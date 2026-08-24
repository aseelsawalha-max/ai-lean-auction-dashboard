// Manual-correction layer for AI classifications, per the spec's "Admins
// can correct AI classifications" / "never overwrite AI output without
// confirmation" requirements. The AI's original call always stays on
// aiIssueCategory-as-classified in the source data; an override replaces
// what the dashboard *displays and calculates on*, while manualOverride
// keeps the audit trail (who, when, what it was overridden to).
//
// There's no backend yet (see README "Known gaps"), so overrides persist to
// localStorage rather than a database. Swapping in a real API call is a
// one-function change: replace loadOverrides/saveOverrides.

import { useSyncExternalStore } from "react";
import type { AIIssueCategory, AuctionUnit, ResponsibleParty } from "./types";

export interface ManualOverridePatch {
  responsibleParty?: ResponsibleParty;
  aiIssueCategory?: AIIssueCategory;
}

export type OverrideMap = Record<
  string,
  ManualOverridePatch & { overriddenBy: string; overriddenAt: string }
>;

const STORAGE_KEY = "auction-dashboard-manual-overrides:v1";

// Module-level cache backing useSyncExternalStore below: getSnapshot must
// return a stable reference when nothing changed, so we read localStorage
// once (lazily, on first client read) and only refresh it on writes.
let cachedSnapshot: OverrideMap = {};
let cachedLoaded = false;
const listeners = new Set<() => void>();

function readFromStorage(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}

function getSnapshot(): OverrideMap {
  if (!cachedLoaded) {
    cachedSnapshot = readFromStorage();
    cachedLoaded = true;
  }
  return cachedSnapshot;
}

const EMPTY_SNAPSHOT: OverrideMap = {};

function getServerSnapshot(): OverrideMap {
  return EMPTY_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function writeOverrides(next: OverrideMap): void {
  cachedSnapshot = next;
  cachedLoaded = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private-mode / quota errors: the override still applies for this
      // session via the in-memory cache above, it just won't survive a reload.
    }
  }
  listeners.forEach((l) => l());
}

// Reads the current overrides and returns a setter, using
// useSyncExternalStore so the localStorage read is hydration-safe (server
// and first client render both see {}, then React resyncs to the real
// client value) without resorting to a setState-in-effect anti-pattern.
export function useManualOverrides(): [OverrideMap, (unitId: string, patch: ManualOverridePatch) => void] {
  const overrides = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  function setOverride(unitId: string, patch: ManualOverridePatch) {
    writeOverrides({
      ...getSnapshot(),
      [unitId]: { ...patch, overriddenBy: "Admin", overriddenAt: new Date().toISOString() },
    });
  }
  return [overrides, setOverride];
}

export function applyManualOverrides(units: AuctionUnit[], overrides: OverrideMap): AuctionUnit[] {
  return units.map((unit) => {
    const entry = overrides[unit.id];
    if (!entry) return unit;
    return {
      ...unit,
      responsibleParty: entry.responsibleParty ?? unit.responsibleParty,
      aiIssueCategory: entry.aiIssueCategory ?? unit.aiIssueCategory,
      aiNeedsReview: false,
      manualOverride: {
        responsibleParty: entry.responsibleParty,
        aiIssueCategory: entry.aiIssueCategory,
        overriddenBy: entry.overriddenBy,
        overriddenAt: entry.overriddenAt,
      },
    };
  });
}
