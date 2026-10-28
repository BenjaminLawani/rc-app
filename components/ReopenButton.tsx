"use client";

import { useState } from "react";
import { setSessionStatus } from "@/lib/local/queries";
import { useSync } from "@/lib/client/sync";

type Props = {
  date: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Reopen a closed day, gated by the admin-set reopen password. The password is
 * verified on the server (/api/reopen-verify) so the secret never lives on the
 * device; only on success do we flip the session back to "open" locally.
 */
export function ReopenButton({ date, className, children }: Props) {
  const { syncNow } = useSync();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setPw("");
    setErr(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reopen-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reopen this day.");
      await setSessionStatus(date, "open");
      syncNow();
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reopen (are you online?).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={close}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-lg"
          >
            <div>
              <div className="text-sm font-semibold">Reopen this day</div>
              <p className="mt-0.5 text-xs text-muted">
                Enter the reopen password set by the admin.
              </p>
            </div>
            <input
              autoFocus
              type="password"
              placeholder="Reopen password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !pw}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
              >
                {busy ? "Checking…" : "Reopen"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
