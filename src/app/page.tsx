"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AUCTION_UNITS, AUCTION_CYCLES, FACILITIES, MANAGERS } from "@/lib/sheetsImport";
import { enrichUnits, computeKPIs } from "@/lib/calculations";
import { applyFilters, EMPTY_FILTERS, type FilterState } from "@/lib/filters";
import type { ManualOverride } from "@/lib/types";
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

const OVERRIDES_STORAGE_KEY = "ai-lean-auction-overrides";
// Fired whenever this tab writes to localStorage, so useSyncExternalStore
// picks up same-tab changes too (the native "storage" event only fires for
// *other* tabs/windows).
const OVERRIDES_CHANGED_EVENT = "ai-lean-auction-overrides-changed";

function subscribeToOverrides(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(OVERRIDES_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(OVERRIDES_CHANGED_EVENT, callback);
  };
}

function getOverridesSnapshot(): string {
  return window.localStorage.getItem(OVERRIDES_STORAGE_KEY) ?? "{}";
}

// The dashboard is statically prerendered, so the server never has a real
// localStorage value — always render "no overrides" for the server/first-
// paint snapshot and let useSyncExternalStore swap in the real value after
// mount, without triggering a hydration-mismatch error.
function getOverridesServerSnapshot(): string {
  return "{}";
}

function writeOverrides(next: Record<string, ManualOverride>) {
  try {
    window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(OVERRIDES_CHANGED_EVENT));
  } catch {
    // best-effort persistence only
  }
}

export default function DashboardPage() {
  const [section, setSection] = useState<Section>("Overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Manual corrections to AI classifications, keyed by unit id. This is a
  // prototype-grade persistence layer (per-browser localStorage) since the
  // dashboard has no backend yet — see README "Known gaps". The underlying
  // AI classification in AUCTION_UNITS is never mutated by this.
  const overridesRaw = useSyncExternalStore(subscribeToOverrides, getOverridesSnapshot, getOverridesServerSnapshot);
  const overrides = useMemo<Record<string, ManualOverride>>(() => {
    try {
      return JSON.parse(overridesRaw);
    } catch {
      return {};
    }
  }, [overridesRaw]);

  function handleOverride(unitId: string, patch: Partial<ManualOverride>) {
    const merged: ManualOverride = { ...overrides[unitId], ...patch, overriddenBy: "Admin", overriddenAt: new Date().toISOString() };
    const next = { ...overrides };
    if (!merged.responsibleParty && !merged.aiIssueCategory) {
      delete next[unitId];
    } else {
      next[unitId] = merged;
    }
    writeOverrides(next);
  }

  const today = useMemo(() => new Date(), []);
  const aiOriginalById = useMemo(
    () => new Map(AUCTION_UNITS.map((u) => [u.id, { responsibleParty: u.responsibleParty, aiIssueCategory: u.aiIssueCategory }])),
    []
  );
  const unitsWithOverrides = useMemo(
    () => (Object.keys(overrides).length === 0 ? AUCTION_UNITS : AUCTION_UNITS.map((u) => (overrides[u.id] ? { ...u, manualOverride: overrides[u.id] } : u))),
    [overrides]
  );
  const allEnriched = useMemo(() => enrichUnits(unitsWithOverrides, today), [unitsWithOverrides, today]);
  const filtered = useMemo(() => applyFilters(allEnriched, filters), [allEnriched, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);

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
                aiOriginalById={aiOriginalById}
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
              aiOriginalById={aiOriginalById}
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
