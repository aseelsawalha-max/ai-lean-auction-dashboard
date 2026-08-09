"use client";

import type { EnrichedUnit, Facility, Manager } from "@/lib/types";
import { computeFacilityStats } from "@/lib/analytics";
import { formatPct } from "@/lib/ui";

interface FacilityPerformanceProps {
  units: EnrichedUnit[];
  facilities: Facility[];
  managers: Manager[];
}

export default function FacilityPerformance({ units, facilities, managers }: FacilityPerformanceProps) {
  const stats = facilities
    .map((f) => computeFacilityStats(units, f, managers.find((m) => m.id === f.managerId)?.name ?? "Unknown"))
    .filter((s) => s.totalUnits > 0)
    .sort((a, b) => (b.bogIssuePct ?? 0) - (a.bogIssuePct ?? 0));

  function flagReasons(s: (typeof stats)[number]): string[] {
    const flags: string[] = [];
    if ((s.bogIssuePct ?? 0) >= 40) flags.push("Recurring BOG issues");
    if ((s.overduePct ?? 0) >= 40) flags.push("Consistently high overdue rate");
    if ((s.avgFollowUpAttempts ?? 0) >= 2) flags.push("Multiple follow-ups required");
    if (s.escalations >= 2) flags.push("Frequent escalations");
    return flags;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Facility Ranking — Highest BOG Issue Rate</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Ranked by share of photo requests where BOG is the responsible party. Owner-caused delays are tracked separately so BOG is not blamed for facility-owner issues.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Facility</th>
              <th className="px-3 py-2">Manager</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Requests</th>
              <th className="px-3 py-2">On-Time %</th>
              <th className="px-3 py-2">Late %</th>
              <th className="px-3 py-2">Overdue %</th>
              <th className="px-3 py-2">BOG Issue %</th>
              <th className="px-3 py-2">Owner Issue %</th>
              <th className="px-3 py-2">Avg Response (d)</th>
              <th className="px-3 py-2">Avg Overdue (d)</th>
              <th className="px-3 py-2">Avg Follow-Ups</th>
              <th className="px-3 py-2">Escalations</th>
              <th className="px-3 py-2">Cycles w/ Issues</th>
              <th className="px-3 py-2 min-w-[200px]">Flags</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, idx) => {
              const flags = flagReasons(s);
              return (
                <tr key={s.facilityId} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{s.facilityName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.managerName}</td>
                  <td className="px-3 py-2 text-center">{s.totalUnits}</td>
                  <td className="px-3 py-2 text-center">{s.totalPhotoRequests}</td>
                  <td className="px-3 py-2 text-center">{formatPct(s.onTimePct)}</td>
                  <td className="px-3 py-2 text-center">{formatPct(s.latePct)}</td>
                  <td className="px-3 py-2 text-center">{formatPct(s.overduePct)}</td>
                  <td className="px-3 py-2 text-center font-semibold text-red-600 dark:text-red-400">
                    {formatPct(s.bogIssuePct)}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-amber-600 dark:text-amber-400">
                    {formatPct(s.ownerIssuePct)}
                  </td>
                  <td className="px-3 py-2 text-center">{s.avgResponseTimeDays?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{s.avgDaysOverdue?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{s.avgFollowUpAttempts?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{s.escalations}</td>
                  <td className="px-3 py-2 text-center">{s.cyclesWithIssues}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
