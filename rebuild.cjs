const fs = require('fs');

let code = fs.readFileSync('e:/precificacao/src/js/main.js', 'utf-8');

const anchorStart = 'function getFilteredItems';
const anchorEnd = 'function renderAll(options = {}) {';

const idxStart = code.indexOf(anchorStart);
const idxEnd = code.indexOf(anchorEnd);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Anchors not found. Start:", idxStart, "End:", idxEnd);
    process.exit(1);
}

const robustReplacement = `function getFilteredItems(workbook, term) {
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
      const haystack = \`\${item.productName || ""} \${item.manufacturer || ""}\`.toLowerCase();
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
    itemsTableBody.innerHTML = '<tr><td colspan="22">Nenhum item encontrado para o filtro atual.</td></tr>';
  }

  groups.forEach((group) => {
    if (group.items.length) {
      itemsTableBody.appendChild(renderLotHeader(group.label, 22));
    }

    const lotSubtotal = calculateLotSubtotal(group.items, settings);

    group.items.forEach((item) => {
      const calc = calculateRow(item, settings);
      const fragment = rowTemplate.content.cloneNode(true);
      const row = fragment.querySelector("tr");

      row.dataset.itemId = item.id;

      const inputs = {
        lotName: row.querySelector('[data-inline="lotName"]'),
        productName: row.querySelector('[data-inline="productName"]'),
        manufacturer: row.querySelector('[data-inline="manufacturer"]'),
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
  const averageProfitPercent = summary.totalFinal > 0 ? (summary.totalProfit / summary.totalFinal) * 100 : 0;
  const averageMaximumDiscount = workbook.items.length > 0 ? summary.totalDiscountPercent / workbook.items.length : 0;

  totalsFields.totalQuantity.textContent = String(summary.totalQuantity);
  totalsFields.totalBaseValue.textContent = formatCurrency(summary.totalBaseValue);
  totalsFields.globalMarkupFoot.textContent = globalMarkup.toFixed(6).replace(".", ",");
  totalsFields.totalMinimumUnit.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.totalMinimumTotal / summary.totalQuantity : 0);
  totalsFields.totalUnitFinal.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.totalFinal / summary.totalQuantity : 0);
  totalsFields.totalDiscountPercent.textContent = formatPercent(averageMaximumDiscount);
  totalsFields.grandTotal.textContent = formatCurrency(summary.totalFinal);
  totalsFields.totalTaxValue.textContent = formatCurrency(summary.totalTax);
  totalsFields.totalTransportValue.textContent = formatCurrency(summary.totalTransport);
  totalsFields.totalWarrantyValue.textContent = formatCurrency(summary.totalWarranty);
  totalsFields.totalProfitValue.textContent = formatCurrency(summary.totalProfit);
  totalsFields.totalProfitPercent.textContent = formatPercent(averageProfitPercent);
  totalsFields.sumPercent.textContent = formatPercent(globalPercent);
  totalsFields.globalMarkup.textContent = globalMarkup.toFixed(6).replace(".", ",");
  totalsFields.baseTotalResume.textContent = formatCurrency(summary.totalBaseValue);
  totalsFields.minimumUnitResume.textContent = formatCurrency(summary.totalQuantity > 0 ? summary.totalMinimumTotal / summary.totalQuantity : 0);
  totalsFields.finalTotalResume.textContent = formatCurrency(summary.totalFinal);
  totalsFields.discountPercentResume.textContent = formatPercent(averageMaximumDiscount);
  totalsFields.profitValueResume.textContent = formatCurrency(summary.totalProfit);
  totalsFields.profitPercentResume.textContent = formatPercent(averageProfitPercent);
  totalsFields.lowMarginCount.textContent = String(summary.lowMarginCount);
  totalsFields.lotCount.textContent = String(summary.lotCount);
  renderLotSummary(summary.lotSummaries);
}

/**
 * Renderiza todos os componentes ou seletivamente (com flags)
 * @param {Object} options - Opções { skipTable, skipForms, skipHistory, skipComparison }
 */
`;

const newCode = code.slice(0, idxStart) + robustReplacement + code.slice(idxEnd);

fs.writeFileSync('e:/precificacao/src/js/main.js', newCode, 'utf-8');
console.log("Rewrite successful.");
