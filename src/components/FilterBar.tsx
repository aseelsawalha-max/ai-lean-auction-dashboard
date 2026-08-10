"use client";

import type { FilterState } from "@/lib/filters";
import { EMPTY_FILTERS, hasActiveFilters } from "@/lib/filters";
import type { Facility, Manager, AuctionCycle, RequestStatus, ResponsibleParty, AIIssueCategory } from "@/lib/types";
import { RESPONSIBLE_PARTIES, ISSUE_CATEGORIES } from "@/lib/ui";
import MultiSelect from "./MultiSelect";

const REQUEST_STATUSES: RequestStatus[] = [
  "Not Requested",
  "Requested - Awaiting Response",
  "Responded - Photos Uploaded",
  "Delayed / No Response",
  "Escalation Needed",
  "Completed",
  "Cancelled / No Longer Going to Auction",
];

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  managers: Manager[];
  facilities: Facility[];
  cycles: AuctionCycle[];
}

export default function FilterBar({ filters, onChange, managers, facilities, cycles }: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <MultiSelect
        label="Manager"
        options={managers.map((m) => ({ value: m.id, label: m.name }))}
        selected={filters.managerIds}
        onChange={(v) => set("managerIds", v)}
      />
      <MultiSelect
        label="Facility"
        options={facilities.map((f) => ({ value: f.id, label: f.name }))}
        selected={filters.facilityIds}
        onChange={(v) => set("facilityIds", v)}
      />
      <MultiSelect
        label="Auction Cycle"
        options={cycles.map((c) => ({ value: c.id, label: c.name }))}
        selected={filters.auctionCycleIds}
        onChange={(v) => set("auctionCycleIds", v)}
      />
      <MultiSelect
        label="Request Status"
        options={REQUEST_STATUSES.map((s) => ({ value: s, label: s }))}
        selected={filters.requestStatuses}
        onChange={(v) => set("requestStatuses", v as RequestStatus[])}
      />
      <MultiSelect
        label="Responsible Party"
        options={RESPONSIBLE_PARTIES.map((s) => ({ value: s, label: s }))}
        selected={filters.responsibleParties}
        onChange={(v) => set("responsibleParties", v as ResponsibleParty[])}
      />
      <MultiSelect
        label="Issue Category"
        options={ISSUE_CATEGORIES.map((s) => ({ value: s, label: s }))}
        selected={filters.issueCategories}
        onChange={(v) => set("issueCategories", v as AIIssueCategory[])}
      />

      <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(e) => set("overdueOnly", e.target.checked)}
          className="rounded border-slate-300"
        />
        Overdue only
      </label>
      <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={filters.notOverdueOnly}
          onChange={(e) => set("notOverdueOnly", e.target.checked)}
          className="rounded border-slate-300"
        />
        Not overdue
      </label>

      <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
        <span className="text-slate-400">From</span>
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => set("dateFrom", e.target.value || null)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
        />
        <span className="text-slate-400">To</span>
        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => set("dateTo", e.target.value || null)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
        />
      </div>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="ml-auto text-sm text-blue-600 hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
