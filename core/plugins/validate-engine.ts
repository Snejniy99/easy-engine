import { satisfies, validRange } from "semver";
import { ENGINE_VERSION } from "../engine-version";

export function assertPluginEngine(
    pluginId: string,
    range: string | undefined
): void {
    if (range == null || range.trim() === "") return;
    const r = range.trim();
    if (validRange(r) === null) {
        throw new Error(
            `Плагин "${pluginId}": неверный meta.engine "${range}" (ожидается semver range)`
        );
    }
    if (!satisfies(ENGINE_VERSION, r, { includePrerelease: true })) {
        throw new Error(
            `Плагин "${pluginId}" требует engine ${r}, версия движка ${ENGINE_VERSION}`
        );
    }
}
