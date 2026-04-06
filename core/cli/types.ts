import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type CliContext = {
    rootDir: string;
    db: PostgresJsDatabase<Record<string, unknown>>;
};

export type CliUserCommand = {
    name: string;
    description?: string;
    run: (ctx: CliContext, args: string[]) => void | Promise<void>;
};
