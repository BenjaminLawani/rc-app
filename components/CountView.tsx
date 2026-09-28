"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useAuth } from "@/lib/client/auth";
import { useSync } from "@/lib/client/sync";
import {
  startOrGetSession,
  setEntryOpening,
  setEntryClosing,
  setSessionStatus,
  todayISO,
  formatSessionLabel,
} from "@/lib/local/queries";
import type { EntryRow } from "@/lib/types";
import { SearchBar } from "@/components/SearchBar";
import { CategorySection } from "@/components/CategorySection";
import { IconSync } from "@/components/icons";

export function CountView({ date }: { date: string }) {
  const { user } = useAuth();
  const { syncNow } = useSync();
  const [search, setSearch] = useState("");
  const isToday = date === todayISO();

  const categories = useLiveQuery(() => getDB().categories.orderBy("sortOrder").toArray(), []);
  const items = useLiveQuery(() => getDB().items.orderBy("sortOrder").toArray(), []);
  const session = useLiveQuery(async () => (await getDB().sessions.get(date)) ?? null, [date]);
  const entries = useLiveQuery(() => getDB().entries.where("sessionId").equals(date).toArray(), [date]);

  // Auto-create only today's session, once the catalog is available locally.
  const creating = useRef(false);
  useEffect(() => {
    if (!user || !isToday || !items || items.length === 0) return;
    if (session === undefined) return;
    if (session === null && !creating.current) {
      creating.current = true;
      startOrGetSession(date, user)
        .then(() => syncNow())
        .finally(() => {
          creating.current = false;
        });
    }
  }, [user, isToday, items, session, date, syncNow]);

  const readOnly = session?.status === "closed";

  const commitOpening = (id: string, v: number) => {
    if (readOnly) return;
    setEntryOpening(id, v, user).then(syncNow);
  };
  const commitClosing = (id: string, v: number | null) => {
    if (readOnly) return;
    setEntryClosing(id, v, user).then(syncNow);
  };

  const entryByItem = useMemo(() => {
    const m = new Map<string, EntryRow>();
    for (const e of entries ?? []) m.set(e.itemId, e);
    return m;
  }, [entries]);

  const groups = useMemo(() => {
    if (!categories || !items) return [];
    const q = search.trim().toLowerCase();
    return categories
      .map((cat) => {
        const rows = items
          .filter((i) => i.categoryId === cat.id && i.active && !i.deletedAt)
          .filter((i) => !q || i.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))
          .map((i) => ({ item: i, entry: entryByItem.get(i.id) }));
        return { cat, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [categories, items, entryByItem, search]);

  const totalItems = (items ?? []).filter((i) => i.active && !i.deletedAt).length;
  const counted = (entries ?? []).filter((e) => e.closing != null).length;
  const totalSold = (entries ?? []).reduce(
    (s, e) => (e.closing != null ? s + (e.opening - e.closing) : s),
    0,
  );
  const pct = totalItems ? Math.round((counted / totalItems) * 100) : 0;

  const loading =
    categories === undefined || items === undefined || session === undefined || entries === undefined;

  // A requested past date that has no session.
  if (!loading && !isToday && session === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-sm text-muted">No stock take was recorded for</p>
        <p className="mt-1 font-medium">{formatSessionLabel(date)}</p>
        <Link href="/" className="mt-4 inline-block rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium">
          Back to today
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {!isToday && (
        <div className="mx-4 mt-1 flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-xs">
          <span className="text-accent">Viewing {formatSessionLabel(date)}</span>
          <Link href="/" className="font-semibold text-accent">
            Back to today
          </Link>
        </div>
      )}

      <div className="px-4 pb-3 pt-2">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {isToday ? "Today's count" : formatSessionLabel(date)}
            </h1>
            <p className="text-xs text-muted">
              {isToday ? formatSessionLabel(date) : session?.status === "closed" ? "Closed" : "Open"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">Sold</div>
            <div className="text-xl font-semibold tabular-nums">{totalSold}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Counted</span>
            <span className="tabular-nums">
              {counted}/{totalItems}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {readOnly && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <span className="text-muted">This day is closed and read-only.</span>
            <button
              onClick={() => setSessionStatus(date, "open").then(syncNow)}
              className="font-semibold text-accent"
            >
              Reopen to edit
            </button>
          </div>
        )}
      </div>

      <SearchBar value={search} onChange={setSearch} />

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : totalItems === 0 ? (
        <div className="px-6 py-20 text-center">
          <p className="text-sm text-muted">No items loaded yet.</p>
          <p className="mt-1 text-xs text-subtle">Connect to the internet to download the catalog.</p>
          <button
            onClick={syncNow}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium"
          >
            <IconSync width={16} height={16} /> Sync now
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="px-6 py-20 text-center text-sm text-muted">
          No items match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <CategorySection
              key={g.cat.id}
              category={g.cat}
              rows={g.rows}
              onCommitOpening={commitOpening}
              onCommitClosing={commitClosing}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
