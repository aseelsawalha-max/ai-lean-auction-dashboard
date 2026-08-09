import type { AuctionCycle, EnrichedUnit, Facility } from "./types";
import { average, pct } from "./calculations";

export interface CycleStats {
  cycleId: string;
  cycleName: string;
  cycleDate: string;
  totalUnits: number;
  totalPhotoRequests: number;
  photosReceived: number;
  onTime: number;
  late: number;
  overdueUnits: number;
  bogDelays: number;
  ownerDelays: number;
  otherDelays: number;
  avgResponseTimeDays: number | null;
  avgDaysOverdue: number | null;
  avgFollowUpAttempts: number | null;
  escalationRate: number | null;
  onTimeCompletionRate: number | null;
}

export function computeCycleStats(units: EnrichedUnit[], cycle: AuctionCycle): CycleStats {
  const cycleUnits = units.filter((u) => u.auctionCycleId === cycle.id);
  // "Not Requested" units are excluded from delay/overdue/follow-up
  // metrics below — a passed deadline with zero logged activity isn't a
  // confirmed miss, just an absence of data (see the AI Insights caveat).
  const requested = cycleUnits.filter((u) => u.requestStatus !== "Not Requested");
  const received = cycleUnits.filter((u) => u.photosReceivedDate);
  const onTime = received.filter((u) => u.onTime);
  const late = received.filter((u) => u.onTime === false);
  const overdue = requested.filter((u) => u.daysOverdue > 0);
  const escalated = cycleUnits.filter((u) => u.requestStatus === "Escalation Needed");

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    cycleDate: cycle.cycleDate,
    totalUnits: cycleUnits.length,
    totalPhotoRequests: requested.length,
    photosReceived: received.length,
    onTime: onTime.length,
    late: late.length,
    overdueUnits: overdue.length,
    bogDelays: requested.filter((u) => u.responsibleParty === "BOG").length,
    ownerDelays: requested.filter((u) => u.responsibleParty === "Owner").length,
    otherDelays: requested.filter((u) => u.responsibleParty === "Other" || u.responsibleParty === "Unknown").length,
    avgResponseTimeDays: average(
      cycleUnits
        .filter((u) => u.photoRequestDate && u.photosReceivedDate)
        .map(
          (u) =>
            (new Date(u.photosReceivedDate as string).getTime() - new Date(u.photoRequestDate as string).getTime()) /
            (1000 * 60 * 60 * 24)
        )
    ),
    avgDaysOverdue: average(overdue.map((u) => u.daysOverdue)),
    avgFollowUpAttempts: average(requested.map((u) => u.followUpAttempts)),
    escalationRate: pct(escalated.length, requested.length),
    onTimeCompletionRate: pct(onTime.length, received.length),
  };
}

export type Trend = "Improving" | "Declining" | "Stable";

export function onTimeTrend(stats: CycleStats[]): Trend {
  const rates = stats.map((s) => s.onTimeCompletionRate).filter((r): r is number => r !== null);
  if (rates.length < 2) return "Stable";
  const delta = rates[rates.length - 1] - rates[0];
  if (delta > 3) return "Improving";
  if (delta < -3) return "Declining";
  return "Stable";
}

export interface FacilityStats {
  facilityId: string;
  facilityName: string;
  managerName: string;
  totalUnits: number;
  totalPhotoRequests: number;
  onTimePct: number | null;
  latePct: number | null;
  overduePct: number | null;
  bogIssuePct: number | null;
  ownerIssuePct: number | null;
  avgResponseTimeDays: number | null;
  avgDaysOverdue: number | null;
  avgFollowUpAttempts: number | null;
  escalations: number;
  cyclesWithIssues: number;
}

export function computeFacilityStats(
  units: EnrichedUnit[],
  facility: Facility,
  managerName: string
): FacilityStats {
  const fUnits = units.filter((u) => u.facilityId === facility.id);
  // "Not Requested" units are excluded from overdue/delay metrics — see
  // the equivalent note in computeCycleStats.
  const requested = fUnits.filter((u) => u.requestStatus !== "Not Requested");
  const received = fUnits.filter((u) => u.photosReceivedDate);
  const onTime = received.filter((u) => u.onTime);
  const late = received.filter((u) => u.onTime === false);
  const overdue = requested.filter((u) => u.daysOverdue > 0);
  const bog = requested.filter((u) => u.responsibleParty === "BOG");
  const owner = requested.filter((u) => u.responsibleParty === "Owner");
  const escalations = fUnits.filter((u) => u.requestStatus === "Escalation Needed");

  const cyclesWithIssues = new Set(
    requested.filter((u) => u.responsibleParty === "BOG" || u.responsibleParty === "Owner" || u.daysOverdue > 0).map((u) => u.auctionCycleId)
  ).size;

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    managerName,
    totalUnits: fUnits.length,
    totalPhotoRequests: requested.length,
    onTimePct: pct(onTime.length, received.length),
    latePct: pct(late.length, received.length),
    overduePct: pct(overdue.length, requested.length),
    bogIssuePct: pct(bog.length, requested.length),
    ownerIssuePct: pct(owner.length, requested.length),
    avgResponseTimeDays: average(
      fUnits
        .filter((u) => u.photoRequestDate && u.photosReceivedDate)
        .map(
          (u) =>
            (new Date(u.photosReceivedDate as string).getTime() - new Date(u.photoRequestDate as string).getTime()) /
            (1000 * 60 * 60 * 24)
        )
    ),
    avgDaysOverdue: average(overdue.map((u) => u.daysOverdue)),
    avgFollowUpAttempts: average(requested.map((u) => u.followUpAttempts)),
    escalations: escalations.length,
    cyclesWithIssues,
  };
}
