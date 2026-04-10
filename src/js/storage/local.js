import { CONFIG } from "../core/config.js";
import { STATE, invalidateSummaryCache } from "../core/state.js";
import { debounce } from "../core/utils.js";


export function createDefaultWorkbook(name = "") {
  const generatedName = name || `Planilha ${new Date().toLocaleDateString("pt-BR")}`;
  return {
    id: crypto.randomUUID(),
    name: generatedName,
    header: {
      sheetName: generatedName,
      processNumber: "",
      agencyName: "",
      bidDate: "",
      bidObject: "",
      proposalValidity: "",
      companyName: "",
      companyDocument: "",
      stateRegistration: "",
      companyAddress: "",
      companyCityState: "",
      companyPhone: "",
      companyEmail: "",
      responsibleName: "",
      proposalIntro: "Apresentamos nossa proposta comercial para atendimento do objeto licitado.",
      commercialTerms: ""
    },
    settings: {
      taxPercent: 4,
      marginPercent: 20,
      transportPercent: 0,
      warrantyPercent: 0,
      minimumProfitAlert: 8
    },
    items: [],
    versions: [],
    manufacturers: [],
    suppliers: [],
    createdAt: new Date().toISOString()
  };
}

export function ensureWorkbookShape(workbook) {
  const base = createDefaultWorkbook(workbook.name || workbook.header?.sheetName || "Planilha");
  return {
    ...base,
    ...workbook,
    header: { ...base.header, ...(workbook.header || {}) },
    settings: { ...base.settings, ...(workbook.settings || {}) },
    items: (workbook.items || []).map((item) => ({
      lotName: "",
      productName: "",
      manufacturer: "",
      supplier: "",
      quantity: 1,
      unitPrice: 0,
      taxPercentOverride: null,
      marginPercentOverride: null,
      transportPercentOverride: null,
      warrantyPercentOverride: null,
      ...item,
      id: String(item.id || crypto.randomUUID())
    })),
    auditLog: Array.isArray(workbook.auditLog) ? workbook.auditLog : [],
    versions: Array.isArray(workbook.versions) ? workbook.versions : [],
    manufacturers: Array.isArray(workbook.manufacturers) ? workbook.manufacturers : [],
    suppliers: Array.isArray(workbook.suppliers) ? workbook.suppliers : []
  };
}

export function loadWorkbooks() {
  try {
    return (JSON.parse(localStorage.getItem(CONFIG.STORAGE.WORKBOOKS_KEY)) || []).map(ensureWorkbookShape);
  } catch {
    return [];
  }
}

import { syncToCloud } from "./cloud.js";

export function saveWorkbooks(workbooks) {
  try {
    const json = JSON.stringify(workbooks);
    
    if (json.length > CONFIG.STORAGE.STORAGE_QUOTA) {
      throw new Error(`Dados muito grandes (${(json.length / 1024 / 1024).toFixed(2)}MB > ${(CONFIG.STORAGE.STORAGE_QUOTA / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    localStorage.setItem(CONFIG.STORAGE.WORKBOOKS_KEY, json);
    STATE.workbooksCache = workbooks;
    
    const autosaveStatus = document.getElementById("autosaveStatus");
    if (autosaveStatus) {
      autosaveStatus.textContent = `Salvo de forma Local \xB7 ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      autosaveStatus.classList.remove("pending");
    }
    
    // Fire and forget cloud sync
    syncToCloud(workbooks).catch(console.error);
    
  } catch (error) {
    console.error("Erro ao salvar workbooks:", error);
    // showNotification will be handled inside components
    throw error;
  }
}

export const debouncedSaveWorkbooks = debounce(function(workbooks) {
  saveWorkbooks(workbooks);
}, CONFIG.UI.AUTOSAVE_DEBOUNCE_MS);

export function getActiveWorkbookId() {
  return localStorage.getItem(CONFIG.STORAGE.ACTIVE_WORKBOOK_KEY);
}

export function setActiveWorkbookId(workbookId) {
  localStorage.setItem(CONFIG.STORAGE.ACTIVE_WORKBOOK_KEY, workbookId);
  STATE.workbooksCache = null;
}

export function ensureWorkbooks() {
  if (STATE.workbooksCache) {
    return STATE.workbooksCache;
  }
  
  let workbooks = loadWorkbooks();
  if (!workbooks.length) {
    const first = createDefaultWorkbook("Planilha principal");
    workbooks = [first];
    saveWorkbooks(workbooks);
    setActiveWorkbookId(first.id);
    STATE.workbooksCache = workbooks;
    return workbooks;
  }

  const activeId = getActiveWorkbookId();
  if (!workbooks.some((workbook) => workbook.id === activeId)) {
    setActiveWorkbookId(workbooks[0].id);
  }

  STATE.workbooksCache = workbooks;
  return workbooks;
}

export function getActiveWorkbook() {
  const workbooks = ensureWorkbooks();
  const activeId = getActiveWorkbookId();
  return workbooks.find((workbook) => workbook.id === activeId) || workbooks[0];
}

export function buildSnapshot(workbook, label) {
  return {
    id: crypto.randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    payload: {
      header: { ...workbook.header },
      settings: { ...workbook.settings },
      items: workbook.items.map((item) => ({ ...item })),
      manufacturers: [...(workbook.manufacturers || [])],
      suppliers: [...(workbook.suppliers || [])]
    }
  };
}

export function updateManufacturersList(workbook) {
  const mergedManufacturers = new Set([...(workbook.manufacturers || [])]);
  const mergedSuppliers = new Set([...(workbook.suppliers || [])]);
  workbook.items.forEach((item) => {
    if (item.manufacturer?.trim()) {
      mergedManufacturers.add(item.manufacturer.trim());
    }
    if (item.supplier?.trim()) {
      mergedSuppliers.add(item.supplier.trim());
    }
  });
  workbook.manufacturers = Array.from(mergedManufacturers).sort((a, b) => a.localeCompare(b));
  workbook.suppliers = Array.from(mergedSuppliers).sort((a, b) => a.localeCompare(b));
  return workbook;
}

export function updateActiveWorkbook(updater, options = {}) {
  const workbooks = ensureWorkbooks();
  const activeId = getActiveWorkbookId();
  const nextWorkbooks = workbooks.map((workbook) => {
    if (workbook.id !== activeId) {
      return workbook;
    }

    let nextWorkbook = updater(ensureWorkbookShape(workbook));
    nextWorkbook = updateManufacturersList(nextWorkbook);

    if (options.versionLabel) {
      const snapshot = buildSnapshot(nextWorkbook, options.versionLabel);
      nextWorkbook.versions = [snapshot, ...(nextWorkbook.versions || [])].slice(0, CONFIG.STORAGE.VERSION_LIMIT);
    }

    if (options.auditDetails) {
      const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user: document.getElementById('navbarLoginBtn')?.textContent?.replace('☁️ Ativo: ', '') || 'Local',
        action: options.auditAction || 'Edição de Dados',
        details: options.auditDetails
      };
      nextWorkbook.auditLog = [logEntry, ...(nextWorkbook.auditLog || [])];
    }

    return nextWorkbook;
  });

  STATE.workbooksCache = nextWorkbooks;
  invalidateSummaryCache();
  STATE.filterCache = { workbookId: null, term: "", items: null };

  debouncedSaveWorkbooks(nextWorkbooks);
}

export function getAlertFilter() {
  return localStorage.getItem(CONFIG.STORAGE.ALERT_FILTER_KEY) === "true";
}

export function setAlertFilter(value) {
  localStorage.setItem(CONFIG.STORAGE.ALERT_FILTER_KEY, String(value));
}
