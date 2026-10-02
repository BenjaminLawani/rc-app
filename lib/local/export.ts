import { getDB } from "./db";
import { soldOf } from "./queries";
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

  const entryByItem = new Map(entries.map((e) => [e.itemId, e]));

  const activeItems = items.filter((i) => i.active && !i.deletedAt);
  const itemsByCat = new Map<string, typeof activeItems>();
  for (const it of activeItems) {
    const list = itemsByCat.get(it.categoryId) ?? [];
    list.push(it);
    itemsByCat.set(it.categoryId, list);
  }

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const header = [
    "Item",
    "Opening",
    "Received",
    "Total",
    "Closing",
    "Transferred/Sold",
    "Price",
    "Value",
  ];

  const rows: (string | number | null)[][] = [];
  let grandValue = 0;

  // One block per category, each with its own column header and value subtotal.
  for (const cat of sortedCats) {
    const catItems = (itemsByCat.get(cat.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    if (catItems.length === 0) continue;

    rows.push([cat.name]);
    rows.push(header);

    let catValue = 0;
    for (const it of catItems) {
      const e = entryByItem.get(it.id);
      const opening = e?.opening ?? it.defaultOpening;
      const received = e?.received ?? 0;
      const closing = e?.closing ?? null;
      const total = opening + received;
      const sold = soldOf({ opening, received, closing });
      const value = sold == null ? null : sold * (it.price ?? 0);
      if (value != null) catValue += value;
      rows.push([
        it.name,
        opening,
        received,
        total,
        closing,
        sold,
        it.price ?? 0,
        value,
      ]);
    }

    grandValue += catValue;
    rows.push(["", "", "", "", "", "", `${cat.name} total`, catValue]);
    rows.push([]);
  }

  // Grand total value across every good.
  rows.push(["", "", "", "", "", "", "Total value", grandValue]);

  // Daily cash-up summary.
  const cash = session.cashCounted ?? 0;
  const pos = session.posTotal ?? 0;
  const expenses = session.expenses ?? 0;
  const accounted = cash + pos + expenses;
  rows.push([]);
  rows.push(["Cash-up"]);
  rows.push(["Expected sales", grandValue]);
  rows.push(["Cash counted", session.cashCounted ?? ""]);
  rows.push(["POS / card", session.posTotal ?? ""]);
  rows.push(["Expenses", session.expenses ?? ""]);
  if (session.expensesNote) rows.push(["Expenses note", session.expensesNote]);
  rows.push(["Accounted for (Cash + POS + Expenses)", accounted]);
  rows.push(["Over / Short (Accounted − Expected)", accounted - grandValue]);

  downloadFile(`stock-${session.date}.csv`, toCsv(rows));
}
