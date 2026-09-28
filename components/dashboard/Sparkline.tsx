export function Sparkline({
  values,
  color = "var(--color-accent)",
  width = 92,
  height = 40,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...values, 1);
  const n = values.length;
  const gap = 3;
  const bw = (width - gap * (n - 1)) / n;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="text-border-strong">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 2));
        const x = i * (bw + gap);
        const isLast = i === n - 1;
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={bw}
            height={h}
            rx={2}
            fill={isLast ? color : "currentColor"}
            opacity={isLast ? 1 : 0.5}
          />
        );
      })}
    </svg>
  );
}
