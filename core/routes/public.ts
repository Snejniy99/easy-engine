import type { FastifyInstance } from "fastify";
import {
    parsePublicThemeBody,
    safeThemeNext,
    serializePublicThemeCookie,
} from "../theme/public-theme";
import { EE_REL_VIEWS } from "../paths";
import { tryServePluginHomePage } from "../plugins/home-page";
import { getLayoutPublicPath } from "../theme/theme-runtime";

export default async function publicRoutes(app: FastifyInstance) {
    app.post("/theme", async (req, reply) => {
        const body = req.body as Record<string, string | undefined>;
        const theme = parsePublicThemeBody(body?.theme);
        if (theme === null) {
            return reply.code(400).send();
        }
        const next = safeThemeNext(body?.next, "/");
        reply.header("Set-Cookie", serializePublicThemeCookie(theme));
        return reply.redirect(next);
    });

    app.get("/", async (req, reply) => {
        if (await tryServePluginHomePage(app, req, reply)) return;
        return reply.view(
            `${EE_REL_VIEWS}/public/home.ejs`,
            { title: "Easy Engine" },
            { layout: getLayoutPublicPath() }
        );
    });

    app.get("/login", async (req, reply) => {
        const user = req.session.get("user");
        if (user) {
            return reply.redirect("/app");
        }
        const q = req.query as { next?: string; registered?: string };
        const next = typeof q.next === "string" ? q.next : "";
        const registered = q.registered === "1";
        return reply.view(
            `${EE_REL_VIEWS}/public/login.ejs`,
            { title: "Вход", error: undefined, next, registered },
            { layout: getLayoutPublicPath() }
        );
    });

    app.get("/register", async (req, reply) => {
        const user = req.session.get("user");
        if (user) {
            return reply.redirect("/app");
        }
        return reply.view(
            `${EE_REL_VIEWS}/public/register.ejs`,
            {
                title: "Регистрация",
                error: undefined,
                email: "",
            },
            { layout: getLayoutPublicPath() }
        );
    });
}
