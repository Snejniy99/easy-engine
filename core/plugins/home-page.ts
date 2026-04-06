import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makePluginRouteOptions } from "./registers";
import type { PluginHost } from "./registers";

export function pickHomePagePluginId(host: PluginHost): string | null {
    for (const p of host.ctx.loadedPlugins) {
        if (p.enabled === false) continue;
        const m = host.modules.get(p.id);
        if (m?.registerHomePage) return p.id;
    }
    return null;
}

export async function tryServePluginHomePage(
    app: FastifyInstance,
    req: FastifyRequest,
    reply: FastifyReply
): Promise<boolean> {
    const host = app.pluginHost;
    if (!host) return false;
    const id = pickHomePagePluginId(host);
    if (!id) return false;
    const mod = host.modules.get(id);
    if (!mod?.registerHomePage) return false;
    const opts = makePluginRouteOptions(
        host.ctx,
        host.pluginsDir,
        id,
        `/p/${id}`
    );
    await mod.registerHomePage(req, reply, opts);
    return true;
}
