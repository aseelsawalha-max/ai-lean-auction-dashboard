import type { AuctionCycle, EnrichedUnit, Facility } from "./types";
import { pct } from "./calculations";

export interface Insight {
  text: string;
  severity: "info" | "warning" | "critical";
}

function bogRateForUnits(units: EnrichedUnit[]): number | null {
  const requested = units.filter((u) => u.requestStatus !== "Not Requested");
  const bog = requested.filter((u) => u.responsibleParty === "BOG");
  return pct(bog.length, requested.length);
}

// Every insight below is derived directly from the enriched unit set passed
// in (already filtered by the caller) — nothing here is a canned statement.
export function generateInsights(
  units: EnrichedUnit[],
  cycles: AuctionCycle[],
  facilities: Facility[]
): Insight[] {
  const insights: Insight[] = [];
  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? id;
  const orderedCycles = [...cycles].sort(
    (a, b) => new Date(a.cycleDate).getTime() - new Date(b.cycleDate).getTime()
  );

  // 0. Data-quality caveat: units past deadline with zero logged photo
  // activity. This is deliberately reported separately from "Overdue" —
  // a blank row could mean the request was never made, or just that this
  // manager's sheet wasn't used to track it. Not a confirmed miss either
  // way, so it's surfaced as a caveat rather than folded into the KPI.
  const noActivityPastDeadline = units.filter(
    (u) => u.requestStatus === "Not Requested" && u.requiredPhotoDeadline && u.deadlineCountdown !== null && u.deadlineCountdown < 0
  );
  if (noActivityPastDeadline.length > 0) {
    const byFacility = new Map<string, number>();
    for (const u of noActivityPastDeadline) byFacility.set(u.facilityId, (byFacility.get(u.facilityId) ?? 0) + 1);
    const topFacilities = [...byFacility.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => `${facilityName(id)} (${n})`);
    insights.push({
      text: `${noActivityPastDeadline.length} units have no photo-tracking activity logged at all and their deadline has passed — this may mean the request was never made, or simply that these rows weren't tracked in the sheet. Recommend confirming with Site Managers before treating these as confirmed misses. Top facilities: ${topFacilities.join(", ")}.`,
      severity: "warning",
    });
  }

  // 1. BOG rate trend across cycles
  const rateByCycle = orderedCycles.map((c) => ({
    cycle: c,
    rate: bogRateForUnits(units.filter((u) => u.auctionCycleId === c.id)),
  }));
  const validRates = rateByCycle.filter((r) => r.rate !== null);
  if (validRates.length >= 2) {
    const first = validRates[0];
    const last = validRates[validRates.length - 1];
    const delta = (last.rate as number) - (first.rate as number);
    if (Math.abs(delta) >= 3) {
      insights.push({
        text: `BOG-related delays ${delta > 0 ? "increased" : "decreased"} from ${first.rate!.toFixed(
          0
        )}% in ${first.cycle.name} to ${last.rate!.toFixed(0)}% in ${last.cycle.name}.`,
        severity: delta > 0 ? "warning" : "info",
      });
    }
  }

  // 2. Facilities driving the most recent cycle's BOG delays
  const latestCycle = orderedCycles[orderedCycles.length - 1];
  if (latestCycle) {
    const latestUnits = units.filter((u) => u.auctionCycleId === latestCycle.id);
    const bogUnitsLatest = latestUnits.filter((u) => u.responsibleParty === "BOG");
    if (bogUnitsLatest.length > 0) {
      const byFacility = new Map<string, number>();
      for (const u of bogUnitsLatest) {
        byFacility.set(u.facilityId, (byFacility.get(u.facilityId) ?? 0) + 1);
      }
      const ranked = [...byFacility.entries()].sort((a, b) => b[1] - a[1]);
      const top = ranked.slice(0, Math.min(3, ranked.length));
      const topTotal = top.reduce((s, [, n]) => s + n, 0);
      const share = pct(topTotal, bogUnitsLatest.length);
      if (share !== null && share >= 40) {
        insights.push({
          text: `${top.length} facilit${top.length === 1 ? "y" : "ies"} (${top
            .map(([id]) => facilityName(id))
            .join(", ")}) accounted for ${share.toFixed(0)}% of BOG-related delays during the ${
            latestCycle.name
          } cycle.`,
          severity: "warning",
        });
      }
    }
  }

  // 3. Facilities with recurring BOG issues across multiple cycles
  const facilityCycleBogRate = new Map<string, { cyclesWithIssue: Set<string>; totalCycles: Set<string> }>();
  for (const u of units) {
    if (u.requestStatus === "Not Requested") continue;
    const entry = facilityCycleBogRate.get(u.facilityId) ?? { cyclesWithIssue: new Set(), totalCycles: new Set() };
    entry.totalCycles.add(u.auctionCycleId);
    if (u.responsibleParty === "BOG") entry.cyclesWithIssue.add(u.auctionCycleId);
    facilityCycleBogRate.set(u.facilityId, entry);
  }
  const recurring = [...facilityCycleBogRate.entries()].filter(
    ([, v]) => v.cyclesWithIssue.size >= 2 && v.cyclesWithIssue.size === v.totalCycles.size && v.totalCycles.size >= 2
  );
  if (recurring.length > 0) {
    insights.push({
      text: `${recurring
        .map(([id]) => facilityName(id))
        .join(", ")} experienced BOG-related delays in every auction cycle on record — a persistent pattern rather than an isolated incident.`,
      severity: "critical",
    });
  }

  // 4. Owner vs BOG distinction check — facility with high owner-caused delays
  const facilityOwnerCounts = new Map<string, number>();
  const facilityTotalDelay = new Map<string, number>();
  for (const u of units) {
    if (u.responsibleParty === "No Delay" || u.requestStatus === "Not Requested") continue;
    facilityTotalDelay.set(u.facilityId, (facilityTotalDelay.get(u.facilityId) ?? 0) + 1);
    if (u.responsibleParty === "Owner") {
      facilityOwnerCounts.set(u.facilityId, (facilityOwnerCounts.get(u.facilityId) ?? 0) + 1);
    }
  }
  for (const [facilityId, ownerCount] of facilityOwnerCounts.entries()) {
    const total = facilityTotalDelay.get(facilityId) ?? 0;
    const share = pct(ownerCount, total);
    if (share !== null && share >= 50 && total >= 3) {
      insights.push({
        text: `${facilityName(
          facilityId
        )} shows owner-caused delays in ${share.toFixed(
          0
        )}% of its flagged units — this facility's issues are primarily an owner problem, not BOG.`,
        severity: "info",
      });
    }
  }

  // 5. Escalation hotspots
  const escalated = units.filter((u) => u.requestStatus === "Escalation Needed");
  if (escalated.length > 0) {
    const byFacility = new Map<string, number>();
    for (const u of escalated) byFacility.set(u.facilityId, (byFacility.get(u.facilityId) ?? 0) + 1);
    const [topId, topCount] = [...byFacility.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      text: `${escalated.length} unit${escalated.length === 1 ? "" : "s"} currently need escalation; ${facilityName(
        topId
      )} has the most with ${topCount}.`,
      severity: "critical",
    });
  }

  // 6. Ambiguous / unknown notes needing review
  const needsReview = units.filter((u) => u.aiNeedsReview && u.requestStatus !== "Not Requested");
  if (needsReview.length > 0) {
    const share = pct(needsReview.length, units.filter((u) => u.requestStatus !== "Not Requested").length);
    insights.push({
      text: `${needsReview.length} unit${needsReview.length === 1 ? "" : "s"} (${
        share !== null ? share.toFixed(0) : "?"
      }% of active requests) have ambiguous notes and were classified as low-confidence or Unknown — recommend Admin review before attributing fault.`,
      severity: "info",
    });
  }

  // 7. On-time rate trend
  const onTimeByCycle = orderedCycles.map((c) => {
    const cUnits = units.filter((u) => u.auctionCycleId === c.id && u.photosReceivedDate);
    const onTime = cUnits.filter((u) => u.onTime).length;
    return { cycle: c, rate: pct(onTime, cUnits.length) };
  });
  const validOnTime = onTimeByCycle.filter((r) => r.rate !== null);
  if (validOnTime.length >= 2) {
    const first = validOnTime[0];
    const last = validOnTime[validOnTime.length - 1];
    const delta = (last.rate as number) - (first.rate as number);
    if (Math.abs(delta) >= 5) {
      insights.push({
        text: `On-time photo completion ${delta > 0 ? "improved" : "declined"} from ${first.rate!.toFixed(
          0
        )}% (${first.cycle.name}) to ${last.rate!.toFixed(0)}% (${last.cycle.name}).`,
        severity: delta > 0 ? "info" : "warning",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      text: "No significant patterns detected in the current filter selection — metrics are stable across the available cycles.",
      severity: "info",
    });
  }

  return insights;
}
