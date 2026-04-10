export const STATE = {
  editingItemId: null,
  searchTerm: "",
  compareWorkbookId: "",
  saveTimeout: null,
  searchTimeout: null,
  filterCache: { workbookId: null, term: "", items: null },
  summaryCache: { workbookId: null, summary: null, itemCount: 0 },
  workbooksCache: null
};

// Aliases variables that parts of UI use
export let editingItemId = STATE.editingItemId;
export let searchTerm = STATE.searchTerm;
export let compareWorkbookId = STATE.compareWorkbookId;

export function invalidateSummaryCache() {
  STATE.summaryCache = { workbookId: null, summary: null, itemCount: 0 };
}
