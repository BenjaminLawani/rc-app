// Currency formatting for the shop's money figures (Nigerian Naira).

/** Format a number as Naira, e.g. 12500 -> "₦12,500". Null/invalid -> "₦0". */
export function formatNaira(n: number | null | undefined): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  const rounded = Math.round(v * 100) / 100;
  return `₦${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
