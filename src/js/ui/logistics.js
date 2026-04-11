import { toNumber, formatCurrency, formatPercent, escapeHtml } from '../core/utils.js';
import { updateActiveWorkbook } from '../storage/local.js';
import { showNotification } from './toasts.js';

const LOGISTICS_DEFAULTS = {
  freightPerKg: 0,
  redespachoPercent: 0,
  cubageFactor: 6000,
  scenario: 'unitario',
  destinationCity: '',
  destinationState: '',
  destinationZip: '',
  desiredDeadlineDays: 0,
  urgency: 'normal',
  history: []
};

function getLogisticsConfig(workbook) {
  return { ...LOGISTICS_DEFAULTS, ...(workbook?.logistics || {}) };
}

function getConfigElements() {
  return {
    freightPerKg: document.getElementById('freightPerKg'),
    redespachoPercent: document.getElementById('redespachoPercent'),
    cubageFactor: document.getElementById('cubageFactor'),
    scenario: document.getElementById('logisticsScenario'),
    destinationCity: document.getElementById('destinationCity'),
    destinationState: document.getElementById('destinationState'),
    destinationZip: document.getElementById('destinationZip'),
    desiredDeadlineDays: document.getElementById('desiredDeadlineDays'),
    urgency: document.getElementById('logisticsUrgency')
  };
}

function syncConfigForm(config) {
  const fields = getConfigElements();
  if (fields.freightPerKg) fields.freightPerKg.value = config.freightPerKg || '';
  if (fields.redespachoPercent) fields.redespachoPercent.value = config.redespachoPercent || '';
  if (fields.cubageFactor) fields.cubageFactor.value = config.cubageFactor || 6000;
  if (fields.scenario) fields.scenario.value = config.scenario || 'unitario';
  if (fields.destinationCity) fields.destinationCity.value = config.destinationCity || '';
  if (fields.destinationState) fields.destinationState.value = config.destinationState || '';
  if (fields.destinationZip) fields.destinationZip.value = config.destinationZip || '';
  if (fields.desiredDeadlineDays) fields.desiredDeadlineDays.value = config.desiredDeadlineDays || '';
  if (fields.urgency) fields.urgency.value = config.urgency || 'normal';
}

function readConfigFromForm() {
  const fields = getConfigElements();
  return {
    freightPerKg: Math.max(0, toNumber(fields.freightPerKg?.value || 0)),
    redespachoPercent: Math.max(0, toNumber(fields.redespachoPercent?.value || 0)),
    cubageFactor: Math.max(1, toNumber(fields.cubageFactor?.value || 6000)),
    scenario: fields.scenario?.value || 'unitario',
    destinationCity: (fields.destinationCity?.value || '').trim(),
    destinationState: (fields.destinationState?.value || '').trim().toUpperCase(),
    destinationZip: (fields.destinationZip?.value || '').trim(),
    desiredDeadlineDays: Math.max(0, Math.round(toNumber(fields.desiredDeadlineDays?.value || 0))),
    urgency: fields.urgency?.value || 'normal'
  };
}

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

function getPackageCount(qty, unitsPerPackage, scenario) {
  if (scenario === 'unitario') return qty;
  const divisor = Math.max(1, Math.round(toNumber(unitsPerPackage || 1)));
  return Math.max(1, Math.ceil(qty / divisor));
}

function getScenarioLabel(scenario) {
  if (scenario === 'master') return 'Caixa master';
  if (scenario === 'pallet') return 'Palletizado';
  return 'Caixa individual';
}

function suggestTransportMode({ totalChargedWeight, totalVolumeM3, totalVolumes, urgency, desiredDeadlineDays }) {
  if (totalChargedWeight <= 0 && totalVolumeM3 <= 0 && totalVolumes <= 0) {
    return {
      label: 'A definir',
      hint: 'Preencha peso e medidas para obter a recomendacao',
      capacityM3: 0.2
    };
  }

  if (urgency === 'critica' || (desiredDeadlineDays > 0 && desiredDeadlineDays <= 2)) {
    return {
      label: 'Aereo / Expresso',
      hint: 'Prazo muito curto pede um modal mais rapido',
      capacityM3: 0.6
    };
  }

  if (totalChargedWeight <= 30 && totalVolumeM3 <= 0.2 && totalVolumes <= 10) {
    return {
      label: 'Correios / Envio leve',
      hint: 'Melhor para cargas pequenas, leves e de baixo volume',
      capacityM3: 0.2
    };
  }

  if (totalChargedWeight <= 300 && totalVolumeM3 <= 2) {
    return {
      label: 'Transportadora fracionada',
      hint: 'Boa opcao para carga media com entrega pulverizada',
      capacityM3: 2
    };
  }

  return {
    label: 'Carga dedicada / palletizada',
    hint: 'Indicado para peso ou volume elevado',
    capacityM3: 10
  };
}

function buildAnalysis(workbook, config) {
  const items = workbook?.items || [];
  const rows = [];
  let totalChargedWeight = 0;
  let totalBaseFreight = 0;
  let totalCubageWeight = 0;
  let totalVolumeM3 = 0;
  let totalVolumes = 0;

  items.forEach((item) => {
    const qty = Math.max(1, toNumber(item.quantity));
    const unitsPerPackage = Math.max(1, Math.round(toNumber(item.unitsPerPackage || 1)));
    const packageCount = getPackageCount(qty, unitsPerPackage, config.scenario);
    const { real, cubic, charged } = calcVolumetricWeight(item, config.cubageFactor);
    const unitVolumeM3 = calcCubicMeters(item);
    const chargedTotal = charged * packageCount;
    const cubicTotal = cubic * packageCount;
    const volumeTotal = unitVolumeM3 * packageCount;
    const freightPerVolume = charged * config.freightPerKg;
    const itemFreight = chargedTotal * config.freightPerKg;
    const baseTotal = Math.max(0, toNumber(item.quantity) * toNumber(item.unitPrice));
    const freightPercent = baseTotal > 0 ? (itemFreight / baseTotal) * 100 : 0;

    totalChargedWeight += chargedTotal;
    totalBaseFreight += itemFreight;
    totalCubageWeight += cubicTotal;
    totalVolumeM3 += volumeTotal;
    totalVolumes += packageCount;

    rows.push({
      ...item,
      qty,
      unitsPerPackage,
      packageCount,
      real,
      cubic,
      charged,
      unitVolumeM3,
      chargedTotal,
      cubicTotal,
      volumeTotal,
      freightPerVolume,
      itemFreight,
      freightPercent,
      baseTotal
    });
  });

  const redespacho = totalBaseFreight * (config.redespachoPercent / 100);
  const totalFinalCost = totalBaseFreight + redespacho;
  const modal = suggestTransportMode({
    totalChargedWeight,
    totalVolumeM3,
    totalVolumes,
    urgency: config.urgency,
    desiredDeadlineDays: config.desiredDeadlineDays
  });

  const occupancyPercent = modal.capacityM3 > 0
    ? Math.min(100, (totalVolumeM3 / modal.capacityM3) * 100)
    : 0;

  const alerts = [];
  if (rows.length && rows.some((row) => !row.weightKg || !row.dimLength || !row.dimWidth || !row.dimHeight)) {
    alerts.push({ type: 'warning', text: 'Existem itens sem peso ou dimensoes completas para cubagem.' });
  }
  if (rows.length && rows.some((row) => row.packageCount < 3)) {
    alerts.push({ type: 'info', text: 'Alguns itens possuem poucos volumes. Revise a embalagem para melhor consolidacao.' });
  }
  if (rows.some((row) => row.cubic > row.real)) {
    alerts.push({ type: 'warning', text: 'Ha itens em que o peso cubico supera o peso real, elevando o frete cobrado.' });
  }
  if (rows.some((row) => row.freightPercent > 15)) {
    alerts.push({ type: 'danger', text: 'Ha itens com impacto logistico acima de 15% do valor base do item.' });
  }
  if ((config.urgency === 'critica' || config.desiredDeadlineDays <= 2) && !config.destinationCity) {
    alerts.push({ type: 'warning', text: 'Prazo urgente informado sem destino completo. A simulacao pode ficar subestimada.' });
  }
  if (!alerts.length) {
    alerts.push({ type: 'ok', text: 'Sem alertas relevantes. Estrutura logistica coerente para os dados preenchidos.' });
  }

  return {
    rows,
    totalChargedWeight,
    totalBaseFreight,
    totalCubageWeight,
    totalVolumeM3,
    totalVolumes,
    redespacho,
    totalFinalCost,
    modal,
    occupancyPercent,
    alerts
  };
}

function updateLogisticsSummary(analysis) {
  const chargedWeightEl = document.getElementById('logisticsKpiChargedWeight');
  const volumeEl = document.getElementById('logisticsKpiVolume');
  const cubageEl = document.getElementById('logisticsKpiCubage');
  const volumesCountEl = document.getElementById('logisticsKpiVolumesCount');
  const estimatedFreightEl = document.getElementById('logisticsKpiEstimatedFreight');
  const modalEl = document.getElementById('logisticsKpiSuggestedModal');
  const modalHintEl = document.getElementById('logisticsKpiSuggestedModalHint');
  const occupancyFillEl = document.getElementById('logisticsOccupancyFill');
  const occupancyPercentEl = document.getElementById('logisticsOccupancyPercent');
  const occupancyCapacityEl = document.getElementById('logisticsOccupancyCapacity');
  const occupancyHintEl = document.getElementById('logisticsOccupancyHint');

  if (chargedWeightEl) chargedWeightEl.textContent = `${analysis.totalChargedWeight.toFixed(2)} kg`;
  if (volumeEl) volumeEl.textContent = `${analysis.totalVolumeM3.toFixed(3)} m3`;
  if (cubageEl) cubageEl.textContent = `${analysis.totalCubageWeight.toFixed(2)} kg`;
  if (volumesCountEl) volumesCountEl.textContent = String(analysis.totalVolumes);
  if (estimatedFreightEl) estimatedFreightEl.textContent = formatCurrency(analysis.totalFinalCost);
  if (modalEl) modalEl.textContent = analysis.modal.label;
  if (modalHintEl) modalHintEl.textContent = analysis.modal.hint;
  if (occupancyFillEl) occupancyFillEl.style.width = `${analysis.occupancyPercent.toFixed(1)}%`;
  if (occupancyPercentEl) occupancyPercentEl.textContent = formatPercent(analysis.occupancyPercent);
  if (occupancyCapacityEl) occupancyCapacityEl.textContent = `Capacidade: ${analysis.modal.capacityM3.toFixed(2)} m3`;
  if (occupancyHintEl) occupancyHintEl.textContent = `${analysis.totalVolumeM3.toFixed(3)} m3 ocupados no cenário atual`;
}

function renderAlerts(alerts) {
  const list = document.getElementById('logisticsAlertsList');
  if (!list) return;

  list.innerHTML = alerts.map((alert) => {
    const borderColor = alert.type === 'danger'
      ? 'var(--danger)'
      : alert.type === 'warning'
        ? 'var(--warning)'
        : alert.type === 'ok'
          ? 'var(--green)'
          : 'var(--primary)';
    return `
      <article class="dashboard-item" style="border-left: 4px solid ${borderColor};">
        <div>
          <strong>${escapeHtml(alert.text)}</strong>
        </div>
      </article>
    `;
  }).join('');
}

function renderHistory(history = []) {
  const tbody = document.getElementById('logisticsHistoryBody');
  if (!tbody) return;
  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Sem histórico logístico para esta planilha.</td></tr>';
    return;
  }

  tbody.innerHTML = history.slice(0, 12).map((entry) => `
    <tr>
      <td>${new Date(entry.createdAt).toLocaleString('pt-BR')}</td>
      <td>${escapeHtml(entry.action || 'Atualizacao')}</td>
      <td>${escapeHtml(entry.scenarioLabel || '—')}</td>
      <td>${escapeHtml(entry.destination || '—')}</td>
      <td>${formatCurrency(entry.totalFreight || 0)}</td>
      <td>${escapeHtml(entry.modal || '—')}</td>
    </tr>
  `).join('');
}

function pushHistory(action, workbook, analysis, config) {
  updateActiveWorkbook((currentWorkbook) => {
    const currentConfig = getLogisticsConfig(currentWorkbook);
    const destination = [config.destinationCity, config.destinationState].filter(Boolean).join(' / ') || config.destinationZip || '—';
    currentWorkbook.logistics = {
      ...currentConfig,
      ...config,
      history: [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          action,
          scenario: config.scenario,
          scenarioLabel: getScenarioLabel(config.scenario),
          destination,
          totalFreight: analysis.totalFinalCost,
          modal: analysis.modal.label
        },
        ...(currentConfig.history || [])
      ].slice(0, 20)
    };
    return currentWorkbook;
  }, {
    auditAction: 'Logistica',
    auditDetails: `${action} registrado na analise logistica`
  });
}

function saveLogisticsConfig(config, withAudit = false) {
  updateActiveWorkbook((workbook) => {
    workbook.logistics = {
      ...getLogisticsConfig(workbook),
      ...config
    };
    return workbook;
  }, withAudit ? {
    auditAction: 'Logistica',
    auditDetails: 'Parametros logisticos atualizados'
  } : {});
}

function saveLogisticsField(itemId, field, rawValue) {
  updateActiveWorkbook((workbook) => {
    const item = workbook.items.find((entry) => entry.id === itemId);
    if (!item) return workbook;
    if (field === 'packagingType') {
      item[field] = (rawValue || '').trim();
    } else if (field === 'unitsPerPackage') {
      item[field] = Math.max(1, Math.round(toNumber(rawValue || 1)));
    } else {
      item[field] = Math.max(0, toNumber(rawValue || 0));
    }
    return workbook;
  });
}

function bindRowInputs(getWorkbookFn) {
  document.querySelectorAll('.logistics-input').forEach((input) => {
    input.addEventListener('change', (event) => {
      saveLogisticsField(event.target.dataset.itemId, event.target.dataset.field, event.target.value);
      renderLogisticsTable(getWorkbookFn);
    });
  });
}

function applyGlobalTransportPercent(getWorkbookFn, analysis) {
  const workbook = getWorkbookFn();
  if (!workbook?.items?.length) return;
  const baseTotal = workbook.items.reduce((sum, item) => sum + (Math.max(0, toNumber(item.quantity)) * Math.max(0, toNumber(item.unitPrice))), 0);
  if (baseTotal <= 0 || analysis.totalFinalCost <= 0) {
    showNotification('Nao ha base suficiente para aplicar transporte global.', 'warning');
    return;
  }

  const percent = (analysis.totalFinalCost / baseTotal) * 100;
  updateActiveWorkbook((currentWorkbook) => {
    currentWorkbook.settings.transportPercent = percent;
    return currentWorkbook;
  }, {
    auditAction: 'Logistica',
    auditDetails: `Transporte global ajustado para ${percent.toFixed(2)}% a partir do calculo logistico`
  });

  const config = readConfigFromForm();
  pushHistory('Aplicacao no transporte global', workbook, analysis, config);
  showNotification(`Transporte global atualizado para ${percent.toFixed(2)}%.`, 'success');
}

function applyItemTransportPercent(getWorkbookFn, analysis) {
  const workbook = getWorkbookFn();
  if (!workbook?.items?.length) return;
  updateActiveWorkbook((currentWorkbook) => {
    analysis.rows.forEach((row) => {
      const item = currentWorkbook.items.find((entry) => entry.id === row.id);
      if (!item) return;
      item.transportPercentOverride = row.freightPercent > 0 ? row.freightPercent : null;
    });
    return currentWorkbook;
  }, {
    auditAction: 'Logistica',
    auditDetails: 'Rateio logistico aplicado por item na planilha'
  });

  const config = readConfigFromForm();
  pushHistory('Rateio do transporte por item', workbook, analysis, config);
  showNotification('Rateio de transporte aplicado por item com sucesso.', 'success');
}

export function setupLogistics(getWorkbookFn) {
  const calcBtn = document.getElementById('calcFreightBtn');
  if (!calcBtn) return;

  const configFields = Object.values(getConfigElements()).filter(Boolean);
  configFields.forEach((field) => {
    field.addEventListener('change', () => {
      saveLogisticsConfig(readConfigFromForm());
      renderLogisticsTable(getWorkbookFn);
    });
  });

  calcBtn.addEventListener('click', () => {
    const workbook = getWorkbookFn();
    const config = readConfigFromForm();
    saveLogisticsConfig(config, true);
    const analysis = renderLogisticsTable(getWorkbookFn);
    if (workbook && analysis) {
      pushHistory('Recalculo logistico', workbook, analysis, config);
      showNotification('Analise logistica recalculada.', 'success');
    }
  });

  document.getElementById('applyGlobalFreightBtn')?.addEventListener('click', () => {
    const analysis = renderLogisticsTable(getWorkbookFn);
    if (analysis) applyGlobalTransportPercent(getWorkbookFn, analysis);
  });

  document.getElementById('applyItemFreightBtn')?.addEventListener('click', () => {
    const analysis = renderLogisticsTable(getWorkbookFn);
    if (analysis) applyItemTransportPercent(getWorkbookFn, analysis);
  });

  document.querySelector('[data-nav="logistics"]')?.addEventListener('click', () => {
    setTimeout(() => renderLogisticsTable(getWorkbookFn), 50);
  });
}

export function renderLogisticsTable(getWorkbookFn) {
  const tbody = document.getElementById('logisticsTableBody');
  if (!tbody) return null;

  const workbook = getWorkbookFn();
  const config = getLogisticsConfig(workbook);
  syncConfigForm(config);

  if (!workbook || !workbook.items.length) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;padding:2rem;color:var(--text-muted)">Adicione itens na aba Precificação para calcular o frete.</td></tr>';
    updateLogisticsSummary({
      totalChargedWeight: 0,
      totalVolumeM3: 0,
      totalCubageWeight: 0,
      totalVolumes: 0,
      totalFinalCost: 0,
      modal: suggestTransportMode({ totalChargedWeight: 0, totalVolumeM3: 0, totalVolumes: 0, urgency: 'normal', desiredDeadlineDays: 0 }),
      occupancyPercent: 0
    });
    renderAlerts([{ type: 'info', text: 'Cadastre itens na precificacao para iniciar a analise logistica.' }]);
    renderHistory(config.history || []);
    return null;
  }

  const analysis = buildAnalysis(workbook, config);

  tbody.innerHTML = analysis.rows.map((item) => {
    const weightClass = item.cubic > item.real ? 'style="color:var(--warning);font-weight:600"' : '';
    return `<tr>
      <td style="padding:8px 12px; text-align:left;">${escapeHtml(item.productName || '—')}</td>
      <td style="padding:8px 12px;text-align:center">${item.qty}</td>
      <td style="padding:8px 12px">
        <input type="text" class="logistics-input" data-item-id="${item.id}" data-field="packagingType"
          value="${escapeHtml(item.packagingType || '')}" placeholder="Ex: Caixa, pallet"
          style="width:120px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="unitsPerPackage"
          value="${item.unitsPerPackage || 1}" placeholder="1" step="1" min="1"
          style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:transparent">
      </td>
      <td style="padding:8px 12px">
        <input type="number" class="logistics-input" data-item-id="${item.id}" data-field="weightKg"
          value="${item.real || ''}" placeholder="0" step="0.1" min="0"
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
      <td style="padding:8px 12px">${item.unitVolumeM3 > 0 ? `${item.unitVolumeM3.toFixed(3)} m3` : '—'}</td>
      <td style="padding:8px 12px" ${weightClass}>${item.cubic > 0 ? item.cubic.toFixed(2) + ' kg' : '—'}</td>
      <td style="padding:8px 12px;font-weight:600" ${weightClass}>${item.charged > 0 ? item.chargedTotal.toFixed(2) + ' kg' : '—'}</td>
      <td style="padding:8px 12px">${formatCurrency(item.freightPerVolume)}</td>
      <td style="padding:8px 12px;color:var(--primary);font-weight:600">${formatCurrency(item.itemFreight)}</td>
      <td style="padding:8px 12px">${item.freightPercent > 0 ? formatPercent(item.freightPercent) : '—'}</td>
    </tr>`;
  }).join('');

  bindRowInputs(getWorkbookFn);

  const elTotalWeight = document.getElementById('logisticsTotalWeight');
  const elTotalFreight = document.getElementById('logisticsTotalFreight');
  const elBaseFreight = document.getElementById('logisticsBaseFreight');
  const elRedespacho = document.getElementById('logisticsRedespacho');
  const elTotalCost = document.getElementById('logisticsTotalCost');

  if (elTotalWeight) elTotalWeight.textContent = `${analysis.totalChargedWeight.toFixed(2)} kg`;
  if (elTotalFreight) elTotalFreight.textContent = formatCurrency(analysis.totalFinalCost);
  if (elBaseFreight) elBaseFreight.textContent = formatCurrency(analysis.totalBaseFreight);
  if (elRedespacho) elRedespacho.textContent = formatCurrency(analysis.redespacho);
  if (elTotalCost) elTotalCost.textContent = formatCurrency(analysis.totalFinalCost);

  updateLogisticsSummary(analysis);
  renderAlerts(analysis.alerts);
  renderHistory(config.history || []);
  return analysis;
}
