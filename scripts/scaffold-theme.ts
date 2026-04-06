import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EE_REL_THEMES } from "../core/paths";

export function runThemeScaffold(rootDir: string, id: string): void {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
        console.error("slug: латиница, цифры, дефис, с буквы");
        process.exit(1);
    }

    const destDir = join(rootDir, EE_REL_THEMES, id);
    const defaultDir = join(rootDir, EE_REL_THEMES, "default");

    if (existsSync(destDir)) {
        console.error(`Каталог уже есть: ${EE_REL_THEMES}/${id}`);
        process.exit(1);
    }
    if (!existsSync(defaultDir)) {
        console.error(
            `Нет эталона ${EE_REL_THEMES}/default — восстановите репозиторий.`
        );
        process.exit(1);
    }

    mkdirSync(destDir, { recursive: true });
    cpSync(join(defaultDir, "layouts"), join(destDir, "layouts"), {
        recursive: true,
    });

    const themeJson = {
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
        version: "1.0.0",
        description: "",
        slug: id,
    };
    writeFileSync(
        join(destDir, "theme.json"),
        JSON.stringify(themeJson, null, 2) + "\n",
        "utf8"
    );

    console.log(`Создан ${EE_REL_THEMES}/${id} на основе default.`);
    console.log(
        `Активация: Настройки системы → Тема, или EE_ACTIVE_THEME=${id}`
    );
}

if (import.meta.main) {
    const id = process.argv[2];
    if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
        console.error("Использование: bun run eecli theme:scaffold <slug>");
        console.error("slug: латиница, цифры, дефис, с буквы");
        process.exit(1);
    }
    runThemeScaffold(join(import.meta.dirname, ".."), id);
}
