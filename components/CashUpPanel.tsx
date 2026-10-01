"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionRow } from "@/lib/types";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/cn";

function parseMoney(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function fmt(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

/** A labelled Naira input that commits on change (debounced) and blur. */
function MoneyField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  disabled?: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [str, setStr] = useState(fmt(value));
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused.current) setStr(fmt(value));
  }, [value]);

  const commit = () => onCommit(parseMoney(str));

  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-2.5 text-sm text-subtle">₦</span>
        <input
          inputMode="decimal"
          disabled={disabled}
          value={str}
          placeholder="0"
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setStr(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(commit, 500);
          }}
          onBlur={() => {
            focused.current = false;
            if (timer.current) clearTimeout(timer.current);
            commit();
          }}
          className="w-36 rounded-lg border border-border bg-surface py-2 pl-6 pr-2 text-right text-[15px] tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted"
        />
      </span>
    </label>
  );
}

type FinancePatch = Partial<
  Pick<SessionRow, "cashCounted" | "posTotal" | "expenses" | "expensesNote">
>;

type Props = {
  expected: number;
  session: SessionRow | null;
  onCommit: (patch: FinancePatch) => void;
  readOnly?: boolean;
};

export function CashUpPanel({ expected, session, onCommit, readOnly }: Props) {
  const cash = session?.cashCounted ?? null;
  const pos = session?.posTotal ?? null;
  const expenses = session?.expenses ?? null;

  const [note, setNote] = useState(session?.expensesNote ?? "");
  const noteFocused = useRef(false);
  useEffect(() => {
    if (!noteFocused.current) setNote(session?.expensesNote ?? "");
  }, [session?.expensesNote]);

  const accounted = (cash ?? 0) + (pos ?? 0) + (expenses ?? 0);
  const diff = accounted - expected;
  const anyEntered = cash != null || pos != null || expenses != null;

  return (
    <div className="px-4 py-3">
      <div className="mb-3 rounded-2xl border border-border bg-accent-soft px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">
          Expected sales (from stock)
        </div>
        <div className="text-2xl font-semibold tabular-nums text-accent">
          {formatNaira(expected)}
        </div>
        <p className="mt-0.5 text-xs text-muted">Sold quantity × price, across counted items.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="divide-y divide-border/70">
          <MoneyField
            label="Cash counted"
            value={cash}
            disabled={readOnly}
            onCommit={(v) => onCommit({ cashCounted: v })}
          />
          <MoneyField
            label="POS / card"
            value={pos}
            disabled={readOnly}
            onCommit={(v) => onCommit({ posTotal: v })}
          />
          <MoneyField
            label="Expenses paid out"
            value={expenses}
            disabled={readOnly}
            onCommit={(v) => onCommit({ expenses: v })}
          />
          <label className="block px-4 py-3">
            <span className="text-sm text-muted">Expenses note</span>
            <input
              disabled={readOnly}
              value={note}
              placeholder="e.g. fuel ₦2,000, change ₦500"
              onFocus={() => {
                noteFocused.current = true;
              }}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                noteFocused.current = false;
                const v = note.trim() || null;
                if (v !== (session?.expensesNote ?? null)) onCommit({ expensesNote: v });
              }}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted">Accounted for (Cash + POS + Expenses)</span>
          <span className="font-medium tabular-nums">{formatNaira(accounted)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Over / Short</div>
            <div className="text-xs text-muted">Accounted − Expected</div>
          </div>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              !anyEntered ? "text-subtle" : diff < 0 ? "text-danger" : "text-success",
            )}
          >
            {!anyEntered ? "—" : `${diff > 0 ? "+" : ""}${formatNaira(diff)}`}
          </span>
        </div>
      </div>

      {readOnly && (
        <p className="mt-3 text-center text-xs text-subtle">
          This day is closed. Reopen it to edit the cash-up.
        </p>
      )}
    </div>
  );
}
