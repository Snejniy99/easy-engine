import type { FastifyInstance } from "fastify";
import {
    adminPluginIdFromPath,
    canAccessAdminPanel,
    isAdminRole,
    isAdminSettingsPath,
    isAdminSpace,
    isAppSpace,
    isPublicPath,
    pathPluginId,
    requestPath,
} from "../auth/access";
import {
    csrfMustValidate,
    ensureCsrfToken,
    validateCsrf,
} from "../auth/csrf";
import type { BootstrapContext } from "./context";
import { buildPanelMenuSections } from "../panel-menu/build-panel-menu";
import {
    buildWidgetHtmlMap,
    createEeWidget,
} from "../plugins/widgets-runtime";
import type { WidgetSurface } from "../plugins/types";
import { getActiveThemeSlug, getThemeStyleHref } from "../theme/theme-runtime";
import { parsePublicThemeCookie } from "../theme/public-theme";

function eeWidgetNoop(): (raw: string) => string {
    return () => "";
}

function widgetSurfaceForPath(path: string): WidgetSurface | null {
    if (path.startsWith("/public") || path.startsWith("/plugin-static/")) {
        return null;
    }
    if (isPublicPath(path)) return "public-home";
    if (isAppSpace(path)) return "app-home";
    if (isAdminSpace(path)) return "admin-home";
    return null;
}

export function registerHooks(app: FastifyInstance, ctx: BootstrapContext) {
    app.addHook("preHandler", async (req, reply) => {
        const path = requestPath(req.url);
        const assetReq =
            path.startsWith("/public/") || path.startsWith("/plugin-static/");
        reply.locals = {
            allPlugins: ctx.loadedPlugins,
            currentPath: path,
            csrfToken: assetReq ? "" : ensureCsrfToken(req.session),
            publicTheme: parsePublicThemeCookie(req.headers.cookie),
            activeThemeSlug: getActiveThemeSlug(),
            themeStyleHref: getThemeStyleHref(),
        };
    });

    app.addHook("preHandler", async (req, reply) => {
        const path = requestPath(req.url);
        const pid = pathPluginId(path);
        if (pid && ctx.pluginEnabledState.get(pid) === false) {
            return reply
                .code(404)
                .type("text/plain; charset=utf-8")
                .send("Модуль отключён");
        }
    });

    app.addHook("preHandler", async (req, reply) => {
        const path = requestPath(req.url);
        if (csrfMustValidate(req.method, path) && !validateCsrf(req)) {
            return reply.code(403).type("text/plain; charset=utf-8").send("CSRF");
        }
    });

    app.addHook("preHandler", async (req, reply) => {
        const user = req.session.get("user");
        const path = requestPath(req.url);

        if (isPublicPath(path)) {
            reply.locals.user = user;
            return;
        }

        if (isAppSpace(path) || isAdminSpace(path)) {
            if (!user) {
                const next = encodeURIComponent(path);
                return reply.redirect(`/login?next=${next}`);
            }
            if (isAdminSpace(path)) {
                if (!canAccessAdminPanel(user.role)) {
                    return reply.code(403).send("Недостаточно прав для администрирования");
                }
                const pluginId = adminPluginIdFromPath(path);
                if (pluginId) {
                    const info = ctx.loadedPlugins.find((p) => p.id === pluginId);
                    if (
                        info?.adminMinRole === "admin" &&
                        !isAdminRole(user.role)
                    ) {
                        return reply
                            .code(403)
                            .send("Доступ только для администраторов");
                    }
                }
                if (isAdminSettingsPath(path) && !isAdminRole(user.role)) {
                    return reply
                        .code(403)
                        .send("Доступ только для администраторов");
                }
            }
            reply.locals.user = user;
            reply.locals.panelMenuSections = buildPanelMenuSections(
                user.role,
                path,
                ctx.loadedPlugins
            );
            return;
        }

        reply.locals.user = user;
    });

    app.addHook("preHandler", async (req, reply) => {
        reply.locals.eeWidget = eeWidgetNoop();
        if (reply.sent) return;
        const path = requestPath(req.url);
        const surface = widgetSurfaceForPath(path);
        if (!surface) return;
        const host = app.pluginHost;
        if (!host) return;
        const map = await buildWidgetHtmlMap(surface, host, {
            ...(reply.locals as Record<string, unknown>),
        });
        reply.locals.eeWidget = createEeWidget(map);
    });
}
