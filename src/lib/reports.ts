import type { AuctionCycle, EnrichedUnit, Facility, Manager } from "./types";
import { computeKPIs } from "./calculations";
import { computeCycleStats, computeFacilityStats, onTimeTrend } from "./analytics";
import { generateInsights } from "./insights";

export interface ManagerBreakdown {
  managerId: string;
  managerName: string;
  activeUnits: number;
  pendingRequests: number;
  overdueUnits: number;
  escalations: number;
  bogDelays: number;
  ownerDelays: number;
}

export interface WeeklySummary {
  generatedFor: string; // ISO date (the Monday it's generated for)
  overall: ReturnType<typeof computeKPIs>;
  byManager: ManagerBreakdown[];
  actionItems: EnrichedUnit[];
}

export function generateWeeklySummary(
  units: EnrichedUnit[],
  managers: Manager[],
  today: Date
): WeeklySummary {
  const overall = computeKPIs(units);

  const byManager: ManagerBreakdown[] = managers.map((m) => {
    const mUnits = units.filter((u) => u.managerId === m.id);
    return {
      managerId: m.id,
      managerName: m.name,
      activeUnits: mUnits.filter((u) => u.unitAuctionStatus === "Active").length,
      pendingRequests: mUnits.filter(
        (u) => u.requestStatus === "Requested - Awaiting Response" || u.requestStatus === "Delayed / No Response"
      ).length,
      overdueUnits: mUnits.filter((u) => u.daysOverdue > 0).length,
      escalations: mUnits.filter((u) => u.requestStatus === "Escalation Needed").length,
      bogDelays: mUnits.filter((u) => u.responsibleParty === "BOG").length,
      ownerDelays: mUnits.filter((u) => u.responsibleParty === "Owner").length,
    };
  });

  const actionItems = units
    .filter((u) => u.severity === "Critical" || u.severity === "High")
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 15);

  return {
    generatedFor: today.toISOString().slice(0, 10),
    overall,
    byManager,
    actionItems,
  };
}

export interface MonthlyReport {
  cycle: AuctionCycle;
  executiveSummary: string;
  currentStats: ReturnType<typeof computeCycleStats>;
  previousStats: ReturnType<typeof computeCycleStats> | null;
  trend: ReturnType<typeof onTimeTrend>;
  facilityHighlights: {
    recurringBog: string[];
    recurringOwner: string[];
    highestOverdue: string | null;
    highestFollowUp: string | null;
    biggestImprovement: string | null;
    biggestDecline: string | null;
  };
  recommendations: string[];
}

export function generateMonthlyReport(
  units: EnrichedUnit[],
  cycles: AuctionCycle[],
  facilities: Facility[],
  managers: Manager[],
  targetCycleId: string
): MonthlyReport | null {
  const sorted = [...cycles].sort((a, b) => new Date(a.cycleDate).getTime() - new Date(b.cycleDate).getTime());
  const idx = sorted.findIndex((c) => c.id === targetCycleId);
  if (idx === -1) return null;
  const cycle = sorted[idx];
  const previousCycle = idx > 0 ? sorted[idx - 1] : null;

  const currentStats = computeCycleStats(units, cycle);
  const previousStats = previousCycle ? computeCycleStats(units, previousCycle) : null;
  const trend = onTimeTrend([previousStats, currentStats].filter((s): s is typeof currentStats => s !== null));

  const facilityStats = facilities.map((f) =>
    computeFacilityStats(
      units.filter((u) => u.auctionCycleId === cycle.id),
      f,
      managers.find((m) => m.id === f.managerId)?.name ?? "Unknown"
    )
  );

  const recurringBog = facilityStats
    .filter((f) => (f.bogIssuePct ?? 0) >= 40 && f.totalPhotoRequests >= 3)
    .sort((a, b) => (b.bogIssuePct ?? 0) - (a.bogIssuePct ?? 0))
    .slice(0, 3)
    .map((f) => `${f.facilityName} (${(f.bogIssuePct ?? 0).toFixed(0)}% BOG issue rate)`);

  const recurringOwner = facilityStats
    .filter((f) => (f.ownerIssuePct ?? 0) >= 40 && f.totalPhotoRequests >= 3)
    .sort((a, b) => (b.ownerIssuePct ?? 0) - (a.ownerIssuePct ?? 0))
    .slice(0, 3)
    .map((f) => `${f.facilityName} (${(f.ownerIssuePct ?? 0).toFixed(0)}% owner issue rate)`);

  const byOverdue = [...facilityStats].sort((a, b) => (b.overduePct ?? 0) - (a.overduePct ?? 0))[0];
  const byFollowUp = [...facilityStats].sort(
    (a, b) => (b.avgFollowUpAttempts ?? 0) - (a.avgFollowUpAttempts ?? 0)
  )[0];

  let biggestImprovement: string | null = null;
  let biggestDecline: string | null = null;
  if (previousCycle) {
    const prevFacilityStats = facilities.map((f) =>
      computeFacilityStats(
        units.filter((u) => u.auctionCycleId === previousCycle.id),
        f,
        managers.find((m) => m.id === f.managerId)?.name ?? "Unknown"
      )
    );
    const deltas = facilities.map((f) => {
      const cur = facilityStats.find((s) => s.facilityId === f.id);
      const prev = prevFacilityStats.find((s) => s.facilityId === f.id);
      const curRate = cur?.onTimePct ?? null;
      const prevRate = prev?.onTimePct ?? null;
      if (curRate === null || prevRate === null) return null;
      return { name: f.name, delta: curRate - prevRate };
    }).filter((d): d is { name: string; delta: number } => d !== null);

    if (deltas.length > 0) {
      const best = [...deltas].sort((a, b) => b.delta - a.delta)[0];
      const worst = [...deltas].sort((a, b) => a.delta - b.delta)[0];
      if (best.delta > 0) biggestImprovement = `${best.name} (+${best.delta.toFixed(0)} pts on-time)`;
      if (worst.delta < 0) biggestDecline = `${worst.name} (${worst.delta.toFixed(0)} pts on-time)`;
    }
  }

  const executiveSummary = `${cycle.name} closed with ${currentStats.totalPhotoRequests} photo requests across ${currentStats.totalUnits} units. ${
    currentStats.onTimeCompletionRate !== null ? currentStats.onTimeCompletionRate.toFixed(0) : "N/A"
  }% of completed requests were on time, with BOG responsible for ${currentStats.bogDelays} delayed unit${
    currentStats.bogDelays === 1 ? "" : "s"
  } and owners responsible for ${currentStats.ownerDelays}. Overall on-time performance is ${trend.toLowerCase()} versus the prior cycle.`;

  const recommendations: string[] = [];
  if (recurringBog.length > 0) {
    recommendations.push(
      `Escalate a direct process review with ${recurringBog[0].split(" (")[0]} given its recurring BOG issue rate — consider a dedicated BOG contact or SLA for this facility.`
    );
  }
  if (recurringOwner.length > 0) {
    recommendations.push(
      `${recurringOwner[0].split(" (")[0]}'s delays are predominantly owner-caused, not BOG — route follow-up to the facility owner relationship rather than BOG escalation.`
    );
  }
  if (byFollowUp && (byFollowUp.avgFollowUpAttempts ?? 0) >= 2) {
    recommendations.push(
      `${byFollowUp.facilityName} required an average of ${(byFollowUp.avgFollowUpAttempts ?? 0).toFixed(
        1
      )} follow-ups per unit this cycle — review whether the initial request channel is reaching the right contact.`
    );
  }
  if (trend === "Declining") {
    recommendations.push(
      `On-time completion declined this cycle — review the ${currentStats.escalationRate?.toFixed(
        0
      ) ?? 0}% escalation rate and confirm escalations are being actioned before the deadline, not after.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("No cycle-specific risk patterns crossed the recommendation threshold this month.");
  }

  return {
    cycle,
    executiveSummary,
    currentStats,
    previousStats,
    trend,
    facilityHighlights: {
      recurringBog,
      recurringOwner,
      highestOverdue: byOverdue ? `${byOverdue.facilityName} (${(byOverdue.overduePct ?? 0).toFixed(0)}% overdue)` : null,
      highestFollowUp: byFollowUp
        ? `${byFollowUp.facilityName} (${(byFollowUp.avgFollowUpAttempts ?? 0).toFixed(1)} avg follow-ups)`
        : null,
      biggestImprovement,
      biggestDecline,
    },
    recommendations,
  };
}

export function reGenerateInsightsForReport(
  units: EnrichedUnit[],
  cycles: AuctionCycle[],
  facilities: Facility[]
) {
  return generateInsights(units, cycles, facilities);
}
