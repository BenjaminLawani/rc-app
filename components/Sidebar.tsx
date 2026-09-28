"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/client/auth";
import { SIDEBAR_NAV } from "./nav";
import { IconLogout } from "./icons";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/70 px-3 py-5 backdrop-blur lg:flex">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-fg shadow-sm">
          RC
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Stock</div>
          <div className="text-sm font-semibold tracking-tight text-muted">Management</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {SIDEBAR_NAV.map(({ href, label, Icon, adminOnly }) => {
          if (adminOnly && user?.role !== "admin") return null;
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon width={20} height={20} strokeWidth={active ? 2 : 1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {(user?.name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-semibold">{user?.name}</div>
          <div className="truncate text-[11px] capitalize text-subtle">{user?.role}</div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="shrink-0 rounded-lg p-1.5 text-subtle transition hover:bg-danger-soft hover:text-danger"
        >
          <IconLogout width={18} height={18} />
        </button>
      </div>
    </aside>
  );
}
