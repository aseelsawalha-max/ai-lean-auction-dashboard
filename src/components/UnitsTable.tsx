"use client";

import type { EnrichedUnit, Facility, Manager, AuctionCycle } from "@/lib/types";
import { sortUnits } from "@/lib/calculations";
import { SEVERITY_STYLES, rowColorClass, formatDate } from "@/lib/ui";

interface UnitsTableProps {
  units: EnrichedUnit[];
  managers: Manager[];
  facilities: Facility[];
  cycles: AuctionCycle[];
}

export default function UnitsTable({ units, managers, facilities, cycles }: UnitsTableProps) {
  const sorted = sortUnits(units);
  const managerName = (id: string) => managers.find((m) => m.id === id)?.name ?? id;
  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? id;
  const cycleName = (id: string) => cycles.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Manager</th>
            <th className="px-3 py-2">Facility</th>
            <th className="px-3 py-2">Unit #</th>
            <th className="px-3 py-2">Cycle</th>
            <th className="px-3 py-2">Requested</th>
            <th className="px-3 py-2">Deadline</th>
            <th className="px-3 py-2">Countdown</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Responsible</th>
            <th className="px-3 py-2">Last Follow-Up</th>
            <th className="px-3 py-2">Follow-Ups</th>
            <th className="px-3 py-2">Days Waiting</th>
            <th className="px-3 py-2">Days Overdue</th>
            <th className="px-3 py-2">AI Issue Category</th>
            <th className="px-3 py-2 min-w-[220px]">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) => {
            const sev = SEVERITY_STYLES[u.severity];
            const countdown = u.deadlineCountdown;
            return (
              <tr
                key={u.id}
                className={`${rowColorClass(u.requestStatus, u.daysOverdue > 0, u.requestStatus === "Escalation Needed")} border-b border-slate-100 dark:border-slate-800/60`}
              >
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{managerName(u.managerId)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{facilityName(u.facilityId)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-medium">{u.unitNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{cycleName(u.auctionCycleId)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(u.photoRequestDate)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(u.requiredPhotoDeadline)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {countdown === null ? "—" : countdown < 0 ? `${Math.abs(countdown)}d overdue` : `${countdown}d left`}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{u.requestStatus}</td>
                <td className="px-3 py-2 whitespace-nowrap">{u.responsibleParty}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(u.lastFollowUpDate)}</td>
                <td className="px-3 py-2 text-center">{u.followUpAttempts}</td>
                <td className="px-3 py-2 text-center">{u.daysWaiting ?? "—"}</td>
                <td className="px-3 py-2 text-center font-medium">{u.daysOverdue > 0 ? u.daysOverdue : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {u.aiIssueCategory}
                  {u.aiNeedsReview && (
                    <span className="ml-1 rounded bg-yellow-100 dark:bg-yellow-900/40 px-1 text-[10px] text-yellow-800 dark:text-yellow-300">
                      review
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs truncate" title={u.originalNotes}>
                  {u.originalNotes || "—"}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={16} className="px-3 py-8 text-center text-slate-400">
                No units match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
