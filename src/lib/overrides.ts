import type { AuctionUnit, AIIssueCategory, ResponsibleParty } from "./types";

// Client-side implementation of the spec's "Allow Admins to correct AI
// classifications" safeguard. There's no backend yet (see README — no
// persistence layer), so corrections are stored in the browser's
// localStorage rather than a database. The override map is keyed by
// AuctionUnit.id and merged onto the imported units on every load; the
// AI's original call is never discarded, only shadowed by the correction
// (see the `manualOverride` field on AuctionUnit).

const STORAGE_KEY = "auction-dashboard.manual-overrides.v1";

export interface OverrideEntry {
  responsibleParty?: ResponsibleParty;
  aiIssueCategory?: AIIssueCategory;
  overriddenBy: string;
  overriddenAt: string; // ISO datetime
}

export type OverrideMap = Record<string, OverrideEntry>;

export function loadOverrides(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: OverrideMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.) —
    // the correction still applies for the current session via React state.
  }
}

// Merges manual corrections onto the imported units *before* enrichment, so
// every downstream consumer (KPIs, cycle/facility analytics, insights,
// reports, CSV export) sees the corrected value without needing to know
// overrides exist. The AI's original classification is preserved on
// `manualOverride` for audit/display rather than being lost.
export function applyOverrides(units: AuctionUnit[], overrides: OverrideMap): AuctionUnit[] {
  return units.map((u) => {
    const entry = overrides[u.id];
    if (!entry) return u;
    return {
      ...u,
      responsibleParty: entry.responsibleParty ?? u.responsibleParty,
      aiIssueCategory: entry.aiIssueCategory ?? u.aiIssueCategory,
      manualOverride: {
        responsibleParty: entry.responsibleParty,
        aiIssueCategory: entry.aiIssueCategory,
        overriddenBy: entry.overriddenBy,
        overriddenAt: entry.overriddenAt,
        originalResponsibleParty: u.responsibleParty,
        originalAIIssueCategory: u.aiIssueCategory,
      },
    };
  });
}
