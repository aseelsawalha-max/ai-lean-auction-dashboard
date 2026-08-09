"use client";

import { useState } from "react";
import type { AuctionCycle, EnrichedUnit, Facility, Manager } from "@/lib/types";
import { generateWeeklySummary, generateMonthlyReport } from "@/lib/reports";
import { unitsToCsv, downloadCsv } from "@/lib/csvExport";
import { formatDate, formatPct } from "@/lib/ui";

interface ReportsPanelProps {
  allUnits: EnrichedUnit[];
  filteredUnits: EnrichedUnit[];
  managers: Manager[];
  facilities: Facility[];
  cycles: AuctionCycle[];
  today: Date;
}

export default function ReportsPanel({ allUnits, filteredUnits, managers, facilities, cycles, today }: ReportsPanelProps) {
  const sortedCycles = [...cycles].sort((a, b) => new Date(a.cycleDate).getTime() - new Date(b.cycleDate).getTime());
  const [selectedCycleId, setSelectedCycleId] = useState(sortedCycles[sortedCycles.length - 1]?.id ?? "");

  const weekly = generateWeeklySummary(allUnits, managers, today);
  const monthly = generateMonthlyReport(allUnits, cycles, facilities, managers, selectedCycleId);
  const cycleNameById = new Map(cycles.map((c) => [c.id, c.name]));

  function exportFiltered() {
    const csv = unitsToCsv(filteredUnits, managers, facilities, cycleNameById);
    downloadCsv(`auction-units-export-${today.toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Export Data</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exports respect the filters currently applied on the dashboard ({filteredUnits.length} of {allUnits.length} units).
            </p>
          </div>
          <button
            onClick={exportFiltered}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Export CSV (Excel-compatible)
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Weekly Operations Summary — generated {formatDate(weekly.generatedFor)}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Pending Units" value={weekly.overall.pendingRequests} />
          <Stat label="Overdue Units" value={weekly.overall.overdueRequests} />
          <Stat label="Escalations" value={weekly.overall.escalationsNeeded} />
          <Stat label="On-Time %" value={formatPct(weekly.overall.onTimePhotoPct)} />
          <Stat label="BOG Delays" value={weekly.overall.bogDelays} />
          <Stat label="Owner Delays" value={weekly.overall.ownerDelays} />
          <Stat
            label="Avg Response"
            value={weekly.overall.avgResponseTimeDays !== null ? `${weekly.overall.avgResponseTimeDays.toFixed(1)}d` : "—"}
          />
        </div>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">By Manager</h4>
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Pending</th>
                <th className="px-3 py-2">Overdue</th>
                <th className="px-3 py-2">Escalations</th>
                <th className="px-3 py-2">BOG</th>
                <th className="px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {weekly.byManager.map((m) => (
                <tr key={m.managerId} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="px-3 py-2 font-medium">{m.managerName}</td>
                  <td className="px-3 py-2 text-center">{m.activeUnits}</td>
                  <td className="px-3 py-2 text-center">{m.pendingRequests}</td>
                  <td className="px-3 py-2 text-center">{m.overdueUnits}</td>
                  <td className="px-3 py-2 text-center">{m.escalations}</td>
                  <td className="px-3 py-2 text-center">{m.bogDelays}</td>
                  <td className="px-3 py-2 text-center">{m.ownerDelays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Action Items ({weekly.actionItems.length})
        </h4>
        <ul className="space-y-1 text-sm">
          {weekly.actionItems.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <span className="rounded-full bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300">
                {u.severity}
              </span>
              {u.unitNumber} — {facilities.find((f) => f.id === u.facilityId)?.name} — {u.daysOverdue}d overdue —{" "}
              {u.responsibleParty}
            </li>
          ))}
          {weekly.actionItems.length === 0 && <li className="text-slate-400">No critical or high-severity units.</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly AI Operations Report</h3>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
          >
            {sortedCycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {monthly && (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Executive Summary
              </h4>
              <p>{monthly.executiveSummary}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Root Cause Breakdown
              </h4>
              <p>
                BOG: {monthly.currentStats.bogDelays} · Owner: {monthly.currentStats.ownerDelays} · Other/Unknown:{" "}
                {monthly.currentStats.otherDelays}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Facility Analysis
              </h4>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Recurring BOG issues: {monthly.facilityHighlights.recurringBog.join("; ") || "None"}</li>
                <li>Recurring owner issues: {monthly.facilityHighlights.recurringOwner.join("; ") || "None"}</li>
                <li>Highest overdue rate: {monthly.facilityHighlights.highestOverdue ?? "N/A"}</li>
                <li>Highest follow-up requirement: {monthly.facilityHighlights.highestFollowUp ?? "N/A"}</li>
                <li>Biggest improvement: {monthly.facilityHighlights.biggestImprovement ?? "N/A"}</li>
                <li>Biggest decline: {monthly.facilityHighlights.biggestDecline ?? "N/A"}</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Trend
              </h4>
              <p>{monthly.trend} vs. prior cycle.</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Recommendations
              </h4>
              <ul className="list-disc list-inside space-y-0.5">
                {monthly.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
