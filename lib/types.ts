// Wire + local-mirror DTOs, shared by client (Dexie) and server (sync API).
// Kept free of server imports so the client bundle stays clean.

export type Role = "admin" | "staff";
export type SyncEntity = "category" | "item" | "session" | "entry";

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: number;
  serverRev: number;
  deletedAt: number | null;
};

export type ItemRow = {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
  defaultOpening: number;
  price: number;
  active: boolean;
  updatedAt: number;
  serverRev: number;
  deletedAt: number | null;
};

export type SessionStatus = "open" | "closed";

export type SessionRow = {
  id: string; // === date (YYYY-MM-DD)
  date: string;
  label: string;
  status: SessionStatus;
  createdBy: string | null;
  createdAt: number;
  closedAt: number | null;
  // Daily cash-up — null until recorded.
  cashCounted: number | null;
  posTotal: number | null;
  expenses: number | null;
  expensesNote: string | null;
  updatedAt: number;
  serverRev: number;
  deletedAt: number | null;
};

export type EntryRow = {
  id: string; // === `${sessionId}:${itemId}`
  sessionId: string;
  itemId: string;
  opening: number;
  closing: number | null;
  received: number;
  transferred: number;
  updatedBy: string | null;
  updatedAt: number;
  serverRev: number;
  deletedAt: number | null;
};

export type AuthUser = { id: string; email: string; name: string; role: Role };

// Server -> client (pull)
export type PullRow =
  | { entity: "category"; row: CategoryRow }
  | { entity: "item"; row: ItemRow }
  | { entity: "session"; row: SessionRow }
  | { entity: "entry"; row: EntryRow };

export type PullResponse = { rows: PullRow[]; cursor: number };

// Client -> server (push). Staff mutate sessions & entries; admins also
// mutate the catalog (items & categories).
export type PushOp =
  | { entity: "session"; row: SessionRow }
  | { entity: "entry"; row: EntryRow }
  | { entity: "item"; row: ItemRow }
  | { entity: "category"; row: CategoryRow };

export type PushRequest = { ops: PushOp[] };
export type PushResponse = { ok: true };
