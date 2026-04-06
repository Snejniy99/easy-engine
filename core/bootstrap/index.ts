import type { FastifyInstance } from "fastify";
import { appEvents } from "../events";
import type { BootstrapContext } from "./context";
import { registerSessionViewAdmin, registerFormbodyStatic } from "./registers";
import { registerReplyDecorators } from "./replies";
import { registerSecurityHeaders } from "./security-headers";
import { registerHooks } from "./hooks";

export type { BootstrapContext, PluginInfo } from "./context";

export async function setupBootstrap(app: FastifyInstance, ctx: BootstrapContext) {
    appEvents.setEventLogger(app.log);
    registerSecurityHeaders(app);
    await registerSessionViewAdmin(app, ctx);
    registerReplyDecorators(app, ctx);
    registerHooks(app, ctx);
    await registerFormbodyStatic(app, ctx);
}
