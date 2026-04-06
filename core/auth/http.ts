export function safeNext(raw: unknown): string {
    if (typeof raw !== "string" || raw.length > 512) return "/app";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/app";
    return raw;
}

export function normalizeEmail(email: unknown): string {
    if (typeof email !== "string") return "";
    return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
    return email.length <= 255 && EMAIL_RE.test(email);
}
