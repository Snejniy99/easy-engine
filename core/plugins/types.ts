import type { EventEmitter } from "node:events";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PluginStoredFiles } from "../storage/stored-files";
import type { PluginStorage } from "../storage/types";
import type { PluginUrlHelpers } from "./plugin-urls";
import type { EngineWsApi } from "../ws";

export interface PluginAdminSettingField {
    key: string;
    label: string;
    defaultValue: string;
    description?: string;
    type?: "text" | "textarea" | "number";
}

export interface PluginRouteOptions {
    db: PostgresJsDatabase<Record<string, unknown>>;
    id: string;
    basePath: string;
    events: EventEmitter;
    config: (key: string) => string | undefined;
    settings: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string): Promise<void>;
    };
    assetsBase: string | null;
    storage: PluginStorage;
    storedFiles: PluginStoredFiles;
    urls: PluginUrlHelpers;
    ws: EngineWsApi;
}

export interface PluginLoadContext {
    db: PostgresJsDatabase<Record<string, unknown>>;
    id: string;
    rootDir: string;
    events: EventEmitter;
    config: (key: string) => string | undefined;
    settings: PluginRouteOptions["settings"];
    bases: {
        admin: string | null;
        app: string | null;
        public: string | null;
    };
    assetsBase: string | null;
    storage: PluginStorage;
    storedFiles: PluginStoredFiles;
    urls: PluginUrlHelpers;
    ws: EngineWsApi;
}

export type PluginRouteRegister = (
    app: FastifyInstance,
    opts: PluginRouteOptions
) => void | Promise<void>;

export type PluginHomePageRegister = (
    req: FastifyRequest,
    reply: FastifyReply,
    opts: PluginRouteOptions
) => void | Promise<void>;

export type PanelMenuSectionId = "site" | "public" | "admin" | "system";

export interface PanelMenuItem {
    id: string;
    label: string;
    href?: string;
    children?: PanelMenuItem[];
    minRole?: "user" | "moderator" | "admin";
}

export type PluginPanelMenuBySection = Partial<
    Record<PanelMenuSectionId, PanelMenuItem[]>
>;

export type WidgetSurface = "public-home" | "admin-home" | "app-home";

export interface PluginWidgetDefinition {
    id: string;
    surface: WidgetSurface;
    order?: number;
    render: (
        opts: PluginRouteOptions
    ) => Promise<{ template: string; data: Record<string, unknown> } | null>;
}

export type RegisteredWidget = {
    pluginId: string;
    widgetId: string;
    surface: WidgetSurface;
    order: number;
    render: PluginWidgetDefinition["render"];
};

export interface PluginModule {
    default?: PluginRouteRegister;
    registerAdmin?: PluginRouteRegister;
    registerApp?: PluginRouteRegister;
    registerPublic?: PluginRouteRegister;
    registerWebSocket?: PluginRouteRegister;
    panelMenu?: PanelMenuItem[];
    panelMenuSection?: PanelMenuSectionId;
    panelMenuBySection?: PluginPanelMenuBySection;
    registerHomePage?: PluginHomePageRegister;
    widgets?: PluginWidgetDefinition[];
    adminSettings?: PluginAdminSettingField[];
    onPluginLoad?: (
        app: FastifyInstance,
        ctx: PluginLoadContext
    ) => void | Promise<void>;
    onPluginUnload?: (
        app: FastifyInstance,
        ctx: { id: string }
    ) => void | Promise<void>;
    meta?: {
        name?: string;
        description?: string;
        version?: string;
        icon?: string;
        engine?: string;
        requires?: string[];
        adminMinRole?: "moderator" | "admin";
        hideInSidebar?: boolean;
        hideInAppSidebar?: boolean;
        hideInPublicSidebar?: boolean;
        panelMenu?: PanelMenuItem[];
        panelMenuSection?: PanelMenuSectionId;
        panelMenuBySection?: PluginPanelMenuBySection;
    };
}
