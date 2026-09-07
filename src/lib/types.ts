// Core data model for the AI Lean / Auction Photo Tracking dashboard.
// This mirrors the fields required by the operations spec: unit info,
// photo-request lifecycle, delay responsibility, follow-ups, and AI note analysis.

export type RequestStatus =
  | "Not Requested"
  | "Requested - Awaiting Response"
  | "Responded - Photos Uploaded"
  | "Delayed / No Response"
  | "Escalation Needed"
  | "Completed"
  | "Cancelled / No Longer Going to Auction";

export type ResponsibleParty =
  | "BOG"
  | "Owner"
  | "Site Manager"
  | "Other"
  | "Unknown"
  | "No Delay";

export const RESPONSIBLE_PARTIES: ResponsibleParty[] = [
  "BOG",
  "Owner",
  "Site Manager",
  "Other",
  "Unknown",
  "No Delay",
];

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Completed";

export type AIIssueCategory =
  | "BOG no response"
  | "BOG delayed response"
  | "Owner delay"
  | "Owner failed to provide photos"
  | "Site Manager follow-up issue"
  | "Access issue"
  | "Scheduling issue"
  | "Incorrect / missing information"
  | "Unit no longer proceeding to auction"
  | "BOG unavailable / turnover"
  | "Facility on hold / offboarding"
  | "No Delay"
  | "Other"
  | "Unknown";

export const AI_ISSUE_CATEGORIES: AIIssueCategory[] = [
  "BOG no response",
  "BOG delayed response",
  "Owner delay",
  "Owner failed to provide photos",
  "Site Manager follow-up issue",
  "Access issue",
  "Scheduling issue",
  "Incorrect / missing information",
  "Unit no longer proceeding to auction",
  "BOG unavailable / turnover",
  "Facility on hold / offboarding",
  "No Delay",
  "Other",
  "Unknown",
];

export interface AuctionCycle {
  id: string;
  name: string; // e.g. "June 2026"
  cycleDate: string; // ISO date, the auction date for the cycle
  sourceSheetName: string; // the original Google Sheet this cycle came from
}

export interface Facility {
  id: string;
  name: string;
  managerId: string;
}

export interface Manager {
  id: string;
  name: string;
}

export interface AuctionUnit {
  id: string; // stable synthetic id, used for de-duplication
  sourceRowKey: string; // composite key from source sheet (sheet + row) for de-dup on re-import
  sourceSheetName: string;

  // Unit information
  managerId: string;
  facilityId: string;
  unitNumber: string;
  auctionCycleId: string;
  unitAuctionStatus: "Active" | "Cancelled" | "Completed";

  // Photo request
  photoRequestDate: string | null; // ISO date
  requiredPhotoDeadline: string | null; // ISO date, source of truth for overdue calc
  requestStatus: RequestStatus;
  photosReceivedDate: string | null; // ISO date

  // Delay responsibility
  responsibleParty: ResponsibleParty;

  // Follow-up tracking
  lastFollowUpDate: string | null;
  followUpAttempts: number;
  escalationDate: string | null;
  escalationStatus: "None" | "Flagged" | "Escalated" | "Resolved";

  // Notes & AI analysis — original note is NEVER overwritten
  originalNotes: string;
  aiIssueCategory: AIIssueCategory;
  aiRootCause: string;
  aiConfidenceScore: number; // 0-1
  aiNeedsReview: boolean; // flagged when classification is ambiguous/low-confidence

  // manual correction trail (admins can override AI without losing the AI's original call)
  manualOverride?: {
    responsibleParty?: ResponsibleParty;
    aiIssueCategory?: AIIssueCategory;
    overriddenBy?: string;
    overriddenAt?: string;
  };
}

// Derived, computed fields (never stored — always recalculated from "today")
export interface ComputedUnitFields {
  daysWaiting: number | null;
  daysOverdue: number; // 0 if not overdue
  deadlineCountdown: number | null; // negative if past due
  severity: Severity;
  onTime: boolean | null; // null if not yet completed
}

export type EnrichedUnit = AuctionUnit & ComputedUnitFields;
