"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/local/db";
import { useSync } from "@/lib/client/sync";
import { IconCloud, IconCloudOff, IconSync, IconCheck } from "./icons";
import { cn } from "@/lib/cn";

export function SyncIndicator() {
  const { status, online, syncNow } = useSync();
  const pending = useLiveQuery(() => getDB().outbox.count(), [], 0) ?? 0;

  const offline = !online || status === "offline";

  let Icon = IconCloud;
  let label = "Synced";
  let tone = "text-muted";

  if (offline) {
    Icon = IconCloudOff;
    label = pending > 0 ? `Offline · ${pending}` : "Offline";
    tone = "text-amber-600";
  } else if (status === "syncing") {
    Icon = IconSync;
    label = "Syncing";
    tone = "text-accent";
  } else if (status === "error") {
    Icon = IconCloudOff;
    label = "Retry";
    tone = "text-danger";
  } else if (pending > 0) {
    Icon = IconCloud;
    label = `${pending} queued`;
    tone = "text-muted";
  } else {
    Icon = IconCheck;
    label = "Synced";
    tone = "text-success";
  }

  return (
    <button
      type="button"
      onClick={syncNow}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95",
        tone,
      )}
      title="Tap to sync now"
    >
      <Icon width={15} height={15} className={status === "syncing" ? "animate-spin" : undefined} />
      <span>{label}</span>
    </button>
  );
}
