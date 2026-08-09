"use client";

import type { AuctionCycle, EnrichedUnit, Facility } from "@/lib/types";
import { generateInsights } from "@/lib/insights";

interface AIInsightsPanelProps {
  units: EnrichedUnit[];
  cycles: AuctionCycle[];
  facilities: Facility[];
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200",
  warning: "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
  info: "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200",
};

export default function AIInsightsPanel({ units, cycles, facilities }: AIInsightsPanelProps) {
  const insights = generateInsights(units, cycles, facilities);

  const needsReviewUnits = units.filter((u) => u.aiNeedsReview && u.requestStatus !== "Not Requested");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-lg border-l-4 p-3 text-sm ${SEVERITY_STYLE[insight.severity]}`}>
            {insight.text}
          </div>
        ))}
      </div>

      {needsReviewUnits.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Ambiguous Classifications Awaiting Admin Review ({needsReviewUnits.length})
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            These notes did not clearly indicate a responsible party. They are classified as Unknown / low-confidence rather than assumed to be BOG-related, per policy.
          </p>
          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">AI Category</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2 min-w-[240px]">Original Note</th>
                </tr>
              </thead>
              <tbody>
                {needsReviewUnits.slice(0, 20).map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2 font-medium">{u.unitNumber}</td>
                    <td className="px-3 py-2">{u.aiIssueCategory}</td>
                    <td className="px-3 py-2">{(u.aiConfidenceScore * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2">{u.originalNotes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
