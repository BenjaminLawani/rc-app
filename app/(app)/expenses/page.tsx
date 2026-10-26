"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useAuth } from "@/lib/client/auth";
import { useSync } from "@/lib/client/sync";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  soldOf,
  todayISO,
  thisMonthISO,
  formatMonthLabel,
} from "@/lib/local/queries";
import { formatNaira } from "@/lib/money";
import type { ExpenseRow } from "@/lib/types";
import { IconPlus, IconTrash } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

/** Shift a "YYYY-MM" month by `delta` months. */
function shiftMonth(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { syncNow } = useSync();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.replace("/");
  }, [loading, user, router]);

  const [month, setMonth] = useState(() => thisMonthISO());

  const items = useLiveQuery(() => getDB().items.toArray(), []);
  const entries = useLiveQuery(() => getDB().entries.toArray(), []);
  const allExpenses = useLiveQuery(() => getDB().expenses.toArray(), []);

  // Sales & cost-of-goods for the month, derived from closed stock counts.
  const sales = useMemo(() => {
    if (!items || !entries) return { revenue: 0, cogs: 0 };
    const itemById = new Map(items.map((i) => [i.id, i]));
    let revenue = 0;
    let cogs = 0;
    for (const e of entries) {
      if (e.deletedAt) continue;
      if (!e.sessionId.startsWith(month)) continue; // sessionId === date (YYYY-MM-DD)
      const sold = soldOf(e);
      if (sold == null) continue;
      const it = itemById.get(e.itemId);
      revenue += sold * (it?.price ?? 0);
      cogs += sold * (it?.costPrice ?? 0);
    }
    return { revenue, cogs };
  }, [items, entries, month]);

  const monthExpenses = useMemo(
    () =>
      (allExpenses ?? [])
        .filter((x) => !x.deletedAt && x.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [allExpenses, month],
  );

  const expenseTotal = monthExpenses.reduce((s, x) => s + x.amount, 0);
  const grossProfit = sales.revenue - sales.cogs;
  const netProfit = grossProfit - expenseTotal;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 lg:py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Expenses &amp; profit</h1>
          <p className="text-xs text-muted">{formatMonthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:text-fg"
          >
            ‹
          </button>
          <input
            type="month"
            value={month}
            max={thisMonthISO()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
            disabled={month >= thisMonthISO()}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      {/* Monthly profit / loss summary */}
      <div className="card p-5">
        <div className="space-y-2.5 text-sm">
          <SummaryRow label="Sales" value={sales.revenue} />
          <SummaryRow label="Cost of goods sold" value={-sales.cogs} muted />
          <SummaryRow label="Gross profit" value={grossProfit} divider />
          <SummaryRow label="Expenses" value={-expenseTotal} muted />
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold">
              {netProfit >= 0 ? "Net profit" : "Net loss"}
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                netProfit >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatNaira(netProfit)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-subtle">
          Sales and cost of goods come from counted stock this month. Add the shop&apos;s running
          costs below and the net profit updates automatically.
        </p>
      </div>

      {/* keyed by month so the date field re-initialises when the month changes */}
      <AddExpense key={month} month={month} onAdded={syncNow} />

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Expenses this month
          </h2>
          <span className="text-xs font-medium tabular-nums text-subtle">
            {formatNaira(expenseTotal)}
          </span>
        </div>
        {monthExpenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
            No expenses recorded for {formatMonthLabel(month)} yet.
          </div>
        ) : (
          <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface">
            {monthExpenses.map((x) => (
              <ExpenseItem key={x.id} expense={x} onChanged={syncNow} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  divider,
}: {
  label: string;
  value: number;
  muted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        divider ? "border-t border-border/70 pt-2.5 font-medium" : ""
      }`}
    >
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={`tabular-nums ${muted ? "text-muted" : "font-medium"}`}>
        {formatNaira(value)}
      </span>
    </div>
  );
}

function AddExpense({ month, onAdded }: { month: string; onAdded: () => void }) {
  const { user } = useAuth();
  // Default the date to today when the shown month is the current one,
  // otherwise to the first of the selected month.
  const [date, setDate] = useState(() =>
    month === thisMonthISO() ? todayISO() : `${month}-01`,
  );
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount) || 0;
    if (!category.trim() || amt <= 0) return;
    await createExpense({ date, category, amount: amt, note, user });
    setCategory("");
    setAmount("");
    setNote("");
    onAdded();
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs font-medium text-muted">Add an expense</div>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            className={inputCls}
            placeholder="What for? (e.g. Rent, Fuel)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="w-28 shrink-0">
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount ₦"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-40 shrink-0">
          <input
            className={inputCls}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <input
            className={inputCls}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
      >
        <IconPlus width={15} height={15} /> Add expense
      </button>
    </form>
  );
}

function ExpenseItem({ expense, onChanged }: { expense: ExpenseRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(expense.category);
  const [amount, setAmount] = useState(String(expense.amount));
  const [note, setNote] = useState(expense.note ?? "");

  const save = async () => {
    const amt = Number(amount) || 0;
    await updateExpense(expense.id, {
      category: category.trim() || expense.category,
      amount: Math.max(0, amt),
      note: note.trim() || null,
    });
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${expense.category}" (${formatNaira(expense.amount)})?`)) return;
    await deleteExpense(expense.id);
    onChanged();
  };

  const day = expense.date.slice(8); // DD

  if (editing) {
    return (
      <div className="space-y-2 bg-surface-2/40 px-3 py-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="w-28 shrink-0">
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <input
          className={inputCls}
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-semibold tabular-nums text-muted">
        {day}
      </div>
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">{expense.category}</div>
        {expense.note && <div className="truncate text-xs text-muted">{expense.note}</div>}
      </button>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatNaira(expense.amount)}
      </span>
      <button
        onClick={remove}
        aria-label={`Delete ${expense.category}`}
        className="shrink-0 rounded-lg p-1.5 text-subtle hover:text-danger"
      >
        <IconTrash width={16} height={16} />
      </button>
    </div>
  );
}
