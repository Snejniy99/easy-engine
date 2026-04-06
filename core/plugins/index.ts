import { mkdirSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { resolveStorageRoot } from "../storage";
import { discoverPluginIds } from "./discovery";
import { registerPluginModules } from "./registers";
import { registerPluginHooks } from "./hooks";
import type { PluginLoaderContext, PluginLoaderInput } from "./context";

export type { PluginLoaderContext, PluginLoaderInput } from "./context";
export type {
    PanelMenuItem,
    PanelMenuSectionId,
    PluginPanelMenuBySection,
    PluginAdminSettingField,
    PluginHomePageRegister,
    PluginLoadContext,
    PluginModule,
    PluginRouteOptions,
    PluginRouteRegister,
    PluginWidgetDefinition,
    RegisteredWidget,
    WidgetSurface,
} from "./types";

export { appEvents } from "../events";
export { pluginEnv } from "./env-config";
export { ENGINE_VERSION } from "../engine-version";
export type { PluginStorage } from "../storage/types";
export type { PluginStoredFiles, StoredFileSaved } from "../storage/stored-files";
export type { PluginUrlHelpers } from "./plugin-urls";
export {
    createPluginUrlHelpers,
    pluginAdminUrl,
    pluginAppUrl,
    pluginPublicUrl,
    pluginStaticUrl,
} from "./plugin-urls";
export type {
    EngineWsApi,
    WsClientPublishGuard,
    WsConnectionMeta,
    WsPublishFilter,
    WsPublishListener,
} from "../ws";

export async function setupPlugins(
    app: FastifyInstance,
    ctx: PluginLoaderInput
) {
    const storageRoot = resolveStorageRoot(ctx.rootDir);
    mkdirSync(storageRoot, { recursive: true });
    const pluginIds = discoverPluginIds(ctx.rootDir);
    registerPluginHooks(app, ctx);
    await registerPluginModules(
        app,
        { ...ctx, storageRoot },
        pluginIds
    );
}
