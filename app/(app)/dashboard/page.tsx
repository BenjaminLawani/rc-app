"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { todayISO, formatSessionLabel } from "@/lib/local/queries";
import type { EntryRow } from "@/lib/types";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryBarChart, type CatDatum } from "@/components/dashboard/CategoryBarChart";
import { RecentSessionsCard, type SessionStat } from "@/components/dashboard/RecentSessionsCard";
import { RecentCountsTable, type CountRow } from "@/components/dashboard/RecentCountsTable";
import { IconInventory, IconStats, IconCount, IconDashboard } from "@/components/icons";

const CAT_COLORS = [
  { bg: "#eff6ff", fg: "#2563eb" },
  { bg: "#fdf2f8", fg: "#db2777" },
  { bg: "#fffbeb", fg: "#d97706" },
  { bg: "#f0fdfa", fg: "#0d9488" },
  { bg: "#f5f3ff", fg: "#7c3aed" },
  { bg: "#eef2ff", fg: "#4f46e5" },
];

const num = (n: number) => n.toLocaleString();

export default function DashboardPage() {
  const categories = useLiveQuery(() => getDB().categories.orderBy("sortOrder").toArray(), []);
  const items = useLiveQuery(() => getDB().items.toArray(), []);
  const sessions = useLiveQuery(() => getDB().sessions.orderBy("date").toArray(), []);
  const entries = useLiveQuery(() => getDB().entries.toArray(), []);

  const loading =
    categories === undefined || items === undefined || sessions === undefined || entries === undefined;

  const model = useMemo(() => {
    if (!categories || !items || !sessions || !entries) return null;

    const activeItems = items.filter((i) => i.active && !i.deletedAt);
    const totalItems = activeItems.length;
    const itemById = new Map(items.map((i) => [i.id, i]));
    const catById = new Map(categories.map((c) => [c.id, c]));
    const catIndex = new Map(categories.map((c, i) => [c.id, i]));
    const colorOf = (catId: string) => CAT_COLORS[(catIndex.get(catId) ?? 0) % CAT_COLORS.length];

    // Per-session aggregates.
    type Agg = { opening: number; closing: number; sold: number; counted: number };
    const bySession = new Map<string, Agg>();
    for (const e of entries) {
      const a = bySession.get(e.sessionId) ?? { opening: 0, closing: 0, sold: 0, counted: 0 };
      a.opening += e.opening;
      if (e.closing != null) {
        a.closing += e.closing;
        a.sold += e.opening - e.closing;
        a.counted += 1;
      }
      bySession.set(e.sessionId, a);
    }

    const liveSessions = sessions.filter((s) => !s.deletedAt); // ascending by date
    const today = todayISO();
    const latest =
      liveSessions.find((s) => s.id === today) ?? liveSessions[liveSessions.length - 1] ?? null;
    const latestAgg = latest ? bySession.get(latest.id) ?? { opening: 0, closing: 0, sold: 0, counted: 0 } : null;

    const recentAsc = liveSessions.slice(-7);
    const spark = (pick: (a: Agg) => number) =>
      recentAsc.map((s) => pick(bySession.get(s.id) ?? { opening: 0, closing: 0, sold: 0, counted: 0 }));

    // Category chart for the latest session.
    const chart: CatDatum[] = categories.map((c) => ({ category: c.name, open: 0, sold: 0, close: 0 }));
    const chartIndex = new Map(categories.map((c, i) => [c.id, i]));
    if (latest) {
      for (const e of entries) {
        if (e.sessionId !== latest.id) continue;
        const it = itemById.get(e.itemId);
        if (!it || !it.active) continue;
        const idx = chartIndex.get(it.categoryId);
        if (idx == null) continue;
        chart[idx].open += e.opening;
        if (e.closing != null) {
          chart[idx].close += e.closing;
          chart[idx].sold += e.opening - e.closing;
        }
      }
    }

    // Recent sessions card (last 5, newest first).
    const recentSessions: SessionStat[] = liveSessions
      .slice(-5)
      .reverse()
      .map((s) => {
        const a = bySession.get(s.id) ?? { opening: 0, closing: 0, sold: 0, counted: 0 };
        return { id: s.id, label: s.label, counted: a.counted, total: totalItems, sold: a.sold };
      });

    // Recent counts table (latest closing entries across sessions).
    const counted = entries
      .filter((e) => e.closing != null && !e.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12);
    const rows: CountRow[] = counted.map((e: EntryRow) => {
      const it = itemById.get(e.itemId);
      const catId = it?.categoryId ?? "";
      return {
        id: e.id,
        date: e.sessionId,
        categoryId: catId,
        categoryName: catById.get(catId)?.name ?? "—",
        item: it?.name ?? e.itemId,
        opening: e.opening,
        closing: e.closing,
        sold: e.closing == null ? null : e.opening - e.closing,
      };
    });

    return { totalItems, latest, latestAgg, spark, chart, recentSessions, rows, colorOf };
  }, [categories, items, sessions, entries]);

  if (loading || !model) {
    return (
      <div className="grid place-items-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const { totalItems, latest, latestAgg, spark, chart, recentSessions, rows, colorOf } = model;
  const agg = latestAgg ?? { opening: 0, closing: 0, sold: 0, counted: 0 };
  const pct = totalItems ? Math.round((agg.counted / totalItems) * 100) : 0;
  const periodLabel = latest ? formatSessionLabel(latest.id) : "No session yet";

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 lg:px-8 lg:py-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">{periodLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          icon={IconInventory}
          label="Opening stock"
          value={num(agg.opening)}
          sub={periodLabel}
          spark={spark((a) => a.opening)}
          sparkColor="var(--color-chart-open)"
        />
        <KpiCard
          icon={IconStats}
          label="Total sold"
          value={num(agg.sold)}
          sub={periodLabel}
          spark={spark((a) => a.sold)}
          sparkColor="var(--color-chart-sold)"
        />
        <KpiCard
          icon={IconInventory}
          label="Closing stock"
          value={num(agg.closing)}
          sub={periodLabel}
          spark={spark((a) => a.closing)}
          sparkColor="var(--color-chart-close)"
        />
        <KpiCard
          icon={IconCount}
          label="Counted"
          value={`${agg.counted}/${totalItems}`}
          sub={`${pct}% complete`}
          spark={spark((a) => a.counted)}
          sparkColor="var(--color-accent)"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-muted">
              <IconDashboard width={16} height={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Stock by category</h2>
              <p className="text-xs text-muted">Opening vs Sold vs Closing — {periodLabel}</p>
            </div>
          </div>
          <CategoryBarChart data={chart} />
        </div>

        <RecentSessionsCard sessions={recentSessions} />
      </div>

      <div className="mt-4">
        <RecentCountsTable rows={rows} categories={categories ?? []} colorOf={colorOf} />
      </div>
    </div>
  );
}
