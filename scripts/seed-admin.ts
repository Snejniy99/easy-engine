import { eq } from "drizzle-orm";
import { join } from "node:path";
import { hashPassword } from "../core/auth/password";
import { loadCliContext } from "../core/cli/load-context";
import type { CliContext } from "../core/cli/types";
import { users } from "../core/schema";

export async function runSeedAdmin(ctx: CliContext): Promise<void> {
    const emailRaw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!emailRaw || !password) {
        console.error("Укажите ADMIN_EMAIL и ADMIN_PASSWORD (см. env.example)");
        process.exit(1);
    }

    const hashed = await hashPassword(password);

    const [existing] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, emailRaw))
        .limit(1);

    if (existing) {
        await ctx.db
            .update(users)
            .set({ password: hashed, role: "admin" })
            .where(eq(users.id, existing.id));
        console.log("Пароль и роль admin обновлены для", emailRaw);
    } else {
        await ctx.db.insert(users).values({
            email: emailRaw,
            username: emailRaw,
            password: hashed,
            role: "admin",
        });
        console.log("Создан администратор", emailRaw);
    }
}

if (import.meta.main) {
    const rootDir = join(import.meta.dirname, "..");
    const ctx = loadCliContext(rootDir);
    await runSeedAdmin(ctx);
    process.exit(0);
}
