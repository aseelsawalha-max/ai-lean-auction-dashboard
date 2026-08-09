import type { EnrichedUnit, RequestStatus, ResponsibleParty, AIIssueCategory } from "./types";

export interface FilterState {
  managerIds: string[];
  facilityIds: string[];
  auctionCycleIds: string[];
  requestStatuses: RequestStatus[];
  responsibleParties: ResponsibleParty[];
  issueCategories: AIIssueCategory[];
  overdueOnly: boolean;
  notOverdueOnly: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}

export const EMPTY_FILTERS: FilterState = {
  managerIds: [],
  facilityIds: [],
  auctionCycleIds: [],
  requestStatuses: [],
  responsibleParties: [],
  issueCategories: [],
  overdueOnly: false,
  notOverdueOnly: false,
  dateFrom: null,
  dateTo: null,
};

export function applyFilters(units: EnrichedUnit[], filters: FilterState): EnrichedUnit[] {
  return units.filter((u) => {
    if (filters.managerIds.length && !filters.managerIds.includes(u.managerId)) return false;
    if (filters.facilityIds.length && !filters.facilityIds.includes(u.facilityId)) return false;
    if (filters.auctionCycleIds.length && !filters.auctionCycleIds.includes(u.auctionCycleId)) return false;
    if (filters.requestStatuses.length && !filters.requestStatuses.includes(u.requestStatus)) return false;
    if (filters.responsibleParties.length && !filters.responsibleParties.includes(u.responsibleParty)) return false;
    if (filters.issueCategories.length && !filters.issueCategories.includes(u.aiIssueCategory)) return false;
    if (filters.overdueOnly && u.daysOverdue <= 0) return false;
    if (filters.notOverdueOnly && u.daysOverdue > 0) return false;
    if (filters.dateFrom && u.photoRequestDate && u.photoRequestDate < filters.dateFrom) return false;
    if (filters.dateTo && u.photoRequestDate && u.photoRequestDate > filters.dateTo) return false;
    return true;
  });
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.managerIds.length > 0 ||
    filters.facilityIds.length > 0 ||
    filters.auctionCycleIds.length > 0 ||
    filters.requestStatuses.length > 0 ||
    filters.responsibleParties.length > 0 ||
    filters.issueCategories.length > 0 ||
    filters.overdueOnly ||
    filters.notOverdueOnly ||
    !!filters.dateFrom ||
    !!filters.dateTo
  );
}
