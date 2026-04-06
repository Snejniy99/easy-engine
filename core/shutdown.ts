type UnloadFn = () => void | Promise<void>;

const unloadByPluginId = new Map<string, UnloadFn>();

export function registerPluginUnload(pluginId: string, fn: UnloadFn) {
    unloadByPluginId.set(pluginId, fn);
}

export function unregisterPluginUnload(pluginId: string) {
    unloadByPluginId.delete(pluginId);
}

export async function runUnloads() {
    const entries = [...unloadByPluginId.entries()];
    for (let i = entries.length - 1; i >= 0; i--) {
        const pair = entries[i];
        if (pair) {
            const fn = pair[1];
            if (fn) await fn();
        }
    }
    unloadByPluginId.clear();
}
