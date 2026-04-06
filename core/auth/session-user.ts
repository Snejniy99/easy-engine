import type { FastifyRequest } from "fastify";

export type SessionUser = {
    id: number;
    email: string;
    username: string;
    role: string;
};

export function setSessionUser(
    session: FastifyRequest["session"],
    user: SessionUser
) {
    (session as { set(key: string, value: SessionUser | undefined): void }).set(
        "user",
        user
    );
}
