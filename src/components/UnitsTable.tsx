"use client";

import { Fragment, useState } from "react";
import type { EnrichedUnit, Facility, Manager, AuctionCycle, AuctionUnit, ResponsibleParty, AIIssueCategory } from "@/lib/types";
import { RESPONSIBLE_PARTIES, AI_ISSUE_CATEGORIES } from "@/lib/types";
import { sortUnits } from "@/lib/calculations";
import { SEVERITY_STYLES, rowColorClass, formatDate } from "@/lib/ui";

type ManualOverride = NonNullable<AuctionUnit["manualOverride"]>;

interface UnitsTableProps {
  units: EnrichedUnit[];
  managers: Manager[];
  facilities: Facility[];
  cycles: AuctionCycle[];
  onOverride?: (unitId: string, override: ManualOverride | null) => void;
}

export default function UnitsTable({ units, managers, facilities, cycles, onOverride }: UnitsTableProps) {
  const sorted = sortUnits(units);
  const [editingId, setEditingId] = useState<string | null>(null);
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
            {onOverride && <th className="px-3 py-2">Correct</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) => {
            const sev = SEVERITY_STYLES[u.severity];
            const countdown = u.deadlineCountdown;
            const isCorrected = !!u.manualOverride;
            const isEditing = editingId === u.id;
            return (
              <Fragment key={u.id}>
                <tr
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    {u.responsibleParty}
                    {isCorrected && u.manualOverride?.responsibleParty && (
                      <span
                        className="ml-1 rounded bg-blue-100 dark:bg-blue-900/40 px-1 text-[10px] text-blue-800 dark:text-blue-300"
                        title={`AI originally classified this as ${u.aiOriginalResponsibleParty}`}
                      >
                        corrected
                      </span>
                    )}
                  </td>
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
                    {isCorrected && u.manualOverride?.aiIssueCategory && (
                      <span
                        className="ml-1 rounded bg-blue-100 dark:bg-blue-900/40 px-1 text-[10px] text-blue-800 dark:text-blue-300"
                        title={`AI originally classified this as ${u.aiOriginalAiIssueCategory}`}
                      >
                        corrected
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={u.originalNotes}>
                    {u.originalNotes || "—"}
                  </td>
                  {onOverride && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : u.id)}
                        className="rounded border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {isEditing ? "Close" : isCorrected ? "Edit" : "Correct"}
                      </button>
                    </td>
                  )}
                </tr>
                {isEditing && onOverride && (
                  <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/60">
                    <td colSpan={17} className="px-3 py-3">
                      <CorrectionEditor
                        unit={u}
                        onSave={(override) => {
                          onOverride(u.id, override);
                          setEditingId(null);
                        }}
                        onClear={() => {
                          onOverride(u.id, null);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={onOverride ? 17 : 16} className="px-3 py-8 text-center text-slate-400">
                No units match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CorrectionEditor({
  unit,
  onSave,
  onClear,
  onCancel,
}: {
  unit: EnrichedUnit;
  onSave: (override: ManualOverride) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [responsibleParty, setResponsibleParty] = useState<ResponsibleParty>(unit.responsibleParty);
  const [aiIssueCategory, setAiIssueCategory] = useState<AIIssueCategory>(unit.aiIssueCategory);
  const [overriddenBy, setOverriddenBy] = useState(unit.manualOverride?.overriddenBy ?? "");

  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        AI originally classified: <span className="font-medium">{unit.aiOriginalResponsibleParty}</span> /{" "}
        <span className="font-medium">{unit.aiOriginalAiIssueCategory}</span>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Responsible Party</span>
        <select
          value={responsibleParty}
          onChange={(e) => setResponsibleParty(e.target.value as ResponsibleParty)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
        >
          {RESPONSIBLE_PARTIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">AI Issue Category</span>
        <select
          value={aiIssueCategory}
          onChange={(e) => setAiIssueCategory(e.target.value as AIIssueCategory)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
        >
          {AI_ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Corrected by</span>
        <input
          type="text"
          value={overriddenBy}
          onChange={(e) => setOverriddenBy(e.target.value)}
          placeholder="Your name"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!overriddenBy.trim()}
          onClick={() =>
            onSave({
              responsibleParty,
              aiIssueCategory,
              overriddenBy: overriddenBy.trim(),
              overriddenAt: new Date().toISOString().slice(0, 10),
            })
          }
          className="rounded-md bg-blue-600 px-3 py-1 text-white disabled:opacity-40"
          title={!overriddenBy.trim() ? "Enter your name to save a correction" : undefined}
        >
          Save
        </button>
        {unit.manualOverride && (
          <button type="button" onClick={onClear} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1">
            Revert to AI
          </button>
        )}
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1">
          Cancel
        </button>
      </div>
    </div>
  );
}
