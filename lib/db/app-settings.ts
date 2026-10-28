import { eq } from "drizzle-orm";
import { db } from "./client";
import { appSettings } from "./schema";

// Well-known setting keys.
export const REOPEN_PASSWORD_HASH = "reopen_password_hash";

export async function getSetting(key: string): Promise<string | null> {
  const row = (await db.select().from(appSettings).where(eq(appSettings.key, key)))[0];
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const now = Date.now();
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}
