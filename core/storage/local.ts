import { createReadStream } from "node:fs";
import {
    access,
    mkdir,
    readdir,
    readFile,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { sanitizeStorageKey } from "./sanitize";
import type { PluginStorage } from "./types";

export function createLocalPluginStorage(
    backendRoot: string,
    pluginId: string
): PluginStorage {
    const base = join(backendRoot, pluginId);

    function resolve(key: string) {
        const k = sanitizeStorageKey(key);
        return { abs: join(base, k), key: k };
    }

    async function walk(dir: string, rel: string): Promise<string[]> {
        let names: string[];
        try {
            names = await readdir(dir);
        } catch {
            return [];
        }
        const out: string[] = [];
        for (const name of names) {
            const r = rel ? `${rel}/${name}` : name;
            const full = join(dir, name);
            let st;
            try {
                st = await stat(full);
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                out.push(...(await walk(full, r)));
            } else if (st.isFile()) {
                out.push(r);
            }
        }
        return out;
    }

    return {
        async put(key, data) {
            const { abs, key: k } = resolve(key);
            await mkdir(dirname(abs), { recursive: true });
            await writeFile(abs, data);
            return { key: k, size: data.length };
        },

        async remove(key) {
            const { abs } = resolve(key);
            try {
                await rm(abs, { force: true });
            } catch {
                return;
            }
        },

        async exists(key) {
            const { abs } = resolve(key);
            try {
                await access(abs);
                const s = await stat(abs);
                return s.isFile();
            } catch {
                return false;
            }
        },

        async readBuffer(key) {
            const { abs } = resolve(key);
            try {
                return await readFile(abs);
            } catch {
                return null;
            }
        },

        async readPath(key) {
            const { abs } = resolve(key);
            try {
                const s = await stat(abs);
                if (!s.isFile()) return null;
                return abs;
            } catch {
                return null;
            }
        },

        async createReadStream(key) {
            const { abs } = resolve(key);
            try {
                const s = await stat(abs);
                if (!s.isFile()) return null;
                return createReadStream(abs);
            } catch {
                return null;
            }
        },

        async list() {
            return walk(base, "");
        },
    };
}
