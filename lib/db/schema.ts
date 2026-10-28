import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ── Auth ────────────────────────────────────────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

// ── Shared catalog ──────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
  serverRev: integer("server_rev").notNull().default(0),
  deletedAt: integer("deleted_at"),
});

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    categoryId: text("category_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    defaultOpening: real("default_opening").notNull().default(0),
    // `price` is the selling price; `costPrice` is what the shop pays for it.
    // Profit margin is derived (selling − cost) and never stored.
    price: real("price").notNull().default(0),
    costPrice: real("cost_price").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at").notNull().default(0),
    serverRev: integer("server_rev").notNull().default(0),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("items_server_rev_idx").on(t.serverRev)],
);

// ── Daily stock-taking sessions (shared) ────────────────────────────
// id === the ISO date (YYYY-MM-DD) so a day's session converges across
// offline devices without server-side dedup.
export const stockSessions = sqliteTable(
  "stock_sessions",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    label: text("label").notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
    // ── Daily cash-up (money reconciliation). Null until staff record it. ──
    cashCounted: real("cash_counted"),
    posTotal: real("pos_total"),
    expenses: real("expenses"),
    expensesNote: text("expenses_note"),
    updatedAt: integer("updated_at").notNull(),
    serverRev: integer("server_rev").notNull().default(0),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("sessions_server_rev_idx").on(t.serverRev)],
);

// id === `${sessionId}:${itemId}` so an item within a session converges
// across devices (last-write-wins on `closing`).
export const stockEntries = sqliteTable(
  "stock_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    itemId: text("item_id").notNull(),
    opening: real("opening").notNull().default(0),
    closing: real("closing"),
    // Received = stock collected during the day. Transferred/sold = (opening + received) − closing.
    // `transferred` is retained for back-compat with older rows but is no longer entered separately.
    received: real("received").notNull().default(0),
    transferred: real("transferred").notNull().default(0),
    updatedBy: text("updated_by"),
    updatedAt: integer("updated_at").notNull(),
    serverRev: integer("server_rev").notNull().default(0),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("entries_server_rev_idx").on(t.serverRev),
    index("entries_session_idx").on(t.sessionId),
  ],
);

// ── Business expenses (admin ledger) ────────────────────────────────
// A free-standing expense line so the admin can tally monthly profit/loss:
// profit = sales − cost of goods sold − Σ expenses.
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD
    category: text("category").notNull().default(""), // e.g. Rent, Salaries, Fuel
    amount: real("amount").notNull().default(0),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    serverRev: integer("server_rev").notNull().default(0),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("expenses_server_rev_idx").on(t.serverRev)],
);

// ── Raw-material usage (staff daily log) ────────────────────────────
// Free-text log of raw materials consumed, e.g. "Flour · 21 · kg".
export const materialUsage = sqliteTable(
  "material_usage",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD
    name: text("name").notNull(), // e.g. Flour
    quantity: real("quantity").notNull().default(0),
    unit: text("unit").notNull().default(""), // e.g. kg
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    serverRev: integer("server_rev").notNull().default(0),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("material_usage_server_rev_idx").on(t.serverRev),
    index("material_usage_date_idx").on(t.date),
  ],
);

// Single-row monotonic counter used to stamp server_rev on every write.
export const syncCounter = sqliteTable("sync_counter", {
  id: integer("id").primaryKey(),
  value: integer("value").notNull().default(0),
});

// ── App settings (server-only key/value) ────────────────────────────
// Not synced to devices. Holds secrets like the reopen-password hash that
// are verified on the server, so they never reach a staff member's device.
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Item = typeof items.$inferSelect;
export type StockSession = typeof stockSessions.$inferSelect;
export type StockEntry = typeof stockEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type MaterialUsage = typeof materialUsage.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
