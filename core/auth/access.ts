export function requestPath(url: string): string {
    const q = url.indexOf("?");
    return q === -1 ? url : url.slice(0, q);
}

export function isPublicPath(path: string): boolean {
    if (path.startsWith("/public")) return true;
    if (path.startsWith("/plugin-static/")) return true;
    if (path.startsWith("/p/")) return true;
    if (path === "/logout") return true;
    if (path === "/" || path === "/login" || path === "/register") return true;
    if (path === "/theme") return true;
    return false;
}

export function isAppSpace(path: string): boolean {
    return path === "/app" || path.startsWith("/app/");
}

export function isAdminSpace(path: string): boolean {
    return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminSettingsPath(path: string): boolean {
    return path === "/admin/settings" || path.startsWith("/admin/settings/");
}

export function canAccessAdminPanel(role: string): boolean {
    return role === "moderator" || role === "admin";
}

export function isAdminRole(role: string): boolean {
    return role === "admin";
}

export function pathPluginId(path: string): string | null {
    if (path.startsWith("/admin/")) {
        const seg = path.slice(7).split("/")[0];
        if (!seg || seg === "settings") return null;
        return seg;
    }
    if (path.startsWith("/app/")) {
        const seg = path.slice(5).split("/")[0];
        return seg || null;
    }
    if (path.startsWith("/p/")) {
        const seg = path.slice(3).split("/")[0];
        return seg || null;
    }
    if (path.startsWith("/plugin-static/")) {
        const seg = path.slice(17).split("/")[0];
        return seg || null;
    }
    return null;
}

export function adminPluginIdFromPath(path: string): string | null {
    if (!path.startsWith("/admin/")) return null;
    return pathPluginId(path);
}
