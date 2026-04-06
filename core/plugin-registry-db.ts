import { inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { pluginRegistry } from "./schema";

export async function hydratePluginEnabledMap(
    db: PostgresJsDatabase<Record<string, unknown>>,
    ids: string[],
    state: Map<string, boolean>
) {
    if (ids.length === 0) return;
    const rows = await db
        .select()
        .from(pluginRegistry)
        .where(inArray(pluginRegistry.pluginId, ids));
    const rowMap = new Map(rows.map((r) => [r.pluginId, r.enabled]));
    for (const id of ids) {
        const v = rowMap.get(id);
        state.set(id, v === undefined ? true : v);
    }
}

export async function upsertPluginRegistryEnabled(
    db: PostgresJsDatabase<Record<string, unknown>>,
    pluginId: string,
    enabled: boolean
) {
    await db
        .insert(pluginRegistry)
        .values({ pluginId, enabled })
        .onConflictDoUpdate({
            target: pluginRegistry.pluginId,
            set: { enabled },
        });
}
