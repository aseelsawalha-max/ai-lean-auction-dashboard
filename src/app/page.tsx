"use client";

import { useMemo, useState } from "react";
import { AUCTION_UNITS, AUCTION_CYCLES, FACILITIES, MANAGERS } from "@/lib/sheetsImport";
import { enrichUnits, computeKPIs } from "@/lib/calculations";
import { applyFilters, EMPTY_FILTERS, type FilterState } from "@/lib/filters";
import type { AuctionUnit } from "@/lib/types";
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

export default function DashboardPage() {
  const [section, setSection] = useState<Section>("Overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Admin corrections to AI classifications, keyed by unit id. In-memory
  // only — there's no persistence layer yet (see README "Known gaps").
  const [overrides, setOverrides] = useState<Record<string, NonNullable<AuctionUnit["manualOverride"]>>>({});

  const today = useMemo(() => new Date(), []);
  const unitsWithOverrides = useMemo(
    () => AUCTION_UNITS.map((u) => (overrides[u.id] ? { ...u, manualOverride: overrides[u.id] } : u)),
    [overrides]
  );
  const allEnriched = useMemo(() => enrichUnits(unitsWithOverrides, today), [unitsWithOverrides, today]);
  const filtered = useMemo(() => applyFilters(allEnriched, filters), [allEnriched, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);

  function handleOverride(unitId: string, override: NonNullable<AuctionUnit["manualOverride"]> | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (override === null) delete next[unitId];
      else next[unitId] = override;
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
