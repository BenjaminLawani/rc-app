import { getDB } from "./db";
import type {
  AuthUser,
  CategoryRow,
  EntryRow,
  ExpenseRow,
  ItemRow,
  MaterialUsageRow,
  SessionRow,
} from "@/lib/types";

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

/** Quantity that left during the day (sold or transferred out):
 *  transferred/sold = total − closing, where total = opening + received.
 *  Null until closing is set. */
export function soldOf(
  e: Pick<EntryRow, "opening" | "closing" | "received">,
): number | null {
  if (e.closing == null) return null;
  return e.opening + (e.received ?? 0) - e.closing;
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
    cashCounted: null,
    posTotal: null,
    expenses: null,
    expensesNote: null,
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
    received: 0,
    transferred: 0,
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
  patch: Partial<Pick<EntryRow, "opening" | "closing" | "received" | "transferred">>,
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

export function setEntryReceived(id: string, received: number, user: AuthUser | null) {
  return patchEntry(id, { received }, user);
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
    received: 0,
    transferred: 0,
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
export async function createItem(input: {
  name: string;
  categoryId: string;
  defaultOpening?: number;
  price?: number;
  costPrice?: number;
}) {
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
    defaultOpening: Math.max(0, input.defaultOpening ?? 0),
    price: Math.max(0, input.price ?? 0),
    costPrice: Math.max(0, input.costPrice ?? 0),
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
  patch: Partial<
    Pick<ItemRow, "name" | "categoryId" | "defaultOpening" | "price" | "costPrice" | "active" | "sortOrder">
  >,
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

/** Record the day's cash-up (cash, POS, expenses) on the session row. */
export async function setSessionFinance(
  sessionId: string,
  patch: Partial<Pick<SessionRow, "cashCounted" | "posTotal" | "expenses" | "expensesNote">>,
  user: AuthUser | null,
) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.sessions, db.outbox, async () => {
    const cur = await db.sessions.get(sessionId);
    if (!cur) return;
    const next: SessionRow = {
      ...cur,
      ...patch,
      createdBy: cur.createdBy ?? user?.id ?? null,
      updatedAt: now,
    };
    await db.sessions.put(next);
    await db.outbox.add({ entity: "session", entityId: sessionId, queuedAt: now });
  });
}

// ── Month helpers ───────────────────────────────────────────────────
/** Current month as "YYYY-MM". */
export function thisMonthISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** A friendly month label, e.g. "October 2026", from "YYYY-MM". */
export function formatMonthLabel(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// ── Business expenses (admin ledger) ────────────────────────────────
export async function createExpense(input: {
  date: string;
  category: string;
  amount: number;
  note?: string;
  user: AuthUser | null;
}) {
  const db = getDB();
  const now = Date.now();
  const id = `exp-${crypto.randomUUID().slice(0, 8)}`;
  const row: ExpenseRow = {
    id,
    date: input.date,
    category: input.category.trim(),
    amount: Math.max(0, input.amount || 0),
    note: input.note?.trim() || null,
    createdBy: input.user?.id ?? null,
    createdAt: now,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  };
  await db.transaction("rw", db.expenses, db.outbox, async () => {
    await db.expenses.put(row);
    await db.outbox.add({ entity: "expense", entityId: id, queuedAt: now });
  });
  return row;
}

export async function updateExpense(
  id: string,
  patch: Partial<Pick<ExpenseRow, "date" | "category" | "amount" | "note">>,
) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.expenses, db.outbox, async () => {
    const cur = await db.expenses.get(id);
    if (!cur) return;
    await db.expenses.put({ ...cur, ...patch, updatedAt: now });
    await db.outbox.add({ entity: "expense", entityId: id, queuedAt: now });
  });
}

/** Soft-delete an expense (tombstone, so the deletion syncs). */
export async function deleteExpense(id: string) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.expenses, db.outbox, async () => {
    const cur = await db.expenses.get(id);
    if (!cur) return;
    await db.expenses.put({ ...cur, deletedAt: now, updatedAt: now });
    await db.outbox.add({ entity: "expense", entityId: id, queuedAt: now });
  });
}

// ── Raw-material usage (staff daily log) ────────────────────────────
export async function createMaterialUsage(input: {
  date: string;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  user: AuthUser | null;
}) {
  const db = getDB();
  const now = Date.now();
  const id = `mat-${crypto.randomUUID().slice(0, 8)}`;
  const row: MaterialUsageRow = {
    id,
    date: input.date,
    name: input.name.trim(),
    quantity: Math.max(0, input.quantity || 0),
    unit: input.unit.trim(),
    note: input.note?.trim() || null,
    createdBy: input.user?.id ?? null,
    createdAt: now,
    updatedAt: now,
    serverRev: 0,
    deletedAt: null,
  };
  await db.transaction("rw", db.materials, db.outbox, async () => {
    await db.materials.put(row);
    await db.outbox.add({ entity: "material", entityId: id, queuedAt: now });
  });
  return row;
}

export async function updateMaterialUsage(
  id: string,
  patch: Partial<Pick<MaterialUsageRow, "date" | "name" | "quantity" | "unit" | "note">>,
) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.materials, db.outbox, async () => {
    const cur = await db.materials.get(id);
    if (!cur) return;
    await db.materials.put({ ...cur, ...patch, updatedAt: now });
    await db.outbox.add({ entity: "material", entityId: id, queuedAt: now });
  });
}

/** Soft-delete a material-usage row (tombstone, so the deletion syncs). */
export async function deleteMaterialUsage(id: string) {
  const db = getDB();
  const now = Date.now();
  await db.transaction("rw", db.materials, db.outbox, async () => {
    const cur = await db.materials.get(id);
    if (!cur) return;
    await db.materials.put({ ...cur, deletedAt: now, updatedAt: now });
    await db.outbox.add({ entity: "material", entityId: id, queuedAt: now });
  });
}
