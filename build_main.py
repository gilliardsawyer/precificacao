import re

with open('e:/precificacao/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to remove:
# 1. CONFIG = { ... }
# 2. DOM = { ... }
# 3. STATE = { ... }
# 4. aliases (we'll re-inject them)
# 5. formatters/utils
# 6. createDefaultWorkbook ... ensureWorkbookShape
# 7. WORKBOOK E ARMAZENAMENTO (loadWorkbooks -> setAlertFilter)
# Wait, let's just find the exact line numbers to remove or keep.
# The user functions that we KEEP start around applyUiModes (though validateItemData is in pricing now)
# Let's just find the index of "function applyUiModes()" and "function getItemFormData()"
# And we must also remove the pricing functions: getEffectivePercents -> validateItemData

new_lines = []

imports = """import { CONFIG } from './core/config.js';
import { STATE, invalidateSummaryCache } from './core/state.js';
import { toNumber, normalizePercent, escapeHtml, debounce, formatCurrency, formatPercent } from './core/utils.js';
import { getEffectivePercents, calculateRow, getLotLabel, groupItemsByLot, calculateLotSubtotal, summarizeWorkbook, validateItemData } from './core/pricing.js';
import { DOM } from './ui/dom.js';
import { showNotification } from './ui/toasts.js';
import { createDefaultWorkbook, ensureWorkbookShape, loadWorkbooks, saveWorkbooks, debouncedSaveWorkbooks, getActiveWorkbookId, setActiveWorkbookId, ensureWorkbooks, getActiveWorkbook, buildSnapshot, updateManufacturersList, updateActiveWorkbook, getAlertFilter, setAlertFilter } from './storage/local.js';

// Aliases for backward compatibility
const itemForm = DOM.forms.item;
const bidForm = DOM.forms.bid;
const settingsForm = DOM.forms.settings;
const itemsTableBody = DOM.tables.itemsTableBody;
const rowTemplate = DOM.tables.rowTemplate;
const clearAllButton = DOM.buttons.clearAll;
const cancelEditButton = DOM.buttons.cancelEdit;
const saveItemButton = DOM.buttons.saveItem;
const newSheetButton = DOM.buttons.newSheet;
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
const autosaveStatus = DOM.status.autosaveStatus;
const quickSearch = DOM.inputs.quickSearch;
const compareSheetSelector = DOM.inputs.compareSheetSelector;
const compareSummary = DOM.sidebars.compareSummary;
const lotSelector = DOM.inputs.lotSelector;
const duplicateLotButton = DOM.buttons.duplicateLot;
const lotSummaryList = DOM.sidebars.lotSummaryList;

const itemFields = DOM.itemFields;
const bidFields = DOM.bidFields;
const settingsFields = DOM.settingsFields;
const totalsFields = DOM.totalsFields;
const printFields = DOM.printFields;

let editingItemId = STATE.editingItemId;
let searchTerm = STATE.searchTerm;
let compareWorkbookId = STATE.compareWorkbookId;

"""

skip = False
for line in lines:
    if line.startswith("const CONFIG = {"):
        skip = True
    if line.startswith("function applyUiModes()"):
        skip = False
        
    if line.startswith("function getEffectivePercents("):
        skip = True
    if line.startswith("function resetItemForm()"):
        skip = False
        
    if line.startswith("function getLotLabel("):
        skip = True
    if line.startswith("function updateActiveWorkbook("):
        skip = False
        
    # Wait, updateActiveWorkbook was extracted to local.js!
    # So we should skip that too.
    
    if skip: continue
    new_lines.append(line)

# Let's do a more robust string replacement instead of a flaky scanner.
content = "".join(lines)

# Remove CONFIG to applyUiModes
content = re.sub(r'const CONFIG.*?function applyUiModes', 'function applyUiModes', content, flags=re.DOTALL)

# Remove getEffectivePercents to resetItemForm
content = re.sub(r'function getEffectivePercents.*?function resetItemForm', 'function resetItemForm', content, flags=re.DOTALL)

# Remove getLotLabel to renderWorkbookSelector
content = re.sub(r'function getLotLabel.*?function renderWorkbookSelector', 'function renderWorkbookSelector', content, flags=re.DOTALL)

# Remove updateActiveWorkbook to getAlertFilter (which are already in local.js)
content = re.sub(r'function updateActiveWorkbook.*?function validateItemData', 'function validateItemData', content, flags=re.DOTALL)

# Wait, validateItemData is extracted!
content = re.sub(r'function validateItemData[^}]+}', '', content)

# Remove any remaining createDefaultWorkbook or ensureWorkbookShape
content = re.sub(r'function createDefaultWorkbook[^}]+}', '', content)
content = re.sub(r'function ensureWorkbookShape[^}]+}', '', content)

# Wait, this regex is too dangerous. Let's just create main.js manually by writing the code that glue things.
