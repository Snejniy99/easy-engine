import type { FastifyInstance } from "fastify";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
    canAccessAdminPanel,
    isAdminRole,
} from "../auth/access";
import type { PluginInfo } from "../bootstrap/context";
import { createLocalPluginStorage } from "../storage";
import {
    getStoredFileRowByPublicId,
    isValidStoredFilePublicId,
} from "../storage/stored-files";

export function registerStoredFileRoute(
    app: FastifyInstance,
    opts: {
        db: PostgresJsDatabase<Record<string, unknown>>;
        storageRoot: string;
        getPlugins: () => PluginInfo[];
        getPluginEnabled: (pluginId: string) => boolean;
    }
) {
    const { db, storageRoot, getPlugins, getPluginEnabled } = opts;

    app.get("/storage/file/:publicId", async (req, reply) => {
        const publicId = (req.params as { publicId: string }).publicId;
        if (!isValidStoredFilePublicId(publicId)) {
            return reply.code(404).send();
        }
        const row = await getStoredFileRowByPublicId(db, publicId);
        if (!row) {
            return reply.code(404).send();
        }
        if (!getPluginEnabled(row.pluginId)) {
            return reply.code(404).send();
        }
        const user = req.session.get("user");
        if (!user) {
            return reply.redirect(`/login?next=${encodeURIComponent(req.url)}`);
        }
        if (!canAccessAdminPanel(user.role)) {
            return reply.code(403).send();
        }
        const info = getPlugins().find((p) => p.id === row.pluginId);
        if (!info?.hasAdminSpace) {
            return reply.code(403).send();
        }
        if (info.adminMinRole === "admin" && !isAdminRole(user.role)) {
            return reply.code(403).send();
        }
        const storage = createLocalPluginStorage(storageRoot, row.pluginId);
        const stream = await storage.createReadStream(row.storageKey);
        if (!stream) {
            return reply.code(404).send();
        }
        const asciiName = row.originalName.replace(/[^\x20-\x7E]/g, "_");
        reply.header(
            "Content-Disposition",
            `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`
        );
        return reply.type(row.mimeType).send(stream);
    });
}
