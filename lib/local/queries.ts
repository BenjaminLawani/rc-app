import { getDB } from "./db";
import type { AuthUser, CategoryRow, EntryRow, ItemRow, SessionRow } from "@/lib/types";

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatSessionLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function soldOf(e: Pick<EntryRow, "opening" | "closing">): number | null {
  if (e.closing == null) return null;
  return e.opening - e.closing;
}

function entryId(sessionId: string, itemId: string) {
  return `${sessionId}:${itemId}`;
}

/** Get today's open session, creating it (with opening carried from the prior day) if needed. */
export async function startOrGetSession(dateISO: string, user: AuthUser | null): Promise<SessionRow> {
  const db = getDB();
  const existing = await db.sessions.get(dateISO);
  if (existing && !existing.deletedAt) return existing;

  const now = Date.now();
  const priors = (await db.sessions.where("date").below(dateISO).toArray())
    .filter((s) => !s.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  const prior = priors[0];

  const priorClosing = new Map<string, number>();
  if (prior) {
    const es = await db.entries.where("sessionId").equals(prior.id).toArray();
    for (const e of es) if (e.closing != null) priorClosing.set(e.itemId, e.closing);
  }

  const items = (await db.items.toArray()).filter((i) => i.active && !i.deletedAt);
  const session: SessionRow = {
    id: dateISO,
    date: dateISO,
    label: formatSessionLabel(dateISO),
    status: "open",
    createdBy: user?.id ?? null,
    createdAt: now,
    closedAt: null,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  };
  const entries: EntryRow[] = items.map((it) => ({
    id: entryId(dateISO, it.id),
    sessionId: dateISO,
    itemId: it.id,
    opening: priorClosing.has(it.id) ? (priorClosing.get(it.id) as number) : it.defaultOpening,
    closing: null,
    updatedBy: user?.id ?? null,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  }));

  await db.transaction("rw", db.sessions, db.entries, db.outbox, async () => {
    await db.sessions.put(session);
    await db.entries.bulkPut(entries);
    await db.outbox.add({ entity: "session", entityId: session.id, queuedAt: now });
    await db.outbox.bulkAdd(entries.map((e) => ({ entity: "entry" as const, entityId: e.id, queuedAt: now })));
  });
  await db.meta.put({ key: "activeSessionId", value: session.id });
  return session;
}

// Patch a single entry inside a transaction so concurrent opening/closing edits
// re-read the latest row and never clobber each other's field.
async function patchEntry(
  id: string,
  patch: Partial<Pick<EntryRow, "opening" | "closing">>,
  user: AuthUser | null,
) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.entries, db.outbox, async () => {
    const cur = await db.entries.get(id);
    if (!cur) return;
    const next: EntryRow = { ...cur, ...patch, updatedBy: user?.id ?? cur.updatedBy, updatedAt: now };
    await db.entries.put(next);
    await db.outbox.add({ entity: "entry", entityId: id, queuedAt: now });
  });
}

export function setEntryClosing(id: string, closing: number | null, user: AuthUser | null) {
  return patchEntry(id, { closing }, user);
}

export function setEntryOpening(id: string, opening: number, user: AuthUser | null) {
  return patchEntry(id, { opening }, user);
}

export async function clearClosing(sessionId: string, user: AuthUser | null) {
  const db = getDB();
  const now = Date.now();
  const es = await db.entries.where("sessionId").equals(sessionId).toArray();
  const updated = es
    .filter((e) => e.closing != null)
    .map((e) => ({ ...e, closing: null, updatedBy: user?.id ?? e.updatedBy, updatedAt: now }));
  if (!updated.length) return;
  await db.transaction("rw", db.entries, db.outbox, async () => {
    await db.entries.bulkPut(updated);
    await db.outbox.bulkAdd(updated.map((e) => ({ entity: "entry" as const, entityId: e.id, queuedAt: now })));
  });
}

export async function resetToDefaults(sessionId: string, user: AuthUser | null) {
  const db = getDB();
  const now = Date.now();
  const [es, items] = await Promise.all([
    db.entries.where("sessionId").equals(sessionId).toArray(),
    db.items.toArray(),
  ]);
  const defaults = new Map(items.map((i) => [i.id, i.defaultOpening]));
  const updated = es.map((e) => ({
    ...e,
    opening: defaults.get(e.itemId) ?? 0,
    closing: null,
    updatedBy: user?.id ?? e.updatedBy,
    updatedAt: now,
  }));
  if (!updated.length) return;
  await db.transaction("rw", db.entries, db.outbox, async () => {
    await db.entries.bulkPut(updated);
    await db.outbox.bulkAdd(updated.map((e) => ({ entity: "entry" as const, entityId: e.id, queuedAt: now })));
  });
}

// ── Catalog management (admin) ──────────────────────────────────────
export async function createItem(input: { name: string; categoryId: string; defaultOpening: number }) {
  const db = getDB();
  const now = Date.now();
  const id = `itm-${crypto.randomUUID().slice(0, 8)}`;
  const siblings = await db.items.where("categoryId").equals(input.categoryId).toArray();
  const sortOrder = siblings.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
  const row: ItemRow = {
    id,
    name: input.name.trim(),
    categoryId: input.categoryId,
    sortOrder,
    defaultOpening: input.defaultOpening,
    active: true,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  };
  await db.transaction("rw", db.items, db.outbox, async () => {
    await db.items.put(row);
    await db.outbox.add({ entity: "item", entityId: id, queuedAt: now });
  });
  return row;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<ItemRow, "name" | "categoryId" | "defaultOpening" | "active" | "sortOrder">>,
) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.items, db.outbox, async () => {
    const cur = await db.items.get(id);
    if (!cur) return;
    await db.items.put({ ...cur, ...patch, updatedAt: now });
    await db.outbox.add({ entity: "item", entityId: id, queuedAt: now });
  });
}

export function archiveItem(id: string) {
  return updateItem(id, { active: false });
}
export function restoreItem(id: string) {
  return updateItem(id, { active: true });
}

export async function createCategory(name: string) {
  const db = getDB();
  const now = Date.now();
  const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
  const cats = await db.categories.toArray();
  const sortOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;
  const row: CategoryRow = {
    id,
    name: name.trim(),
    sortOrder,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  };
  await db.transaction("rw", db.categories, db.outbox, async () => {
    await db.categories.put(row);
    await db.outbox.add({ entity: "category", entityId: id, queuedAt: now });
  });
  return row;
}

export async function updateCategory(id: string, patch: Partial<Pick<CategoryRow, "name" | "sortOrder">>) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.categories, db.outbox, async () => {
    const cur = await db.categories.get(id);
    if (!cur) return;
    await db.categories.put({ ...cur, ...patch, updatedAt: now });
    await db.outbox.add({ entity: "category", entityId: id, queuedAt: now });
  });
}

export async function setSessionStatus(sessionId: string, status: "open" | "closed") {
  const db = getDB();
  const cur = await db.sessions.get(sessionId);
  if (!cur) return;
  const now = Date.now();
  const next: SessionRow = {
    ...cur,
    status,
    closedAt: status === "closed" ? now : null,
    updatedAt: now,
  };
  await db.transaction("rw", db.sessions, db.outbox, async () => {
    await db.sessions.put(next);
    await db.outbox.add({ entity: "session", entityId: sessionId, queuedAt: now });
  });
}
