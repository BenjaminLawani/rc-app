import { gt, eq } from "drizzle-orm";
import { db } from "./client";
import { categories, items, stockSessions, stockEntries, syncCounter } from "./schema";
import type { PullResponse, PullRow, PushOp } from "@/lib/types";

/**
 * Apply a batch of client mutations with last-write-wins semantics.
 * Each accepted write gets the next monotonic server_rev.
 */
export async function applyPush(ops: PushOp[], userId: string): Promise<void> {
  if (ops.length === 0) return;
  await db.transaction(async (tx) => {
    let rev = (await tx.select().from(syncCounter).where(eq(syncCounter.id, 1)))[0]?.value ?? 0;

    for (const op of ops) {
      if (op.entity === "session") {
        const incoming = op.row;
        const existing = (
          await tx.select().from(stockSessions).where(eq(stockSessions.id, incoming.id))
        )[0];
        if (existing && existing.updatedAt >= incoming.updatedAt) continue; // keep server
        rev += 1;
        if (existing) {
          await tx
            .update(stockSessions)
            .set({
              date: incoming.date,
              label: incoming.label,
              status: incoming.status,
              closedAt: incoming.closedAt,
              updatedAt: incoming.updatedAt,
              serverRev: rev,
              deletedAt: incoming.deletedAt,
            })
            .where(eq(stockSessions.id, incoming.id));
        } else {
          await tx.insert(stockSessions).values({
            id: incoming.id,
            date: incoming.date,
            label: incoming.label,
            status: incoming.status,
            createdBy: incoming.createdBy ?? userId,
            createdAt: incoming.createdAt,
            closedAt: incoming.closedAt,
            updatedAt: incoming.updatedAt,
            serverRev: rev,
            deletedAt: incoming.deletedAt,
          });
        }
      } else if (op.entity === "entry") {
        const incoming = op.row;
        const existing = (
          await tx.select().from(stockEntries).where(eq(stockEntries.id, incoming.id))
        )[0];
        if (existing && existing.updatedAt >= incoming.updatedAt) continue; // keep server
        rev += 1;
        if (existing) {
          await tx
            .update(stockEntries)
            .set({
              opening: incoming.opening,
              closing: incoming.closing,
              updatedBy: userId,
              updatedAt: incoming.updatedAt,
              serverRev: rev,
              deletedAt: incoming.deletedAt,
            })
            .where(eq(stockEntries.id, incoming.id));
        } else {
          await tx.insert(stockEntries).values({
            id: incoming.id,
            sessionId: incoming.sessionId,
            itemId: incoming.itemId,
            opening: incoming.opening,
            closing: incoming.closing,
            updatedBy: userId,
            updatedAt: incoming.updatedAt,
            serverRev: rev,
            deletedAt: incoming.deletedAt,
          });
        }
      } else if (op.entity === "item") {
        const incoming = op.row;
        const existing = (await tx.select().from(items).where(eq(items.id, incoming.id)))[0];
        if (existing && existing.updatedAt >= incoming.updatedAt) continue;
        rev += 1;
        const values = {
          name: incoming.name,
          categoryId: incoming.categoryId,
          sortOrder: incoming.sortOrder,
          defaultOpening: incoming.defaultOpening,
          active: incoming.active,
          updatedAt: incoming.updatedAt,
          serverRev: rev,
          deletedAt: incoming.deletedAt,
        };
        if (existing) await tx.update(items).set(values).where(eq(items.id, incoming.id));
        else await tx.insert(items).values({ id: incoming.id, ...values });
      } else {
        const incoming = op.row;
        const existing = (await tx.select().from(categories).where(eq(categories.id, incoming.id)))[0];
        if (existing && existing.updatedAt >= incoming.updatedAt) continue;
        rev += 1;
        const values = {
          name: incoming.name,
          sortOrder: incoming.sortOrder,
          updatedAt: incoming.updatedAt,
          serverRev: rev,
          deletedAt: incoming.deletedAt,
        };
        if (existing) await tx.update(categories).set(values).where(eq(categories.id, incoming.id));
        else await tx.insert(categories).values({ id: incoming.id, ...values });
      }
    }

    await tx.update(syncCounter).set({ value: rev }).where(eq(syncCounter.id, 1));
  });
}

/** Return every syncable row with server_rev greater than `since`, oldest change first. */
export async function pullChanges(since: number): Promise<PullResponse> {
  const [cats, its, sess, ents] = await Promise.all([
    db.select().from(categories).where(gt(categories.serverRev, since)),
    db.select().from(items).where(gt(items.serverRev, since)),
    db.select().from(stockSessions).where(gt(stockSessions.serverRev, since)),
    db.select().from(stockEntries).where(gt(stockEntries.serverRev, since)),
  ]);

  const rows: PullRow[] = [
    ...cats.map((row): PullRow => ({ entity: "category", row })),
    ...its.map((row): PullRow => ({ entity: "item", row })),
    ...sess.map((row): PullRow => ({ entity: "session", row })),
    ...ents.map((row): PullRow => ({ entity: "entry", row })),
  ];

  rows.sort((a, b) => a.row.serverRev - b.row.serverRev);
  const cursor = rows.length ? rows[rows.length - 1].row.serverRev : since;
  return { rows, cursor };
}
