import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PluginAdminSettingField } from "./plugins/types";
import { pluginSettings } from "./schema";

export async function getPluginSetting(
    db: PostgresJsDatabase<Record<string, unknown>>,
    pluginId: string,
    key: string
): Promise<string | null> {
    const [row] = await db
        .select()
        .from(pluginSettings)
        .where(
            and(
                eq(pluginSettings.pluginId, pluginId),
                eq(pluginSettings.key, key)
            )
        )
        .limit(1);
    return row?.value ?? null;
}

export async function setPluginSetting(
    db: PostgresJsDatabase<Record<string, unknown>>,
    pluginId: string,
    key: string,
    value: string
): Promise<void> {
    await db
        .insert(pluginSettings)
        .values({ pluginId, key, value })
        .onConflictDoUpdate({
            target: [pluginSettings.pluginId, pluginSettings.key],
            set: { value, updatedAt: new Date() },
        });
}

export async function ensurePluginAdminSettingsDefaults(
    db: PostgresJsDatabase<Record<string, unknown>>,
    pluginId: string,
    fields: PluginAdminSettingField[]
) {
    for (const f of fields) {
        const cur = await getPluginSetting(db, pluginId, f.key);
        if (cur === null) {
            await setPluginSetting(db, pluginId, f.key, f.defaultValue);
        }
    }
}
