import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SEG = /^[a-z][a-z0-9-]*$/;

function parseSegments(raw: string): string[] | null {
    const t = raw.trim().replace(/\\/g, "/");
    const parts = (t.includes(":")
        ? t.split(":")
        : t.split("/")
    )
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0) return null;
    for (const p of parts) {
        if (!SEG.test(p)) return null;
    }
    return parts;
}

export function runCommandScaffold(rootDir: string, raw: string): void {
    const segments = parseSegments(raw);
    if (!segments) {
        console.error(
            "Имя: foo:bar или foo/bar — сегменты из латиницы, цифр, дефиса, с буквы"
        );
        process.exit(1);
    }

    const commandName = segments.join(":");
    const fileName = `${segments[segments.length - 1]}.ts`;
    const dirParts = segments.slice(0, -1);
    const filePath = join(rootDir, "cli", "commands", ...dirParts, fileName);
    const relDisplay = join("cli", "commands", ...dirParts, fileName).replace(
        /\\/g,
        "/"
    );

    if (existsSync(filePath)) {
        console.error(`Файл уже есть: ${relDisplay}`);
        process.exit(1);
    }

    mkdirSync(dirname(filePath), { recursive: true });

    const upLevels = 1 + segments.length;
    const importCore = `${"../".repeat(upLevels)}core/cli/types`;

    writeFileSync(
        filePath,
        `import type { CliContext } from "${importCore}";

const cmd = {
    name: "${commandName}",
    description: "",
    async run(ctx: CliContext, args: string[]) {
        console.log(ctx.rootDir, args);
    },
};

export default cmd;
`,
        "utf8"
    );

    console.log(`Создан ${relDisplay} — eecli ${commandName}`);
}

if (import.meta.main) {
    const raw = process.argv[2];
    if (!raw) {
        console.error("Использование: bun run eecli command:scaffold <foo:bar>");
        console.error("Пример: bun run eecli command:scaffold reports:stats");
        process.exit(1);
    }
    runCommandScaffold(join(import.meta.dirname, ".."), raw);
}
