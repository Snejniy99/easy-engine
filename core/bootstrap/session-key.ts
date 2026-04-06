const KEY_BYTES = 32;

export function resolveSessionKey(): Buffer {
    const raw = process.env.SESSION_KEY?.trim();
    if (!raw) {
        return Buffer.from("a".repeat(KEY_BYTES));
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }

    const fromB64 = Buffer.from(raw, "base64");
    if (fromB64.length === KEY_BYTES) {
        return fromB64;
    }

    const fromUtf8 = Buffer.from(raw, "utf8");
    if (fromUtf8.length === KEY_BYTES) {
        return fromUtf8;
    }

    throw new Error(
        "SESSION_KEY: нужно ровно 32 байта. Варианты: 64 hex (openssl rand -hex 32), base64 от 32 байт (openssl rand -base64 32), или ASCII-строка из 32 символов."
    );
}
