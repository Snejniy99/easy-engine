import type { FastifyInstance } from "fastify";
import type {
    PluginPanelMenuBySection,
    PluginRouteOptions,
    PluginWidgetDefinition,
} from "../../core/plugins/types";

export const panelMenuBySection: PluginPanelMenuBySection = {
    site: [
        {
            id: "hub",
            label: "Демо плагина",
            children: [
                { id: "cab", label: "Личный кабинет", href: "/app/example" },
            ],
        },
    ],
    public: [
        {
            id: "proot",
            label: "Демо плагина",
            children: [
                { id: "pub", label: "Публичная страница", href: "/p/example" },
            ],
        },
    ],
    admin: [
        {
            id: "aroot",
            label: "Демо плагина",
            children: [
                {
                    id: "adm",
                    label: "Администрирование",
                    href: "/admin/example",
                },
            ],
        },
    ],
};

export const widgets: PluginWidgetDefinition[] = [
    {
        id: "demo-public",
        surface: "public-home",
        order: 20,
        async render(opts) {
            return {
                template: "widgets/demo-public-home.ejs",
                data: {
                    pluginPublicBase: opts.urls.public(),
                    adminPluginBase: opts.urls.admin(),
                },
            };
        },
    },
    {
        id: "demo-admin",
        surface: "admin-home",
        order: 10,
        async render(opts) {
            return {
                template: "widgets/demo-admin-home.ejs",
                data: {
                    adminBase: opts.urls.admin(),
                },
            };
        },
    },
    {
        id: "demo-app",
        surface: "app-home",
        order: 10,
        async render(opts) {
            return {
                template: "widgets/demo-app-home.ejs",
                data: {
                    appPluginBase: opts.urls.app(),
                },
            };
        },
    },
];

export async function registerAdmin(
    app: FastifyInstance,
    opts: PluginRouteOptions
) {
    const { id, basePath, assetsBase, urls } = opts;

    app.get("/", async (_req, reply) => {
        return reply.viewPlugin(id, "info.ejs", {
            title: "Демо-плагин",
            pluginBase: basePath,
            assetsBase,
            urls,
            appUrl: urls.app(),
            publicUrl: urls.public(),
        });
    });
}

registerAdmin.meta = {
    name: "Демо-плагин",
    description: "Демо-плагин",
    version: "1.0.0",
    icon: "example",
    engine: ">=1.0.0",
};

export async function registerPublic(
    app: FastifyInstance,
    opts: PluginRouteOptions
) {
    const { id, basePath, urls } = opts;

    app.get("/", async (_req, reply) => {
        return reply.viewPluginPublic(id, "public-demo.ejs", {
            title: "Демо: публичная часть",
            pluginBase: basePath,
            adminPluginBase: urls.admin(),
        });
    });
}

export async function registerApp(
    app: FastifyInstance,
    opts: PluginRouteOptions
) {
    const { id, basePath, urls } = opts;

    app.get("/", async (_req, reply) => {
        return reply.viewPlugin(id, "app-demo.ejs", {
            title: "Демо: личный кабинет",
            pluginBase: basePath,
            adminPluginBase: urls.admin(),
        });
    });
}

export default registerAdmin;
