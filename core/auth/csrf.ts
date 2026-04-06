import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";

const KEY = "_csrf";

type RawSession = {
    get(key: string): unknown;
    set(key: string, value: string): void;
};

function raw(session: FastifyRequest["session"]): RawSession {
    return session as unknown as RawSession;
}

export function ensureCsrfToken(session: FastifyRequest["session"]): string {
    const cur = raw(session).get(KEY);
    if (typeof cur === "string" && cur.length > 0) return cur;
    const t = randomBytes(24).toString("base64url");
    raw(session).set(KEY, t);
    return t;
}

export function rotateCsrfToken(session: FastifyRequest["session"]) {
    const t = randomBytes(24).toString("base64url");
    raw(session).set(KEY, t);
}

export function csrfMustValidate(method: string, path: string): boolean {
    const m = method.toUpperCase();
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
    if (path.startsWith("/public/") || path.startsWith("/plugin-static/"))
        return false;
    return true;
}

export function validateCsrf(req: FastifyRequest): boolean {
    const expected = raw(req.session).get(KEY);
    if (typeof expected !== "string" || !expected) return false;
    const body = req.body as Record<string, unknown> | undefined;
    const fromBody =
        body && typeof body._csrf === "string" ? body._csrf : undefined;
    const h = req.headers["x-csrf-token"];
    const fromHeader = typeof h === "string" ? h : undefined;
    const sent = fromBody ?? fromHeader;
    return typeof sent === "string" && sent.length > 0 && sent === expected;
}
