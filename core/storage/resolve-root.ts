import { join } from "node:path";

export function resolveStorageRoot(projectRoot: string): string {
    const raw = process.env.STORAGE_ROOT?.trim();
    if (!raw) {
        return join(projectRoot, "data", "storage");
    }
    if (raw.startsWith("/")) {
        return raw;
    }
    return join(projectRoot, raw);
}
