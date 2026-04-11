import { posix } from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EE_REL_VIEWS } from "../paths";
import {
    computeActiveThemeSlug,
    resolveThemeLayoutPanelPath,
    resolveThemeLayoutPublicPath,
    resolveThemeViewPath,
    themeStyleHref,
} from "./engine-theme";

let cachedSlug: string | null = null;
let cachedLayoutPublic = posix.join(EE_REL_VIEWS, "layout-public.ejs");
let cachedLayoutPanel = posix.join(EE_REL_VIEWS, "layout.ejs");
let cachedRootDir = "";

export async function refreshThemeRuntime(
    db: PostgresJsDatabase<Record<string, unknown>>,
    rootDir: string
) {
    cachedRootDir = rootDir;
    cachedSlug = await computeActiveThemeSlug(db, rootDir);
    cachedLayoutPublic = resolveThemeLayoutPublicPath(rootDir, cachedSlug);
    cachedLayoutPanel = resolveThemeLayoutPanelPath(rootDir, cachedSlug);
}

export function getActiveThemeSlug(): string | null {
    return cachedSlug;
}

export function getLayoutPublicPath(): string {
    return cachedLayoutPublic;
}

export function getLayoutPanelPath(): string {
    return cachedLayoutPanel;
}

export function getThemeStyleHref(): string | null {
    if (!cachedRootDir) return null;
    return themeStyleHref(cachedRootDir, cachedSlug);
}

export function getThemedViewPath(relativeUnderViews: string): string {
    if (!cachedRootDir) {
        return posix.join(EE_REL_VIEWS, relativeUnderViews);
    }
    return resolveThemeViewPath(
        cachedRootDir,
        cachedSlug,
        relativeUnderViews,
        posix.join(EE_REL_VIEWS, relativeUnderViews)
    );
}
