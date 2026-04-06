import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function runPluginScaffold(rootDir: string, id: string): void {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
        console.error("id: латиница, цифры, дефис, с буквы");
        process.exit(1);
    }

    const pluginDir = join(rootDir, "plugins", id);
    if (existsSync(pluginDir)) {
        console.error(`Каталог уже есть: plugins/${id}`);
        process.exit(1);
    }

    mkdirSync(join(pluginDir, "views"), { recursive: true });
    mkdirSync(join(pluginDir, "public"), { recursive: true });

    writeFileSync(
        join(pluginDir, "index.ts"),
        `import type { FastifyInstance } from "fastify";
import type { PluginRouteOptions } from "../../core/plugins/types";

export async function registerPublic(
    app: FastifyInstance,
    opts: PluginRouteOptions
) {
    const { id, basePath } = opts;
    app.get("/", async (_req, reply) => {
        return reply.type("text/plain").send(\`Плагин \${id}, база \${basePath}\`);
    });
}

export const meta = {
    name: "${id}",
    description: "",
    version: "0.1.0",
    engine: ">=1.0.0",
};
`
    );

    writeFileSync(join(pluginDir, "public", ".gitkeep"), "");

    console.log(
        `Создан plugins/${id} — добавь schema.ts при необходимости и зарегистрируй таблицы в drizzle.config.`
    );
}

if (import.meta.main) {
    const id = process.argv[2];
    if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
        console.error("Использование: bun run eecli plugin:scaffold <id>");
        console.error("id: латиница, цифры, дефис, с буквы");
        process.exit(1);
    }
    runPluginScaffold(join(import.meta.dirname, ".."), id);
}
