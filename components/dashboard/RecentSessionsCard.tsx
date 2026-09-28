"use client";

import Link from "next/link";
import { todayISO } from "@/lib/local/queries";

export type SessionStat = {
  id: string;
  label: string;
  counted: number;
  total: number;
  sold: number;
};

export function RecentSessionsCard({ sessions }: { sessions: SessionStat[] }) {
  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Recent sessions</h3>
          <p className="text-xs text-muted">Counting progress by day</p>
        </div>
        <Link href="/sessions" className="text-xs font-semibold text-accent">
          View all
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No sessions yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {sessions.map((s) => {
            const pct = s.total ? Math.round((s.counted / s.total) * 100) : 0;
            const isToday = s.id === todayISO();
            return (
              <li key={s.id}>
                <Link
                  href={isToday ? "/" : `/?d=${s.id}`}
                  className="-mx-2 block rounded-lg px-2 py-1 transition hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {s.label}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                          Today
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-muted">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-subtle">
                    <span className="tabular-nums">
                      {s.counted}/{s.total} counted
                    </span>
                    <span className="tabular-nums">Sold {s.sold.toLocaleString()}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
