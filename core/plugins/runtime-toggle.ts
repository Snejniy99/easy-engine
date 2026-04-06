import type { FastifyInstance } from "fastify";
import { upsertPluginRegistryEnabled } from "../plugin-registry-db";
import { unregisterPluginUnload } from "../shutdown";
import type { PluginHost } from "./registers";
import { registerSinglePluginRuntime } from "./registers";

export async function applyPluginEnabledToggle(
    app: FastifyInstance,
    host: PluginHost,
    pluginId: string,
    enabled: boolean
) {
    const mod = host.modules.get(pluginId);
    if (!mod) {
        throw new Error("Неизвестный плагин");
    }
    if (enabled) {
        for (const r of mod.meta?.requires ?? []) {
            if (host.ctx.pluginEnabledState.get(r) === false) {
                throw new Error(`Сначала включите зависимость: ${r}`);
            }
        }
    }

    await upsertPluginRegistryEnabled(host.ctx.db, pluginId, enabled);
    host.ctx.pluginEnabledState.set(pluginId, enabled);
    const info = host.ctx.loadedPlugins.find((p) => p.id === pluginId);
    if (info) info.enabled = enabled;

    if (!enabled) {
        const fn = mod.onPluginUnload;
        if (fn) await fn(app, { id: pluginId });
        unregisterPluginUnload(pluginId);
        return;
    }

    await registerSinglePluginRuntime(app, host, pluginId);
}
