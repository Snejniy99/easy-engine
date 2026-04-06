import dotenv from "dotenv";
import { createConfiguredApp } from "./core/cli/create-configured-app";
import { runUnloads } from "./core/shutdown";

dotenv.config();

const rootDir = import.meta.dirname;

const app = await createConfiguredApp({
    rootDir,
    logger: true,
});

const port = Number(process.env.PORT) || 3000;

try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 CMS готова: http://localhost:${port}`);
} catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "EADDRINUSE") {
        console.error(`❌ Порт ${process.env.PORT} уже занят другим процессом!`);
        process.exit(1);
    }
    app.log.error(err);
}

let closing = false;
async function shutdown() {
    if (closing) return;
    closing = true;
    try {
        await runUnloads();
        await app.close();
    } finally {
        process.exit(0);
    }
}

process.on("SIGINT", () => {
    void shutdown();
});

process.on("SIGTERM", () => {
    void shutdown();
});
