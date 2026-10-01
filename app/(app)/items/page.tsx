"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useAuth } from "@/lib/client/auth";
import { useSync } from "@/lib/client/sync";
import {
  createItem,
  updateItem,
  archiveItem,
  restoreItem,
  createCategory,
} from "@/lib/local/queries";
import type { ItemRow } from "@/lib/types";
import { IconPlus, IconTrash, IconReset } from "@/components/icons";
import { cn } from "@/lib/cn";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

export default function ItemsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { syncNow } = useSync();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") router.replace("/settings");
  }, [loading, user, router]);

  const categories = useLiveQuery(() => getDB().categories.orderBy("sortOrder").toArray(), []);
  const items = useLiveQuery(() => getDB().items.orderBy("sortOrder").toArray(), []);

  // Each category is a "sheet"; show one at a time.
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ name: "", defaultOpening: "0", price: "0" });
  const [error, setError] = useState<string | null>(null);

  const liveCats = useMemo(() => (categories ?? []).filter((c) => !c.deletedAt), [categories]);

  // Derive the active sheet so it stays valid as categories load/change,
  // without storing-then-correcting it in state. `activeCat` only holds the
  // user's explicit pick; we fall back to the first sheet otherwise.
  const effectiveCat =
    activeCat && liveCats.some((c) => c.id === activeCat) ? activeCat : liveCats[0]?.id ?? null;

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    const row = await createCategory(newCat);
    setNewCat("");
    setAddingCat(false);
    setActiveCat(row.id);
    syncNow();
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !effectiveCat) {
      setError("Enter an item name. Add a category first if there are none.");
      return;
    }
    await createItem({
      name: form.name,
      categoryId: effectiveCat,
      defaultOpening: Math.max(0, Number(form.defaultOpening) || 0),
      price: Math.max(0, Number(form.price) || 0),
    });
    setForm({ name: "", defaultOpening: "0", price: "0" });
    syncNow();
  };

  if (user && user.role !== "admin") return null;

  const activeCategory = liveCats.find((c) => c.id === effectiveCat) ?? null;
  const catItems = (items ?? []).filter(
    (i) => i.categoryId === effectiveCat && (showArchived || i.active) && !i.deletedAt,
  );
  const activeCount = (items ?? []).filter(
    (i) => i.categoryId === effectiveCat && i.active && !i.deletedAt,
  ).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-2">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Manage items</h1>
          <p className="text-xs text-muted">Each category is its own sheet.</p>
        </div>
        <Link href="/settings" className="text-sm font-medium text-accent">
          Done
        </Link>
      </div>

      {/* Sheet tabs — one per category, with a + to add a new one */}
      <div className="-mx-4 border-b border-border px-4">
        <div className="flex items-end gap-1 overflow-x-auto pb-px">
          {liveCats.map((cat) => {
            const count = (items ?? []).filter(
              (i) => i.categoryId === cat.id && i.active && !i.deletedAt,
            ).length;
            const active = cat.id === effectiveCat;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-border bg-surface text-fg"
                    : "border-transparent text-muted hover:text-fg",
                )}
              >
                {cat.name}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-accent-soft text-accent" : "bg-border text-subtle",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setAddingCat((v) => !v)}
            aria-label="Add category sheet"
            title="Add category"
            className={cn(
              "shrink-0 rounded-t-lg px-2.5 py-2 text-muted transition hover:text-accent",
              addingCat && "text-accent",
            )}
          >
            <IconPlus width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Inline "new sheet" input, revealed by the + tab */}
      {addingCat && (
        <form onSubmit={addCategory} className="mt-3 flex gap-2">
          <input
            autoFocus
            className={inputCls}
            placeholder="New category name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <button type="submit" className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg">
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingCat(false);
              setNewCat("");
            }}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </form>
      )}

      {liveCats.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted">
          No categories yet. Tap <span className="font-medium text-accent">+</span> to add your first sheet.
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              {activeCategory?.name}
              <span className="ml-2 font-normal normal-case text-subtle">{activeCount} items</span>
            </h2>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>

          {/* Add item to this sheet */}
          <form onSubmit={addItem} className="mb-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-medium text-muted">
              Add an item to {activeCategory?.name}
            </div>
            <input
              className={inputCls}
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">
                Opening qty
                <input
                  className={`${inputCls} mt-1`}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.defaultOpening}
                  onChange={(e) => setForm({ ...form, defaultOpening: e.target.value })}
                />
              </label>
              <label className="flex-1 text-xs text-muted">
                Price (₦)
                <input
                  className={`${inputCls} mt-1`}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
            >
              <IconPlus width={15} height={15} /> Add item
            </button>
          </form>

          {catItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
              No {showArchived ? "" : "active "}items in {activeCategory?.name} yet.
            </div>
          ) : (
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface">
              {catItems.map((it) => (
                <ItemAdminRow key={it.id} item={it} onChanged={syncNow} categories={liveCats} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemAdminRow({
  item,
  categories,
  onChanged,
}: {
  item: ItemRow;
  categories: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [open, setOpen] = useState(String(item.defaultOpening));
  const [price, setPrice] = useState(String(item.price ?? 0));

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setOpen(String(item.defaultOpening)), [item.defaultOpening]);
  useEffect(() => setPrice(String(item.price ?? 0)), [item.price]);

  const commitName = async () => {
    const n = name.trim();
    if (n && n !== item.name) {
      await updateItem(item.id, { name: n });
      onChanged();
    }
  };
  const commitOpen = async () => {
    const v = Math.max(0, Number(open) || 0);
    if (v !== item.defaultOpening) {
      await updateItem(item.id, { defaultOpening: v });
      onChanged();
    }
  };
  const commitPrice = async () => {
    const v = Math.max(0, Number(price) || 0);
    if (v !== (item.price ?? 0)) {
      await updateItem(item.id, { price: v });
      onChanged();
    }
  };

  const numCls =
    "w-full rounded-lg border border-border px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-accent";

  return (
    <div className={`px-3 py-2.5 ${item.active ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none focus:border-border focus:bg-surface"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
        />
        <select
          className="max-w-[7rem] rounded-lg border border-border px-1.5 py-1.5 text-xs outline-none"
          value={item.categoryId}
          onChange={async (e) => {
            await updateItem(item.id, { categoryId: e.target.value });
            onChanged();
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {item.active ? (
          <button
            aria-label="Archive"
            onClick={async () => {
              await archiveItem(item.id);
              onChanged();
            }}
            className="shrink-0 rounded-lg p-1.5 text-subtle hover:text-danger"
          >
            <IconTrash width={16} height={16} />
          </button>
        ) : (
          <button
            aria-label="Restore"
            onClick={async () => {
              await restoreItem(item.id);
              onChanged();
            }}
            className="shrink-0 rounded-lg p-1.5 text-subtle hover:text-accent"
          >
            <IconReset width={16} height={16} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-2">
        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-subtle">
          Opening
          <input
            className={`${numCls} w-16`}
            type="number"
            min={0}
            aria-label={`${item.name} default opening`}
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            onBlur={commitOpen}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-subtle">
          Price ₦
          <input
            className={`${numCls} w-24`}
            type="number"
            min={0}
            aria-label={`${item.name} price`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
          />
        </label>
      </div>
    </div>
  );
}
