import "dotenv/config";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { categories, items, users, syncCounter } from "./schema";
import { CATEGORIES, ITEMS } from "@/lib/items.seed";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const now = Date.now();

  // Ensure the monotonic sync counter exists, then read its current value.
  await db.insert(syncCounter).values({ id: 1, value: 0 }).onConflictDoNothing();
  let rev = (await db.select().from(syncCounter).where(eq(syncCounter.id, 1)))[0]?.value ?? 0;
  const nextRev = () => (rev += 1);

  // Categories (idempotent: skip ones that already exist).
  let catAdded = 0;
  for (const c of CATEGORIES) {
    const exists = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, c.id));
    if (exists.length) continue;
    await db.insert(categories).values({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      updatedAt: now,
      serverRev: nextRev(),
      deletedAt: null,
    });
    catAdded += 1;
  }

  // Items (idempotent).
  let itemAdded = 0;
  for (const it of ITEMS) {
    const exists = await db.select({ id: items.id }).from(items).where(eq(items.id, it.id));
    if (exists.length) continue;
    await db.insert(items).values({
      id: it.id,
      name: it.name,
      categoryId: it.categoryId,
      sortOrder: it.sortOrder,
      defaultOpening: 0,
      active: true,
      updatedAt: now,
      serverRev: nextRev(),
      deletedAt: null,
    });
    itemAdded += 1;
  }

  // Admin user from env.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";
  let adminMsg = "skipped (ADMIN_EMAIL/ADMIN_PASSWORD not set)";
  if (email && password) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing.length) {
      adminMsg = `already exists (${email})`;
    } else {
      await db.insert(users).values({
        id: randomUUID(),
        email,
        name,
        passwordHash: await hashPassword(password),
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      adminMsg = `created ${email}`;
    }
  }

  await db.update(syncCounter).set({ value: rev }).where(eq(syncCounter.id, 1));

  console.log(`Seed complete:
  categories: +${catAdded} (of ${CATEGORIES.length})
  items:      +${itemAdded} (of ${ITEMS.length})
  admin:      ${adminMsg}
  server_rev: ${rev}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
