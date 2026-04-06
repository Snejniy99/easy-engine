import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import {
    ensurePluginAdminSettingsDefaults,
    getPluginSetting,
    setPluginSetting,
} from "../plugin-settings";
import { appEvents } from "../events";
import { hydratePluginEnabledMap } from "../plugin-registry-db";
import type { PluginLoaderContext } from "./context";
import { pluginEnv } from "./env-config";
import { createLocalPluginStorage } from "../storage";
import { createPluginStoredFiles } from "../storage/stored-files";
import { registerPluginUnload } from "../shutdown";
import { sortPluginIdsByRequires } from "./sort-deps";
import {
    assertValidPluginAdminSettings,
    resolvePluginAdminSettings,
} from "./admin-settings";
import { createPluginUrlHelpers } from "./plugin-urls";
import { createWsApi } from "../ws";
import type {
    PluginModule,
    PluginRouteOptions,
    PluginRouteRegister,
    RegisteredWidget,
} from "./types";
import { assertPluginEngine } from "./validate-engine";
import type { PluginInfo } from "../bootstrap/context";

const WIDGET_ID_RE = /^[a-z][a-z0-9-]*$/;

function resolveMeta(
    folder: string,
    mod: PluginModule,
    adminFn: PluginRouteRegister | undefined
) {
    const fromFn = (adminFn as { meta?: PluginModule["meta"] })?.meta;
    return (
        mod.meta ??
        fromFn ?? {
            name: folder,
            description: "Описание не указано",
            version: "0.0.1",
        }
    );
}

function buildPluginInfo(
    folder: string,
    pluginModule: PluginModule,
    adminFn: PluginRouteRegister | undefined,
    enabled: boolean
): PluginInfo {
    const meta = resolveMeta(folder, pluginModule, adminFn);
    return {
        id: folder,
        name: meta.name ?? folder,
        description: meta.description,
        version: meta.version,
        icon: meta.icon,
        hasAppSpace: Boolean(pluginModule.registerApp),
        hasPublicSpace: Boolean(pluginModule.registerPublic),
        hasAdminSpace: Boolean(adminFn),
        adminMinRole: meta.adminMinRole ?? "moderator",
        hideInSidebar: Boolean(meta.hideInSidebar),
        hideInAppSidebar: Boolean(meta.hideInAppSidebar),
        hideInPublicSidebar: Boolean(meta.hideInPublicSidebar),
        enabled,
        hasAdminSettings:
            resolvePluginAdminSettings(pluginModule, adminFn).length > 0,
        hasHomePage: Boolean(pluginModule.registerHomePage),
        hasWidgets: Boolean(pluginModule.widgets?.length),
        hasWebSocket: Boolean(pluginModule.registerWebSocket),
        panelMenu: pluginModule.panelMenu ?? meta.panelMenu,
        panelMenuSection:
            pluginModule.panelMenuSection ?? meta.panelMenuSection,
        panelMenuBySection:
            pluginModule.panelMenuBySection ?? meta.panelMenuBySection,
    };
}

export function makePluginRouteOptions(
    ctx: PluginLoaderContext,
    pluginsDir: string,
    folder: string,
    basePath: string
): PluginRouteOptions {
    const pluginRoot = join(pluginsDir, folder);
    const pluginPublicDir = join(pluginRoot, "public");
    const assetsBase = existsSync(pluginPublicDir)
        ? `/plugin-static/${folder}/`
        : null;
    const storage = createLocalPluginStorage(ctx.storageRoot, folder);
    const storedFiles = createPluginStoredFiles(ctx.db, folder, storage);
    return {
        db: ctx.db,
        id: folder,
        basePath,
        events: appEvents,
        config: (key: string) => pluginEnv(folder, key),
        settings: {
            get: (key: string) => getPluginSetting(ctx.db, folder, key),
            set: (key: string, value: string) =>
                setPluginSetting(ctx.db, folder, key, value),
        },
        assetsBase,
        storage,
        storedFiles,
        urls: createPluginUrlHelpers(folder, assetsBase),
        ws: createWsApi(ctx.wsHub),
    };
}

export async function registerPluginRoutes(
    app: FastifyInstance,
    ctx: PluginLoaderContext,
    folder: string,
    pluginModule: PluginModule,
    pluginsDir: string,
    widgetsSink?: RegisteredWidget[]
) {
    const adminFn =
        pluginModule.registerAdmin ?? pluginModule.default ?? undefined;
    const pluginRoot = join(pluginsDir, folder);
    const pluginPublicDir = join(pluginRoot, "public");
    const assetsBase = existsSync(pluginPublicDir)
        ? `/plugin-static/${folder}/`
        : null;

    if (assetsBase) {
        await app.register(fastifyStatic, {
            root: pluginPublicDir,
            prefix: assetsBase,
            decorateReply: false,
        });
    }

    const sharedSettings = {
        get: (key: string) => getPluginSetting(ctx.db, folder, key),
        set: (key: string, value: string) =>
            setPluginSetting(ctx.db, folder, key, value),
    };

    const baseRouteOpts = makePluginRouteOptions(
        ctx,
        pluginsDir,
        folder,
        `/p/${folder}`
    );
    const routeOpts = (basePath: string) => ({ ...baseRouteOpts, basePath });

    if (adminFn) {
        await app.register(adminFn, {
            prefix: `/admin/${folder}`,
            ...routeOpts(`/admin/${folder}`),
        });
    }

    if (pluginModule.registerApp) {
        await app.register(pluginModule.registerApp, {
            prefix: `/app/${folder}`,
            ...routeOpts(`/app/${folder}`),
        });
    }

    if (pluginModule.registerPublic) {
        await app.register(pluginModule.registerPublic, {
            prefix: `/p/${folder}`,
            ...routeOpts(`/p/${folder}`),
        });
    }

    if (pluginModule.registerWebSocket) {
        const wsOpts = makePluginRouteOptions(
            ctx,
            pluginsDir,
            folder,
            `/ws/plugins/${folder}`
        );
        await app.register(
            async (inner) => {
                await pluginModule.registerWebSocket!(inner, wsOpts);
            },
            { prefix: `/ws/plugins/${folder}` }
        );
    }

    if (pluginModule.onPluginLoad) {
        await pluginModule.onPluginLoad(app, {
            db: ctx.db,
            id: folder,
            rootDir: pluginRoot,
            events: appEvents,
            config: (key: string) => pluginEnv(folder, key),
            settings: sharedSettings,
            bases: {
                admin: adminFn ? `/admin/${folder}` : null,
                app: pluginModule.registerApp ? `/app/${folder}` : null,
                public: pluginModule.registerPublic ? `/p/${folder}` : null,
            },
            assetsBase,
            storage: baseRouteOpts.storage,
            storedFiles: baseRouteOpts.storedFiles,
            urls: baseRouteOpts.urls,
            ws: baseRouteOpts.ws,
        });
    }

    if (pluginModule.onPluginUnload) {
        const unload = pluginModule.onPluginUnload;
        registerPluginUnload(folder, () => unload(app, { id: folder }));
    }

    await ensurePluginAdminSettingsDefaults(
        ctx.db,
        folder,
        resolvePluginAdminSettings(pluginModule, adminFn)
    );

    if (widgetsSink && pluginModule.widgets?.length) {
        const seenIds = new Set<string>();
        for (const w of pluginModule.widgets) {
            if (typeof w.id !== "string" || !WIDGET_ID_RE.test(w.id)) {
                throw new Error(
                    `Плагин "${folder}": у виджета задан некорректный id "${String(w.id)}" (нужен slug: a-z, цифры, дефис)`
                );
            }
            if (seenIds.has(w.id)) {
                throw new Error(
                    `Плагин "${folder}": повторяется id виджета "${w.id}"`
                );
            }
            seenIds.add(w.id);
            widgetsSink.push({
                pluginId: folder,
                widgetId: w.id,
                surface: w.surface,
                order: w.order ?? 100,
                render: w.render,
            });
        }
    }

    app.log.info(`Plugin ${folder} routes registered`);
}

export type PluginHost = {
    ctx: PluginLoaderContext;
    modules: Map<string, PluginModule>;
    pluginsDir: string;
    registeredIds: Set<string>;
    widgets: RegisteredWidget[];
};

export async function registerPluginModules(
    app: FastifyInstance,
    ctx: PluginLoaderContext,
    pluginIds: string[]
) {
    const pluginsDir = join(ctx.rootDir, "plugins");
    const modules = new Map<string, PluginModule>();

    for (const folder of pluginIds) {
        const indexPath = join(pluginsDir, folder, "index.ts");
        modules.set(folder, (await import(indexPath)) as PluginModule);
    }

    await hydratePluginEnabledMap(ctx.db, pluginIds, ctx.pluginEnabledState);

    let ordered: string[];
    try {
        ordered = sortPluginIdsByRequires(pluginIds, (id) => {
            const m = modules.get(id);
            return m?.meta?.requires ?? [];
        });
    } catch (e) {
        app.log.error(e);
        throw e;
    }

    const isOn = (id: string) => ctx.pluginEnabledState.get(id) !== false;

    for (const folder of ordered) {
        const pluginModule = modules.get(folder)!;
        const adminFn =
            pluginModule.registerAdmin ?? pluginModule.default ?? undefined;
        assertPluginEngine(folder, resolveMeta(folder, pluginModule, adminFn).engine);
        assertValidPluginAdminSettings(
            folder,
            resolvePluginAdminSettings(pluginModule, adminFn)
        );
    }

    ctx.loadedPlugins.length = 0;
    for (const folder of ordered) {
        const pluginModule = modules.get(folder)!;
        const adminFn =
            pluginModule.registerAdmin ?? pluginModule.default ?? undefined;
        const enabled = isOn(folder);
        ctx.loadedPlugins.push(
            buildPluginInfo(folder, pluginModule, adminFn, enabled)
        );
    }

    for (const folder of ordered) {
        if (!isOn(folder)) continue;
        const pluginModule = modules.get(folder)!;
        const reqs = pluginModule.meta?.requires ?? [];
        for (const r of reqs) {
            if (ctx.pluginEnabledState.get(r) === false) {
                throw new Error(
                    `Включённый плагин "${folder}" требует отключённый "${r}"`
                );
            }
        }
    }

    const registeredIds = new Set<string>();
    const widgets: RegisteredWidget[] = [];

    for (const folder of ordered) {
        if (!isOn(folder)) continue;
        const pluginModule = modules.get(folder)!;
        try {
            await registerPluginRoutes(
                app,
                ctx,
                folder,
                pluginModule,
                pluginsDir,
                widgets
            );
            registeredIds.add(folder);
        } catch (err) {
            app.log.error({ err }, `Plugin ${folder} registration failed`);
            throw err;
        }
    }

    const widgetKeys = new Set<string>();
    for (const w of widgets) {
        const k = `${w.pluginId}:${w.widgetId}`;
        if (widgetKeys.has(k)) {
            throw new Error(`Повтор виджета в реестре: ${k}`);
        }
        widgetKeys.add(k);
    }

    const host: PluginHost = { ctx, modules, pluginsDir, registeredIds, widgets };
    const homeClaimers = ctx.loadedPlugins.filter(
        (p) =>
            p.enabled !== false &&
            Boolean(modules.get(p.id)?.registerHomePage)
    );
    if (homeClaimers.length > 1) {
        app.log.warn(
            `Несколько плагинов объявили registerHomePage (${homeClaimers.map((c) => c.id).join(", ")}); главная — у первого в порядке загрузки: ${homeClaimers[0]!.id}`
        );
    }
    app.decorate("pluginHost", host);
}

export async function registerSinglePluginRuntime(
    app: FastifyInstance,
    host: PluginHost,
    pluginId: string
) {
    if (host.registeredIds.has(pluginId)) return;
    const mod = host.modules.get(pluginId);
    if (!mod) throw new Error(`Неизвестный плагин: ${pluginId}`);
    await registerPluginRoutes(
        app,
        host.ctx,
        pluginId,
        mod,
        host.pluginsDir,
        host.widgets
    );
    host.registeredIds.add(pluginId);
}
