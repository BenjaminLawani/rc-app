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
  if (n == null || n === 0) return "";
  return String(n);
}

type Props = {
  item: ItemModel;
  entry: EntryRow | undefined;
  onCommitReceived: (id: string, value: number) => void;
  onCommitTransferred: (id: string, value: number) => void;
  readOnly?: boolean;
};

export function MovementRow({ item, entry, onCommitReceived, onCommitTransferred, readOnly }: Props) {
  const [recvStr, setRecvStr] = useState(fmt(entry?.received));
  const [xferStr, setXferStr] = useState(fmt(entry?.transferred));
  const focused = useRef<"recv" | "xfer" | null>(null);
  const recvTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (focused.current !== "recv") setRecvStr(fmt(entry?.received));
  }, [entry?.received]);
  useEffect(() => {
    if (focused.current !== "xfer") setXferStr(fmt(entry?.transferred));
  }, [entry?.transferred]);

  if (!entry) return null;

  const recvVal = parseNum(recvStr);
  const xferVal = parseNum(xferStr);

  const commitReceived = () => onCommitReceived(entry.id, Math.max(0, parseNum(recvStr) ?? 0));
  const commitTransferred = () => onCommitTransferred(entry.id, Math.max(0, parseNum(xferStr) ?? 0));

  const inputCls =
    "w-full rounded-lg border border-border bg-surface px-1 py-2 text-center text-[15px] tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 truncate text-[15px] text-fg" title={item.name}>
        {item.name}
      </div>

      <input
        aria-label={`${item.name} received`}
        inputMode="decimal"
        disabled={readOnly}
        value={recvStr}
        placeholder="0"
        onFocus={(e) => {
          focused.current = "recv";
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setRecvStr(e.target.value);
          if (recvTimer.current) clearTimeout(recvTimer.current);
          recvTimer.current = setTimeout(commitReceived, 500);
        }}
        onBlur={() => {
          focused.current = null;
          if (recvTimer.current) clearTimeout(recvTimer.current);
          commitReceived();
        }}
        className={cn(inputCls, recvVal ? "border-success/40 font-medium text-success" : "text-muted")}
      />

      <input
        aria-label={`${item.name} transferred`}
        inputMode="decimal"
        disabled={readOnly}
        value={xferStr}
        placeholder="0"
        onFocus={(e) => {
          focused.current = "xfer";
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setXferStr(e.target.value);
          if (xferTimer.current) clearTimeout(xferTimer.current);
          xferTimer.current = setTimeout(commitTransferred, 500);
        }}
        onBlur={() => {
          focused.current = null;
          if (xferTimer.current) clearTimeout(xferTimer.current);
          commitTransferred();
        }}
        className={cn(inputCls, xferVal ? "border-warning/50 font-medium text-warning" : "text-muted")}
      />
    </div>
  );
}
