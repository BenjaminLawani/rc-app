"use client";

import { useEffect, useState } from "react";
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

  const [showArchived, setShowArchived] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ name: "", categoryId: "", defaultOpening: "0" });
  const [error, setError] = useState<string | null>(null);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    await createCategory(newCat);
    setNewCat("");
    syncNow();
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const catId = form.categoryId || categories?.[0]?.id;
    if (!form.name.trim() || !catId) {
      setError("Name and category are required.");
      return;
    }
    await createItem({
      name: form.name,
      categoryId: catId,
      defaultOpening: Math.max(0, Number(form.defaultOpening) || 0),
    });
    setForm({ name: "", categoryId: catId, defaultOpening: "0" });
    syncNow();
  };

  if (user && user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Manage items</h1>
          <p className="text-xs text-muted">Add, edit or archive the shared catalog.</p>
        </div>
        <Link href="/settings" className="text-sm font-medium text-accent">
          Done
        </Link>
      </div>

      {/* Add category */}
      <form onSubmit={addCategory} className="mb-3 flex gap-2">
        <input
          className={inputCls}
          placeholder="New category name"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
        />
        <button type="submit" className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium">
          Add
        </button>
      </form>

      {/* Add item */}
      <form onSubmit={addItem} className="mb-4 space-y-2 rounded-2xl border border-border bg-surface p-4">
        <div className="text-xs font-medium text-muted">Add an item</div>
        <input
          className={inputCls}
          placeholder="Item name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="flex gap-2">
          <select
            className={inputCls}
            value={form.categoryId || categories?.[0]?.id || ""}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={`${inputCls} w-28`}
            type="number"
            min={0}
            placeholder="Opening"
            value={form.defaultOpening}
            onChange={(e) => setForm({ ...form, defaultOpening: e.target.value })}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
        >
          <IconPlus width={15} height={15} /> Add item
        </button>
      </form>

      <label className="mb-3 flex items-center gap-2 px-1 text-xs text-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived items
      </label>

      {(categories ?? []).map((cat) => {
        const catItems = (items ?? []).filter(
          (i) => i.categoryId === cat.id && (showArchived || i.active) && !i.deletedAt,
        );
        if (catItems.length === 0) return null;
        return (
          <section key={cat.id} className="mb-4">
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
              {cat.name}
            </h2>
            <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface">
              {catItems.map((it) => (
                <ItemAdminRow key={it.id} item={it} onChanged={syncNow} categories={categories ?? []} />
              ))}
            </div>
          </section>
        );
      })}
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

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setOpen(String(item.defaultOpening)), [item.defaultOpening]);

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

  return (
    <div className={`px-3 py-2.5 ${item.active ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none focus:border-border focus:bg-surface"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
        />
        <input
          className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-accent"
          type="number"
          min={0}
          aria-label={`${item.name} default opening`}
          value={open}
          onChange={(e) => setOpen(e.target.value)}
          onBlur={commitOpen}
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
    </div>
  );
}
