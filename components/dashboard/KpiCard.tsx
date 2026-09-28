import type { ComponentType, SVGProps } from "react";
import { Sparkline } from "./Sparkline";

type Props = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  sparkColor?: string;
};

export function KpiCard({ icon: Icon, label, value, sub, spark, sparkColor }: Props) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted">
        <Icon width={18} height={18} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-subtle">{sub}</div>}
        </div>
        {spark && spark.length > 0 && (
          <Sparkline values={spark} color={sparkColor} />
        )}
      </div>
    </div>
  );
}
