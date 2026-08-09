"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AuctionCycle, EnrichedUnit } from "@/lib/types";
import { computeCycleStats, onTimeTrend } from "@/lib/analytics";
import { formatPct } from "@/lib/ui";

interface CycleAnalyticsProps {
  units: EnrichedUnit[];
  cycles: AuctionCycle[];
}

const TREND_STYLE: Record<string, string> = {
  Improving: "text-emerald-600 dark:text-emerald-400",
  Declining: "text-red-600 dark:text-red-400",
  Stable: "text-slate-500 dark:text-slate-400",
};

export default function CycleAnalytics({ units, cycles }: CycleAnalyticsProps) {
  const sortedCycles = [...cycles].sort((a, b) => new Date(a.cycleDate).getTime() - new Date(b.cycleDate).getTime());
  const stats = sortedCycles.map((c) => computeCycleStats(units, c));
  const trend = onTimeTrend(stats);

  const chartData = stats.map((s) => ({
    name: s.cycleName,
    "On-Time %": s.onTimeCompletionRate ?? 0,
    "BOG Delays": s.bogDelays,
    "Owner Delays": s.ownerDelays,
    "Other Delays": s.otherDelays,
    "Avg Days Overdue": s.avgDaysOverdue ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Overall on-time completion trend</div>
          <div className={`text-xl font-semibold ${TREND_STYLE[trend]}`}>{trend}</div>
        </div>
        <div className="flex gap-6 text-right">
          {stats.map((s) => (
            <div key={s.cycleId}>
              <div className="text-xs text-slate-400">{s.cycleName}</div>
              <div className="text-lg font-semibold">{formatPct(s.onTimeCompletionRate)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">On-Time Completion % by Cycle</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="On-Time %" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Delays by Responsible Party</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="BOG Delays" fill="#dc2626" />
              <Bar dataKey="Owner Delays" fill="#d97706" />
              <Bar dataKey="Other Delays" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Cycle</th>
              <th className="px-3 py-2">Total Units</th>
              <th className="px-3 py-2">Requests</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">On Time</th>
              <th className="px-3 py-2">Late</th>
              <th className="px-3 py-2">Overdue</th>
              <th className="px-3 py-2">BOG</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Other</th>
              <th className="px-3 py-2">Avg Response (d)</th>
              <th className="px-3 py-2">Avg Overdue (d)</th>
              <th className="px-3 py-2">Avg Follow-Ups</th>
              <th className="px-3 py-2">Escalation Rate</th>
              <th className="px-3 py-2">On-Time Rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.cycleId} className="border-b border-slate-100 dark:border-slate-800/60">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{s.cycleName}</td>
                <td className="px-3 py-2 text-center">{s.totalUnits}</td>
                <td className="px-3 py-2 text-center">{s.totalPhotoRequests}</td>
                <td className="px-3 py-2 text-center">{s.photosReceived}</td>
                <td className="px-3 py-2 text-center">{s.onTime}</td>
                <td className="px-3 py-2 text-center">{s.late}</td>
                <td className="px-3 py-2 text-center">{s.overdueUnits}</td>
                <td className="px-3 py-2 text-center">{s.bogDelays}</td>
                <td className="px-3 py-2 text-center">{s.ownerDelays}</td>
                <td className="px-3 py-2 text-center">{s.otherDelays}</td>
                <td className="px-3 py-2 text-center">{s.avgResponseTimeDays?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2 text-center">{s.avgDaysOverdue?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2 text-center">{s.avgFollowUpAttempts?.toFixed(1) ?? "—"}</td>
                <td className="px-3 py-2 text-center">{formatPct(s.escalationRate)}</td>
                <td className="px-3 py-2 text-center font-medium">{formatPct(s.onTimeCompletionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
