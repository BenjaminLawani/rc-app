import { getDB } from "./db";
import { toCsv, downloadFile } from "@/lib/csv";

export async function exportSessionCsv(sessionId: string) {
  const db = getDB();
  const [session, entries, items, categories] = await Promise.all([
    db.sessions.get(sessionId),
    db.entries.where("sessionId").equals(sessionId).toArray(),
    db.items.toArray(),
    db.categories.toArray(),
  ]);
  if (!session) return;

  const catById = new Map(categories.map((c) => [c.id, c]));
  const entryByItem = new Map(entries.map((e) => [e.itemId, e]));

  const activeItems = items
    .filter((i) => i.active && !i.deletedAt)
    .sort((a, b) => {
      const ca = catById.get(a.categoryId)?.sortOrder ?? 0;
      const cb = catById.get(b.categoryId)?.sortOrder ?? 0;
      return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder;
    });

  const rows: (string | number | null)[][] = [["Category", "Item", "Opening", "Closing", "Sold"]];
  for (const it of activeItems) {
    const e = entryByItem.get(it.id);
    const opening = e?.opening ?? it.defaultOpening;
    const closing = e?.closing ?? null;
    const sold = closing == null ? null : opening - closing;
    rows.push([catById.get(it.categoryId)?.name ?? "", it.name, opening, closing, sold]);
  }

  downloadFile(`stock-${session.date}.csv`, toCsv(rows));
}
