import type { FastifyInstance } from "fastify";
import { count } from "drizzle-orm";
import { db } from "../db";
import { isAdminRole } from "../auth/access";
import type { PluginInfo } from "../bootstrap/context";
import {
    ensurePluginAdminSettingsDefaults,
    getPluginSetting,
    setPluginSetting,
} from "../plugin-settings";
import { EE_REL_VIEWS } from "../paths";
import { resolvePluginAdminSettings } from "../plugins/admin-settings";
import type { PluginHost } from "../plugins/registers";
import { applyPluginEnabledToggle } from "../plugins/runtime-toggle";
import {
    ACTIVE_THEME_SETTING_KEY,
    getStoredActiveThemeRaw,
    listEngineThemes,
    SITE_SETTINGS_PLUGIN_ID,
} from "../theme/engine-theme";
import {
    getActiveThemeSlug,
    getLayoutPanelPath,
    getThemedViewPath,
    refreshThemeRuntime,
} from "../theme/theme-runtime";
import { users } from "../schema";

const SETTINGS_PLUGINS_PAGE_SIZE = 10;

export default async function adminRoutes(
    app: FastifyInstance,
    opts: { plugins: PluginInfo[]; rootDir: string }
) {
    const { plugins, rootDir } = opts;

    app.get("/", async (_req, reply) => {
        const [userCountRow] = await db.select({ n: count() }).from(users);
        const userCount = userCountRow?.n ?? 0;
        const enabledPlugins = plugins.filter((p: { enabled: boolean }) => p.enabled);

        return reply.view(
            getThemedViewPath("index.ejs"),
            {
                title: "Панель управления",
                plugins: enabledPlugins,
                pluginCount: enabledPlugins.length,
                userCount,
            },
            { layout: getLayoutPanelPath() }
        );
    });

    app.get("/settings", async (req, reply) => {
        const q = req.query as { page?: string };
        const sorted = [...plugins].sort((a: { id: string }, b: { id: string }) =>
            a.id.localeCompare(b.id)
        );
        const totalCount = sorted.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / SETTINGS_PLUGINS_PAGE_SIZE));
        let page = Number(q.page);
        if (!Number.isFinite(page) || page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * SETTINGS_PLUGINS_PAGE_SIZE;
        const pluginsPage = sorted.slice(start, start + SETTINGS_PLUGINS_PAGE_SIZE);
        const rowFrom = totalCount === 0 ? 0 : start + 1;
        const rowTo = Math.min(start + SETTINGS_PLUGINS_PAGE_SIZE, totalCount);
        const engineThemes = listEngineThemes(rootDir);
        const themeStored = await getStoredActiveThemeRaw(db);
        const effSlug = getActiveThemeSlug();
        const effMeta = engineThemes.find((t) => t.slug === effSlug);
        const themeEffectiveLabel = effMeta
            ? `${effMeta.name} (${effSlug})`
            : effSlug
              ? effSlug
              : `встроенные шаблоны ${EE_REL_VIEWS}/`;

        return reply.view(
            getThemedViewPath("settings.ejs"),
            {
                title: "Настройки системы",
                plugins: pluginsPage,
                currentPage: page,
                totalPages,
                totalCount,
                pageSize: SETTINGS_PLUGINS_PAGE_SIZE,
                rowFrom,
                rowTo,
                engineThemes,
                themeStored,
                themeEffectiveLabel,
            },
            { layout: getLayoutPanelPath() }
        );
    });

    app.post("/settings/site-theme", async (req, reply) => {
        const user = req.session.get("user");
        if (!user || !isAdminRole(user.role)) {
            return reply.code(403).send("Только администратор");
        }
        const body = req.body as Record<string, string | undefined>;
        const raw =
            typeof body?.activeTheme === "string" ? body.activeTheme.trim() : "";
        const allowed = new Set(listEngineThemes(rootDir).map((t) => t.slug));
        if (raw !== "" && !allowed.has(raw)) {
            return reply.code(400).send();
        }
        await setPluginSetting(
            db,
            SITE_SETTINGS_PLUGIN_ID,
            ACTIVE_THEME_SETTING_KEY,
            raw
        );
        await refreshThemeRuntime(db, rootDir);
        const pageRaw = body?.page?.trim();
        const pageNum = pageRaw ? Number(pageRaw) : NaN;
        const back =
            Number.isFinite(pageNum) && pageNum >= 1
                ? `/admin/settings?page=${Math.floor(pageNum)}`
                : "/admin/settings";
        return reply.redirect(back);
    });

    app.post("/settings/plugins/toggle", async (req, reply) => {
        const user = req.session.get("user");
        if (!user || !isAdminRole(user.role)) {
            return reply.code(403).send("Только администратор");
        }
        const body = req.body as Record<string, string | undefined>;
        const pluginId = body?.pluginId?.trim();
        const enabled = body?.enabled === "1";
        if (!pluginId || !/^[a-z][a-z0-9-]*$/.test(pluginId)) {
            return reply.code(400).send();
        }
        const host = app.pluginHost;
        if (
            !host ||
            !host.ctx.loadedPlugins.some((p) => p.id === pluginId)
        ) {
            return reply.code(404).send();
        }
        try {
            await applyPluginEnabledToggle(app, host as PluginHost, pluginId, enabled);
        } catch (err) {
            req.log.error(err);
            return reply
                .code(400)
                .type("text/plain; charset=utf-8")
                .send(String(err));
        }
        const pageRaw = body?.page?.trim();
        const pageNum = pageRaw ? Number(pageRaw) : NaN;
        const back =
            Number.isFinite(pageNum) && pageNum >= 1
                ? `/admin/settings?page=${Math.floor(pageNum)}`
                : "/admin/settings";
        return reply.redirect(back);
    });

    app.get("/settings/plugins/:pluginId", async (req, reply) => {
        const user = req.session.get("user");
        if (!user || !isAdminRole(user.role)) {
            return reply.code(403).send("Только администратор");
        }
        const pluginId = (req.params as { pluginId: string }).pluginId;
        if (!/^[a-z][a-z0-9-]*$/.test(pluginId)) {
            return reply.code(400).send();
        }
        const host = app.pluginHost;
        if (!host) {
            return reply.code(404).send();
        }
        const mod = host.modules.get(pluginId);
        if (!mod || !host.ctx.loadedPlugins.some((p) => p.id === pluginId)) {
            return reply.code(404).send();
        }
        const adminFn = mod.registerAdmin ?? mod.default;
        const fields = resolvePluginAdminSettings(mod, adminFn);
        if (fields.length === 0) {
            return reply.code(404).send();
        }
        await ensurePluginAdminSettingsDefaults(db, pluginId, fields);
        const values: Record<string, string> = {};
        for (const f of fields) {
            const v = await getPluginSetting(db, pluginId, f.key);
            values[f.key] = v ?? f.defaultValue;
        }
        const metaName = host.ctx.loadedPlugins.find((p) => p.id === pluginId)
            ?.name;
        return reply.view(
            getThemedViewPath("plugin-admin-settings.ejs"),
            {
                title: `Параметры: ${metaName ?? pluginId}`,
                pluginId,
                pluginName: metaName ?? pluginId,
                fields,
                values,
            },
            { layout: getLayoutPanelPath() }
        );
    });

    app.post("/settings/plugins/:pluginId", async (req, reply) => {
        const user = req.session.get("user");
        if (!user || !isAdminRole(user.role)) {
            return reply.code(403).send("Только администратор");
        }
        const pluginId = (req.params as { pluginId: string }).pluginId;
        if (!/^[a-z][a-z0-9-]*$/.test(pluginId)) {
            return reply.code(400).send();
        }
        const host = app.pluginHost;
        if (!host) {
            return reply.code(404).send();
        }
        const mod = host.modules.get(pluginId);
        if (!mod || !host.ctx.loadedPlugins.some((p) => p.id === pluginId)) {
            return reply.code(404).send();
        }
        const adminFn = mod.registerAdmin ?? mod.default;
        const fields = resolvePluginAdminSettings(mod, adminFn);
        if (fields.length === 0) {
            return reply.code(404).send();
        }
        const body = req.body as Record<string, string | undefined>;
        for (const f of fields) {
            const raw = body[`setting_${f.key}`];
            if (typeof raw !== "string") {
                return reply.code(400).send();
            }
            const t = f.type ?? "text";
            let v = t === "textarea" ? raw : raw.trim();
            if (t === "number") {
                if (v === "") {
                    v = f.defaultValue;
                } else if (!/^-?\d+(\.\d+)?$/.test(v)) {
                    return reply.code(400).send();
                }
            }
            await setPluginSetting(db, pluginId, f.key, v);
        }
        return reply.redirect(`/admin/settings/plugins/${pluginId}`);
    });
}
