export function pluginEnv(pluginId: string, key: string): string | undefined {
    const pid = pluginId.toUpperCase().replace(/-/g, "_");
    const k = key.toUpperCase().replace(/-/g, "_");
    return process.env[`PLUGIN_${pid}_${k}`];
}
