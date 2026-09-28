import { getDB } from "@/lib/local/db";
import type { PullResponse, PullRow, PushOp } from "@/lib/types";

export class AuthExpiredError extends Error {
  constructor() {
    super("Authentication expired");
    this.name = "AuthExpiredError";
  }
}

async function getCursor(): Promise<number> {
  const m = await getDB().meta.get("pullCursor");
  return (m?.value as number) ?? 0;
}

async function setCursor(v: number) {
  await getDB().meta.put({ key: "pullCursor", value: v });
}

/** Merge server rows into the local mirror using last-write-wins on updatedAt.
 * Adopt the server row unless a newer local edit is still pending. */
async function applyPull(rows: PullRow[]) {
  if (!rows.length) return;
  const db = getDB();
  await db.transaction("rw", db.categories, db.items, db.sessions, db.entries, async () => {
    for (const r of rows) {
      if (r.entity === "category") {
        const cur = await db.categories.get(r.row.id);
        if (!cur || r.row.updatedAt >= cur.updatedAt) await db.categories.put(r.row);
      } else if (r.entity === "item") {
        const cur = await db.items.get(r.row.id);
        if (!cur || r.row.updatedAt >= cur.updatedAt) await db.items.put(r.row);
      } else if (r.entity === "session") {
        const cur = await db.sessions.get(r.row.id);
        if (!cur || r.row.updatedAt >= cur.updatedAt) await db.sessions.put(r.row);
      } else {
        const cur = await db.entries.get(r.row.id);
        if (!cur || r.row.updatedAt >= cur.updatedAt) await db.entries.put(r.row);
      }
    }
  });
}

export async function pull(): Promise<number> {
  const since = await getCursor();
  const res = await fetch(`/api/sync/pull?since=${since}`, { cache: "no-store" });
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const data = (await res.json()) as PullResponse;
  await applyPull(data.rows);
  if (data.cursor > since) await setCursor(data.cursor);
  return data.rows.length;
}

export async function push(): Promise<number> {
  const db = getDB();
  const outbox = await db.outbox.toArray();
  if (!outbox.length) return 0;

  // Coalesce multiple queued edits of the same entity, sending its latest state.
  type Entity = "session" | "entry" | "item" | "category";
  const groups = new Map<string, { entity: Entity; entityId: string; ids: number[] }>();
  for (const o of outbox) {
    const key = `${o.entity}:${o.entityId}`;
    const g = groups.get(key) ?? { entity: o.entity, entityId: o.entityId, ids: [] };
    if (o.id != null) g.ids.push(o.id);
    groups.set(key, g);
  }

  const ops: PushOp[] = [];
  const sentIds: number[] = [];
  for (const g of groups.values()) {
    sentIds.push(...g.ids);
    if (g.entity === "session") {
      const row = await db.sessions.get(g.entityId);
      if (row) ops.push({ entity: "session", row });
    } else if (g.entity === "entry") {
      const row = await db.entries.get(g.entityId);
      if (row) ops.push({ entity: "entry", row });
    } else if (g.entity === "item") {
      const row = await db.items.get(g.entityId);
      if (row) ops.push({ entity: "item", row });
    } else {
      const row = await db.categories.get(g.entityId);
      if (row) ops.push({ entity: "category", row });
    }
  }

  const res = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ops }),
  });
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) throw new Error(`push failed: ${res.status}`);

  await db.outbox.bulkDelete(sentIds);
  return ops.length;
}

/** Push local changes then pull remote ones. Returns nothing; throws on auth/network failure. */
export async function sync(): Promise<void> {
  await push();
  await pull();
}

export async function pendingCount(): Promise<number> {
  return getDB().outbox.count();
}
