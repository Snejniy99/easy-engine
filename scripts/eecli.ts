import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { createConfiguredApp } from "../core/cli/create-configured-app";
import { loadCliContext } from "../core/cli/load-context";
import type { CliUserCommand } from "../core/cli/types";
import { ENGINE_VERSION } from "../core/engine-version";
import { runUnloads } from "../core/shutdown";
import { runCommandScaffold } from "./scaffold-command";
import { runPluginScaffold } from "./scaffold-plugin";
import { runSeedAdmin } from "./seed-admin";
import { runThemeScaffold } from "./scaffold-theme";

config({ path: join(import.meta.dirname, "..", ".env") });

const rootDir = join(import.meta.dirname, "..");
const commandsRoot = join(rootDir, "cli", "commands");

const pkg = JSON.parse(
    readFileSync(join(rootDir, "package.json"), "utf-8")
) as { version?: string };

const RESERVED = new Set([
    "routes:list",
    "seed:admin",
    "plugin:scaffold",
    "theme:scaffold",
    "command:scaffold",
    "list",
]);

function pathToCommandName(relPath: string): string {
    const noExt = relPath.replace(/\.ts$/i, "");
    const parts = noExt.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0]!;
    return parts.join(":");
}

function discoverCliCommandFiles(commandsRootDir: string): {
    commandName: string;
    filePath: string;
    relPath: string;
}[] {
    if (!existsSync(commandsRootDir)) {
        return [];
    }
    const files: { rel: string; full: string }[] = [];
    function walk(dir: string): void {
        for (const name of readdirSync(dir)) {
            if (name.startsWith(".")) continue;
            const full = join(dir, name);
            const st = statSync(full);
            if (st.isDirectory()) {
                walk(full);
            } else if (name.endsWith(".ts")) {
                files.push({
                    rel: relative(commandsRootDir, full).replace(/\\/g, "/"),
                    full,
                });
            }
        }
    }
    walk(commandsRootDir);
    return files.map(({ rel, full }) => ({
        commandName: pathToCommandName(rel),
        filePath: full,
        relPath: rel,
    }));
}

const program = new Command();

program
    .name("eecli")
    .description("Утилиты Easy Engine (команды в стиле foo:bar)")
    .version(`${pkg.version ?? "?"} (engine ${ENGINE_VERSION})`, "-V, --version");

function addBuiltinRoutesList(): void {
    program.addCommand(
        new Command("routes:list")
            .description("Дерево зарегистрированных маршрутов Fastify")
            .action(async () => {
                const app = await createConfiguredApp({ rootDir, logger: false });
                console.log(app.printRoutes({ commonPrefix: false }));
                await runUnloads();
                await app.close();
            })
    );
}

function addBuiltinSeedAdmin(): void {
    program.addCommand(
        new Command("seed:admin")
            .description(
                "Создать или обновить администратора (ADMIN_EMAIL, ADMIN_PASSWORD)"
            )
            .action(async () => {
                const ctx = loadCliContext(rootDir);
                await runSeedAdmin(ctx);
            })
    );
}

function addBuiltinPluginScaffold(): void {
    program.addCommand(
        new Command("plugin:scaffold")
            .description("Создать каталог plugins/<id> с заготовкой")
            .argument("<id>", "идентификатор плагина")
            .action((id: string) => {
                runPluginScaffold(rootDir, id);
            })
    );
}

function addBuiltinThemeScaffold(): void {
    program.addCommand(
        new Command("theme:scaffold")
            .description("Создать тему на основе default")
            .argument("<id>", "slug темы")
            .action((id: string) => {
                runThemeScaffold(rootDir, id);
            })
    );
}

function addBuiltinCommandScaffold(): void {
    program.addCommand(
        new Command("command:scaffold")
            .description("Создать cli/commands/foo/bar.ts → eecli foo:bar")
            .argument("<name>", "foo:bar или foo/bar")
            .action((name: string) => {
                runCommandScaffold(rootDir, name);
            })
    );
}

function addBuiltinList(): void {
    program.addCommand(
        new Command("list")
            .alias("ls")
            .description("Список команд (то же, что в eecli --help)")
            .action(() => {
                printCommandsHelp();
            })
    );
}

function printCommandsHelp(): void {
    const cmds = [...program.commands].sort((a, b) =>
        a.name().localeCompare(b.name(), "ru")
    );
    for (const c of cmds) {
        const n = c.name();
        if (n === "help") continue;
        const desc = c.description() || "";
        const args = c.registeredArguments
            .filter((a) => a.required || a.description)
            .map((a) =>
                a.required ? `<${a.name()}>` : `[${a.name()}]`
            )
            .join(" ");
        const head = args ? `${n} ${args}` : n;
        console.log(`${head.padEnd(40)} ${desc}`);
    }
}

async function addUserCommands(): Promise<void> {
    const discovered = discoverCliCommandFiles(commandsRoot);
    const sorted = [...discovered].sort((a, b) =>
        a.commandName.localeCompare(b.commandName, "ru")
    );
    const seen = new Set<string>();
    for (const { commandName, filePath, relPath } of sorted) {
        if (!commandName || seen.has(commandName)) continue;
        seen.add(commandName);
        if (RESERVED.has(commandName)) {
            console.warn(
                `eecli: пропуск cli/commands — имя «${commandName}» зарезервировано (${relPath})`
            );
            continue;
        }
        const mod = (await import(pathToFileURL(filePath).href)) as {
            default?: CliUserCommand;
            cliCommand?: CliUserCommand;
        };
        const raw = mod.default ?? mod.cliCommand;
        if (!raw || typeof raw.run !== "function") {
            console.warn(
                `eecli: пропуск ${relPath} — нужен export default { run } или cliCommand`
            );
            continue;
        }
        const desc =
            typeof raw.description === "string"
                ? raw.description
                : `cli/commands/${relPath.replace(/\.ts$/i, "")}`;
        program.addCommand(
            new Command(commandName)
                .description(desc)
                .argument("[args...]", "аргументы")
                .allowUnknownOption(true)
                .action(async (args: string[] | undefined) => {
                    const ctx = loadCliContext(rootDir);
                    await raw.run(ctx, args ?? []);
                })
        );
    }
}

addBuiltinRoutesList();
addBuiltinSeedAdmin();
addBuiltinPluginScaffold();
addBuiltinThemeScaffold();
addBuiltinCommandScaffold();
addBuiltinList();

await addUserCommands();

program.configureHelp({
    sortSubcommands: true,
});

program.parse();
