import type { FastifyInstance } from "fastify";
import { EE_REL_VIEWS } from "../paths";
import { getLayoutPanelPath } from "../theme/theme-runtime";

export default async function appSpaceRoutes(app: FastifyInstance) {
    app.get("/", async (_req, reply) => {
        return reply.view(
            `${EE_REL_VIEWS}/app/dashboard.ejs`,
            {
                title: "Личный кабинет",
            },
            { layout: getLayoutPanelPath() }
        );
    });
}
