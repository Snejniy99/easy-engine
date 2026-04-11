import type { FastifyInstance } from "fastify";
import { getLayoutPanelPath, getThemedViewPath } from "../theme/theme-runtime";

export default async function appSpaceRoutes(app: FastifyInstance) {
    app.get("/", async (_req, reply) => {
        return reply.view(
            getThemedViewPath("app/dashboard.ejs"),
            {
                title: "Личный кабинет",
            },
            { layout: getLayoutPanelPath() }
        );
    });
}
