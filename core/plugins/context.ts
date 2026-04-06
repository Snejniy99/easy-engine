import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { BootstrapContext } from "../bootstrap/context";

export interface PluginLoaderInput extends BootstrapContext {
    db: PostgresJsDatabase<Record<string, unknown>>;
}

export interface PluginLoaderContext extends PluginLoaderInput {
    storageRoot: string;
}
