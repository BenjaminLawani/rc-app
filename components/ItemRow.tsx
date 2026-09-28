"use client";

import { useEffect, useRef, useState } from "react";
import type { EntryRow, ItemRow as ItemModel } from "@/lib/types";
import { cn } from "@/lib/cn";

function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "";
  return String(n);
}

type Props = {
  item: ItemModel;
  entry: EntryRow | undefined;
  onCommitOpening: (id: string, value: number) => void;
  onCommitClosing: (id: string, value: number | null) => void;
  readOnly?: boolean;
};

export function ItemRow({ item, entry, onCommitOpening, onCommitClosing, readOnly }: Props) {
  const [openStr, setOpenStr] = useState(fmt(entry?.opening));
  const [closeStr, setCloseStr] = useState(fmt(entry?.closing));
  const focused = useRef<"open" | "close" | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflect remote/store changes when the field is not being edited.
  useEffect(() => {
    if (focused.current !== "open") setOpenStr(fmt(entry?.opening));
  }, [entry?.opening]);
  useEffect(() => {
    if (focused.current !== "close") setCloseStr(fmt(entry?.closing));
  }, [entry?.closing]);

  if (!entry) return null;

  const openVal = parseNum(openStr);
  const closeVal = parseNum(closeStr);
  const effectiveOpen = openVal ?? entry.opening;
  const sold = closeVal == null ? null : effectiveOpen - closeVal;

  const commitOpening = () => {
    const n = Math.max(0, parseNum(openStr) ?? 0);
    onCommitOpening(entry.id, n);
  };
  const commitClosing = () => {
    const raw = parseNum(closeStr);
    onCommitClosing(entry.id, raw == null ? null : Math.max(0, raw));
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-surface px-1 py-2 text-center text-[15px] tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3rem] items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 truncate text-[15px] text-fg" title={item.name}>
        {item.name}
      </div>

      <input
        aria-label={`${item.name} opening`}
        inputMode="decimal"
        disabled={readOnly}
        value={openStr}
        onFocus={(e) => {
          focused.current = "open";
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setOpenStr(e.target.value);
          if (openTimer.current) clearTimeout(openTimer.current);
          openTimer.current = setTimeout(commitOpening, 500);
        }}
        onBlur={() => {
          focused.current = null;
          if (openTimer.current) clearTimeout(openTimer.current);
          commitOpening();
        }}
        className={cn(inputCls, "text-muted")}
      />

      <input
        aria-label={`${item.name} closing`}
        inputMode="decimal"
        disabled={readOnly}
        value={closeStr}
        onFocus={(e) => {
          focused.current = "close";
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setCloseStr(e.target.value);
          if (closeTimer.current) clearTimeout(closeTimer.current);
          closeTimer.current = setTimeout(commitClosing, 500);
        }}
        onBlur={() => {
          focused.current = null;
          if (closeTimer.current) clearTimeout(closeTimer.current);
          commitClosing();
        }}
        className={cn(inputCls, closeVal != null ? "border-accent/40 font-medium text-fg" : "")}
      />

      <div
        className={cn(
          "text-right text-[15px] font-semibold tabular-nums",
          sold == null ? "text-subtle" : sold < 0 ? "text-danger" : "text-fg",
        )}
      >
        {sold == null ? "—" : sold}
      </div>
    </div>
  );
}
