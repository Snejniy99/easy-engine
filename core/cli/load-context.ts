import dotenv from "dotenv";
import { db } from "../db";
import type { CliContext } from "./types";

export function loadCliContext(rootDir: string): CliContext {
    dotenv.config({ path: `${rootDir}/.env` });
    return { rootDir, db };
}
