import type { FastifyInstance } from "fastify";

const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join("; ");

export function registerSecurityHeaders(app: FastifyInstance) {
    app.addHook("onSend", async (_req, reply, payload) => {
        reply.header("Content-Security-Policy", csp);
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        return payload;
    });
}
