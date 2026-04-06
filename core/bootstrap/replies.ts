import type { FastifyInstance } from "fastify";
import ejs from "ejs";
import { join } from "node:path";
import type { BootstrapContext } from "./context";
import { getLayoutPanelPath, getLayoutPublicPath } from "../theme/theme-runtime";

export function registerReplyDecorators(
    app: FastifyInstance,
    ctx: BootstrapContext
) {
    const rootDir = ctx.rootDir;

    app.decorateReply(
        "viewPlugin",
        function (this: any, pluginId: string, template: string, data: any) {
            const pluginTemplatePath = `plugins/${pluginId}/views/${template}`;
            return this.view(pluginTemplatePath, data, {
                layout: getLayoutPanelPath(),
            });
        }
    );

    app.decorateReply(
        "viewPluginPublic",
        function (this: any, pluginId: string, template: string, data: any) {
            const pluginTemplatePath = `plugins/${pluginId}/views/${template}`;
            return this.view(pluginTemplatePath, data, {
                layout: getLayoutPublicPath(),
            });
        }
    );

    app.decorateReply(
        "partialViewPlugin",
        async function (this: any, pluginId: string, template: string, data: any) {
            const file = join(rootDir, "plugins", pluginId, "views", template);
            const html = await ejs.renderFile(file, {
                ...(this.locals ?? {}),
                ...data,
            });
            return this.type("text/html; charset=utf-8").send(html);
        }
    );
}
