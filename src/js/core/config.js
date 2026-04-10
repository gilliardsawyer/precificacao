export const CONFIG = {
  STORAGE: {
    WORKBOOKS_KEY: "precificacao-workbooks",
    ACTIVE_WORKBOOK_KEY: "precificacao-active-workbook",
    ALERT_FILTER_KEY: "precificacao-alert-filter",
    PRODUCTS_KEY: "precificacao-products",
    VERSION_LIMIT: 12,
    STORAGE_QUOTA: 5 * 1024 * 1024 // 5MB
  },
  PRICING: {
    NEAR_MINIMUM_GAP_PERCENT: 5,
    MAX_QUANTITY: 999999,
    MAX_PRICE: 999999999,
    MINIMUM_PROFIT_ALERT: 8
  },
  UI: {
    SEARCH_DEBOUNCE_MS: 300,
    AUTOSAVE_DEBOUNCE_MS: 1000,
    NOTIFICATION_DURATION_MS: 2000,
    TABLE_MIN_HEIGHT_VH: 72,
    SIDEBAR_WIDTH_PX: 310
  }
};
