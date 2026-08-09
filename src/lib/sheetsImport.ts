import type { AuctionCycle, AuctionUnit, Facility, Manager, RequestStatus, ResponsibleParty } from "./types";
import { classifyNote } from "./classifier";
import { extractNoteTimeline } from "./noteTimeline";
import rawRows from "@/data/raw-imported-rows.json";

// Import pipeline for the real July/August 2026 Google Sheets tracking
// exports. The source sheets are one tab per Site Manager, with column
// names, notes-column naming, and photo-status vocabulary that vary from
// tab to tab — see src/data/raw-imported-rows.json, which already went
// through mechanical column-name standardization (see scripts note below).
// This module does the business-logic standardization: batch/deadline
// resolution, request-status inference, and note classification.
//
// Known gaps in the source data (not fabricated here — left null/absent
// instead, per the "never invent data" rule):
//   - No dedicated "photo request date" or "photos received date" column.
//     Both are recovered only where a date is explicitly written into the
//     notes text (see noteTimeline.ts); otherwise left null.
//   - No dedicated "follow-up count" column. Recovered the same way, from
//     "Followed up on ..." phrasing in notes; otherwise 0.
//   - Physical security fields present in the source (lock codes, gate
//     codes, key access instructions) are intentionally excluded from this
//     import — they aren't part of the dashboard's data model and
//     shouldn't be duplicated into another system.

interface RawRow {
  month: string;
  sourceSheetName: string;
  sourceRowKey: string;
  manager: string;
  facility: string | null;
  locationCode: string | null;
  unitNumber: string;
  auctionDate: string;
  notesRaw: string | null;
  photoStatusRaw: string | null;
}

const ROWS = rawRows as RawRow[];

// This import is a point-in-time snapshot of the shared sheets, not a live
// sync — "deadline passed" categorization below is evaluated against the
// date the snapshot was generated. Re-running the import later should bump
// this constant (or better, wire up a live Google Sheets connection).
const TODAY_ISO = "2026-08-09";

// Deadline rule as provided by Ops: the required photo-upload deadline is
// tied to the auction batch, not a fixed offset from the request date.
// 2026-08-19 appears in the source data (18 rows) but wasn't in the batch
// list provided — it's assumed to belong to the nearest batch (Batch 1,
// two days after 8/17) rather than dropped. Flagged in the import summary.
interface BatchDef {
  cycleId: string;
  cycleName: string;
  deadline: string;
  assumed?: boolean;
}

const BATCH_BY_DATE: Record<string, BatchDef> = {
  "2026-07-15": { cycleId: "jul-2026-b1", cycleName: "July 2026 — Batch 1 (7/15)", deadline: "2026-07-06" },
  "2026-07-22": { cycleId: "jul-2026-b2", cycleName: "July 2026 — Batch 2 (7/22–7/31)", deadline: "2026-07-17" },
  "2026-07-28": { cycleId: "jul-2026-b2", cycleName: "July 2026 — Batch 2 (7/22–7/31)", deadline: "2026-07-17" },
  "2026-07-31": { cycleId: "jul-2026-b2", cycleName: "July 2026 — Batch 2 (7/22–7/31)", deadline: "2026-07-17" },
  "2026-08-17": { cycleId: "aug-2026-b1", cycleName: "August 2026 — Batch 1 (8/17)", deadline: "2026-08-06" },
  "2026-08-19": { cycleId: "aug-2026-b1", cycleName: "August 2026 — Batch 1 (8/17)", deadline: "2026-08-06", assumed: true },
  "2026-08-26": { cycleId: "aug-2026-b2", cycleName: "August 2026 — Batch 2 (8/26)", deadline: "2026-08-15" },
};

const STATUS_TOKENS: Record<string, "received" | "not_received" | "requested" | "na" | "cancelled" | "escalate"> = {
  yes: "received",
  uploaded: "received",
  "yes.": "received",
  "uploaded.": "received",
  no: "not_received",
  "no.": "not_received",
  requested: "requested",
  "requested photos": "requested",
  "requested photo": "requested",
  "n/a": "na",
  na: "na",
  "tenant paid": "cancelled",
  "paid/removed from auction": "cancelled",
  "vacant & moved out": "cancelled",
  "sm audit needed": "escalate",
};

function normalizeStatusToken(raw: string | null): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

function isKnownStatusToken(raw: string | null): boolean {
  const norm = normalizeStatusToken(raw);
  return norm !== null && norm in STATUS_TOKENS;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const managerIds = new Map<string, string>();
const facilityIds = new Map<string, string>();
const facilityManager = new Map<string, string>();

function getManagerId(name: string): string {
  if (!managerIds.has(name)) managerIds.set(name, `mgr-${slugify(name)}`);
  return managerIds.get(name) as string;
}

function getFacilityId(name: string, managerId: string): string {
  const key = name;
  if (!facilityIds.has(key)) {
    facilityIds.set(key, `fac-${slugify(name)}`);
    facilityManager.set(key, managerId);
  }
  return facilityIds.get(key) as string;
}

export const importWarnings: string[] = [];

const cyclesSeen = new Map<string, AuctionCycle>();
const units: AuctionUnit[] = [];

for (const row of ROWS) {
  const batch = BATCH_BY_DATE[row.auctionDate];
  if (!batch) {
    importWarnings.push(`Unmapped auction date ${row.auctionDate} (${row.sourceRowKey}) — row skipped`);
    continue;
  }
  if (!cyclesSeen.has(batch.cycleId)) {
    cyclesSeen.set(batch.cycleId, {
      id: batch.cycleId,
      name: batch.cycleName,
      cycleDate: row.auctionDate,
      sourceSheetName: row.month,
    });
  }

  const managerName = row.manager;
  const managerId = getManagerId(managerName);
  const facilityName = row.facility ?? "Unknown Facility";
  const facilityId = getFacilityId(facilityName, managerId);

  const photoIsStatusWord = isKnownStatusToken(row.photoStatusRaw);
  const originalNotes = row.notesRaw ?? (photoIsStatusWord ? null : row.photoStatusRaw) ?? "";
  const classificationText = [row.notesRaw, !photoIsStatusWord ? row.photoStatusRaw : null].filter(Boolean).join(". ");
  const classification = classifyNote(classificationText);
  const cycleYear = parseInt(row.auctionDate.slice(0, 4), 10);
  const timeline = extractNoteTimeline(classificationText, cycleYear);

  const statusToken = photoIsStatusWord ? STATUS_TOKENS[normalizeStatusToken(row.photoStatusRaw) as string] : null;

  const deadlinePassed = batch.deadline < TODAY_ISO;
  const hasAnySignal = Boolean(row.notesRaw || row.photoStatusRaw);

  let requestStatus: RequestStatus;
  if (!hasAnySignal) {
    requestStatus = "Not Requested";
  } else if (statusToken === "received" || classification.category === "No Delay") {
    requestStatus = classification.category === "Unit no longer proceeding to auction" ? "Cancelled / No Longer Going to Auction" : "Responded - Photos Uploaded";
  } else if (statusToken === "cancelled" || classification.category === "Unit no longer proceeding to auction") {
    requestStatus = "Cancelled / No Longer Going to Auction";
  } else if (statusToken === "escalate") {
    requestStatus = "Escalation Needed";
  } else if (classification.category === "BOG no response" || classification.category === "BOG unavailable / turnover") {
    requestStatus = deadlinePassed ? "Escalation Needed" : "Delayed / No Response";
  } else if (
    classification.responsibleParty === "BOG" ||
    classification.responsibleParty === "Owner" ||
    classification.responsibleParty === "Site Manager"
  ) {
    requestStatus = deadlinePassed && timeline.followUpAttempts >= 2 ? "Escalation Needed" : "Delayed / No Response";
  } else if (statusToken === "requested" || timeline.requestDate) {
    requestStatus = deadlinePassed ? "Delayed / No Response" : "Requested - Awaiting Response";
  } else if (statusToken === "na") {
    requestStatus = "Not Requested";
  } else if (statusToken === "not_received") {
    requestStatus = deadlinePassed ? "Delayed / No Response" : "Requested - Awaiting Response";
  } else {
    requestStatus = deadlinePassed ? "Delayed / No Response" : "Requested - Awaiting Response";
  }

  let responsibleParty: ResponsibleParty = classification.responsibleParty;
  let aiIssueCategory = classification.category;
  let aiConfidenceScore = classification.confidence;
  let aiNeedsReview = classification.needsReview;
  let aiRootCause = classification.rootCause;

  // A unit that ultimately got its photos can still have been a BOG/owner
  // issue along the way (e.g. "Requested on 6.26.26. Followed up on
  // 6.29.26" with Photos = Yes) — keep that attribution so facility/BOG
  // rankings aren't blind to friction that got resolved. Only default to
  // "No Delay" when there's no textual evidence of friction at all.
  const hasExplicitIssueSignal =
    responsibleParty === "BOG" || responsibleParty === "Owner" || responsibleParty === "Site Manager" || responsibleParty === "Other";

  if (requestStatus === "Cancelled / No Longer Going to Auction") {
    responsibleParty = "No Delay";
    aiIssueCategory = "Unit no longer proceeding to auction";
    aiNeedsReview = false;
  } else if (requestStatus === "Responded - Photos Uploaded" && !hasExplicitIssueSignal) {
    responsibleParty = "No Delay";
    aiIssueCategory = "No Delay";
    aiConfidenceScore = Math.max(aiConfidenceScore, 0.7);
    aiNeedsReview = false;
  } else if (
    (requestStatus === "Delayed / No Response" || requestStatus === "Escalation Needed") &&
    responsibleParty === "Unknown"
  ) {
    responsibleParty = "BOG";
    aiConfidenceScore = 0.5;
    aiNeedsReview = true;
    aiRootCause = "No notes on file explaining the delay; defaulting to BOG as the standard photo-request channel — recommend admin verification.";
  }

  units.push({
    id: row.sourceRowKey,
    sourceRowKey: row.sourceRowKey,
    sourceSheetName: row.sourceSheetName,
    managerId,
    facilityId,
    unitNumber: row.unitNumber,
    auctionCycleId: batch.cycleId,
    unitAuctionStatus:
      requestStatus === "Cancelled / No Longer Going to Auction"
        ? "Cancelled"
        : requestStatus === "Responded - Photos Uploaded"
        ? "Completed"
        : "Active",
    photoRequestDate: timeline.requestDate,
    requiredPhotoDeadline: batch.deadline,
    requestStatus,
    photosReceivedDate: requestStatus === "Responded - Photos Uploaded" ? timeline.lastFollowUpDate : null,
    responsibleParty,
    lastFollowUpDate: timeline.lastFollowUpDate,
    followUpAttempts: timeline.followUpAttempts,
    escalationDate: requestStatus === "Escalation Needed" ? timeline.lastFollowUpDate : null,
    escalationStatus: requestStatus === "Escalation Needed" ? "Escalated" : "None",
    originalNotes,
    aiIssueCategory,
    aiRootCause,
    aiConfidenceScore,
    aiNeedsReview,
  });
}

if (batch19Count() > 0) {
  importWarnings.push(
    `${batch19Count()} unit(s) auctioned 2026-08-19 were assumed to belong to August Batch 1 (deadline 8/6) — this date wasn't in the batch list provided and should be confirmed.`
  );
}

function batch19Count(): number {
  return ROWS.filter((r) => r.auctionDate === "2026-08-19").length;
}

export const MANAGERS: Manager[] = [...managerIds.entries()].map(([name, id]) => ({ id, name }));
export const FACILITIES: Facility[] = [...facilityIds.entries()].map(([name, id]) => ({
  id,
  name,
  managerId: facilityManager.get(name) as string,
}));
export const AUCTION_CYCLES: AuctionCycle[] = [...cyclesSeen.values()];
export const AUCTION_UNITS: AuctionUnit[] = units;
