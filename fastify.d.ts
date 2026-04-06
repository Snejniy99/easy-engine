import type { PluginLoaderContext } from "./core/plugins/context";
import type { PluginModule, RegisteredWidget } from "./core/plugins/types";
import type { PanelMenuSectionBuilt } from "./core/panel-menu/build-panel-menu";
import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    pluginHost?: {
      ctx: PluginLoaderContext;
      modules: Map<string, PluginModule>;
      pluginsDir: string;
      registeredIds: Set<string>;
      widgets: RegisteredWidget[];
    };
  }

  interface FastifyReply {
    locals: {
      allPlugins: {
        id: string;
        name: string;
        version?: string;
        hasAppSpace?: boolean;
        hasPublicSpace?: boolean;
        hasAdminSpace?: boolean;
        hideInSidebar?: boolean;
        hideInAppSidebar?: boolean;
        hideInPublicSidebar?: boolean;
        adminMinRole?: "moderator" | "admin";
        enabled?: boolean;
        hasAdminSettings?: boolean;
        hasHomePage?: boolean;
        hasWidgets?: boolean;
        hasWebSocket?: boolean;
        panelMenu?: import("./core/plugins/types").PanelMenuItem[];
        panelMenuSection?: import("./core/plugins/types").PanelMenuSectionId;
        panelMenuBySection?: import("./core/plugins/types").PluginPanelMenuBySection;
      }[];
      panelMenuSections?: PanelMenuSectionBuilt[];
      currentPath: string;
      publicTheme?: "light" | "dark" | "system";
      activeThemeSlug?: string | null;
      themeStyleHref?: string | null;
      csrfToken?: string;
      user?: { id: number; email: string; username?: string; role: string };
      eeWidget?: (key: string) => string;
    };
    viewPlugin(
      pluginId: string,
      template: string,
      data: object
    ): FastifyReply;
    viewPluginPublic(
      pluginId: string,
      template: string,
      data: object
    ): FastifyReply;
    partialViewPlugin(
      pluginId: string,
      template: string,
      data: object
    ): Promise<FastifyReply>;
  }
}
