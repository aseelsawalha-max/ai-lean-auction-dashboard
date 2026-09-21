"use client";

import { useEffect, useMemo, useState } from "react";
import { AUCTION_UNITS, AUCTION_CYCLES, FACILITIES, MANAGERS } from "@/lib/sheetsImport";
import { enrichUnits, computeKPIs } from "@/lib/calculations";
import { applyFilters, EMPTY_FILTERS, type FilterState } from "@/lib/filters";
import { applyOverrides, loadOverrides, saveOverrides, type OverrideMap } from "@/lib/overrides";
import type { AIIssueCategory, ResponsibleParty } from "@/lib/types";
import KpiCards from "@/components/KpiCards";
import FilterBar from "@/components/FilterBar";
import UnitsTable from "@/components/UnitsTable";
import CycleAnalytics from "@/components/CycleAnalytics";
import FacilityPerformance from "@/components/FacilityPerformance";
import AIInsightsPanel from "@/components/AIInsightsPanel";
import ReportsPanel from "@/components/ReportsPanel";

const SECTIONS = [
  "Overview",
  "Current Auction Units",
  "Auction Cycle Analytics",
  "Facility & BOG Performance",
  "AI Insights",
  "Reports",
] as const;
type Section = (typeof SECTIONS)[number];

// No auth layer yet (see README), so there's no session user to attribute
// manual AI-classification corrections to. Falls back to the operator
// account this environment is provisioned for.
const CURRENT_ADMIN = "aseel.sawalha@whitelabelstorage.com";

export default function DashboardPage() {
  const [section, setSection] = useState<Section>("Overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [overrides, setOverrides] = useState<OverrideMap>({});

  // Overrides are persisted client-side (localStorage) rather than in a
  // database — see "Known gaps" in the README. Loaded after mount (not via
  // lazy useState init) to avoid an SSR/client markup mismatch, since this
  // page is statically prerendered.
  useEffect(() => {
    const stored = loadOverrides();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted overrides from localStorage, not synced state
    setOverrides(stored);
  }, []);

  const today = useMemo(() => new Date(), []);
  const overriddenUnits = useMemo(() => applyOverrides(AUCTION_UNITS, overrides), [overrides]);
  const allEnriched = useMemo(() => enrichUnits(overriddenUnits, today), [overriddenUnits, today]);
  const filtered = useMemo(() => applyFilters(allEnriched, filters), [allEnriched, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);

  function handleOverride(unitId: string, patch: { responsibleParty?: ResponsibleParty; aiIssueCategory?: AIIssueCategory }) {
    setOverrides((prev) => {
      const existing = prev[unitId];
      const next: OverrideMap = {
        ...prev,
        [unitId]: {
          responsibleParty: patch.responsibleParty ?? existing?.responsibleParty,
          aiIssueCategory: patch.aiIssueCategory ?? existing?.aiIssueCategory,
          overriddenBy: CURRENT_ADMIN,
          overriddenAt: new Date().toISOString(),
        },
      };
      saveOverrides(next);
      return next;
    });
  }

  function handleResetOverride(unitId: string) {
    setOverrides((prev) => {
      if (!(unitId in prev)) return prev;
      const next = { ...prev };
      delete next[unitId];
      saveOverrides(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <h1 className="text-xl font-semibold">AI Lean Auction Photo Tracking &amp; Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Admin Operations Dashboard</p>
        </div>
        <nav className="mx-auto max-w-[1600px] px-6">
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  section === s
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
        <FilterBar filters={filters} onChange={setFilters} managers={MANAGERS} facilities={FACILITIES} cycles={AUCTION_CYCLES} />

        {section === "Overview" && (
          <div className="space-y-6">
            <KpiCards kpis={kpis} />
            <div>
              <h2 className="mb-3 text-lg font-semibold">Units Requiring Attention</h2>
              <UnitsTable
                units={filtered.filter((u) => u.severity === "Critical" || u.severity === "High")}
                managers={MANAGERS}
                facilities={FACILITIES}
                cycles={AUCTION_CYCLES}
                onOverride={handleOverride}
                onResetOverride={handleResetOverride}
              />
            </div>
          </div>
        )}

        {section === "Current Auction Units" && (
          <div className="space-y-4">
            <KpiCards kpis={kpis} />
            <UnitsTable
              units={filtered}
              managers={MANAGERS}
              facilities={FACILITIES}
              cycles={AUCTION_CYCLES}
              onOverride={handleOverride}
              onResetOverride={handleResetOverride}
            />
          </div>
        )}

        {section === "Auction Cycle Analytics" && <CycleAnalytics units={filtered} cycles={AUCTION_CYCLES} />}

        {section === "Facility & BOG Performance" && (
          <FacilityPerformance units={filtered} facilities={FACILITIES} managers={MANAGERS} />
        )}

        {section === "AI Insights" && <AIInsightsPanel units={filtered} cycles={AUCTION_CYCLES} facilities={FACILITIES} />}

        {section === "Reports" && (
          <ReportsPanel
            allUnits={allEnriched}
            filteredUnits={filtered}
            managers={MANAGERS}
            facilities={FACILITIES}
            cycles={AUCTION_CYCLES}
            today={today}
          />
        )}
      </main>
    </div>
  );
}
