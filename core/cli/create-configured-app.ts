import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { setupBootstrap, type PluginInfo } from "../bootstrap";
import { EngineWsHub } from "../ws/hub";
import { registerStoredFileRoute } from "../routes/stored-file";
import { resolveStorageRoot } from "../storage";
import { refreshThemeRuntime } from "../theme/theme-runtime";
import { setupPlugins } from "../plugins";
import { registerErrorPages } from "../http/error-pages";

export async function createConfiguredApp(options: {
    rootDir: string;
    logger?: boolean;
}): Promise<FastifyInstance> {
    const app = Fastify({
        logger: options.logger ?? false,
    });
    const loadedPlugins: PluginInfo[] = [];
    const pluginEnabledState = new Map<string, boolean>();
    const wsHub = new EngineWsHub();
    const { rootDir } = options;

    await refreshThemeRuntime(db, rootDir);

    await setupBootstrap(app, {
        rootDir,
        loadedPlugins,
        pluginEnabledState,
        wsHub,
    });

    await setupPlugins(app, {
        rootDir,
        loadedPlugins,
        db,
        pluginEnabledState,
        wsHub,
    });

    registerStoredFileRoute(app, {
        db,
        storageRoot: resolveStorageRoot(rootDir),
        getPlugins: () => loadedPlugins,
        getPluginEnabled: (pluginId) =>
            pluginEnabledState.get(pluginId) !== false,
    });

    registerErrorPages(app);

    return app;
}
