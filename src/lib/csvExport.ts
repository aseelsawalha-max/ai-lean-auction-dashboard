import type { EnrichedUnit, Facility, Manager } from "./types";

const COLUMNS: Array<{ header: string; get: (u: EnrichedUnit, ctx: ExportContext) => string | number }> = [
  { header: "Manager", get: (u, ctx) => ctx.managerName(u.managerId) },
  { header: "Facility", get: (u, ctx) => ctx.facilityName(u.facilityId) },
  { header: "Unit Number", get: (u) => u.unitNumber },
  { header: "Auction Cycle", get: (u, ctx) => ctx.cycleName(u.auctionCycleId) },
  { header: "Photo Request Date", get: (u) => u.photoRequestDate ?? "" },
  { header: "Required Deadline", get: (u) => u.requiredPhotoDeadline ?? "" },
  { header: "Photos Received Date", get: (u) => u.photosReceivedDate ?? "" },
  { header: "Request Status", get: (u) => u.requestStatus },
  { header: "Responsible Party", get: (u) => u.responsibleParty },
  { header: "Severity", get: (u) => u.severity },
  { header: "Days Waiting", get: (u) => u.daysWaiting ?? "" },
  { header: "Days Overdue", get: (u) => u.daysOverdue },
  { header: "Deadline Countdown", get: (u) => u.deadlineCountdown ?? "" },
  { header: "Follow-Up Attempts", get: (u) => u.followUpAttempts },
  { header: "Last Follow-Up Date", get: (u) => u.lastFollowUpDate ?? "" },
  { header: "Escalation Status", get: (u) => u.escalationStatus },
  { header: "AI Issue Category", get: (u) => u.aiIssueCategory },
  { header: "AI Root Cause", get: (u) => u.aiRootCause },
  { header: "AI Confidence", get: (u) => u.aiConfidenceScore },
  { header: "Needs Review", get: (u) => (u.aiNeedsReview ? "Yes" : "No") },
  { header: "Manually Corrected", get: (u) => (u.isOverridden ? "Yes" : "No") },
  { header: "AI Original Responsible Party", get: (u) => u.aiOriginalResponsibleParty },
  { header: "AI Original Issue Category", get: (u) => u.aiOriginalAiIssueCategory },
  { header: "Original Notes", get: (u) => u.originalNotes },
  { header: "Source Sheet", get: (u) => u.sourceSheetName },
];

interface ExportContext {
  managerName: (id: string) => string;
  facilityName: (id: string) => string;
  cycleName: (id: string) => string;
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function unitsToCsv(
  units: EnrichedUnit[],
  managers: Manager[],
  facilities: Facility[],
  cycleNameById: Map<string, string>
): string {
  const ctx: ExportContext = {
    managerName: (id) => managers.find((m) => m.id === id)?.name ?? id,
    facilityName: (id) => facilities.find((f) => f.id === id)?.name ?? id,
    cycleName: (id) => cycleNameById.get(id) ?? id,
  };

  const headerRow = COLUMNS.map((c) => escapeCsvValue(c.header)).join(",");
  const rows = units.map((u) => COLUMNS.map((c) => escapeCsvValue(c.get(u, ctx))).join(","));
  return [headerRow, ...rows].join("\n");
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
