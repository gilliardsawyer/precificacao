import { CONFIG } from './core/config.js';
import { STATE, invalidateSummaryCache } from './core/state.js';
import { toNumber, normalizePercent, escapeHtml, debounce, formatCurrency, formatPercent } from './core/utils.js';
import { getEffectivePercents, calculateRow, getLotLabel, groupItemsByLot, calculateLotSubtotal, summarizeWorkbook, validateItemData } from './core/pricing.js';
import { DOM } from './ui/dom.js';
import { showNotification } from './ui/toasts.js';
import { createDefaultWorkbook, ensureWorkbookShape, loadWorkbooks, saveWorkbooks, debouncedSaveWorkbooks, getActiveWorkbookId, setActiveWorkbookId, ensureWorkbooks, getActiveWorkbook, buildSnapshot, updateManufacturersList, updateActiveWorkbook, getAlertFilter, setAlertFilter } from './storage/local.js';

import { initAuth } from './ui/auth.js';
import { setupMassEdit, MassEditState } from './ui/massEdit.js';
import { setupSortableTable } from './ui/sortableTable.js';
import { setupSmartImporter, handleImportedSpreadsheet } from './ui/smartImport.js';
import { setupFloatingCalc } from './ui/floatingCalc.js';
import { setupLogistics } from './ui/logistics.js';
import { setupCompetition } from './ui/competition.js';
import {
  setupSubTabs, setupScenarios, setupChecklist, setupTimeline,
  setupImpugnacao, setupPaymentSimulator, renderProfitability,
  setupEmpenho, setupEditalAnalysis, renderPriceSuggestions, setupPdfGenerator
} from './ui/advancedFeatures.js';

// Incializar autenticação, passando o renderAll global como callback fallback
initAuth(() => renderAll());
setupMassEdit(() => renderAll());
setupSortableTable(() => renderAll());
window.calcComponent = setupFloatingCalc(getActiveWorkbook);
setupLogistics(getActiveWorkbook);
setupCompetition(getActiveWorkbook);
setupSubTabs();
setupScenarios(getActiveWorkbook, () => renderAll());
setupChecklist(getActiveWorkbook, updateActiveWorkbook);
setupTimeline(getActiveWorkbook, updateActiveWorkbook);
setupImpugnacao(getActiveWorkbook);
setupPaymentSimulator(getActiveWorkbook);
setupEmpenho(getActiveWorkbook, updateActiveWorkbook);
setupEditalAnalysis();
setupPdfGenerator(getActiveWorkbook);
setupNavigation();

// Renderizar módulos de dados ao clicar nas abas
document.querySelector('[data-nav="financial"]')?.addEventListener('click', () => {
  setTimeout(() => { renderProfitability(); }, 50);
});
document.querySelector('[data-nav="ai"]')?.addEventListener('click', () => {
  setTimeout(() => { renderPriceSuggestions(getActiveWorkbook); }, 50);
});

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const modules = document.querySelectorAll(".module-content");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetModuleId = `module-${item.dataset.nav}`;
      const targetModule = document.getElementById(targetModuleId);

      if (!targetModule) return;

      // Atualizar UI da Navegação
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Atualizar Visibilidade dos Módulos
      modules.forEach((mod) => {
        mod.classList.remove("module-active");
        mod.classList.add("module-hidden");
      });

      targetModule.classList.remove("module-hidden");
      targetModule.classList.add("module-active");

      // Resetar scroll para o topo ao trocar de aba
      window.scrollTo({ top: 0, behavior: "smooth" });
      
      // Feedback visual se necessário
      console.log(`Módulo ativo: ${item.dataset.nav}`);
    });
  });
}

setupSmartImporter((mappedItems) => {
  if (!mappedItems.length) return;
  updateActiveWorkbook((workbook) => {
    workbook.items.push(...mappedItems);
    return workbook;
  }, { versionLabel: `Importação Inteligente (${mappedItems.length} itens)` });
  
  renderAll({ skipForms: false, skipHistory: false });
  showNotification(`${mappedItems.length} item(ns) importado(s)!`, "success");
});

// ============================================================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================================================



// ============================================================================
// ELEMENTOS DO DOM - ORGANIZADOS POR CATEGORIA
// ============================================================================



// ============================================================================
// ESTADO GLOBAL
// ============================================================================



// Aliases for backward compatibility
const itemForm = DOM.forms.item;
const bidForm = DOM.forms.bid;
const settingsForm = DOM.forms.settings;
const proposalForm = DOM.forms.proposal;
const itemsTableBody = DOM.tables.itemsTableBody;
const rowTemplate = DOM.tables.rowTemplate;
const clearAllButton = DOM.buttons.clearAll;
const cancelEditButton = DOM.buttons.cancelEdit;
const saveItemButton = DOM.buttons.saveItem;
const newSheetButton = DOM.buttons.newSheet;
const newSheetBottomButton = DOM.buttons.newSheetBottom;
const duplicateSheetButton = DOM.buttons.duplicateSheet;
const importItemsButton = DOM.buttons.importItems;
const importFileInput = DOM.inputs.importFileInput;
const importXlsxButton = DOM.buttons.importXlsx;
const importXlsxInput = DOM.inputs.importXlsxInput;
const exportExcelButton = DOM.buttons.exportExcel;
const exportPdfButton = DOM.buttons.exportPdf;
const backupButton = DOM.buttons.backup;
const restoreButton = DOM.buttons.restore;
const restoreFileInput = DOM.inputs.restoreFileInput;
const toggleAlertFilterButton = DOM.buttons.toggleAlertFilter;
const clearFiltersButton = DOM.buttons.clearFilters;
const togglePrintModeButton = DOM.buttons.togglePrintMode;
const sheetSelector = DOM.inputs.sheetSelector;
const versionHistory = DOM.sidebars.versionHistory;
const manufacturerSuggestions = DOM.inputs.manufacturerSuggestions;
const supplierSuggestions = DOM.inputs.supplierSuggestions;
const autosaveStatus = DOM.status.autosaveStatus;
const quickSearch = DOM.inputs.quickSearch;
const compareSheetSelector = DOM.inputs.compareSheetSelector;
const compareSummary = DOM.sidebars.compareSummary;
const lotSelector = DOM.inputs.lotSelector;
const duplicateLotButton = DOM.buttons.duplicateLot;
const lotSummaryList = DOM.sidebars.lotSummaryList;

const itemFields = DOM.itemFields;
const bidFields = DOM.bidFields;
const proposalFields = DOM.proposalFields;
const settingsFields = DOM.settingsFields;
const totalsFields = DOM.totalsFields;
const printFields = DOM.printFields;

let editingItemId = STATE.editingItemId;
let searchTerm = STATE.searchTerm;
let compareWorkbookId = STATE.compareWorkbookId;

// ============================================================================
// FORMATADORES E UTILITÁRIOS
// ============================================================================





/**
 * Converte valor para número seguro
 * @param {*} value - Valor a converter
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} Número entre min e max
 */


/**
 * Normaliza percentual entre 0 e 100
 * @param {*} value - Valor a normalizar
 * @param {boolean} allowBlank - Se permite retornar null
 * @returns {number|null} Percentual normalizado ou null
 */


/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */


/**
 * Cria debounce para funções
 * @param {Function} func - Função a executar
 * @param {number} delay - Delay em ms
 * @returns {Function} Função debounced
 */


/**
 * Cria notificação/toast para usuário
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo (success, error, info, warning)
 * @param {number} duration - Duração em ms
 */






// ============================================================================
// WORKBOOK E ARMAZENAMENTO
// ============================================================================





/**
 * Salva workbooks com debounce para evitar gravar 100x por segundo
 */
















 
/**
 * Marca estado como tendo alterações pendentes
 */
function markAutosavePending() {
  if (!autosaveStatus) {
    return;
  }
  autosaveStatus.textContent = "Alteracoes pendentes";
  autosaveStatus.classList.add("pending");
}

const debouncedAutosaveBidForm = debounce(() => {
  persistBidForm({ withVersion: false });
}, CONFIG.UI.AUTOSAVE_DEBOUNCE_MS);

const debouncedAutosaveProposalForm = debounce(() => {
  persistProposalForm({ withVersion: false });
}, CONFIG.UI.AUTOSAVE_DEBOUNCE_MS);

const debouncedAutosaveSettingsForm = debounce(() => {
  persistSettingsForm({ withVersion: false });
}, CONFIG.UI.AUTOSAVE_DEBOUNCE_MS);





function applyUiModes() {
  document.body.classList.toggle("alert-filter", getAlertFilter());
  toggleAlertFilterButton.textContent = getAlertFilter() ? "Mostrar todos" : "So alertas";
}



function getItemFormData() {
  return {
    lotName: itemFields.lotName.value.trim(),
    productName: itemFields.productName.value.trim(),
    manufacturer: itemFields.manufacturer.value.trim(),
    supplier: itemFields.supplier.value.trim(),
    quantity: Math.max(1, Math.round(toNumber(itemFields.quantity.value))),
    unitPrice: Math.max(0, toNumber(itemFields.unitPrice.value)),
    taxPercentOverride: normalizePercent(itemFields.itemTaxPercent.value, true),
    marginPercentOverride: normalizePercent(itemFields.itemMarginPercent.value, true),
    transportPercentOverride: normalizePercent(itemFields.itemTransportPercent.value, true),
    warrantyPercentOverride: normalizePercent(itemFields.itemWarrantyPercent.value, true)
  };
}

function getSettingsFromForm() {
  return {
    taxPercent: normalizePercent(settingsFields.taxPercent.value),
    marginPercent: normalizePercent(settingsFields.marginPercent.value),
    transportPercent: normalizePercent(settingsFields.transportPercent.value),
    warrantyPercent: normalizePercent(settingsFields.warrantyPercent.value),
    minimumProfitAlert: normalizePercent(settingsFields.minimumProfitAlert.value)
  };
}









function resetItemForm() {
  itemForm.reset();
  itemFields.quantity.value = "1";
  itemFields.unitPrice.value = "0";
  STATE.editingItemId = null;
  cancelEditButton.classList.add("hidden");
  saveItemButton.textContent = "Salvar item";
}

function populateItemForm(item) {
  itemFields.lotName.value = item.lotName || "";
  itemFields.productName.value = item.productName || "";
  itemFields.manufacturer.value = item.manufacturer || "";
  itemFields.supplier.value = item.supplier || "";
  itemFields.quantity.value = String(item.quantity || 1);
  itemFields.unitPrice.value = String(item.unitPrice || 0);
  itemFields.itemTaxPercent.value = item.taxPercentOverride ?? "";
  itemFields.itemMarginPercent.value = item.marginPercentOverride ?? "";
  itemFields.itemTransportPercent.value = item.transportPercentOverride ?? "";
  itemFields.itemWarrantyPercent.value = item.warrantyPercentOverride ?? "";
}

function renderWorkbookSelector() {
  const workbooks = ensureWorkbooks();
  const activeId = getActiveWorkbookId();
  sheetSelector.innerHTML = "";
  compareSheetSelector.innerHTML = '<option value="">Sem comparacao</option>';
  workbooks.forEach((workbook) => {
    const option = document.createElement("option");
    option.value = workbook.id;
    option.textContent = workbook.header.sheetName || workbook.name;
    option.selected = workbook.id === activeId;
    sheetSelector.appendChild(option);

    if (workbook.id !== activeId) {
      const compareOption = document.createElement("option");
      compareOption.value = workbook.id;
      compareOption.textContent = workbook.header.sheetName || workbook.name;
      compareOption.selected = workbook.id === compareWorkbookId;
      compareSheetSelector.appendChild(compareOption);
    }
  });

  if (!workbooks.some((workbook) => workbook.id === STATE.compareWorkbookId)) {
    STATE.compareWorkbookId = "";
    compareSheetSelector.value = "";
  }
}

function renderManufacturerSuggestions(workbook) {
  manufacturerSuggestions.innerHTML = "";
  (workbook.manufacturers || []).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    manufacturerSuggestions.appendChild(option);
  });
}

function renderSupplierSuggestions(workbook) {
  supplierSuggestions.innerHTML = "";
  (workbook.suppliers || []).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    supplierSuggestions.appendChild(option);
  });
}

function syncFormsFromWorkbook(workbook) {
  bidFields.sheetName.value = workbook.header.sheetName || workbook.name || "";
  bidFields.processNumber.value = workbook.header.processNumber || "";
  bidFields.agencyName.value = workbook.header.agencyName || "";
  bidFields.bidDate.value = workbook.header.bidDate || "";
  bidFields.bidObject.value = workbook.header.bidObject || "";
  bidFields.proposalValidity.value = workbook.header.proposalValidity || "";
  proposalFields.companyName.value = workbook.header.companyName || "";
  proposalFields.companyDocument.value = workbook.header.companyDocument || "";
  proposalFields.stateRegistration.value = workbook.header.stateRegistration || "";
  proposalFields.companyAddress.value = workbook.header.companyAddress || "";
  proposalFields.companyCityState.value = workbook.header.companyCityState || "";
  proposalFields.companyPhone.value = workbook.header.companyPhone || "";
  proposalFields.companyEmail.value = workbook.header.companyEmail || "";
  proposalFields.responsibleName.value = workbook.header.responsibleName || "";
  proposalFields.proposalIntro.value = workbook.header.proposalIntro || "";
  proposalFields.commercialTerms.value = workbook.header.commercialTerms || "";

  settingsFields.taxPercent.value = workbook.settings.taxPercent;
  settingsFields.marginPercent.value = workbook.settings.marginPercent;
  settingsFields.transportPercent.value = workbook.settings.transportPercent;
  settingsFields.warrantyPercent.value = workbook.settings.warrantyPercent;
  settingsFields.minimumProfitAlert.value = workbook.settings.minimumProfitAlert;
  
  // Atualizar placeholders do formulário de item com valores padrão
  itemFields.itemTaxPercent.placeholder = String(workbook.settings.taxPercent);
  itemFields.itemMarginPercent.placeholder = String(workbook.settings.marginPercent);
  itemFields.itemTransportPercent.placeholder = String(workbook.settings.transportPercent);
  itemFields.itemWarrantyPercent.placeholder = String(workbook.settings.warrantyPercent);
}

function syncPrintHeader(workbook) {
  const summary = summarizeWorkbook(workbook);
  const averageProfitPercent = summary.totalFinal > 0 ? (summary.profitValue / summary.totalFinal) * 100 : 0;
  const formatPrintText = (value, fallback = "-") => value && String(value).trim() ? String(value).trim() : fallback;

  printFields.printSheetName.textContent = workbook.header.sheetName || workbook.name || "-";
  printFields.printProcessNumber.textContent = formatPrintText(workbook.header.processNumber);
  printFields.printAgencyName.textContent = formatPrintText(workbook.header.agencyName);
  printFields.printBidDate.textContent = formatPrintText(workbook.header.bidDate);
  printFields.printProposalValidity.textContent = formatPrintText(workbook.header.proposalValidity);
  printFields.printHeaderProcessNumber.textContent = formatPrintText(workbook.header.processNumber);
  printFields.printHeaderAgencyName.textContent = formatPrintText(workbook.header.agencyName);
  printFields.printHeaderBidDate.textContent = formatPrintText(workbook.header.bidDate);
  printFields.printHeaderProposalValidity.textContent = formatPrintText(workbook.header.proposalValidity);
  printFields.printBidObject.textContent = formatPrintText(workbook.header.bidObject);
  printFields.printCompanyName.textContent = formatPrintText(workbook.header.companyName);
  printFields.printCompanyDocument.textContent = formatPrintText(workbook.header.companyDocument);
  printFields.printStateRegistration.textContent = formatPrintText(workbook.header.stateRegistration);
  printFields.printCompanyAddress.textContent = formatPrintText(workbook.header.companyAddress);
  printFields.printCompanyCityState.textContent = formatPrintText(workbook.header.companyCityState);
  printFields.printCompanyPhone.textContent = formatPrintText(workbook.header.companyPhone);
  printFields.printCompanyEmail.textContent = formatPrintText(workbook.header.companyEmail);
  printFields.printResponsibleName.textContent = formatPrintText(workbook.header.responsibleName);
  printFields.printProposalIntro.textContent = formatPrintText(
    workbook.header.proposalIntro,
    "Apresentamos nossa proposta comercial para atendimento do objeto licitado."
  );
  printFields.printCommercialTerms.textContent = formatPrintText(
    workbook.header.commercialTerms,
    "Sem condições comerciais adicionais informadas."
  );
  printFields.printGrandTotal.textContent = formatCurrency(summary.totalFinal);
  printFields.printTotalItems.textContent = String(workbook.items.length);
  printFields.printLotCount.textContent = String(summary.lotCount);
  printFields.printProfitPercent.textContent = formatPercent(averageProfitPercent);
}
function renderVersionHistory(workbook) {
  versionHistory.innerHTML = "";
  if (!workbook.versions.length) {
    versionHistory.innerHTML = '<div class="history-item"><strong>Nenhuma versao registrada ainda.</strong><time>Uma nova versao aparece quando voce altera itens, importa dados ou muda a configuracao.</time></div>';
    return;
  }

  workbook.versions.forEach((version) => {
    const wrapper = document.createElement("div");
    wrapper.className = "history-item";
    
    // Usar textContent para dados dinâmicos (segurança XSS)
    const strong = document.createElement("strong");
    strong.textContent = version.label;
    wrapper.appendChild(strong);
    
    const time = document.createElement("time");
    time.textContent = new Date(version.createdAt).toLocaleString("pt-BR");
    wrapper.appendChild(time);
    
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button";
    button.dataset.restoreVersion = version.id;
    button.textContent = "Restaurar esta versao";
    wrapper.appendChild(button);
    
    versionHistory.appendChild(wrapper);
  });
}



function renderLotHeader(label, colspan) {
  const row = document.createElement("tr");
  row.className = "lot-row";
  row.innerHTML = `<td colspan="${colspan}">${label}</td>`;
  return row;
}

function renderLotSubtotal(label, subtotal) {
  const row = document.createElement("tr");
  row.className = "lot-subtotal-row";
  row.innerHTML = `
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td colspan="3">Subtotal ${label}</td> 
    <td>-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td>${formatCurrency(subtotal.finalUnitAverage)}</td> 
    <td class="no-print">-</td> 
    <td>${formatCurrency(subtotal.finalTotal)}</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
    <td class="no-print">-</td> 
  `;
  return row;
}



function renderLotSelector(workbook) {
  const selectedValue = lotSelector.value;
  lotSelector.innerHTML = '<option value="">Escolha um lote</option>';
  const labels = [...new Set(workbook.items.map((item) => getLotLabel(item)))];
  labels.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    option.selected = label === selectedValue;
    lotSelector.appendChild(option);
  });
}

function renderCompareSummary(workbook) {
  if (!STATE.compareWorkbookId) {
    compareSummary.innerHTML = `
      <div class="summary-row">
        <span>Status</span>
        <strong>Selecione uma planilha para comparar</strong>
      </div>
    `;
    return;
  }

  const target = ensureWorkbooks().find((entry) => entry.id === STATE.compareWorkbookId);
  if (!target) {
    compareSummary.innerHTML = `
      <div class="summary-row">
        <span>Status</span>
        <strong>Planilha de comparacao nao encontrada</strong>
      </div>
    `;
    return;
  }

  const currentTotals = summarizeWorkbook(workbook);
  const compareTotals = summarizeWorkbook(target);
  const totalDiff = currentTotals.finalTotal - compareTotals.finalTotal;
  const profitDiff = currentTotals.totalProfit - compareTotals.totalProfit;
  const itemDiff = workbook.items.length - target.items.length;

  compareSummary.innerHTML = `
    <div class="summary-row">
      <span>Planilha comparada</span>
      <strong>${target.header.sheetName || target.name}</strong>
    </div>
    <div class="summary-row">
      <span>Diferenca de total final</span>
      <strong>${formatCurrency(totalDiff)}</strong>
    </div>
    <div class="summary-row">
      <span>Diferenca de lucro</span>
      <strong>${formatCurrency(profitDiff)}</strong>
    </div>
    <div class="summary-row">
      <span>Diferenca de itens</span>
      <strong>${itemDiff}</strong>
    </div>
  `;
}

function renderLotSummary(lotSummaries) {
  lotSummaryList.innerHTML = "";
  if (!lotSummaries.length) {
    lotSummaryList.innerHTML = '<div class="history-item"><strong>Nenhum lote cadastrado.</strong></div>';
    return;
  }

  lotSummaries.forEach((summary, index) => {
    const card = document.createElement("div");
    card.className = "history-item";
    card.style.setProperty('--stagger', index + 1);
    const label = summary.label || "Sem lote";
    card.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <time>${summary.count} item(ns) | ${formatCurrency(summary.finalTotal)}</time>
      <div class="summary-row">
        <span>Lucro</span>
        <strong>${formatCurrency(summary.profitValue)}</strong>
      </div>
      <div class="summary-row">
        <span>Desconto max. medio</span>
        <strong>${formatPercent(summary.maximumDiscountAverage)}</strong>
      </div>
    `;
    lotSummaryList.appendChild(card);
  });
}

/**
 * Calcula subtotal para um lote
 * @param {Array} items - Items do lote
 * @param {Object} settings - Configurações de cálculo
 * @returns {Object} Subtotal com agregações
 */


/**
 * Resumo completo da planilha com cache inteligente
 * @param {Object} workbook - Workbook a resumir
 * @returns {Object} Totais e agregações
 */


/**
 * Invalida cache de resumo
 */

/**
 * Obtém itens filtrados com cache
 * @param {Object} workbook - Workbook
 * @param {string} term - Termo de busca
 * @returns {Array} Items filtrados
 */
function getFilteredItems(workbook, term) {
  if (STATE.filterCache.workbookId === workbook.id && STATE.filterCache.term === term && STATE.filterCache.items !== null) {
    return STATE.filterCache.items;
  }

  STATE.filterCache.workbookId = workbook.id;
  STATE.filterCache.term = term;
  
  if (term.trim() === "") {
    STATE.filterCache.items = workbook.items;
  } else {
    const searchTerm = term.trim().toLowerCase();
    STATE.filterCache.items = workbook.items.filter((item) => {
      const haystack = `${item.productName || ""} ${item.manufacturer || ""} ${item.supplier || ""}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  return STATE.filterCache.items;
}

function renderTable() {
  const workbook = getActiveWorkbook();
  const settings = workbook.settings;
  const minProfitAlert = settings.minimumProfitAlert;
  
  const filteredItems = getFilteredItems(workbook, STATE.searchTerm);
  const groups = groupItemsByLot(filteredItems);
  const summary = summarizeWorkbook(workbook);
  
  itemsTableBody.innerHTML = "";

  if (!filteredItems.length) {
    itemsTableBody.innerHTML = '<tr><td colspan="23">Nenhum item encontrado para o filtro atual.</td></tr>';
  }

  groups.forEach((group) => {
    if (group.items.length) {
      itemsTableBody.appendChild(renderLotHeader(group.label, 23));
    }

    const lotSubtotal = calculateLotSubtotal(group.items, settings);
    let staggerIndex = 0;

    group.items.forEach((item) => {
      staggerIndex++;
      const calc = calculateRow(item, settings);
      const fragment = rowTemplate.content.cloneNode(true);
      const row = fragment.querySelector("tr");
      row.style.setProperty('--stagger', staggerIndex);

      row.dataset.itemId = item.id;

      const inputs = {
        lotName: row.querySelector('[data-inline="lotName"]'),
        productName: row.querySelector('[data-inline="productName"]'),
        manufacturer: row.querySelector('[data-inline="manufacturer"]'),
        supplier: row.querySelector('[data-inline="supplier"]'),
        quantity: row.querySelector('[data-inline="quantity"]'),
        unitPrice: row.querySelector('[data-inline="unitPrice"]'),
        taxPercentOverride: row.querySelector('[data-inline="taxPercentOverride"]'),
        marginPercentOverride: row.querySelector('[data-inline="marginPercentOverride"]'),
        transportPercentOverride: row.querySelector('[data-inline="transportPercentOverride"]'),
        warrantyPercentOverride: row.querySelector('[data-inline="warrantyPercentOverride"]')
      };

      inputs.lotName.value = item.lotName || "";
      inputs.productName.value = item.productName || "";
      inputs.manufacturer.value = item.manufacturer || "";
      inputs.supplier.value = item.supplier || "";
      inputs.quantity.value = String(calc.quantity);
      inputs.unitPrice.value = String(calc.unitPrice);
      inputs.taxPercentOverride.value = item.taxPercentOverride ?? "";
      inputs.marginPercentOverride.value = item.marginPercentOverride ?? "";
      inputs.transportPercentOverride.value = item.transportPercentOverride ?? "";
      inputs.warrantyPercentOverride.value = item.warrantyPercentOverride ?? "";
      
      inputs.taxPercentOverride.placeholder = String(settings.taxPercent);
      inputs.marginPercentOverride.placeholder = String(settings.marginPercent);
      inputs.transportPercentOverride.placeholder = String(settings.transportPercent);
      inputs.warrantyPercentOverride.placeholder = String(settings.warrantyPercent);

      // Preencher spans de impressão para evitar inputs no PDF
      row.querySelector('[data-print="lotName"]').textContent = item.lotName || "-";
      row.querySelector('[data-print="productName"]').textContent = item.productName || "-";
      row.querySelector('[data-print="manufacturer"]').textContent = item.manufacturer || "-";
      row.querySelector('[data-print="quantity"]').textContent = String(calc.quantity);
      row.querySelector('[data-print="unitPrice"]').textContent = formatCurrency(calc.unitPrice);

      const cells = {
        baseTotal: row.querySelector('[data-cell="baseTotal"]'),
        markup: row.querySelector('[data-cell="markup"]'),
        minimumUnitPrice: row.querySelector('[data-cell="minimumUnitPrice"]'),
        finalUnitPrice: row.querySelector('[data-cell="finalUnitPrice"]'),
        maximumDiscountPercent: row.querySelector('[data-cell="maximumDiscountPercent"]'),
        finalTotal: row.querySelector('[data-cell="finalTotal"]'),
        taxValue: row.querySelector('[data-cell="taxValue"]'),
        transportValue: row.querySelector('[data-cell="transportValue"]'),
        warrantyValue: row.querySelector('[data-cell="warrantyValue"]'),
        profitValue: row.querySelector('[data-cell="profitValue"]'),
        profitPercent: row.querySelector('[data-cell="profitPercent"]')
      };

      cells.baseTotal.textContent = formatCurrency(calc.baseTotal);
      cells.markup.textContent = calc.markup.toFixed(6).replace(".", ",");
      cells.minimumUnitPrice.textContent = formatCurrency(calc.minimumUnitPrice);
      cells.finalUnitPrice.textContent = formatCurrency(calc.finalUnitPrice);
      cells.maximumDiscountPercent.textContent = formatPercent(calc.maximumDiscountPercent);
      cells.finalTotal.textContent = formatCurrency(calc.finalTotal);
      cells.taxValue.textContent = formatCurrency(calc.taxValue);
      cells.transportValue.textContent = formatCurrency(calc.transportValue);
      cells.warrantyValue.textContent = formatCurrency(calc.warrantyValue);
      cells.profitValue.textContent = formatCurrency(calc.profitValue);
      cells.profitPercent.textContent = formatPercent(calc.profitPercentReal);
      
      const checkbox = row.querySelector('.item-checkbox');
      if (checkbox) {
        checkbox.checked = MassEditState.selectedItems.has(item.id);
      }
      
      cells.minimumUnitPrice.classList.add("minimum-price-cell");
      
      if (calc.profitPercentReal < minProfitAlert) {
        cells.profitPercent.classList.add("low-profit-cell");
        cells.profitValue.classList.add("low-profit-cell");
        row.classList.add("low-profit-row");
      }
      
      if (calc.nearMinimum) {
        cells.maximumDiscountPercent.classList.add("risk-cell");
        cells.finalUnitPrice.classList.add("risk-cell");
        row.classList.add("near-minimum-row");
      }

      row.querySelectorAll("[data-action]").forEach((button) => {
        button.dataset.itemId = item.id;
      });

      itemsTableBody.appendChild(fragment);
    });

    if (lotSubtotal.count) {
      itemsTableBody.appendChild(renderLotSubtotal(group.label, lotSubtotal));
    }
  });

  const globalPercent = settings.taxPercent + settings.marginPercent + settings.transportPercent + settings.warrantyPercent;
  const globalMarkup = 1 + (globalPercent / 100);
  const averageProfitPercent = summary.totalFinal > 0 ? (summary.profitValue / summary.totalFinal) * 100 : 0;
  const averageMaximumDiscount = summary.discountPercentAverage || 0;

  totalsFields.totalQuantity.textContent = String(summary.totalQuantity);
  totalsFields.totalBaseValue.textContent = formatCurrency(summary.baseTotal);
  totalsFields.globalMarkupFoot.textContent = globalMarkup.toFixed(6).replace(".", ",");
  totalsFields.totalMinimumUnit.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.minimumTotal / summary.totalQuantity : 0);
  totalsFields.totalUnitFinal.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.finalTotal / summary.totalQuantity : 0);
  totalsFields.totalDiscountPercent.textContent = formatPercent(averageMaximumDiscount);
  totalsFields.grandTotal.textContent = formatCurrency(summary.totalFinal);
  totalsFields.totalTaxValue.textContent = formatCurrency(summary.taxValue);
  totalsFields.totalTransportValue.textContent = formatCurrency(summary.transportValue);
  totalsFields.totalWarrantyValue.textContent = formatCurrency(summary.warrantyValue);
  totalsFields.totalProfitValue.textContent = formatCurrency(summary.profitValue);
  totalsFields.totalProfitPercent.textContent = formatPercent(averageProfitPercent);
  totalsFields.sumPercent.textContent = formatPercent(globalPercent);
  totalsFields.globalMarkup.textContent = globalMarkup.toFixed(6).replace(".", ",");
  totalsFields.baseTotalResume.textContent = formatCurrency(summary.baseTotal);
  totalsFields.minimumUnitResume.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.minimumTotal / summary.totalQuantity : 0);
  totalsFields.finalTotalResume.textContent = formatCurrency(summary.totalFinal);
  totalsFields.discountPercentResume.textContent = formatPercent(averageMaximumDiscount);
  totalsFields.profitValueResume.textContent = formatCurrency(summary.profitValue);
  totalsFields.profitPercentResume.textContent = formatPercent(averageProfitPercent);
  totalsFields.lowMarginCount.textContent = String(summary.lowMarginCount);
  totalsFields.lotCount.textContent = String(summary.lotCount);
  renderLotSummary(summary.lotSummaries);
}

/**
 * Renderiza todos os componentes ou seletivamente (com flags)
 * @param {Object} options - Opções { skipTable, skipForms, skipHistory, skipComparison }
 */
function renderAll(options = {}) {
  const {
    skipTable = false,
    skipForms = false,
    skipHistory = false,
    skipComparison = false
  } = options;

  const workbook = getActiveWorkbook();
  applyUiModes();

  if (!skipForms) {
    renderWorkbookSelector();
    renderLotSelector(workbook);
    renderManufacturerSuggestions(workbook);
    renderSupplierSuggestions(workbook);
    syncFormsFromWorkbook(workbook);
    syncPrintHeader(workbook);
  }

  if (!skipHistory) {
    renderVersionHistory(workbook);
  }

  if (!skipComparison) {
    renderCompareSummary(workbook);
  }

  if (!skipTable) {
    renderTable();
  }
  renderProfitability();
  renderAuditLog(workbook);
  if (window.calcComponent) window.calcComponent.refresh();
}

function renderAuditLog(workbook) {
  const container = document.getElementById("auditContainer");
  if (!container) return;
  const logs = workbook.auditLog || [];
  if (!logs.length) {
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted)">Nenhuma alteração registrada nesta planilha ainda.</div>';
    return;
  }
  
  container.innerHTML = logs.map((log) => {
    const data = new Date(log.timestamp).toLocaleString("pt-BR");
    return `
      <div class="timeline-event past" style="border-left-color: var(--primary);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; color:var(--text-main);">${escapeHtml(log.action)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(log.details)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.8rem; font-weight:500;">${escapeHtml(log.user)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${data}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
function persistBidForm({ withVersion = true } = {}) {
  updateActiveWorkbook((workbook) => {
    workbook.name = bidFields.sheetName.value.trim() || workbook.name;
    workbook.header.sheetName = bidFields.sheetName.value.trim() || workbook.name;
    workbook.header.processNumber = bidFields.processNumber.value.trim();
    workbook.header.agencyName = bidFields.agencyName.value.trim();
    workbook.header.bidDate = bidFields.bidDate.value;
    workbook.header.bidObject = bidFields.bidObject.value.trim();
    workbook.header.proposalValidity = bidFields.proposalValidity.value.trim();
    return workbook;
  }, withVersion ? { versionLabel: "Cabecalho atualizado" } : {});
  renderAll({ skipHistory: !withVersion, skipTable: true });
}

function saveBidForm() {
  persistBidForm({ withVersion: true });
}

function persistProposalForm({ withVersion = true } = {}) {
  updateActiveWorkbook((workbook) => {
    workbook.header.companyName = proposalFields.companyName.value.trim();
    workbook.header.companyDocument = proposalFields.companyDocument.value.trim();
    workbook.header.stateRegistration = proposalFields.stateRegistration.value.trim();
    workbook.header.companyAddress = proposalFields.companyAddress.value.trim();
    workbook.header.companyCityState = proposalFields.companyCityState.value.trim();
    workbook.header.companyPhone = proposalFields.companyPhone.value.trim();
    workbook.header.companyEmail = proposalFields.companyEmail.value.trim();
    workbook.header.responsibleName = proposalFields.responsibleName.value.trim();
    workbook.header.proposalIntro = proposalFields.proposalIntro.value.trim();
    workbook.header.commercialTerms = proposalFields.commercialTerms.value.trim();
    return workbook;
  }, withVersion ? { versionLabel: "Dados do proponente atualizados" } : {});
  renderAll({ skipHistory: !withVersion, skipTable: true });
}

function saveProposalForm(event) {
  if (event) event.preventDefault();
  persistProposalForm({ withVersion: true });
}

function persistSettingsForm({ withVersion = true } = {}) {
  updateActiveWorkbook((workbook) => {
    workbook.settings = getSettingsFromForm();
    return workbook;
  }, withVersion ? { versionLabel: "Parametros gerais atualizados" } : {});
  renderAll({ skipHistory: !withVersion });
}

function saveSettingsForm(event) {
  if (event) event.preventDefault();
  persistSettingsForm({ withVersion: true });
}

function saveItem(itemData) {
  console.log("DEBUG: saveItem chamado com dados:", itemData);
  const error = validateItemData(itemData);
  if (error) {
    console.log("DEBUG: Validação falhou:", error);
    showNotification(error, "error");
    return false;
  }

  const isEditing = STATE.editingItemId !== null;
  console.log("DEBUG: isEditing =", isEditing);
  
  updateActiveWorkbook((workbook) => {
    if (STATE.editingItemId) {
      workbook.items = workbook.items.map((item) =>
        item.id === STATE.editingItemId ? { ...item, ...itemData } : item
      );
    } else {
      workbook.items.push({
        id: crypto.randomUUID(),
        ...itemData
      });
    }
    console.log("DEBUG: Workbook atualizado com", workbook.items.length, "items");
    return workbook;
  }, {
    versionLabel: isEditing ? "Item atualizado" : "Item adicionado",
    auditAction: isEditing ? "Edição" : "Criação",
    auditDetails: isEditing ? `Item do produto '${itemData.productName}' atualizado` : `Novo item '${itemData.productName}' adicionado`
  });

  resetItemForm();
  renderAll({ skipForms: true, skipHistory: true });
  showNotification(isEditing ? "Item atualizado com sucesso!" : "Item adicionado com sucesso!", "success");
  return true;
}

function updateInlineItem(itemId, field, rawValue) {
  updateActiveWorkbook((workbook) => {
    workbook.items = workbook.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const nextItem = { ...item };
      if (field === "lotName" || field === "productName" || field === "manufacturer" || field === "supplier") {
        nextItem[field] = rawValue.trim();
      }
      if (field === "quantity") {
        nextItem.quantity = Math.max(1, Math.round(toNumber(rawValue)));
      }
      if (field === "unitPrice") {
        nextItem.unitPrice = Math.max(0, toNumber(rawValue));
      }
      if (field.endsWith("Override")) {
        nextItem[field] = normalizePercent(rawValue, true);
      }
      return nextItem;
    });
    return workbook;
  }, {
    versionLabel: "Edicao rapida na tabela",
    auditAction: "Edição Rápida",
    auditDetails: `Campo '${field}' atualizado via tabela`
  });
  renderAll();
}

function deleteItem(itemId) {
  if (!confirm("Tem certeza que deseja excluir este item?")) {
    return;
  }
  
  updateActiveWorkbook((workbook) => {
    workbook.items = workbook.items.filter((item) => item.id !== itemId);
    return workbook;
  }, {
    versionLabel: "Item excluido",
    auditAction: "Exclusão",
    auditDetails: "Item removido da tabela"
  });
  
  if (STATE.editingItemId === itemId) {
    resetItemForm();
  }
  
  renderAll({ skipForms: true, skipHistory: true });
  showNotification("Item excluído com sucesso", "success");
}

function duplicateItem(itemId) {
  updateActiveWorkbook((workbook) => {
    const source = workbook.items.find((item) => item.id === itemId);
    if (!source) {
      return workbook;
    }
    workbook.items.push({
      ...source,
      id: crypto.randomUUID(),
      productName: `${source.productName} copia`
    });
    return workbook;
  }, { versionLabel: "Item duplicado" });
  renderAll({ skipForms: true, skipHistory: true });
  showNotification("Item duplicado com sucesso!", "success");
}

function duplicateLot() {
  const selectedLot = lotSelector.value;
  if (!selectedLot) {
    showNotification("Escolha um lote para duplicar.", "warning");
    return;
  }

  updateActiveWorkbook((workbook) => {
    const sourceItems = workbook.items.filter((item) => getLotLabel(item) === selectedLot);
    if (!sourceItems.length) {
      return workbook;
    }

    const nextLotName = `${selectedLot} copia`;
    const copies = sourceItems.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      lotName: nextLotName
    }));
    workbook.items.push(...copies);
    return workbook;
  }, { versionLabel: `Lote duplicado (${selectedLot})` });

  renderAll({ skipForms: true, skipHistory: true });
  showNotification(`Lote "${selectedLot}" duplicado com sucesso!`, "success");
}

function clearFiltersAndVisualState() {
  STATE.searchTerm = "";
  STATE.compareWorkbookId = "";
  quickSearch.value = "";
  compareSheetSelector.value = "";
  lotSelector.value = "";
  setAlertFilter(false);
  document.body.classList.remove("print-preview");
  togglePrintModeButton.textContent = "Modo impressao";
  renderAll();
}

function loadItemIntoForm(itemId) {
  const workbook = getActiveWorkbook();
  const item = workbook.items.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }
  STATE.editingItemId = itemId;
  populateItemForm(item);
  cancelEditButton.classList.remove("hidden");
  saveItemButton.textContent = "Atualizar item";
  itemFields.productName.focus();
}

function createNewSheet() {
  const name = window.prompt("Nome da nova planilha:", "Nova planilha");
  if (name === null) {
    return;
  }
  const workbooks = ensureWorkbooks();
  const next = createDefaultWorkbook(name.trim() || "Nova planilha");
  console.log("DEBUG: Criando nova planilha vazia:", next);
  workbooks.push(next);
  saveWorkbooks(workbooks);
  setActiveWorkbookId(next.id);
  resetItemForm();
  renderAll();
  showNotification(`Planilha "${name}" criada com sucesso!`, "success");
}

function duplicateSheet() {
  const workbook = getActiveWorkbook();
  const workbooks = ensureWorkbooks();
  const next = {
    ...workbook,
    id: crypto.randomUUID(),
    name: `${workbook.header.sheetName || workbook.name} copia`,
    header: {
      ...workbook.header,
      sheetName: `${workbook.header.sheetName || workbook.name} copia`
    },
    items: workbook.items.map((item) => ({
      ...item,
      id: crypto.randomUUID()
    })),
    versions: [],
    manufacturers: [...(workbook.manufacturers || [])]
  };
  workbooks.push(next);
  saveWorkbooks(workbooks);
  setActiveWorkbookId(next.id);
  resetItemForm();
  renderAll();
}

function deleteCurrentSheet() {
  const workbook = getActiveWorkbook();
  if (!confirm(`Excluir a planilha "${workbook.header.sheetName || workbook.name}"? Esta ação não pode ser desfeita.`)) {
    return;
  }

  let workbooks = ensureWorkbooks().filter((entry) => entry.id !== workbook.id);
  if (!workbooks.length) {
    const fallback = createDefaultWorkbook("Planilha principal");
    workbooks = [fallback];
    setActiveWorkbookId(fallback.id);
  } else {
    setActiveWorkbookId(workbooks[0].id);
  }

  saveWorkbooks(workbooks);
  resetItemForm();
  clearFiltersAndVisualState();
  showNotification("Planilha excluída com sucesso", "success");
}

function restoreVersion(versionId) {
  updateActiveWorkbook((workbook) => {
    const version = workbook.versions.find((entry) => entry.id === versionId);
    if (!version) {
      return workbook;
    }
    workbook.header = { ...version.payload.header };
    workbook.settings = { ...version.payload.settings };
    workbook.items = version.payload.items.map((item) => ({ ...item }));
    workbook.manufacturers = [...(version.payload.manufacturers || [])];
    workbook.suppliers = [...(version.payload.suppliers || [])];
    return workbook;
  }, { versionLabel: "Versao restaurada" });
  resetItemForm();
  renderAll();
}

function parseDelimitedText(text) {
  const separator = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(separator).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((value) => value.trim());
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

function mapImportedRecord(record) {
  return {
    id: crypto.randomUUID(),
    lotName: record.lote || record["lote/grupo"] || record.grupo || "",
    productName: record.produto || record.item || "",
    manufacturer: record["marca/modelo"] || record.marca || record.fabricante || "",
    supplier: record.fornecedor || record["nome do fornecedor"] || record.supplier || "",
    quantity: Math.max(1, Math.round(toNumber(record.quantidade || record.qtd || 1))),
    unitPrice: Math.max(0, toNumber(record["custo compra"] || record.custo || record["valor unitario"] || record.unitario || 0)),
    taxPercentOverride: normalizePercent(record["imposto %"] || record.imposto || "", true),
    marginPercentOverride: normalizePercent(record["margem %"] || record.margem || "", true),
    transportPercentOverride: normalizePercent(record["transporte %"] || record.transporte || "", true),
    warrantyPercentOverride: normalizePercent(record["garantia %"] || record.garantia || "", true)
  };
}

/**
 * Importa itens genérico (sem duplicação CSV/XLSX)
 */
function importItems(records, sourceType) {
  const items = records.map(mapImportedRecord).filter((item) => item.productName);

  if (!items.length) {
    showNotification(`Nenhum item válido encontrado (${sourceType}).`, "warning");
    return;
  }

  updateActiveWorkbook((workbook) => {
    workbook.items.push(...items);
    return workbook;
  }, { versionLabel: `Importação ${sourceType} (${items.length} itens)` });

  renderAll({ skipForms: false, skipHistory: false });
  showNotification(`${items.length} item(ns) importado(s) com sucesso!`, "success");
}

function importItemsFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const records = parseDelimitedText(String(reader.result || ""));
    if (!records.length) {
      showNotification("CSV inválido ou vazio. Verifique se possui cabeçalho e dados.", "error");
      return;
    }
    // Para CSV vamos usar o mapeador legado por enquanto se quiser, ou mandar direto
    // Como foi pedido para XLSX vamos mandar pra ele também? Sim, o mapeador funciona com JSON genérico!
    handleImportedSpreadsheet(records);
  };
  reader.readAsText(file, "utf-8");
}

function importItemsFromXlsx(file) {
  if (!window.XLSX) {
    showNotification("Biblioteca XLSX não foi carregada. Tente novamente.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const workbookFile = window.XLSX.read(reader.result, { type: "array" });
      if (!workbookFile.SheetNames.length) {
        throw new Error("Arquivo não contém abas");
      }
      
      const firstSheet = workbookFile.Sheets[workbookFile.SheetNames[0]];
      // Sem mudar as chaves, mantendo os cabeçalhos literais para o usuário entender o modal
      const records = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      
      if (!records.length) {
        throw new Error("Aba principal está vazia");
      }
      
      handleImportedSpreadsheet(records);
    } catch (error) {
      showNotification(`Erro ao importar XLSX: ${error.message}`, "error");
      console.error(error);
    }
  };
  reader.readAsArrayBuffer(file);
}

function createBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    activeWorkbookId: getActiveWorkbookId(),
    workbooks: ensureWorkbooks()
  };
  downloadFile(`backup_precificacao_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      
      if (!payload.workbooks || !Array.isArray(payload.workbooks)) {
        throw new Error("Formato de backup inválido");
      }

      const workbooks = (payload.workbooks || []).map(ensureWorkbookShape);
      
      if (!workbooks.length) {
        throw new Error("Nenhuma planilha encontrada no backup");
      }
      
      // Validar integridade
      if (!workbooks.every(w => w.id && Array.isArray(w.items))) {
        throw new Error("Backup contém dados inconsistentes");
      }

      saveWorkbooks(workbooks);
      setActiveWorkbookId(
        payload.activeWorkbookId && workbooks.some((entry) => entry.id === payload.activeWorkbookId) 
          ? payload.activeWorkbookId 
          : workbooks[0].id
      );
      resetItemForm();
      renderAll();
      showNotification("Backup restaurado com sucesso!", "success");
    } catch (error) {
      showNotification(`Erro ao restaurar backup: ${error.message}`, "error");
      console.error(error);
    }
  };
  reader.readAsText(file, "utf-8");
}

function prepareExportTable() {
  const clone = document.getElementById("pricingTable").cloneNode(true);
  clone.querySelectorAll(".no-print").forEach((node) => node.remove());
  clone.querySelectorAll("input, textarea").forEach((field) => {
    const span = document.createElement("span");
    span.textContent = field.value || "-";
    field.replaceWith(span);
  });
  return clone.outerHTML;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportExcel() {
  const workbook = getActiveWorkbook();
  const title = workbook.header.sheetName || workbook.name || "planilha";
  const html = `
    <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <h2>${title}</h2>
        <p>Processo: ${workbook.header.processNumber || "-"}</p>
        <p>Orgao: ${workbook.header.agencyName || "-"}</p>
        <p>Data: ${workbook.header.bidDate || "-"}</p>
        <p>Validade: ${workbook.header.proposalValidity || "-"}</p>
        <p>Objeto: ${workbook.header.bidObject || "-"}</p>
        ${prepareExportTable()}
      </body>
    </html>
  `;
  downloadFile(`${title.replace(/\s+/g, "_")}.xls`, html, "application/vnd.ms-excel");
}

function exportPdf() {
  const wasPreviewEnabled = document.body.classList.contains("print-preview");
  if (!wasPreviewEnabled) {
    document.body.classList.add("print-preview");
    togglePrintModeButton.textContent = "Sair modo impressao";
  }

  const previousTitle = document.title;
  const workbook = getActiveWorkbook();
  document.title = `${workbook.header.sheetName || workbook.name || "Proposta"} - proposta`;

  const restorePreview = () => {
    document.title = previousTitle;
    if (!wasPreviewEnabled) {
      document.body.classList.remove("print-preview");
      togglePrintModeButton.textContent = "Modo impressao";
    }
    window.removeEventListener("afterprint", restorePreview);
  };

  window.addEventListener("afterprint", restorePreview);
  window.setTimeout(() => window.print(), 80);
}

function togglePrintMode() {
  document.body.classList.toggle("print-preview");
  togglePrintModeButton.textContent = document.body.classList.contains("print-preview")
    ? "Sair modo impressao"
    : "Modo impressao";
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveItem(getItemFormData());
});

itemForm.addEventListener("input", markAutosavePending);
bidForm.addEventListener("input", () => {
  markAutosavePending();
  debouncedAutosaveBidForm();
});
proposalForm.addEventListener("input", () => {
  markAutosavePending();
  debouncedAutosaveProposalForm();
});
settingsForm.addEventListener("input", () => {
  markAutosavePending();
  debouncedAutosaveSettingsForm();
});
bidForm.addEventListener("change", saveBidForm);
proposalForm.addEventListener("change", saveProposalForm);
settingsForm.addEventListener("change", saveSettingsForm);

sheetSelector.addEventListener("change", (event) => {
  setActiveWorkbookId(event.target.value);
  resetItemForm();
  renderAll();
});

// Debounce na busca rápida para não renderizar a cada keystroke
quickSearch.addEventListener("input", debounce((event) => {
  STATE.searchTerm = event.target.value;
  // Renderizar apenas a tabela, skip forms e history
  renderAll({ skipForms: true, skipHistory: true, skipComparison: true });
}, CONFIG.UI.SEARCH_DEBOUNCE_MS));

compareSheetSelector.addEventListener("change", (event) => {
  STATE.compareWorkbookId = event.target.value;
  renderAll({ skipTable: true, skipForms: true });
});

// Delegação de eventos para tabela
itemsTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const itemId = button.dataset.itemId;
  switch (button.dataset.action) {
    case "edit":
      loadItemIntoForm(itemId);
      break;
    case "duplicate":
      duplicateItem(itemId);
      break;
    case "delete":
      deleteItem(itemId);
      break;
  }
});

itemsTableBody.addEventListener("change", (event) => {
  const field = event.target.closest("[data-inline]");
  if (!field) {
    return;
  }
  const row = field.closest("tr");
  updateInlineItem(row.dataset.itemId, field.dataset.inline, field.value);
});

itemsTableBody.addEventListener("input", (event) => {
  if (event.target.closest("[data-inline]")) {
    markAutosavePending();
  }
});

versionHistory.addEventListener("click", (event) => {
  const button = event.target.closest("[data-restore-version]");
  if (!button) {
    return;
  }
  if (confirm("Restaurar esta versão? Mudanças atuais serão perdidas.")) {
    restoreVersion(button.dataset.restoreVersion);
    showNotification("Versão restaurada com sucesso!", "success");
  }
});

clearAllButton.addEventListener("click", deleteCurrentSheet);
cancelEditButton.addEventListener("click", resetItemForm);
newSheetButton.addEventListener("click", createNewSheet);
newSheetBottomButton?.addEventListener("click", createNewSheet);
duplicateSheetButton.addEventListener("click", duplicateSheet);

importItemsButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files?.[0];
  if (file) {
    importItemsFromFile(file);
    importFileInput.value = "";
  }
});

importXlsxButton.addEventListener("click", () => importXlsxInput.click());
importXlsxInput.addEventListener("change", () => {
  const file = importXlsxInput.files?.[0];
  if (file) {
    importItemsFromXlsx(file);
    importXlsxInput.value = "";
  }
});

exportExcelButton.addEventListener("click", exportExcel);
exportPdfButton.addEventListener("click", exportPdf);
backupButton.addEventListener("click", createBackup);

restoreButton.addEventListener("click", () => restoreFileInput.click());
restoreFileInput.addEventListener("change", () => {
  const file = restoreFileInput.files?.[0];
  if (file) {
    restoreBackup(file);
    restoreFileInput.value = "";
  }
});

toggleAlertFilterButton.addEventListener("click", () => {
  setAlertFilter(!getAlertFilter());
  renderAll({ skipForms: true, skipHistory: true, skipComparison: true });
  showNotification(getAlertFilter() ? "Mostrando apenas alertas" : "Mostrando todos os itens", "info");
});

clearFiltersButton.addEventListener("click", clearFiltersAndVisualState);
togglePrintModeButton.addEventListener("click", togglePrintMode);
duplicateLotButton.addEventListener("click", duplicateLot);

// Atalhos de teclado
document.addEventListener("keydown", (event) => {
  // Ctrl+S = Salvar item
  if (event.ctrlKey && event.key === "s") {
    event.preventDefault();
    if (STATE.editingItemId) {
      saveItem(getItemFormData());
    }
  }
  
  // Escape = Cancelar edição
  if (event.key === "Escape" && STATE.editingItemId) {
    event.preventDefault();
    resetItemForm();
  }
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

ensureWorkbooks();
resetItemForm();
applyUiModes();
renderAll();

// Avisar se houver mudanças não salvas ao sair
window.addEventListener("beforeunload", (e) => {
  if (autosaveStatus && autosaveStatus.classList.contains("pending")) {
    e.preventDefault();
    e.returnValue = "Existem alterações não salvas.";
  }
});

// DEBUG: Log para verificar inicialização
console.log("=== APLICAÇÃO INICIALIZADA ===");
console.log("Workbooks carregados:", loadWorkbooks());
console.log("Workbook ativo:", getActiveWorkbook());
console.log("localStorage habilitado:", typeof localStorage !== 'undefined');
