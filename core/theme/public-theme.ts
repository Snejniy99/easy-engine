export const PUBLIC_THEME_COOKIE = "ee_public_theme";

export type PublicThemePreference = "light" | "dark" | "system";

const VALID = new Set<string>(["light", "dark", "system"]);

export function parsePublicThemeCookie(
    cookieHeader: string | undefined
): PublicThemePreference {
    if (!cookieHeader) return "system";
    const parts = cookieHeader.split(";");
    for (const part of parts) {
        const idx = part.indexOf("=");
        if (idx === -1) continue;
        const name = part.slice(0, idx).trim();
        if (name !== PUBLIC_THEME_COOKIE) continue;
        let v = part.slice(idx + 1).trim();
        try {
            v = decodeURIComponent(v);
        } catch {
            return "system";
        }
        if (VALID.has(v)) return v as PublicThemePreference;
        return "system";
    }
    return "system";
}

export function serializePublicThemeCookie(value: PublicThemePreference): string {
    return `${PUBLIC_THEME_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function parsePublicThemeBody(raw: unknown): PublicThemePreference | null {
    if (raw !== "light" && raw !== "dark" && raw !== "system") return null;
    return raw;
}

export function safeThemeNext(raw: unknown, fallback: string): string {
    if (typeof raw !== "string" || raw.length > 512) return fallback;
    if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
    if (
        raw === "/" ||
        raw.startsWith("/login") ||
        raw.startsWith("/register") ||
        raw.startsWith("/p/")
    ) {
        return raw;
    }
    return fallback;
}
