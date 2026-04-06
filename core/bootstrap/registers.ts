import type { FastifyInstance } from "fastify";
import secureSession from "@fastify/secure-session";
import view from "@fastify/view";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import ejs from "ejs";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import adminRoutes from "../routes/admin";
import appSpaceRoutes from "../routes/app";
import authRoutes from "../routes/auth";
import publicRoutes from "../routes/public";
import { EE_REL_THEMES } from "../paths";
import type { BootstrapContext } from "./context";
import { resolveSessionKey } from "./session-key";
import { registerEngineWebSocket } from "../ws/register";

export async function registerSessionViewAdmin(
    app: FastifyInstance,
    ctx: BootstrapContext
) {
    await app.register(secureSession, {
        key: resolveSessionKey(),
        cookie: {
            path: "/",
            httpOnly: true,
        },
    });

    await app.register(formbody);

    await app.register(view, {
        engine: { ejs },
        root: ctx.rootDir,
    });

    await app.register(publicRoutes);
    await app.register(authRoutes);
    await app.register(appSpaceRoutes, { prefix: "/app" });
    await app.register(adminRoutes, {
        prefix: "/admin",
        plugins: ctx.loadedPlugins,
        rootDir: ctx.rootDir,
    });

    await registerEngineWebSocket(app, ctx.wsHub);
}

export async function registerFormbodyStatic(
    app: FastifyInstance,
    ctx: BootstrapContext
) {
    await app.register(fastifyStatic, {
        root: join(ctx.rootDir, "public"),
        prefix: "/public/",
    });
    const themesRoot = join(ctx.rootDir, EE_REL_THEMES);
    if (existsSync(themesRoot)) {
        for (const ent of readdirSync(themesRoot, { withFileTypes: true })) {
            if (!ent.isDirectory()) continue;
            const pub = join(themesRoot, ent.name, "public");
            if (!existsSync(pub)) continue;
            await app.register(fastifyStatic, {
                root: pub,
                prefix: `/theme-assets/${ent.name}/`,
                decorateReply: false,
            });
        }
    }
}

