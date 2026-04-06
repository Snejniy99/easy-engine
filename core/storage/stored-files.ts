import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { pluginStoredFiles } from "../schema";
import type { PluginStorage } from "./types";

export type StoredFileSaved = {
    publicId: string;
    href: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
};

export type PluginStoredFiles = {
    save(input: {
        data: Buffer;
        originalName: string;
        mimeType: string;
    }): Promise<StoredFileSaved>;
    listRecent(limit: number): Promise<StoredFileSaved[]>;
    appendUtf8(
        publicId: string,
        text: string
    ): Promise<{ sizeBytes: number } | null>;
    remove(publicId: string): Promise<boolean>;
};

const PUBLIC_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidStoredFilePublicId(id: string): boolean {
    return PUBLIC_ID_RE.test(id);
}

function trimMeta(
    originalName: string,
    mimeType: string
): { originalName: string; mimeType: string } {
    const base = originalName
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        ?.trim() ?? "file";
    const name =
        base.length > 512 ? `${base.slice(0, 508)}…` : base || "file";
    const mime = mimeType.trim().slice(0, 255) || "application/octet-stream";
    return { originalName: name, mimeType: mime };
}

function storageExtensionSuffix(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot <= 0 || lastDot >= fileName.length - 1) return "";
    const ext = fileName.slice(lastDot + 1).toLowerCase();
    if (!/^[a-z0-9]{1,16}$/.test(ext)) return "";
    return `.${ext}`;
}

function hrefFor(publicId: string): string {
    return `/storage/file/${publicId}`;
}

export function createPluginStoredFiles(
    db: PostgresJsDatabase<Record<string, unknown>>,
    pluginId: string,
    storage: PluginStorage
): PluginStoredFiles {
    return {
        async save(input) {
            const { originalName, mimeType } = trimMeta(
                input.originalName,
                input.mimeType
            );
            const publicId = randomUUID();
            const storageKey = `objects/${publicId}${storageExtensionSuffix(originalName)}`;
            await storage.put(storageKey, input.data);
            const sizeBytes = input.data.length;
            let createdAt: Date;
            try {
                const [row] = await db
                    .insert(pluginStoredFiles)
                    .values({
                        publicId,
                        pluginId,
                        storageKey,
                        originalName,
                        mimeType,
                        sizeBytes,
                    })
                    .returning({ createdAt: pluginStoredFiles.createdAt });
                if (!row) {
                    await storage.remove(storageKey);
                    throw new Error("plugin_stored_files insert");
                }
                createdAt = row.createdAt ?? new Date();
            } catch (e) {
                await storage.remove(storageKey);
                throw e;
            }
            return {
                publicId,
                href: hrefFor(publicId),
                originalName,
                mimeType,
                sizeBytes,
                createdAt,
            };
        },

        async listRecent(limit) {
            const rows = await db
                .select()
                .from(pluginStoredFiles)
                .where(eq(pluginStoredFiles.pluginId, pluginId))
                .orderBy(desc(pluginStoredFiles.createdAt))
                .limit(limit);
            return rows.map((r) => ({
                publicId: r.publicId,
                href: hrefFor(r.publicId),
                originalName: r.originalName,
                mimeType: r.mimeType,
                sizeBytes: r.sizeBytes,
                createdAt: r.createdAt ?? new Date(),
            }));
        },

        async appendUtf8(publicId, text) {
            if (!isValidStoredFilePublicId(publicId)) return null;
            const [row] = await db
                .select({
                    id: pluginStoredFiles.id,
                    storageKey: pluginStoredFiles.storageKey,
                })
                .from(pluginStoredFiles)
                .where(
                    and(
                        eq(pluginStoredFiles.publicId, publicId),
                        eq(pluginStoredFiles.pluginId, pluginId)
                    )
                )
                .limit(1);
            if (!row) return null;
            const prev = (await storage.readBuffer(row.storageKey)) ?? Buffer.alloc(0);
            const chunk = Buffer.from(text, "utf8");
            const next = Buffer.concat([prev, chunk]);
            await storage.put(row.storageKey, next);
            await db
                .update(pluginStoredFiles)
                .set({ sizeBytes: next.length })
                .where(eq(pluginStoredFiles.id, row.id));
            return { sizeBytes: next.length };
        },

        async remove(publicId) {
            if (!isValidStoredFilePublicId(publicId)) return false;
            const [row] = await db
                .select({
                    id: pluginStoredFiles.id,
                    storageKey: pluginStoredFiles.storageKey,
                })
                .from(pluginStoredFiles)
                .where(
                    and(
                        eq(pluginStoredFiles.publicId, publicId),
                        eq(pluginStoredFiles.pluginId, pluginId)
                    )
                )
                .limit(1);
            if (!row) return false;
            await storage.remove(row.storageKey);
            await db
                .delete(pluginStoredFiles)
                .where(eq(pluginStoredFiles.id, row.id));
            return true;
        },
    };
}

export async function getStoredFileRowByPublicId(
    db: PostgresJsDatabase<Record<string, unknown>>,
    publicId: string
) {
    const [row] = await db
        .select()
        .from(pluginStoredFiles)
        .where(eq(pluginStoredFiles.publicId, publicId))
        .limit(1);
    return row ?? null;
}
