import type { AuctionCycle, AuctionUnit, Facility, Manager, RequestStatus } from "./types";
import { classifyNote } from "./classifier";

// Sample dataset standing in for the Google Sheets import described in the
// spec. Shapes and volumes are chosen to make every dashboard section
// (KPIs, cycle trends, facility/BOG rankings, AI insights) demonstrate
// something meaningful. Replace with real imported records once the actual
// Google Sheets + deadline rule are provided — see lib/sheetsImport.ts.

// Deterministic PRNG (mulberry32) so server and client render identical data.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260809);

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MANAGERS: Manager[] = [
  { id: "m1", name: "John Alvarez" },
  { id: "m2", name: "Priya Nair" },
  { id: "m3", name: "Derrick Owens" },
  { id: "m4", name: "Maria Santos" },
];

export const FACILITIES: Facility[] = [
  { id: "f1", name: "Riverside Self Storage", managerId: "m1" },
  { id: "f2", name: "Lakeview Storage Center", managerId: "m1" },
  { id: "f3", name: "Downtown Mini Storage", managerId: "m2" },
  { id: "f4", name: "Sunbelt Storage Yard", managerId: "m2" },
  { id: "f5", name: "Harbor Point Storage", managerId: "m3" },
  { id: "f6", name: "Pinecrest Storage", managerId: "m3" },
  { id: "f7", name: "Metro Storage Depot", managerId: "m4" },
  { id: "f8", name: "Valley View Storage", managerId: "m4" },
];

export const AUCTION_CYCLES: AuctionCycle[] = [
  { id: "c-june", name: "June 2026", cycleDate: "2026-06-25", sourceSheetName: "June 2026 Auction Tracker" },
  { id: "c-july", name: "July 2026", cycleDate: "2026-07-25", sourceSheetName: "July 2026 Auction Tracker" },
  { id: "c-august", name: "August 2026", cycleDate: "2026-08-25", sourceSheetName: "August 2026 Auction Tracker" },
];

const PHOTO_DEADLINE_LEAD_DAYS = 10; // required deadline = photo request date + 10 days (process rule placeholder)

interface NoteTemplate {
  note: string;
  status: RequestStatus;
  followUps: number;
  receivedOffsetFromDeadline: number | null; // days relative to deadline; null = not yet received
}

// Facilities f5 (Harbor Point) and f6 (Pinecrest) are deliberately weighted
// toward recurring BOG problems across all three cycles, so the Facility &
// BOG Performance ranking and AI Insights have a real pattern to surface.
const BOG_PRONE_FACILITIES = new Set(["f5", "f6"]);
const OWNER_PRONE_FACILITIES = new Set(["f4"]);

const BOG_NO_RESPONSE_NOTES = [
  "Requested photos from BOG, no response yet.",
  "BOG has not responded after initial request.",
  "No response from BOG despite email and phone attempt.",
];
const BOG_DELAYED_NOTES = [
  "Reached out to BOG twice, still waiting.",
  "Followed up with BOG again, they said photos are coming.",
  "Contacted BOG three times before photos were finally uploaded.",
  "BOG responded after multiple follow-ups this week.",
];
const OWNER_NOTES = [
  "Owner said they would send photos but haven't yet.",
  "Owner unavailable, out of town until next week.",
  "Owner did not provide photos before the deadline.",
  "Waiting on owner to upload photos, contacted twice.",
];
const ACCESS_NOTES = ["Access issue at the unit, gate code did not work.", "Couldn't access unit, lock needs to be cut first."];
const SCHEDULING_NOTES = ["Scheduling conflict, rescheduled photo appointment for next week."];
const INFO_NOTES = ["Wrong contact number on file, had to track down correct info."];
const NO_LONGER_AUCTION_NOTES = ["Tenant paid off balance, unit removed from auction.", "Unit vacated, no longer proceeding to auction."];
const CLEAN_NOTES = ["Photos received on time, no issues.", "Straightforward request, BOG responded quickly.", ""];
const UNKNOWN_NOTES = ["Checking on status.", "Pending update.", "Need to review with team."];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// BOG issue rate is deliberately trending upward across cycles (June -> August)
// so cycle analytics and AI insights have a real worsening trend to surface.
const BOG_RATE_BY_CYCLE: Record<string, number> = {
  "c-june": 0.4,
  "c-july": 0.5,
  "c-august": 0.62,
};

function buildUnit(
  idx: number,
  cycle: AuctionCycle,
  facility: Facility,
  requestDateBase: string
): AuctionUnit {
  const unitNumber = `${facility.id.toUpperCase()}-${100 + idx}`;
  const isBogProne = BOG_PRONE_FACILITIES.has(facility.id);
  const isOwnerProne = OWNER_PRONE_FACILITIES.has(facility.id);
  const cycleBogRate = BOG_RATE_BY_CYCLE[cycle.id] ?? 0.5;

  // Every facility has a baseline chance of a BOG or owner delay; prone
  // facilities are weighted much higher so they stand out in the rankings
  // and AI insights without BOG/Owner issues being exclusive to them.
  const bogRate = isBogProne ? cycleBogRate : 0.1 + cycleBogRate * 0.08;
  const ownerRate = isOwnerProne ? 0.45 : 0.08;

  // Cumulative probability buckets (must sum to <= 1)
  const buckets: Array<{ upTo: number; build: () => NoteTemplate }> = [];
  let cum = 0;
  cum += bogRate;
  buckets.push({
    upTo: cum,
    build: () => {
      const delayed = rng() < 0.5;
      return delayed
        ? { note: pick(BOG_DELAYED_NOTES), status: "Delayed / No Response", followUps: 2 + Math.floor(rng() * 3), receivedOffsetFromDeadline: rng() < 0.5 ? Math.floor(rng() * 5) + 1 : null }
        : { note: pick(BOG_NO_RESPONSE_NOTES), status: "Escalation Needed", followUps: 1 + Math.floor(rng() * 2), receivedOffsetFromDeadline: null };
    },
  });
  cum += ownerRate;
  buckets.push({
    upTo: cum,
    build: () => ({
      note: pick(OWNER_NOTES),
      status: rng() < 0.5 ? "Delayed / No Response" : "Escalation Needed",
      followUps: 1 + Math.floor(rng() * 3),
      receivedOffsetFromDeadline: rng() < 0.4 ? Math.floor(rng() * 6) : null,
    }),
  });
  cum += 0.04;
  buckets.push({ upTo: cum, build: () => ({ note: pick(ACCESS_NOTES), status: "Delayed / No Response", followUps: 1, receivedOffsetFromDeadline: Math.floor(rng() * 3) }) });
  cum += 0.03;
  buckets.push({ upTo: cum, build: () => ({ note: pick(SCHEDULING_NOTES), status: "Requested - Awaiting Response", followUps: 1, receivedOffsetFromDeadline: null }) });
  cum += 0.03;
  buckets.push({ upTo: cum, build: () => ({ note: pick(INFO_NOTES), status: "Delayed / No Response", followUps: 2, receivedOffsetFromDeadline: Math.floor(rng() * 4) }) });
  cum += 0.05;
  buckets.push({ upTo: cum, build: () => ({ note: pick(NO_LONGER_AUCTION_NOTES), status: "Cancelled / No Longer Going to Auction", followUps: 0, receivedOffsetFromDeadline: null }) });
  cum += 0.04;
  buckets.push({ upTo: cum, build: () => ({ note: pick(UNKNOWN_NOTES), status: "Requested - Awaiting Response", followUps: Math.floor(rng() * 2), receivedOffsetFromDeadline: null }) });
  cum += 0.04;
  buckets.push({ upTo: cum, build: () => ({ note: "", status: "Not Requested", followUps: 0, receivedOffsetFromDeadline: null }) });
  // Remaining probability mass -> clean, on-time completions.
  buckets.push({
    upTo: 1,
    build: () => ({ note: pick(CLEAN_NOTES), status: "Completed", followUps: rng() < 0.3 ? 1 : 0, receivedOffsetFromDeadline: -(Math.floor(rng() * 6) + 1) }),
  });

  const roll = rng();
  const bucket = buckets.find((b) => roll < b.upTo) ?? buckets[buckets.length - 1];
  const template = bucket.build();

  const photoRequestDate = template.status === "Not Requested" ? null : addDays(requestDateBase, Math.floor(rng() * 5));
  const requiredPhotoDeadline = photoRequestDate ? addDays(photoRequestDate, PHOTO_DEADLINE_LEAD_DAYS) : null;
  const photosReceivedDate =
    template.receivedOffsetFromDeadline !== null && requiredPhotoDeadline
      ? addDays(requiredPhotoDeadline, template.receivedOffsetFromDeadline)
      : null;

  const classification = classifyNote(template.note);

  const isFutureCycle = cycle.id === "c-august";
  // For the in-progress cycle, don't fabricate a "received" date for units still open.
  const finalReceivedDate = isFutureCycle && template.status !== "Completed" && template.status !== "Cancelled / No Longer Going to Auction" && rng() < 0.7 ? null : photosReceivedDate;

  return {
    id: `${cycle.id}-${facility.id}-${idx}`,
    sourceRowKey: `${cycle.sourceSheetName}::row-${idx}`,
    sourceSheetName: cycle.sourceSheetName,
    managerId: facility.managerId,
    facilityId: facility.id,
    unitNumber,
    auctionCycleId: cycle.id,
    unitAuctionStatus:
      template.status === "Cancelled / No Longer Going to Auction"
        ? "Cancelled"
        : template.status === "Completed"
        ? "Completed"
        : "Active",
    photoRequestDate,
    requiredPhotoDeadline,
    requestStatus: template.status,
    photosReceivedDate: finalReceivedDate,
    responsibleParty:
      template.status === "Completed" || template.status === "Cancelled / No Longer Going to Auction"
        ? "No Delay"
        : classification.responsibleParty,
    lastFollowUpDate:
      template.followUps > 0 && photoRequestDate ? addDays(photoRequestDate, 3 + Math.floor(rng() * 5)) : null,
    followUpAttempts: template.followUps,
    escalationDate: template.status === "Escalation Needed" ? addDays(requiredPhotoDeadline || requestDateBase, 1) : null,
    escalationStatus: template.status === "Escalation Needed" ? "Escalated" : "None",
    originalNotes: template.note,
    aiIssueCategory: classification.category,
    aiRootCause: classification.rootCause,
    aiConfidenceScore: classification.confidence,
    aiNeedsReview: classification.needsReview,
  };
}

function generateUnitsForCycle(cycle: AuctionCycle, requestDateBase: string, unitsPerFacility: number): AuctionUnit[] {
  const units: AuctionUnit[] = [];
  let idx = 0;
  for (const facility of FACILITIES) {
    for (let i = 0; i < unitsPerFacility; i++) {
      units.push(buildUnit(idx, cycle, facility, requestDateBase));
      idx++;
    }
  }
  return units;
}

export const AUCTION_UNITS: AuctionUnit[] = [
  ...generateUnitsForCycle(AUCTION_CYCLES[0], "2026-06-01", 6),
  ...generateUnitsForCycle(AUCTION_CYCLES[1], "2026-07-01", 7),
  ...generateUnitsForCycle(AUCTION_CYCLES[2], "2026-08-01", 8),
];
