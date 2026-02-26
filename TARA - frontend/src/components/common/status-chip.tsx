export function StatusChip({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const base = "rounded-full px-2 py-1 text-xs font-medium";
  if (normalized.includes("active") || normalized.includes("open")) {
    return <span className={`${base} bg-emerald-100 text-emerald-700`}>{value}</span>;
  }
  if (normalized.includes("pending") || normalized.includes("draft")) {
    return <span className={`${base} bg-amber-100 text-amber-700`}>{value}</span>;
  }
  if (normalized.includes("inactive") || normalized.includes("closed") || normalized.includes("deleted")) {
    return <span className={`${base} bg-slate-200 text-slate-700`}>{value}</span>;
  }
  return <span className={`${base} bg-blue-100 text-blue-700`}>{value}</span>;
}
