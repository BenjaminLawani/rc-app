"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useAuth } from "@/lib/client/auth";
import { useSync } from "@/lib/client/sync";
import {
  createMaterialUsage,
  deleteMaterialUsage,
  updateMaterialUsage,
  todayISO,
  formatSessionLabel,
} from "@/lib/local/queries";
import type { MaterialUsageRow } from "@/lib/types";
import { IconPlus, IconTrash } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function MaterialsPage() {
  const { user } = useAuth();
  const { syncNow } = useSync();
  const [date, setDate] = useState(() => todayISO());

  const all = useLiveQuery(() => getDB().materials.toArray(), []);

  const dayRows = useMemo(
    () =>
      (all ?? [])
        .filter((m) => !m.deletedAt && m.date === date)
        .sort((a, b) => b.createdAt - a.createdAt),
    [all, date],
  );

  // Suggest material names & units the shop has used before (for the datalists).
  const { nameSuggestions, unitSuggestions } = useMemo(() => {
    const names = new Set<string>();
    const units = new Set<string>();
    for (const m of all ?? []) {
      if (m.deletedAt) continue;
      if (m.name) names.add(m.name);
      if (m.unit) units.add(m.unit);
    }
    return {
      nameSuggestions: [...names].sort(),
      unitSuggestions: [...units, "kg", "g", "L", "ml", "pcs", "bags"].filter(
        (u, i, a) => a.indexOf(u) === i,
      ),
    };
  }, [all]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 lg:py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Raw materials used</h1>
          <p className="text-xs text-muted">{formatSessionLabel(date)}</p>
        </div>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <AddMaterial date={date} onAdded={syncNow} />

      <div className="mt-5">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
          Logged {date === todayISO() ? "today" : "that day"}
        </h2>
        {dayRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
            Nothing logged yet. Add what was used above.
          </div>
        ) : (
          <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface">
            {dayRows.map((m) => (
              <MaterialItem key={m.id} row={m} onChanged={syncNow} />
            ))}
          </div>
        )}
      </div>

      <datalist id="material-names">
        {nameSuggestions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="material-units">
        {unitSuggestions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {user?.role === "admin" && (
        <p className="mt-4 px-1 text-center text-[11px] text-subtle">
          Staff log raw materials here each day.
        </p>
      )}
    </div>
  );
}

function AddMaterial({ date, onAdded }: { date: string; onAdded: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity) || 0;
    if (!name.trim() || qty <= 0) return;
    await createMaterialUsage({ date, name, quantity: qty, unit, note, user });
    setName("");
    setQuantity("");
    setNote("");
    onAdded();
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs font-medium text-muted">What did you use?</div>
      <input
        className={inputCls}
        list="material-names"
        placeholder="Material (e.g. Flour)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="Quantity (e.g. 21)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="w-24 shrink-0">
          <input
            className={inputCls}
            list="material-units"
            placeholder="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      </div>
      <input
        className={inputCls}
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
      >
        <IconPlus width={15} height={15} /> Add
      </button>
    </form>
  );
}

function MaterialItem({ row, onChanged }: { row: MaterialUsageRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [unit, setUnit] = useState(row.unit);
  const [note, setNote] = useState(row.note ?? "");

  const save = async () => {
    const qty = Number(quantity) || 0;
    await updateMaterialUsage(row.id, {
      name: name.trim() || row.name,
      quantity: Math.max(0, qty),
      unit: unit.trim(),
      note: note.trim() || null,
    });
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    await deleteMaterialUsage(row.id);
    onChanged();
  };

  if (editing) {
    return (
      <div className="space-y-2 bg-surface-2/40 px-3 py-3">
        <input className={inputCls} list="material-names" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="w-24 shrink-0">
            <input
              className={inputCls}
              list="material-units"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
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
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">{row.name}</div>
        {row.note && <div className="truncate text-xs text-muted">{row.note}</div>}
      </button>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {num(row.quantity)}
        {row.unit ? ` ${row.unit}` : ""}
      </span>
      <button
        onClick={remove}
        aria-label={`Delete ${row.name}`}
        className="shrink-0 rounded-lg p-1.5 text-subtle hover:text-danger"
      >
        <IconTrash width={16} height={16} />
      </button>
    </div>
  );
}
