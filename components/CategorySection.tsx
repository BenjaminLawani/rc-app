"use client";

import type { CategoryRow, EntryRow, ItemRow as ItemModel } from "@/lib/types";
import { ItemRow } from "./ItemRow";

type Row = { item: ItemModel; entry: EntryRow | undefined };

type Props = {
  category: CategoryRow;
  rows: Row[];
  onCommitOpening: (id: string, value: number) => void;
  onCommitReceived: (id: string, value: number) => void;
  onCommitClosing: (id: string, value: number | null) => void;
  readOnly?: boolean;
};

export function CategorySection({
  category,
  rows,
  onCommitOpening,
  onCommitReceived,
  onCommitClosing,
  readOnly,
}: Props) {
  const counted = rows.filter((r) => r.entry?.closing != null).length;

  return (
    <section className="mb-2">
      <div className="sticky top-14 z-10 flex items-center justify-between border-y border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          {category.name}
        </h2>
        <span className="text-[11px] font-medium tabular-nums text-subtle">
          {counted}/{rows.length}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_2.5rem_2.75rem_2.5rem] gap-1.5 px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-subtle">
        <div />
        <div className="text-center">Open</div>
        <div className="text-center">Recv</div>
        <div className="text-center">Total</div>
        <div className="text-center">Close</div>
        <div className="text-right">Sold</div>
      </div>

      <div className="divide-y divide-border/70 bg-surface">
        {rows.map((r) => (
          <ItemRow
            key={r.item.id}
            item={r.item}
            entry={r.entry}
            onCommitOpening={onCommitOpening}
            onCommitReceived={onCommitReceived}
            onCommitClosing={onCommitClosing}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}
