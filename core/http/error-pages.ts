import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getLayoutPublicPath, getThemedViewPath } from "../theme/theme-runtime";

function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

function acceptsHtml(req: FastifyRequest): boolean {
    const a = req.headers.accept ?? "";
    if (a.includes("text/html")) return true;
    if (a.includes("application/json") && !a.includes("text/html")) {
        return false;
    }
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("application/json")) return false;
    return req.method === "GET" || req.method === "HEAD";
}

type ErrorLike = Error & {
    statusCode?: number;
    validation?: unknown;
    validationContext?: string;
};

function asErrorLike(error: unknown): ErrorLike {
    if (error instanceof Error) {
        return error as ErrorLike;
    }
    const e = new Error(
        typeof error === "string" ? error : JSON.stringify(error)
    );
    return e as ErrorLike;
}

function resolveStatusCode(error: ErrorLike): number {
    return typeof error.statusCode === "number" && error.statusCode >= 400
        ? error.statusCode
        : 500;
}

function productionUserLine(statusCode: number): string {
    if (statusCode === 404) {
        return "Такой страницы нет или ссылка устарела.";
    }
    if (statusCode >= 500) {
        return "На сервере произошла ошибка. Попробуйте позже.";
    }
    return "Запрос не может быть выполнен.";
}

function replyJson(
    reply: FastifyReply,
    statusCode: number,
    body: Record<string, unknown>
) {
    return reply.code(statusCode).send(body);
}

async function replyPublicErrorPage(
    reply: FastifyReply,
    data: {
        title: string;
        statusCode: number;
        isNotFound: boolean;
        showDetails: boolean;
        userLine: string;
        techMessage: string;
        stack: string;
        requestPath: string;
        validationJson: string;
    }
) {
    return reply.code(data.statusCode).view(
        getThemedViewPath("public/error.ejs"),
        data,
        { layout: getLayoutPublicPath() }
    );
}

export function registerErrorPages(app: FastifyInstance) {
    app.setErrorHandler(async (raw, req, reply) => {
        const error = asErrorLike(raw);
        const statusCode = resolveStatusCode(error);
        if (statusCode >= 500) {
            req.log.error({ err: error }, error.message);
        } else {
            req.log.warn({ err: error }, error.message);
        }

        const prod = isProduction();

        if (acceptsHtml(req)) {
            const showDetails = !prod;
            const isNotFound = statusCode === 404;
            const title =
                statusCode === 404
                    ? "Страница не найдена"
                    : `Ошибка ${statusCode}`;
            const userLine = showDetails
                ? error.message || "Неизвестная ошибка"
                : productionUserLine(statusCode);
            let validationJson = "";
            if (showDetails && error.validation !== undefined) {
                try {
                    validationJson = JSON.stringify(error.validation, null, 2);
                } catch {
                    validationJson = String(error.validation);
                }
            }
            return replyPublicErrorPage(reply, {
                title,
                statusCode,
                isNotFound,
                showDetails,
                userLine,
                techMessage: error.message || "",
                stack: error.stack ?? "",
                requestPath: req.url,
                validationJson,
            });
        }

        if (prod && statusCode >= 500) {
            return replyJson(reply, statusCode, {
                statusCode,
                error: "Internal Server Error",
                message: "На сервере произошла ошибка.",
            });
        }

        const body: Record<string, unknown> = {
            statusCode,
            error: error.name || "Error",
            message: error.message,
        };
        if (!prod && error.stack) {
            body.stack = error.stack;
        }
        if (error.validation !== undefined) {
            body.validation = error.validation;
        }
        if (error.validationContext) {
            body.validationContext = error.validationContext;
        }
        return replyJson(reply, statusCode, body);
    });

    app.setNotFoundHandler(async (req, reply) => {
        if (acceptsHtml(req)) {
            const showDetails = !isProduction();
            const userLine = showDetails
                ? `Маршрут не найден: ${req.method} ${req.url}`
                : productionUserLine(404);
            return replyPublicErrorPage(reply, {
                title: "Страница не найдена",
                statusCode: 404,
                isNotFound: true,
                showDetails,
                userLine,
                techMessage: "Not Found",
                stack: "",
                requestPath: req.url,
                validationJson: "",
            });
        }
        if (isProduction()) {
            return replyJson(reply, 404, {
                statusCode: 404,
                error: "Not Found",
                message: "Ресурс не найден.",
            });
        }
        return replyJson(reply, 404, {
            statusCode: 404,
            error: "Not Found",
            message: `Маршрут ${req.method} ${req.url} не найден`,
        });
    });
}
