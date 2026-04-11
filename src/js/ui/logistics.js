import { toNumber, formatCurrency } from '../core/utils.js';


/**
 * Calcula o peso cobrado de um item usando a lógica de cuagem:
 * Peso Cúbico = (C × L × A) / FatorCubagem
 * Peso Cobrado = Math.max(PesoReal, PesoCúbico)
 */
function calcVolumetricWeight(item, cubageFactor) {
  const real = toNumber(item.weightKg || 0);
  const c = toNumber(item.dimLength || 0);
  const l = toNumber(item.dimWidth || 0);
  const a = toNumber(item.dimHeight || 0);
  const cubic = (c * l * a) / cubageFactor;
  const charged = Math.max(real, cubic);
  return { real, cubic, charged };
}

function calcCubicMeters(item) {
  const c = toNumber(item.dimLength || 0);
  const l = toNumber(item.dimWidth || 0);
  const a = toNumber(item.dimHeight || 0);
  if (c <= 0 || l <= 0 || a <= 0) return 0;
  return (c * l * a) / 1000000;
}

function suggestTransportMode({ totalChargedWeight, totalVolumeM3, totalVolumes }) {
  if (totalChargedWeight <= 0 && totalVolumeM3 <= 0 && totalVolumes <= 0) {
    return {
      label: 'A definir',
      hint: 'Preencha peso e medidas para obter a recomendacao'
    };
  }

  if (totalChargedWeight <= 30 && totalVolumeM3 <= 0.2 && totalVolumes <= 10) {
    return {
      label: 'Correios / Envio leve',
      hint: 'Melhor para cargas pequenas, leves e de baixo volume'
    };
  }

  if (totalChargedWeight <= 300 && totalVolumeM3 <= 2) {
    return {
      label: 'Transportadora fracionada',
      hint: 'Boa opcao para carga media com entrega pulverizada'
    };
  }

  return {
    label: 'Carga dedicada / palletizada',
    hint: 'Indicado para peso ou volume elevado'
  };
}

function updateLogisticsSummary(summary) {
  const chargedWeightEl = document.getElementById('logisticsKpiChargedWeight');
  const volumeEl = document.getElementById('logisticsKpiVolume');
  const cubageEl = document.getElementById('logisticsKpiCubage');
  const volumesCountEl = document.getElementById('logisticsKpiVolumesCount');
  const estimatedFreightEl = document.getElementById('logisticsKpiEstimatedFreight');
  const modalEl = document.getElementById('logisticsKpiSuggestedModal');
  const modalHintEl = document.getElementById('logisticsKpiSuggestedModalHint');

  const suggestion = suggestTransportMode(summary);

  if (chargedWeightEl) chargedWeightEl.textContent = `${summary.totalChargedWeight.toFixed(2)} kg`;
  if (volumeEl) volumeEl.textContent = `${summary.totalVolumeM3.toFixed(3)} m3`;
  if (cubageEl) cubageEl.textContent = `${summary.totalCubageWeight.toFixed(2)} kg`;
  if (volumesCountEl) volumesCountEl.textContent = String(summary.totalVolumes);
  if (estimatedFreightEl) estimatedFreightEl.textContent = formatCurrency(summary.totalFinalCost);
  if (modalEl) modalEl.textContent = suggestion.label;
  if (modalHintEl) modalHintEl.textContent = suggestion.hint;
}

export function setupLogistics(getWorkbookFn) {
  const calcBtn = document.getElementById('calcFreightBtn');
  if (!calcBtn) return;

  calcBtn.addEventListener('click', () => renderLogisticsTable(getWorkbookFn));

  // Renderizar quando a aba for clicada
  document.querySelector('[data-nav="logistics"]')?.addEventListener('click', () => {
    setTimeout(() => renderLogisticsTable(getWorkbookFn), 50);
  });
}

export function renderLogisticsTable(getWorkbookFn) {
  const tbody = document.getElementById('logisticsTableBody');
  if (!tbody) return;

  const workbook = getWorkbookFn();
  const emptySummary = {
    totalChargedWeight: 0,
    totalVolumeM3: 0,
    totalCubageWeight: 0,
    totalVolumes: 0,
    totalFinalCost: 0
  };

  if (!workbook || !workbook.items.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">Adicione itens na aba Precificação para calcular o frete.</td></tr>';
    updateLogisticsSummary(emptySummary);
    return;
  }

  const freightPerKg = toNumber(document.getElementById('freightPerKg')?.value || 0);
  const redespachoPercent = toNumber(document.getElementById('redespachoPercent')?.value || 0);
  const cubageFactor = Math.max(1, toNumber(document.getElementById('cubageFactor')?.value || 6000));

  let totalChargedWeight = 0;
  let totalBaseFreight = 0;
  let totalCubageWeight = 0;
  let totalVolumeM3 = 0;
  let totalVolumes = 0;

  tbody.innerHTML = workbook.items.map(item => {
    const qty = Math.max(1, toNumber(item.quantity));
    const { real, cubic, charged } = calcVolumetricWeight(item, cubageFactor);
    const itemVolumeM3 = calcCubicMeters(item);
    const chargedTotal = charged * qty;
    const cubicTotal = cubic * qty;
    const volumeTotal = itemVolumeM3 * qty;
    const itemFreight = chargedTotal * freightPerKg;

    totalChargedWeight += chargedTotal;
    totalBaseFreight += itemFreight;
    totalCubageWeight += cubicTotal;
    totalVolumeM3 += volumeTotal;
    totalVolumes += qty;

    const weightClass = cubic > real ? 'style="color:var(--warning);font-weight:600"' : '';

    return `<tr>
      <td style="padding:8px 12px">${item.productName || '—'}</td>
      <td style="padding:8px 12px;text-align:center">${qty}</td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="weightKg"
          value="${real || ''}" placeholder="0" step="0.1" min="0"
          style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="dimLength"
          value="${toNumber(item.dimLength) || ''}" placeholder="0" step="1" min="0"
          style="width:70px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="dimWidth"
          value="${toNumber(item.dimWidth) || ''}" placeholder="0" step="1" min="0"
          style="width:70px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="dimHeight"
          value="${toNumber(item.dimHeight) || ''}" placeholder="0" step="1" min="0"
          style="width:70px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px" ${weightClass}>${cubic > 0 ? cubic.toFixed(2) + ' kg' : '—'}</td>
      <td style="padding:8px 12px;font-weight:600" ${weightClass}>${charged > 0 ? charged.toFixed(2) + ' kg' : '—'}</td>
      <td style="padding:8px 12px;color:var(--primary);font-weight:600">${formatCurrency(itemFreight)}</td>
    </tr>`;
  }).join('');

  // Ativar edição inline e recalcular ao mudar campos
  tbody.querySelectorAll('.logistics-input').forEach(input => {
    input.addEventListener('change', (e) => {
      saveLogisticsDimension(e.target, getWorkbookFn);
      renderLogisticsTable(getWorkbookFn);
    });
  });

  // Totais
  const redespacho = totalBaseFreight * (redespachoPercent / 100);
  const totalFinal = totalBaseFreight + redespacho;

  const elTotalWeight = document.getElementById('logisticsTotalWeight');
  const elTotalFreight = document.getElementById('logisticsTotalFreight');
  const elBaseFreight = document.getElementById('logisticsBaseFreight');
  const elRedespacho = document.getElementById('logisticsRedespacho');
  const elTotalCost = document.getElementById('logisticsTotalCost');

  if (elTotalWeight) elTotalWeight.textContent = totalChargedWeight.toFixed(2) + ' kg';
  if (elTotalFreight) elTotalFreight.textContent = formatCurrency(totalFinal);
  if (elBaseFreight) elBaseFreight.textContent = formatCurrency(totalBaseFreight);
  if (elRedespacho) elRedespacho.textContent = formatCurrency(redespacho);
  if (elTotalCost) elTotalCost.textContent = formatCurrency(totalFinal);

  updateLogisticsSummary({
    totalChargedWeight,
    totalVolumeM3,
    totalCubageWeight,
    totalVolumes,
    totalFinalCost: totalFinal
  });
}

function saveLogisticsDimension(input, getWorkbookFn) {
  const itemId = input.dataset.itemId;
  const field = input.dataset.field;
  const value = toNumber(input.value);

  const workbook = getWorkbookFn();
  if (!workbook) return;

  const item = workbook.items.find(i => i.id === itemId);
  if (item) {
    item[field] = value;
    // Persistir: ler todos os workbooks do localStorage e salvar com o item atualizado
    try {
      const STORAGE_KEY = 'precificacao-workbooks';
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const idx = all.findIndex(w => w.id === workbook.id);
      if (idx !== -1) {
        const itemIdx = all[idx].items.findIndex(i => i.id === itemId);
        if (itemIdx !== -1) all[idx].items[itemIdx][field] = value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    } catch (_) { /* silenciar erros de quota */ }
  }
}
