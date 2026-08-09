import type { KPISet } from "@/lib/calculations";
import { formatPct } from "@/lib/ui";

interface KpiCardsProps {
  kpis: KPISet;
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" | "success" | "default" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
      ? "text-orange-600 dark:text-orange-400"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <Card label="Active Auction Units" value={String(kpis.totalActiveUnits)} />
      <Card label="Photo Requests" value={String(kpis.totalPhotoRequests)} />
      <Card label="Photos Received" value={String(kpis.photosReceived)} tone="success" />
      <Card label="Pending" value={String(kpis.pendingRequests)} tone="warning" />
      <Card label="Overdue" value={String(kpis.overdueRequests)} tone="danger" />
      <Card label="Escalations Needed" value={String(kpis.escalationsNeeded)} tone="danger" />
      <Card label="BOG-Related Delays" value={String(kpis.bogDelays)} tone="warning" />
      <Card label="Owner-Related Delays" value={String(kpis.ownerDelays)} tone="warning" />
      <Card label="Other / Unknown Delays" value={String(kpis.otherUnknownDelays)} />
      <Card label="On-Time Photo %" value={formatPct(kpis.onTimePhotoPct)} tone="success" />
      <Card label="Avg Response Time" value={kpis.avgResponseTimeDays !== null ? `${kpis.avgResponseTimeDays.toFixed(1)}d` : "—"} />
      <Card label="Avg Follow-Ups" value={kpis.avgFollowUpAttempts !== null ? kpis.avgFollowUpAttempts.toFixed(1) : "—"} />
    </div>
  );
}
