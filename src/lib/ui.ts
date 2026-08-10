import type { AIIssueCategory, ResponsibleParty, Severity } from "./types";

export const RESPONSIBLE_PARTIES: ResponsibleParty[] = ["BOG", "Owner", "Site Manager", "Other", "Unknown", "No Delay"];

export const ISSUE_CATEGORIES: AIIssueCategory[] = [
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

export const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; dot: string; label: string }> = {
  Critical: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", dot: "bg-red-600", label: "Critical" },
  High: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500", label: "High" },
  Medium: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", label: "Medium" },
  Low: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", label: "Low" },
  Completed: { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", dot: "bg-slate-400", label: "Completed" },
};

// Row background per spec's color-coding rule (distinct from severity badge colors).
export function rowColorClass(status: string, isOverdue: boolean, isEscalation: boolean): string {
  if (isEscalation) return "border-l-4 border-orange-500 bg-orange-50/60 dark:bg-orange-950/20";
  if (status === "Completed" || status === "Responded - Photos Uploaded") {
    return "border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20";
  }
  if (isOverdue) return "border-l-4 border-red-500 bg-red-50/60 dark:bg-red-950/20";
  return "border-l-4 border-amber-400 bg-amber-50/40 dark:bg-amber-950/10";
}

export const RESPONSIBLE_PARTY_COLORS: Record<string, string> = {
  BOG: "#dc2626",
  Owner: "#d97706",
  "Site Manager": "#2563eb",
  Other: "#7c3aed",
  Unknown: "#64748b",
  "No Delay": "#059669",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatPct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

export function formatDays(v: number | null): string {
  return v === null ? "—" : v.toFixed(1);
}
