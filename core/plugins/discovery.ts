import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function discoverPluginIds(rootDir: string): string[] {
    const pluginsDir = join(rootDir, "plugins");
    if (!existsSync(pluginsDir)) {
        return [];
    }
    return readdirSync(pluginsDir).filter((folder) => {
        const indexPath = join(pluginsDir, folder, "index.ts");
        return existsSync(indexPath);
    });
}
