import Dexie, { type Table } from "dexie";
import type { CategoryRow, ItemRow, SessionRow, EntryRow, AuthUser } from "@/lib/types";

export type OutboxRow = {
  id?: number;
  entity: "session" | "entry" | "item" | "category";
  entityId: string;
  queuedAt: number;
};

export type MetaRow =
  | { key: "pullCursor"; value: number }
  | { key: "auth"; value: { user: AuthUser; token: string; exp: number } | null }
  | { key: "activeSessionId"; value: string | null };

/** Offline-first mirror of the shared cloud dataset, plus the outbox + sync metadata. */
class LocalDB extends Dexie {
  categories!: Table<CategoryRow, string>;
  items!: Table<ItemRow, string>;
  sessions!: Table<SessionRow, string>;
  entries!: Table<EntryRow, string>;
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("rc-stock");
    this.version(1).stores({
      categories: "id, sortOrder, serverRev",
      items: "id, categoryId, sortOrder, serverRev",
      sessions: "id, date, status, serverRev",
      entries: "id, sessionId, itemId, serverRev, [sessionId+itemId]",
      outbox: "++id, entity, entityId, queuedAt",
      meta: "key",
    });
  }
}

// Constructed lazily so it is never instantiated during SSR (no indexedDB there).
let _db: LocalDB | null = null;
export function getDB(): LocalDB {
  if (!_db) _db = new LocalDB();
  return _db;
}
