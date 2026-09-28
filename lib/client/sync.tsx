"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { sync, AuthExpiredError } from "@/lib/sync/engine";
import { useAuth } from "./auth";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

type SyncContextValue = {
  status: SyncStatus;
  online: boolean;
  lastSyncedAt: number | null;
  syncNow: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);
const INTERVAL_MS = 20_000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [online, setOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const running = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    if (!user) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    if (running.current) return;
    running.current = true;
    setStatus("syncing");
    try {
      await sync();
      setLastSyncedAt(Date.now());
      setStatus("idle");
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        await signOut();
        return;
      }
      setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    } finally {
      running.current = false;
    }
  }, [user, signOut]);

  const syncNow = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(run, 400);
  }, [run]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      run();
    };
    const handleOffline = () => {
      setOnline(false);
      setStatus("offline");
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [run]);

  useEffect(() => {
    if (!user) return;
    run();
    const id = setInterval(run, INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, run]);

  return (
    <SyncContext.Provider value={{ status, online, lastSyncedAt, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
