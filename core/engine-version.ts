import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { valid } from "semver";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
const v = typeof raw.version === "string" ? raw.version.trim() : "";
export const ENGINE_VERSION = valid(v) ? v : "0.0.0";
