"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { todayISO, formatSessionLabel, soldOf } from "@/lib/local/queries";
import { StatCard } from "@/components/StatCard";

export default function StatsPage() {
  const today = todayISO();
  const categories = useLiveQuery(() => getDB().categories.orderBy("sortOrder").toArray(), []);
  const items = useLiveQuery(() => getDB().items.toArray(), []);
  const entries = useLiveQuery(() => getDB().entries.where("sessionId").equals(today).toArray(), [today]);

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  const activeItems = (items ?? []).filter((i) => i.active && !i.deletedAt);
  const totalItems = activeItems.length;

  let totalOpening = 0;
  let totalClosing = 0;
  let totalSold = 0;
  let counted = 0;
  for (const e of entries ?? []) {
    totalOpening += e.opening;
    if (e.closing != null) {
      totalClosing += e.closing;
      totalSold += soldOf(e) ?? 0;
      counted += 1;
    }
  }
  const pct = totalItems ? Math.round((counted / totalItems) * 100) : 0;

  const perCat = (categories ?? [])
    .map((cat) => {
      const total = activeItems.filter((i) => i.categoryId === cat.id).length;
      const es = (entries ?? []).filter((e) => itemById.get(e.itemId)?.categoryId === cat.id);
      const c = es.filter((e) => e.closing != null).length;
      const sold = es.reduce((s, e) => s + (soldOf(e) ?? 0), 0);
      return { cat, total, counted: c, sold };
    })
    .filter((x) => x.total > 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-2">
      <h1 className="text-lg font-semibold tracking-tight">Statistics</h1>
      <p className="mb-4 text-xs text-muted">{formatSessionLabel(today)}</p>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Opening" value={totalOpening} />
        <StatCard label="Closing" value={totalClosing} />
        <StatCard label="Sold" value={totalSold} accent />
        <StatCard label="Counted" value={`${counted}/${totalItems}`} hint={`${pct}% complete`} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Progress</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {perCat.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
            By category
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {perCat.map((x) => (
              <li key={x.cat.id} className="flex items-center justify-between border-b border-border/70 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{x.cat.name}</div>
                  <div className="text-xs text-muted tabular-nums">
                    {x.counted}/{x.total} counted
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-subtle">Sold</div>
                  <div className="text-sm font-semibold tabular-nums">{x.sold}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
