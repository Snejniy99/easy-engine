import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { rotateCsrfToken } from "../auth/csrf";
import { isValidEmail, normalizeEmail, safeNext } from "../auth/http";
import { setSessionUser } from "../auth/session-user";
import { hashPassword, verifyPassword } from "../auth/password";
import { EE_REL_VIEWS } from "../paths";
import { getLayoutPublicPath } from "../theme/theme-runtime";
import { users } from "../schema";

function isUniqueViolation(e: unknown): boolean {
    if (e && typeof e === "object" && "code" in e) {
        if ((e as { code: string }).code === "23505") return true;
    }
    if (
        e &&
        typeof e === "object" &&
        "cause" in e &&
        e.cause &&
        typeof e.cause === "object" &&
        "code" in e.cause
    ) {
        return (e.cause as { code: string }).code === "23505";
    }
    return false;
}

export default async function authRoutes(app: FastifyInstance) {
    await app.register(
        async (r) => {
            await r.register(rateLimit, {
                max: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 40),
                timeWindow: process.env.RATE_LIMIT_AUTH_WINDOW ?? "15 minutes",
            });

            r.post("/login", async (req, reply) => {
                const body = req.body as Record<string, string | undefined>;
                const email = normalizeEmail(body?.email);
                const password =
                    typeof body?.password === "string" ? body.password : "";
                const next = safeNext(body?.next);
                const publicLayout = { layout: getLayoutPublicPath() };

                if (!email || !password) {
                    return reply.view(
                        `${EE_REL_VIEWS}/public/login.ejs`,
                        {
                            title: "Вход",
                            error: "Заполните email и пароль",
                            next: typeof body?.next === "string" ? body.next : "",
                        },
                        publicLayout
                    );
                }

                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email))
                    .limit(1);

                if (
                    !user ||
                    !user.isActive ||
                    !(await verifyPassword(password, user.password))
                ) {
                    return reply.view(
                        `${EE_REL_VIEWS}/public/login.ejs`,
                        {
                            title: "Вход",
                            error: "Неверный email или пароль",
                            next:
                                typeof body?.next === "string" ? body.next : "",
                        },
                        publicLayout
                    );
                }

                setSessionUser(req.session, {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                });
                rotateCsrfToken(req.session);

                return reply.redirect(next);
            });

            r.post("/register", async (req, reply) => {
                const body = req.body as Record<string, string | undefined>;
                const email = normalizeEmail(body?.email);
                const password =
                    typeof body?.password === "string" ? body.password : "";
                const password2 =
                    typeof body?.password_confirm === "string"
                        ? body.password_confirm
                        : "";
                const publicLayout = { layout: getLayoutPublicPath() };

                const renderErr = (error: string) =>
                    reply.view(
                        `${EE_REL_VIEWS}/public/register.ejs`,
                        {
                            title: "Регистрация",
                            error,
                            email:
                                typeof body?.email === "string"
                                    ? body.email
                                    : "",
                        },
                        publicLayout
                    );

                if (!email || !password) {
                    return renderErr("Заполните email и пароль");
                }
                if (!isValidEmail(email)) {
                    return renderErr("Некорректный email");
                }
                if (password.length < 8) {
                    return renderErr("Пароль не короче 8 символов");
                }
                if (password.length > 128) {
                    return renderErr("Пароль слишком длинный");
                }
                if (password !== password2) {
                    return renderErr("Пароли не совпадают");
                }

                const hashed = await hashPassword(password);

                try {
                    await db.insert(users).values({
                        email,
                        username: email,
                        password: hashed,
                    });
                } catch (e: unknown) {
                    if (isUniqueViolation(e)) {
                        return renderErr("Этот email уже зарегистрирован");
                    }
                    throw e;
                }

                return reply.redirect("/login?registered=1");
            });

            r.post("/logout", async (req, reply) => {
                req.session.delete();
                return reply.redirect("/");
            });
        },
        { prefix: "/" }
    );
}
