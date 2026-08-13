function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : tone === "info"
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "border-zinc-200 bg-zinc-50 text-zinc-900";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function StatsGrid({
  total,
  success,
  failed,
  remaining,
}: {
  total: number;
  success: number;
  failed: number;
  remaining: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Total" value={total} tone="neutral" />
      <StatCard label="Remaining" value={remaining} tone="info" />
      <StatCard label="Success" value={success} tone="success" />
      <StatCard label="Failed" value={failed} tone="danger" />
    </div>
  );
}
