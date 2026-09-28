"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useAuth } from "@/lib/client/auth";
import { useSync } from "@/lib/client/sync";
import { clearClosing, resetToDefaults, todayISO } from "@/lib/local/queries";
import { exportSessionCsv } from "@/lib/local/export";
import type { Role } from "@/lib/types";
import { IconDownload, IconTrash, IconReset, IconSync, IconLogout, IconPlus, IconLock, IconCount } from "@/components/icons";

const fieldCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update password.");
      setMsg({ ok: true, text: "Password updated." });
      setCur("");
      setNext("");
      setOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium"
        >
          <IconLock width={16} height={16} /> Change password
        </button>
        {msg?.ok && <p className="mt-1 text-xs text-success">{msg.text}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="text-xs font-medium text-muted">Change password</div>
      <input
        className={fieldCls}
        type="password"
        placeholder="Current password"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        required
      />
      <input
        className={fieldCls}
        type="password"
        placeholder="New password (min 6 chars)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
      />
      {msg && !msg.ok && <p className="text-xs text-danger">{msg.text}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? "Saving…" : "Update"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border/70 px-4 py-3 last:border-0">{children}</div>;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { status, online, lastSyncedAt, syncNow } = useSync();
  const today = todayISO();
  const session = useLiveQuery(async () => (await getDB().sessions.get(today)) ?? null, [today]);
  const pending = useLiveQuery(() => getDB().outbox.count(), [], 0) ?? 0;
  const hasSession = !!session;

  const handleClear = async () => {
    if (!hasSession) return;
    if (confirm("Clear all closing stock entries for today? Openings are kept.")) {
      await clearClosing(today, user);
      syncNow();
    }
  };
  const handleReset = async () => {
    if (!hasSession) return;
    if (confirm("Reset today to original values? Openings return to defaults and closings are cleared.")) {
      await resetToDefaults(today, user);
      syncNow();
    }
  };
  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-2">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Settings</h1>

      <Section title="Account">
        <Row>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
            </div>
            <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {user?.role}
            </span>
          </div>
        </Row>
        <Row>
          <ChangePassword />
        </Row>
        <Row>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm font-medium text-danger"
          >
            <IconLogout width={16} height={16} /> Sign out
          </button>
        </Row>
      </Section>

      {user?.role === "admin" && (
        <Section title="Catalog">
          <Row>
            <Link href="/items" className="flex items-center justify-between text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <IconCount width={16} height={16} /> Manage items
              </span>
              <span className="text-subtle">›</span>
            </Link>
          </Row>
        </Section>
      )}

      <Section title="Sync">
        <Row>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Connection</span>
            <span className="font-medium">{online ? "Online" : "Offline"}</span>
          </div>
        </Row>
        <Row>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Pending changes</span>
            <span className="font-medium tabular-nums">{pending}</span>
          </div>
        </Row>
        <Row>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="text-muted">Last synced</div>
              <div className="text-xs text-subtle">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "—"}
                {status === "error" && " · error"}
              </div>
            </div>
            <button
              onClick={syncNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium active:scale-95"
            >
              <IconSync width={15} height={15} /> Sync now
            </button>
          </div>
        </Row>
      </Section>

      <Section title="Today's data">
        <Row>
          <button
            onClick={() => exportSessionCsv(today)}
            disabled={!hasSession}
            className="inline-flex items-center gap-2 text-sm font-medium disabled:opacity-40"
          >
            <IconDownload width={16} height={16} /> Export CSV
          </button>
        </Row>
        <Row>
          <button
            onClick={handleClear}
            disabled={!hasSession}
            className="inline-flex items-center gap-2 text-sm font-medium disabled:opacity-40"
          >
            <IconTrash width={16} height={16} /> Clear closing stock
          </button>
        </Row>
        <Row>
          <button
            onClick={handleReset}
            disabled={!hasSession}
            className="inline-flex items-center gap-2 text-sm font-medium text-danger disabled:opacity-40"
          >
            <IconReset width={16} height={16} /> Reset to original values
          </button>
        </Row>
      </Section>

      {user?.role === "admin" && <UsersManager />}

      <p className="px-1 text-center text-xs text-subtle">RC Stock · v1.0 · The Right Choice</p>
    </div>
  );
}

type UserRow = { id: string; email: string; name: string; role: Role };

function UsersManager() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" as Role });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load users.");
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users (are you online?).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add user.");
      setForm({ name: "", email: "", password: "", role: "staff" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add user.");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: UserRow) => {
    const pw = window.prompt(`New password for ${u.name} (min 6 characters):`);
    if (!pw) return;
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: u.id, password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    window.alert(res.ok ? "Password updated." : data.error || "Could not update password.");
  };

  const removeUser = async (u: UserRow) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error || "Could not delete user.");
      return;
    }
    await load();
  };

  const inputCls = fieldCls;

  return (
    <Section title="Users">
      {loading ? (
        <Row>
          <span className="text-sm text-muted">Loading…</span>
        </Row>
      ) : (
        users.map((u) => (
          <Row key={u.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{u.name}</div>
                <div className="truncate text-xs text-muted">{u.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {u.role}
                </span>
                <button
                  onClick={() => resetPassword(u)}
                  className="rounded-md p-1 text-subtle hover:text-accent"
                  aria-label={`Reset password for ${u.name}`}
                >
                  <IconLock width={15} height={15} />
                </button>
                {u.id !== me?.id && (
                  <button
                    onClick={() => removeUser(u)}
                    className="rounded-md p-1 text-subtle hover:text-danger"
                    aria-label={`Delete ${u.name}`}
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                )}
              </div>
            </div>
          </Row>
        ))
      )}

      <Row>
        <form onSubmit={add} className="space-y-2">
          <div className="text-xs font-medium text-muted">Add a user</div>
          <input
            className={inputCls}
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className={inputCls}
            type="email"
            autoCapitalize="none"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className={inputCls}
            type="password"
            placeholder="Password (min 6 chars)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
          >
            <IconPlus width={15} height={15} /> {saving ? "Adding…" : "Add user"}
          </button>
        </form>
      </Row>
    </Section>
  );
}
