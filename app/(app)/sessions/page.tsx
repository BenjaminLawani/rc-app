"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useSync } from "@/lib/client/sync";
import { setSessionStatus, todayISO } from "@/lib/local/queries";
import { exportSessionCsv } from "@/lib/local/export";
import { IconDownload, IconLock, IconReset } from "@/components/icons";
import { cn } from "@/lib/cn";

export default function SessionsPage() {
  const { syncNow } = useSync();
  const sessions = useLiveQuery(() => getDB().sessions.orderBy("date").reverse().toArray(), []);
  const entries = useLiveQuery(() => getDB().entries.toArray(), []);
  const today = todayISO();

  const statsBySession = useMemo(() => {
    const map = new Map<string, { counted: number; total: number; sold: number }>();
    for (const e of entries ?? []) {
      const s = map.get(e.sessionId) ?? { counted: 0, total: 0, sold: 0 };
      s.total += 1;
      if (e.closing != null) {
        s.counted += 1;
        s.sold += e.opening - e.closing;
      }
      map.set(e.sessionId, s);
    }
    return map;
  }, [entries]);

  const visible = (sessions ?? []).filter((s) => !s.deletedAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-2">
      <h1 className="mb-1 text-lg font-semibold tracking-tight">Sessions</h1>
      <p className="mb-4 text-xs text-muted">Each day&apos;s stock take. Openings carry over from the day before.</p>

      {sessions === undefined ? (
        <div className="grid place-items-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted">
          No sessions yet. Start counting on the Count tab.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => {
            const st = statsBySession.get(s.id) ?? { counted: 0, total: 0, sold: 0 };
            const isToday = s.id === today;
            return (
              <li key={s.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.label}</span>
                      {isToday && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          Today
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          s.status === "open" ? "bg-border text-muted" : "bg-success/10 text-success",
                        )}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Counted {st.counted}/{st.total} · Sold{" "}
                      <span className="font-medium tabular-nums text-fg">{st.sold}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={isToday ? "/" : `/?d=${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition active:scale-95"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => exportSessionCsv(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition active:scale-95"
                  >
                    <IconDownload width={15} height={15} /> Export CSV
                  </button>
                  <button
                    onClick={() => setSessionStatus(s.id, s.status === "open" ? "closed" : "open").then(syncNow)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition active:scale-95"
                  >
                    {s.status === "open" ? (
                      <>
                        <IconLock width={15} height={15} /> Close day
                      </>
                    ) : (
                      <>
                        <IconReset width={15} height={15} /> Reopen
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
