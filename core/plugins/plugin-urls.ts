function joinBaseAndPath(base: string, sub?: string): string {
    if (sub == null || sub === "") return base;
    const s = sub.replace(/^\/+/, "");
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${b}/${s}`;
}

export function pluginAdminUrl(pluginId: string, path?: string): string {
    return joinBaseAndPath(`/admin/${pluginId}`, path);
}

export function pluginAppUrl(pluginId: string, path?: string): string {
    return joinBaseAndPath(`/app/${pluginId}`, path);
}

export function pluginPublicUrl(pluginId: string, path?: string): string {
    return joinBaseAndPath(`/p/${pluginId}`, path);
}

export function pluginStaticUrl(pluginId: string, file: string): string {
    const f = file.replace(/^\/+/, "");
    return `/plugin-static/${pluginId}/${f}`;
}

export type PluginUrlHelpers = {
    admin: (path?: string) => string;
    app: (path?: string) => string;
    public: (path?: string) => string;
    static: (file: string) => string | null;
};

export function createPluginUrlHelpers(
    pluginId: string,
    assetsBase: string | null
): PluginUrlHelpers {
    return {
        admin: (path) => pluginAdminUrl(pluginId, path),
        app: (path) => pluginAppUrl(pluginId, path),
        public: (path) => pluginPublicUrl(pluginId, path),
        static: (file) => {
            if (!assetsBase) return null;
            const f = file.replace(/^\/+/, "");
            return `${assetsBase}${f}`;
        },
    };
}
