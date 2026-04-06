import type { PluginInfo } from "../bootstrap/context";
import {
    isAdminSettingsPath,
    pathPluginId,
    requestPath,
} from "../auth/access";
import type { PanelMenuItem, PanelMenuSectionId } from "../plugins/types";

function pathFromHref(href: string): string {
    const raw = href.trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const u = new URL(raw);
            const p = u.pathname.replace(/\/$/, "") || "/";
            return p;
        } catch {
            return "/";
        }
    }
    return requestPath(raw).replace(/\/$/, "") || "/";
}

export function inferMenuSectionFromHref(href: string): PanelMenuSectionId | null {
    const path = pathFromHref(href);
    if (path === "/" || path === "/app" || path.startsWith("/app/")) {
        return "site";
    }
    if (path === "/p" || path.startsWith("/p/")) {
        return "public";
    }
    if (isAdminSettingsPath(path)) {
        return "system";
    }
    if (path === "/admin" || path.startsWith("/admin/")) {
        return "admin";
    }
    return null;
}

export function inferMenuMinRoleFromHref(
    href: string,
    plugins: PluginInfo[]
): PanelMenuItem["minRole"] | undefined {
    const path = pathFromHref(href);
    if (isAdminSettingsPath(path)) {
        return "admin";
    }
    if (path === "/admin" || path.startsWith("/admin/")) {
        const pid = pathPluginId(path);
        if (pid) {
            const plugin = plugins.find((x) => x.id === pid);
            return plugin?.adminMinRole ?? "moderator";
        }
        return "moderator";
    }
    return undefined;
}

export function firstHrefInTree(item: PanelMenuItem): string | undefined {
    if (item.href) {
        return item.href;
    }
    for (const c of item.children ?? []) {
        const h = firstHrefInTree(c);
        if (h) {
            return h;
        }
    }
    return undefined;
}

export function inferMenuSectionForSubtree(
    item: PanelMenuItem,
    fallback: PanelMenuSectionId
): PanelMenuSectionId {
    const href = item.href ?? firstHrefInTree(item);
    if (!href) {
        return fallback;
    }
    return inferMenuSectionFromHref(href) ?? fallback;
}

export function enrichMenuTreeWithCoreMeta(
    item: PanelMenuItem,
    plugins: PluginInfo[]
): PanelMenuItem {
    const children = item.children?.map((c) =>
        enrichMenuTreeWithCoreMeta(c, plugins)
    );
    const minRole = item.href
        ? inferMenuMinRoleFromHref(item.href, plugins)
        : item.minRole;
    return { ...item, minRole, children };
}
