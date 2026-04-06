import type {
    PluginAdminSettingField,
    PluginModule,
    PluginRouteRegister,
} from "./types";

const KEY_RE = /^[a-z][a-z0-9_]*$/;

export function resolvePluginAdminSettings(
    mod: PluginModule | undefined,
    adminFn: PluginRouteRegister | undefined
): PluginAdminSettingField[] {
    if (!mod) return [];
    const fromFn = (adminFn as { adminSettings?: PluginAdminSettingField[] })
        ?.adminSettings;
    return mod.adminSettings ?? fromFn ?? [];
}

export function assertValidPluginAdminSettings(
    pluginId: string,
    fields: PluginAdminSettingField[]
) {
    const seen = new Set<string>();
    for (const f of fields) {
        if (!KEY_RE.test(f.key)) {
            throw new Error(
                `Плагин "${pluginId}": недопустимый ключ настройки "${f.key}" (нужен шаблон [a-z][a-z0-9_]*)`
            );
        }
        if (seen.has(f.key)) {
            throw new Error(
                `Плагин "${pluginId}": повтор ключа настройки "${f.key}"`
            );
        }
        seen.add(f.key);
        if (!f.label?.trim()) {
            throw new Error(
                `Плагин "${pluginId}": пустой label для ключа "${f.key}"`
            );
        }
        if (f.defaultValue === undefined || f.defaultValue === null) {
            throw new Error(
                `Плагин "${pluginId}": у ключа "${f.key}" нужен defaultValue (строка)`
            );
        }
        if (typeof f.defaultValue !== "string") {
            throw new Error(
                `Плагин "${pluginId}": defaultValue для "${f.key}" должен быть строкой`
            );
        }
        const t = f.type ?? "text";
        if (t !== "text" && t !== "textarea" && t !== "number") {
            throw new Error(
                `Плагин "${pluginId}": неверный type для "${f.key}"`
            );
        }
    }
}
