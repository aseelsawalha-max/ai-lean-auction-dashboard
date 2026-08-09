import type { AuctionUnit, ComputedUnitFields, EnrichedUnit, Severity } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export function daysWaiting(unit: AuctionUnit, today: Date): number | null {
  if (!unit.photoRequestDate) return null;
  const end = unit.photosReceivedDate ? new Date(unit.photosReceivedDate) : today;
  return Math.max(0, daysBetween(end, new Date(unit.photoRequestDate)));
}

export function daysOverdue(unit: AuctionUnit, today: Date): number {
  if (!unit.requiredPhotoDeadline) return 0;
  const deadline = new Date(unit.requiredPhotoDeadline);
  const isDone =
    unit.requestStatus === "Completed" || unit.requestStatus === "Responded - Photos Uploaded";
  const reference = isDone && unit.photosReceivedDate ? new Date(unit.photosReceivedDate) : today;
  const diff = daysBetween(reference, deadline);
  return diff > 0 ? diff : 0;
}

export function deadlineCountdown(unit: AuctionUnit, today: Date): number | null {
  if (!unit.requiredPhotoDeadline) return null;
  return daysBetween(new Date(unit.requiredPhotoDeadline), today);
}

export function isOnTime(unit: AuctionUnit): boolean | null {
  if (!unit.photosReceivedDate || !unit.requiredPhotoDeadline) return null;
  return new Date(unit.photosReceivedDate) <= new Date(unit.requiredPhotoDeadline);
}

export function computeSeverity(unit: AuctionUnit, today: Date): Severity {
  if (
    unit.requestStatus === "Completed" ||
    unit.requestStatus === "Responded - Photos Uploaded" ||
    unit.requestStatus === "Cancelled / No Longer Going to Auction"
  ) {
    return "Completed";
  }

  const countdown = deadlineCountdown(unit, today);
  const overdue = daysOverdue(unit, today);

  if (unit.requestStatus === "Escalation Needed" || overdue > 7) return "Critical";
  if (overdue > 0) return "High";
  if (countdown !== null && countdown <= 3) return "Medium";
  return "Low";
}

export function enrichUnit(unit: AuctionUnit, today: Date): EnrichedUnit {
  const computed: ComputedUnitFields = {
    daysWaiting: daysWaiting(unit, today),
    daysOverdue: daysOverdue(unit, today),
    deadlineCountdown: deadlineCountdown(unit, today),
    severity: computeSeverity(unit, today),
    onTime: isOnTime(unit),
  };
  return { ...unit, ...computed };
}

export function enrichUnits(units: AuctionUnit[], today: Date): EnrichedUnit[] {
  return units.map((u) => enrichUnit(u, today));
}

const SEVERITY_ORDER: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Completed: 4,
};

export function sortUnits(units: EnrichedUnit[]): EnrichedUnit[] {
  return [...units].sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    const aCountdown = a.deadlineCountdown ?? Infinity;
    const bCountdown = b.deadlineCountdown ?? Infinity;
    if (aCountdown !== bCountdown) return aCountdown - bCountdown;
    return b.followUpAttempts - a.followUpAttempts;
  });
}

export function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export interface KPISet {
  totalActiveUnits: number;
  totalPhotoRequests: number;
  photosReceived: number;
  pendingRequests: number;
  overdueRequests: number;
  escalationsNeeded: number;
  bogDelays: number;
  ownerDelays: number;
  otherUnknownDelays: number;
  onTimePhotoPct: number | null;
  avgResponseTimeDays: number | null;
  avgFollowUpAttempts: number | null;
}

export function computeKPIs(units: EnrichedUnit[]): KPISet {
  const totalActiveUnits = units.filter((u) => u.unitAuctionStatus === "Active").length;
  const totalPhotoRequests = units.filter((u) => u.requestStatus !== "Not Requested").length;
  const photosReceived = units.filter((u) => u.photosReceivedDate).length;
  const pendingRequests = units.filter(
    (u) =>
      u.requestStatus === "Requested - Awaiting Response" ||
      u.requestStatus === "Delayed / No Response"
  ).length;
  const overdueRequests = units.filter((u) => u.daysOverdue > 0).length;
  const escalationsNeeded = units.filter((u) => u.requestStatus === "Escalation Needed").length;
  const bogDelays = units.filter((u) => u.responsibleParty === "BOG").length;
  const ownerDelays = units.filter((u) => u.responsibleParty === "Owner").length;
  const otherUnknownDelays = units.filter(
    (u) => u.responsibleParty === "Other" || u.responsibleParty === "Unknown"
  ).length;

  const completed = units.filter((u) => u.photosReceivedDate && u.requiredPhotoDeadline);
  const onTimeCount = completed.filter((u) => u.onTime).length;
  const onTimePhotoPct = pct(onTimeCount, completed.length);

  const responseTimes = units
    .filter((u) => u.photoRequestDate && u.photosReceivedDate)
    .map(
      (u) =>
        (new Date(u.photosReceivedDate as string).getTime() -
          new Date(u.photoRequestDate as string).getTime()) /
        MS_PER_DAY
    );
  const avgResponseTimeDays = average(responseTimes);

  const avgFollowUpAttempts = average(units.map((u) => u.followUpAttempts));

  return {
    totalActiveUnits,
    totalPhotoRequests,
    photosReceived,
    pendingRequests,
    overdueRequests,
    escalationsNeeded,
    bogDelays,
    ownerDelays,
    otherUnknownDelays,
    onTimePhotoPct,
    avgResponseTimeDays,
    avgFollowUpAttempts,
  };
}
