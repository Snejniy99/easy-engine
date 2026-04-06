const SEG = /^[a-zA-Z0-9._-]+$/;

export function sanitizeStorageKey(raw: string): string {
    const s = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!s) {
        throw new Error("storage: пустой ключ");
    }
    const parts = s.split("/").filter(Boolean);
    if (parts.length > 48) {
        throw new Error("storage: слишком длинный путь");
    }
    for (const p of parts) {
        if (p === "." || p === "..") {
            throw new Error("storage: недопустимый сегмент пути");
        }
        if (p.length > 240) {
            throw new Error("storage: слишком длинное имя сегмента");
        }
        if (!SEG.test(p)) {
            throw new Error("storage: недопустимые символы в ключе");
        }
    }
    return parts.join("/");
}
