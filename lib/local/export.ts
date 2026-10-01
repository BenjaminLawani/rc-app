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

  const catById = new Map(categories.map((c) => [c.id, c]));
  const entryByItem = new Map(entries.map((e) => [e.itemId, e]));

  const activeItems = items
    .filter((i) => i.active && !i.deletedAt)
    .sort((a, b) => {
      const ca = catById.get(a.categoryId)?.sortOrder ?? 0;
      const cb = catById.get(b.categoryId)?.sortOrder ?? 0;
      return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder;
    });

  const rows: (string | number | null)[][] = [
    ["Category", "Item", "Opening", "Received", "Transferred", "Closing", "Sold", "Price", "Value"],
  ];
  let expected = 0;
  for (const it of activeItems) {
    const e = entryByItem.get(it.id);
    const opening = e?.opening ?? it.defaultOpening;
    const received = e?.received ?? 0;
    const transferred = e?.transferred ?? 0;
    const closing = e?.closing ?? null;
    const sold = e
      ? soldOf(e)
      : soldOf({ opening, closing, received, transferred });
    const value = sold == null ? null : sold * (it.price ?? 0);
    if (value != null) expected += value;
    rows.push([
      catById.get(it.categoryId)?.name ?? "",
      it.name,
      opening,
      received,
      transferred,
      closing,
      sold,
      it.price ?? 0,
      value,
    ]);
  }

  // Daily cash-up summary.
  const cash = session.cashCounted ?? 0;
  const pos = session.posTotal ?? 0;
  const expenses = session.expenses ?? 0;
  const accounted = cash + pos + expenses;
  rows.push([]);
  rows.push(["Cash-up"]);
  rows.push(["Expected sales", expected]);
  rows.push(["Cash counted", session.cashCounted ?? ""]);
  rows.push(["POS / card", session.posTotal ?? ""]);
  rows.push(["Expenses", session.expenses ?? ""]);
  if (session.expensesNote) rows.push(["Expenses note", session.expensesNote]);
  rows.push(["Accounted for (Cash + POS + Expenses)", accounted]);
  rows.push(["Over / Short (Accounted − Expected)", accounted - expected]);

  downloadFile(`stock-${session.date}.csv`, toCsv(rows));
}
