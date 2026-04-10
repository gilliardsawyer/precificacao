import { DOM } from './dom.js';
import { calculateRow } from '../core/pricing.js';
import { toNumber, formatCurrency, formatPercent } from '../core/utils.js';

/**
 * Inicializa a Calculadora de Recuo Flutuante.
 * @param {Function} getWorkbookFn - Função que retorna a planilha ativa
 */
export function setupFloatingCalc(getWorkbookFn) {
  const { calc } = DOM;
  if (!calc || !calc.container) return null;

  // Abrir / Fechar
  calc.openBtn?.addEventListener('click', () => {
    calc.container.style.display = 'block';
    updateCalcBaseValues();
  });

  calc.closeBtn?.addEventListener('click', () => {
    calc.container.style.display = 'none';
  });

  // Atualizar em tempo real ao digitar o lance
  calc.lanceInput?.addEventListener('input', runCalculation);
  calc.modeSelect?.addEventListener('change', () => {
    syncModeUi();
    runCalculation();
  });

  function syncModeUi() {
    const mode = calc.modeSelect?.value || 'total';
    if (calc.inputLabel) {
      calc.inputLabel.innerText = mode === 'unit'
        ? 'Seu próximo lance unitário (R$)'
        : 'Seu próximo lance total (R$)';
    }
  }

  function getSelectedContext(workbook) {
    const selectedCheckboxes = document.querySelectorAll('.item-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map((checkbox) => {
      const row = checkbox.closest('tr');
      return row?.dataset?.itemId;
    }).filter(Boolean);

    const items = selectedIds.length
      ? workbook.items.filter((item) => selectedIds.includes(item.id))
      : workbook.items;

    const quantity = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    const labels = items.map((item) => item.productName).filter(Boolean);

    return {
      items,
      quantity,
      selectedCount: selectedIds.length,
      label: selectedIds.length === 0
        ? `Planilha inteira (${items.length} item(ns))`
        : selectedIds.length === 1
          ? labels[0] || '1 item selecionado'
          : `${selectedIds.length} itens selecionados`
    };
  }

  function updateCalcBaseValues() {
    if (calc.container.style.display === 'none') return;

    const workbook = getWorkbookFn();
    if (!workbook) return;

    const context = getSelectedContext(workbook);
    const itemsToSum = context.items;

    let minCostTotal = 0;
    itemsToSum.forEach(item => {
      try {
        const calcData = calculateRow(item, workbook.settings);
        minCostTotal += calcData.minimumTotal;
      } catch (_) { /* item inválido, ignorar */ }
    });

    if (calc.minCost) calc.minCost.innerText = formatCurrency(minCostTotal);
    if (calc.minUnitCost) {
      calc.minUnitCost.innerText = formatCurrency(context.quantity > 0 ? minCostTotal / context.quantity : 0);
    }
    if (calc.scopeLabel) {
      calc.scopeLabel.innerText = context.label;
    }
    if (calc.targetCount) {
      calc.targetCount.innerText = `${context.quantity} unidade(s)`;
    }
    calc.container.dataset.minCost = minCostTotal;
    calc.container.dataset.targetQuantity = String(context.quantity || 0);
    calc.container.dataset.scopeLabel = context.label;

    if (calc.modeSelect) {
      const forceTotal = context.quantity <= 0 || context.selectedCount > 1;
      calc.modeSelect.disabled = forceTotal;
      if (forceTotal) {
        calc.modeSelect.value = 'total';
      }
    }
    syncModeUi();

    runCalculation();
  }

  function runCalculation() {
    const minCostTotal = toNumber(calc.container?.dataset?.minCost || 0);
    const targetQuantity = Math.max(0, toNumber(calc.container?.dataset?.targetQuantity || 0));
    const lanceValue = toNumber(calc.lanceInput?.value || 0);
    const mode = calc.modeSelect?.value || 'total';

    if (lanceValue <= 0) {
      if (calc.bidTotal) calc.bidTotal.innerText = 'R$ 0,00';
      if (calc.bidUnit) calc.bidUnit.innerText = 'R$ 0,00';
      if (calc.profitValue) calc.profitValue.innerText = 'R$ 0,00';
      if (calc.marginPercent) calc.marginPercent.innerText = '0,00%';
      if (calc.status) {
        calc.status.className = 'calc-status';
        calc.status.innerText = 'Informe um lance para simular a disputa.';
      }
      return;
    }

    const simulatedTotal = mode === 'unit' ? lanceValue * targetQuantity : lanceValue;
    const simulatedUnit = targetQuantity > 0 ? simulatedTotal / targetQuantity : 0;
    const profit = simulatedTotal - minCostTotal;
    const marginPercent = simulatedTotal > 0 ? (profit / simulatedTotal) * 100 : 0;

    if (calc.bidTotal) calc.bidTotal.innerText = formatCurrency(simulatedTotal);
    if (calc.bidUnit) calc.bidUnit.innerText = formatCurrency(simulatedUnit);
    if (calc.profitValue) calc.profitValue.innerText = formatCurrency(profit);
    if (calc.marginPercent) calc.marginPercent.innerText = formatPercent(marginPercent);

    // Alertas visuais de status
    if (calc.status) {
      calc.status.className = 'calc-status';
      if (marginPercent < 5) {
        calc.status.classList.add('danger');
        calc.status.innerText = profit < 0
          ? '🔴 Prejuízo: lance abaixo do custo mínimo.'
          : '🔴 Perigo: margem crítica abaixo de 5%.';
      } else if (marginPercent < 15) {
        calc.status.classList.add('warning');
        calc.status.innerText = '🟡 Atenção: margem apertada abaixo de 15%.';
      } else {
        calc.status.classList.add('success');
        calc.status.innerText = '🟢 Lance viável com margem saudável.';
      }
    }
  }

  syncModeUi();

  // Hook público para atualização automática após renderAll()
  return { refresh: updateCalcBaseValues };
}
