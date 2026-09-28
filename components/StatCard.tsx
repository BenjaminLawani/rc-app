import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
};

export function StatCard({ label, value, hint, accent }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent ? "border-accent/20 bg-accent-soft" : "border-border bg-surface",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          accent ? "text-accent" : "text-fg",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
