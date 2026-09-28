"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/SyncIndicator";
import { UserMenu } from "@/components/UserMenu";
import { IconBell } from "@/components/icons";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface/60 px-4 backdrop-blur safe-top lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[11px] font-bold text-accent-fg">
              RC
            </div>
            <span className="text-sm font-semibold tracking-tight">RC Stock</span>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1.5 sm:gap-3">
            <SyncIndicator />
            <button
              type="button"
              aria-label="Notifications"
              className="hidden rounded-full p-2 text-muted transition hover:bg-surface-2 sm:block"
            >
              <IconBell width={18} height={18} />
            </button>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 pb-24 lg:pb-10">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
