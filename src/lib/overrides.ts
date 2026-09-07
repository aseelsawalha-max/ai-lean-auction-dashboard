// Manual-correction layer for AI classifications (spec section 16: "Allow
// Admins to correct AI classifications"). No backend/persistence layer
// exists yet (see README "Known gaps"), so corrections are kept in
// localStorage, keyed by the unit's stable `sourceRowKey` so they survive
// re-imports that regenerate synthetic `id`s. Applying an override never
// touches `originalNotes`, `aiRootCause`, or `aiConfidenceScore` — only the
// two fields the spec explicitly allows an Admin to correct.
//
// Modeled as a module-level external store (read via useSyncExternalStore
// in the UI) rather than component state, since the source of truth is
// localStorage, not React — this keeps the server-rendered snapshot ({})
// and the post-hydration client snapshot from ever conflicting.

import type { AuctionUnit } from "./types";

export type ManualOverride = NonNullable<AuctionUnit["manualOverride"]>;
export type OverrideMap = Record<string, ManualOverride>;
export type OverridePatch = Pick<ManualOverride, "responsibleParty" | "aiIssueCategory">;

const STORAGE_KEY = "auction-dashboard-manual-overrides:v1";

const EMPTY_OVERRIDES: OverrideMap = {};

let overrides: OverrideMap = EMPTY_OVERRIDES;
let hydrated = false;
const listeners = new Set<() => void>();

function readFromStorage(): OverrideMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as OverrideMap) : EMPTY_OVERRIDES;
  } catch {
    return EMPTY_OVERRIDES;
  }
}

function writeToStorage(next: OverrideMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable/full — override still applies for this session,
    // it just won't persist across reloads.
  }
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  overrides = readFromStorage();
}

export function subscribeOverrides(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOverridesSnapshot(): OverrideMap {
  ensureHydrated();
  return overrides;
}

export function getServerOverridesSnapshot(): OverrideMap {
  return EMPTY_OVERRIDES;
}

export function setOverride(sourceRowKey: string, patch: OverridePatch, overriddenBy: string): void {
  ensureHydrated();
  overrides = {
    ...overrides,
    [sourceRowKey]: {
      ...overrides[sourceRowKey],
      ...patch,
      overriddenBy,
      overriddenAt: new Date().toISOString(),
    },
  };
  writeToStorage(overrides);
  listeners.forEach((listener) => listener());
}

export function applyOverrides(units: AuctionUnit[], map: OverrideMap): AuctionUnit[] {
  if (Object.keys(map).length === 0) return units;
  return units.map((u) => {
    const override = map[u.sourceRowKey];
    if (!override) return u;
    return {
      ...u,
      responsibleParty: override.responsibleParty ?? u.responsibleParty,
      aiIssueCategory: override.aiIssueCategory ?? u.aiIssueCategory,
      manualOverride: override,
    };
  });
}
