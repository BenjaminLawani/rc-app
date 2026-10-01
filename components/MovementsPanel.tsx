"use client";

import type { CategoryRow, EntryRow, ItemRow as ItemModel } from "@/lib/types";
import { MovementRow } from "./MovementRow";

type Row = { item: ItemModel; entry: EntryRow | undefined };
type Group = { cat: CategoryRow; rows: Row[] };

type Props = {
  groups: Group[];
  onCommitReceived: (id: string, value: number) => void;
  onCommitTransferred: (id: string, value: number) => void;
  readOnly?: boolean;
};

export function MovementsPanel({ groups, onCommitReceived, onCommitTransferred, readOnly }: Props) {
  return (
    <div>
      <p className="px-4 pb-1 pt-2 text-xs text-muted">
        Record stock that came in (Received) or went to another shop (Transferred) today. These
        adjust the quantity sold.
      </p>
      {groups.map(({ cat, rows }) => {
        const touched = rows.filter(
          (r) => (r.entry?.received ?? 0) > 0 || (r.entry?.transferred ?? 0) > 0,
        ).length;
        return (
          <section key={cat.id} className="mb-2">
            <div className="sticky top-14 z-10 flex items-center justify-between border-y border-border bg-bg/95 px-4 py-2 backdrop-blur">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                {cat.name}
              </h2>
              <span className="text-[11px] font-medium tabular-nums text-subtle">{touched}</span>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-2 px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-subtle">
              <div />
              <div className="text-center">Recv</div>
              <div className="text-center">Xfer</div>
            </div>

            <div className="divide-y divide-border/70 bg-surface">
              {rows.map((r) => (
                <MovementRow
                  key={r.item.id}
                  item={r.item}
                  entry={r.entry}
                  onCommitReceived={onCommitReceived}
                  onCommitTransferred={onCommitTransferred}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
