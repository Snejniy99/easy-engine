import type { ReadStream } from "node:fs";

export interface PluginStorage {
    put(key: string, data: Buffer): Promise<{ key: string; size: number }>;
    remove(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    readBuffer(key: string): Promise<Buffer | null>;
    readPath(key: string): Promise<string | null>;
    createReadStream(key: string): Promise<ReadStream | null>;
    list(): Promise<string[]>;
}
