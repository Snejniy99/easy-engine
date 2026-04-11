import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EE_REL_THEMES, EE_REL_VIEWS } from "../paths";
import { getPluginSetting } from "../plugin-settings";

export const SITE_SETTINGS_PLUGIN_ID = "easy_engine";

export const ACTIVE_THEME_SETTING_KEY = "active_theme";

export const LEGACY_THEME_SETTING_KEY = "public_theme";

const SLUG = /^[a-z][a-z0-9-]*$/;

export type EngineThemeMeta = {
    slug: string;
    name: string;
    version: string;
    description: string;
};

function themeJsonPath(rootDir: string, slug: string) {
    return join(rootDir, EE_REL_THEMES, slug, "theme.json");
}

export function isValidThemeSlug(rootDir: string, slug: string): boolean {
    if (!SLUG.test(slug)) return false;
    return existsSync(themeJsonPath(rootDir, slug));
}

export function listEngineThemes(rootDir: string): EngineThemeMeta[] {
    const dir = join(rootDir, EE_REL_THEMES);
    if (!existsSync(dir)) return [];
    const out: EngineThemeMeta[] = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const slug = ent.name;
        if (!SLUG.test(slug)) continue;
        const p = themeJsonPath(rootDir, slug);
        if (!existsSync(p)) continue;
        try {
            const raw = JSON.parse(readFileSync(p, "utf8")) as Record<
                string,
                unknown
            >;
            const name =
                typeof raw.name === "string" && raw.name.length > 0
                    ? raw.name
                    : slug;
            const version =
                typeof raw.version === "string" ? raw.version : "0.0.0";
            const description =
                typeof raw.description === "string" ? raw.description : "";
            const jsSlug =
                typeof raw.slug === "string" && raw.slug.length > 0
                    ? raw.slug
                    : slug;
            if (jsSlug !== slug) continue;
            out.push({ slug, name, version, description });
        } catch {
            continue;
        }
    }
    return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function resolveLayoutRelative(
    rootDir: string,
    activeSlug: string | null,
    file: "layout-public.ejs" | "layout-panel.ejs",
    viewsFallback: string
): string {
    const trySlugs = activeSlug ? [activeSlug, "default"] : ["default"];
    for (const s of trySlugs) {
        if (!SLUG.test(s)) continue;
        const rel = posix.join(EE_REL_THEMES, s, "layouts", file);
        const full = join(rootDir, rel);
        if (existsSync(full)) {
            return rel;
        }
    }
    return viewsFallback;
}

export function resolveThemeLayoutPublicPath(
    rootDir: string,
    activeSlug: string | null
): string {
    return resolveLayoutRelative(
        rootDir,
        activeSlug,
        "layout-public.ejs",
        posix.join(EE_REL_VIEWS, "layout-public.ejs")
    );
}

export function resolveThemeLayoutPanelPath(
    rootDir: string,
    activeSlug: string | null
): string {
    return resolveLayoutRelative(
        rootDir,
        activeSlug,
        "layout-panel.ejs",
        posix.join(EE_REL_VIEWS, "layout.ejs")
    );
}

export function resolveThemeViewPath(
    rootDir: string,
    activeSlug: string | null,
    viewRelativeToViewsDir: string,
    viewsFallback: string
): string {
    const trySlugs = activeSlug ? [activeSlug, "default"] : ["default"];
    for (const s of trySlugs) {
        if (!SLUG.test(s)) continue;
        const rel = posix.join(
            EE_REL_THEMES,
            s,
            "views",
            viewRelativeToViewsDir
        );
        const full = join(rootDir, rel);
        if (existsSync(full)) {
            return rel;
        }
    }
    return viewsFallback;
}

export function themeStyleHref(
    rootDir: string,
    activeSlug: string | null
): string | null {
    if (!activeSlug || !SLUG.test(activeSlug)) return null;
    const f = join(rootDir, EE_REL_THEMES, activeSlug, "public", "style.css");
    if (!existsSync(f)) return null;
    return `/theme-assets/${activeSlug}/style.css`;
}

export async function getStoredActiveThemeRaw(
    db: PostgresJsDatabase<Record<string, unknown>>
): Promise<string> {
    let v = await getPluginSetting(
        db,
        SITE_SETTINGS_PLUGIN_ID,
        ACTIVE_THEME_SETTING_KEY
    );
    let t = (v ?? "").trim();
    if (t === "") {
        v = await getPluginSetting(
            db,
            SITE_SETTINGS_PLUGIN_ID,
            LEGACY_THEME_SETTING_KEY
        );
        t = (v ?? "").trim();
    }
    return t;
}

function envThemeSlug(rootDir: string): string | null {
    const raw =
        process.env.EE_ACTIVE_THEME?.trim() ||
        process.env.EE_PUBLIC_THEME?.trim();
    if (!raw || !SLUG.test(raw)) return null;
    if (!isValidThemeSlug(rootDir, raw)) return null;
    return raw;
}

export async function computeActiveThemeSlug(
    db: PostgresJsDatabase<Record<string, unknown>>,
    rootDir: string
): Promise<string | null> {
    const stored = await getStoredActiveThemeRaw(db);
    if (stored !== "" && isValidThemeSlug(rootDir, stored)) {
        return stored;
    }
    const fromEnv = envThemeSlug(rootDir);
    if (fromEnv) return fromEnv;
    if (isValidThemeSlug(rootDir, "default")) return "default";
    return null;
}
