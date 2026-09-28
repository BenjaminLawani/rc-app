"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type CountRow = {
  id: string;
  date: string;
  categoryId: string;
  categoryName: string;
  item: string;
  opening: number;
  closing: number | null;
  sold: number | null;
};

type Props = {
  rows: CountRow[];
  categories: { id: string; name: string }[];
  colorOf: (categoryId: string) => { bg: string; fg: string };
};

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition",
        active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function RecentCountsTable({ rows, categories, colorOf }: Props) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? rows : rows.filter((r) => r.categoryId === filter);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Recent counts</h3>
          <p className="text-xs text-muted">Latest closing entries across sessions</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Pill>
          {categories.map((c) => (
            <Pill key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.name.split(/[ ,]/)[0]}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Category</th>
              <th className="pb-2 pr-3 font-medium">Item</th>
              <th className="pb-2 pr-3 text-right font-medium">Opening</th>
              <th className="pb-2 pr-3 text-right font-medium">Closing</th>
              <th className="pb-2 text-right font-medium">Sold</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No counts recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const c = colorOf(r.categoryId);
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 tabular-nums text-muted">{r.date}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: c.bg, color: c.fg }}
                      >
                        {r.categoryName}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{r.item}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                      {r.opening.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {r.closing == null ? "—" : r.closing.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {r.sold == null ? "—" : r.sold.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
