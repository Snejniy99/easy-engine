import type { EngineWsHub } from "../ws/hub";
import type {
    PanelMenuItem,
    PanelMenuSectionId,
    PluginPanelMenuBySection,
} from "../plugins/types";

export interface PluginInfo {
    id: string;
    name: string;
    description?: string;
    version?: string;
    icon?: string;
    hasAppSpace?: boolean;
    hasPublicSpace?: boolean;
    hasAdminSpace?: boolean;
    adminMinRole?: "moderator" | "admin";
    hideInSidebar?: boolean;
    hideInAppSidebar?: boolean;
    hideInPublicSidebar?: boolean;
    enabled: boolean;
    hasAdminSettings?: boolean;
    hasHomePage?: boolean;
    hasWidgets?: boolean;
    hasWebSocket?: boolean;
    panelMenu?: PanelMenuItem[];
    panelMenuSection?: PanelMenuSectionId;
    panelMenuBySection?: PluginPanelMenuBySection;
}

export interface BootstrapContext {
    rootDir: string;
    loadedPlugins: PluginInfo[];
    pluginEnabledState: Map<string, boolean>;
    wsHub: EngineWsHub;
}
