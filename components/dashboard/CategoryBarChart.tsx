"use client";

import { useState } from "react";

export type CatDatum = { category: string; open: number; sold: number; close: number };

const SERIES = [
  { key: "open", label: "Opening", color: "var(--color-chart-open)", id: "gOpen" },
  { key: "sold", label: "Sold", color: "var(--color-chart-sold)", id: "gSold" },
  { key: "close", label: "Closing", color: "var(--color-chart-close)", id: "gClose" },
] as const;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function CategoryBarChart({ data }: { data: CatDatum[] }) {
  const [hover, setHover] = useState<
    { x: number; y: number; label: string; series: string; value: number } | null
  >(null);

  const W = 720;
  const H = 300;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rawMax = Math.max(1, ...data.flatMap((d) => [d.open, d.sold, d.close]));
  const max = niceMax(rawMax);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(22, (groupW * 0.62) / SERIES.length);
  const innerGap = 4;
  const clusterW = barW * SERIES.length + innerGap * (SERIES.length - 1);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stock by category">
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.id} id={s.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.45" />
            </linearGradient>
          ))}
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-subtle)">
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, gi) => {
          const gx = padL + gi * groupW + (groupW - clusterW) / 2;
          return (
            <g key={d.category}>
              {SERIES.map((s, si) => {
                const v = d[s.key];
                const bx = gx + si * (barW + innerGap);
                const by = y(v);
                const bh = padT + plotH - by;
                return (
                  <rect
                    key={s.key}
                    x={bx}
                    y={by}
                    width={barW}
                    height={Math.max(0, bh)}
                    rx={4}
                    fill={`url(#${s.id})`}
                    onMouseEnter={(e) =>
                      setHover({
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                        label: d.category,
                        series: s.label,
                        value: v,
                      })
                    }
                    onMouseMove={(e) =>
                      setHover((h) => (h ? { ...h, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY } : h))
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
              <text
                x={gx + clusterW / 2}
                y={H - padB + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-muted)"
              >
                {d.category.length > 14 ? d.category.slice(0, 13) + "…" : d.category}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / H) * 100}% - 8px)` }}
        >
          <div className="font-medium">{hover.label}</div>
          <div className="text-muted">
            {hover.series}: <span className="font-semibold tabular-nums text-fg">{hover.value.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 px-1">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
