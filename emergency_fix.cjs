const fs = require('fs');

let code = fs.readFileSync('e:/precificacao/src/js/main.js', 'utf-8');

const anchorStart = 'function togglePrintMode() {';
const anchorEnd = 'compareSheetSelector.addEventListener("change"';

const idxStart = code.indexOf(anchorStart);
const idxEnd = code.indexOf(anchorEnd);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Anchors not found.", idxStart, idxEnd);
    process.exit(1);
}

// Find the first line after togglePrintMode block
// togglePrintMode ends at line 1131 (approx)
// We want to replace everything from after the end of the function up to compareSheetSelector

const functionEnd = code.indexOf('}', idxStart) + 1;

const blockToInject = `

// ============================================================================
// EVENT LISTENERS
// ============================================================================

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveItem(getItemFormData());
});

itemForm.addEventListener("input", markAutosavePending);
bidForm.addEventListener("input", markAutosavePending);
settingsForm.addEventListener("input", markAutosavePending);
bidForm.addEventListener("change", saveBidForm);
settingsForm.addEventListener("submit", saveSettingsForm);

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

`;

const newCode = code.slice(0, functionEnd) + blockToInject + code.slice(idxEnd);

fs.writeFileSync('e:/precificacao/src/js/main.js', newCode, 'utf-8');
console.log("Restoration successful.");
