"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/client/auth";
import { IconLogout, IconSettings, IconChevronDown } from "./icons";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initial = (user?.name ?? "?").slice(0, 1).toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-surface-2 sm:pr-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initial}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-xs font-semibold">{user?.name}</div>
          <div className="text-[10px] capitalize text-subtle">{user?.role}</div>
        </div>
        <IconChevronDown width={14} height={14} className="hidden text-subtle sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-muted">{user?.email}</div>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition hover:bg-surface-2"
            role="menuitem"
          >
            <IconSettings width={16} height={16} /> Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-danger transition hover:bg-danger-soft"
            role="menuitem"
          >
            <IconLogout width={16} height={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
