import { toNumber, formatCurrency, formatPercent, escapeHtml } from '../core/utils.js';
import { summarizeWorkbook, groupItemsByLot, calculateLotSubtotal, calculateRow } from '../core/pricing.js';

// Importação dinâmica do PDF.js para manter o módulo leve até ser necessário
let pdfjsLib = null;
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  return pdfjsLib;
}

// ═══════════════════════════════════════════════════
// SUB-TABS: Sistema de abas internas para todos módulos
// ═══════════════════════════════════════════════════
export function setupSubTabs() {
  document.querySelectorAll('.sub-tabs').forEach(tabGroup => {
    const group = tabGroup.dataset.group;
    const section = tabGroup.closest('.module-content');
    if (!section) return;

    tabGroup.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Desativar todas as tabs
        tabGroup.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Mostrar apenas o conteúdo correspondente
        section.querySelectorAll('.sub-content').forEach(c => {
          c.style.display = 'none';
          c.classList.remove('active');
        });
        const target = section.querySelector(`[data-subcontent="${tab.dataset.subtab}"]`);
        if (target) {
          target.style.display = 'block';
          target.classList.add('active');
        }
      });
    });
  });
}

// ═══════════════════════════════════════════════════
// MOTOR DE CENÁRIOS
// ═══════════════════════════════════════════════════
export function setupScenarios(getWorkbookFn, renderAllFn) {
  const btn = document.getElementById('openScenariosBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const workbook = getWorkbookFn();
    if (!workbook) return;
    const s = workbook.settings;

    const modal = document.createElement('div');
    modal.className = 'scenarios-modal no-print';
    modal.innerHTML = `
      <div class="scenarios-panel">
        <div class="section-title" style="margin-bottom:16px">
          <h2>🎛️ Simulador de Cenários</h2>
          <p>Ajuste os parâmetros e veja o impacto em toda a proposta em tempo real.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${makeSlider('Imposto %', 'scenarioTax', s.taxPercent, 0, 30)}
          ${makeSlider('Margem %', 'scenarioMargin', s.marginPercent, 0, 50)}
          ${makeSlider('Transporte %', 'scenarioTransport', s.transportPercent, 0, 30)}
          ${makeSlider('Garantia %', 'scenarioWarranty', s.warrantyPercent, 0, 20)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px;padding:16px;background:var(--bg);border-radius:var(--radius-sm)">
          <div style="text-align:center">
            <div style="font-size:0.75rem;color:var(--text-muted)">Mark-up Simulado</div>
            <div id="scenarioMarkup" style="font-size:1.4rem;font-weight:700;color:var(--primary)">—</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.75rem;color:var(--text-muted)">Total Simulado</div>
            <div id="scenarioTotal" style="font-size:1.4rem;font-weight:700;color:var(--green)">—</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
          <button type="button" class="ghost-button" id="scenarioCancel">Cancelar</button>
          <button type="button" class="primary-button" id="scenarioApply">Aplicar ao Workbook</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    // Cálculo em tempo real
    const update = () => {
      const tax = toNumber(modal.querySelector('#scenarioTax').value);
      const margin = toNumber(modal.querySelector('#scenarioMargin').value);
      const transport = toNumber(modal.querySelector('#scenarioTransport').value);
      const warranty = toNumber(modal.querySelector('#scenarioWarranty').value);
      const markup = 1 + (tax + margin + transport + warranty) / 100;

      // Simular total
      let total = 0;
      workbook.items.forEach(item => {
        const base = toNumber(item.quantity) * toNumber(item.unitPrice);
        total += base * markup;
      });

      modal.querySelector('#scenarioMarkup').textContent = markup.toFixed(4);
      modal.querySelector('#scenarioTotal').textContent = formatCurrency(total);
      
      // Atualizar labels
      modal.querySelector('#scenarioTaxVal').textContent = `${tax}%`;
      modal.querySelector('#scenarioMarginVal').textContent = `${margin}%`;
      modal.querySelector('#scenarioTransportVal').textContent = `${transport}%`;
      modal.querySelector('#scenarioWarrantyVal').textContent = `${warranty}%`;
    };

    modal.querySelectorAll('input[type=range]').forEach(slider => {
      slider.addEventListener('input', update);
    });
    update();

    modal.querySelector('#scenarioCancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#scenarioApply').addEventListener('click', () => {
      workbook.settings.taxPercent = toNumber(modal.querySelector('#scenarioTax').value);
      workbook.settings.marginPercent = toNumber(modal.querySelector('#scenarioMargin').value);
      workbook.settings.transportPercent = toNumber(modal.querySelector('#scenarioTransport').value);
      workbook.settings.warrantyPercent = toNumber(modal.querySelector('#scenarioWarranty').value);
      localStorage.setItem('precificacao-workbooks', JSON.stringify(
        JSON.parse(localStorage.getItem('precificacao-workbooks') || '[]').map(w =>
          w.id === workbook.id ? workbook : w
        )
      ));
      modal.remove();
      renderAllFn();
    });
  });
}

function makeSlider(label, id, value, min, max) {
  return `
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:0.85rem;font-weight:600">${label}</span>
        <span id="${id}Val" style="font-size:0.85rem;color:var(--primary);font-weight:700">${value}%</span>
      </div>
      <input type="range" id="${id}" class="scenario-slider" min="${min}" max="${max}" step="0.5" value="${value}">
    </div>
  `;
}

// ═══════════════════════════════════════════════════
// CHECKLIST DE HABILITAÇÃO
// ═══════════════════════════════════════════════════
export function setupChecklist(getWorkbookFn, updateWorkbookFn) {
  const addBtn = document.getElementById('addChecklistDocBtn');
  if (!addBtn) return;

  function loadChecklist() {
    const wb = getWorkbookFn();
    return wb?.checklist || [];
  }

  function saveChecklist(docs) {
    updateWorkbookFn(wb => {
      wb.checklist = docs;
      return wb;
    }, { auditAction: "Checklist", auditDetails: "Lista de documentos alterada" });
  }

  function renderChecklist() {
    const container = document.getElementById('checklistContainer');
    if (!container) return;
    const docs = loadChecklist();
    if (!docs.length) {
      container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-muted)">Nenhum documento cadastrado.</div>';
      return;
    }

    const today = new Date();
    const STATUS_ICONS = { ok: '✅', pending: '⏳', expired: '❌' };
    
    container.innerHTML = docs.map((doc, index) => {
      let autoStatus = doc.status;
      if (doc.expiry) {
        const expDate = new Date(doc.expiry);
        if (expDate < today) autoStatus = 'expired';
        else if ((expDate - today) / (1000*60*60*24) < 15) autoStatus = 'pending';
      }
      const daysDiff = doc.expiry ? Math.ceil((new Date(doc.expiry) - today) / (1000*60*60*24)) : null;
      const expiryText = daysDiff !== null
        ? (daysDiff < 0 ? `<span style="color:var(--danger);font-weight:600">Vencido há ${Math.abs(daysDiff)}d</span>`
          : daysDiff < 15 ? `<span style="color:var(--warning);font-weight:600">${daysDiff}d restantes</span>`
          : `<span style="color:var(--green)">${daysDiff}d restantes</span>`)
        : '';

      return `<div class="checklist-item status-${autoStatus}" style="--stagger: ${index + 1}">
        <span style="font-size:1.1rem">${STATUS_ICONS[autoStatus] || '⏳'}</span>
        <span style="flex:1;font-weight:500">${doc.name}</span>
        ${expiryText}
        <button type="button" data-checklist-remove="${doc.id}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1rem">×</button>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-checklist-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveChecklist(loadChecklist().filter(d => d.id !== btn.dataset.checklistRemove));
        renderChecklist();
      });
    });
  }

  addBtn.addEventListener('click', () => {
    const name = document.getElementById('checklistDocName')?.value.trim();
    if (!name) return;
    const docs = loadChecklist();
    docs.push({
      id: Date.now().toString(),
      name,
      expiry: document.getElementById('checklistDocExpiry')?.value || '',
      status: document.getElementById('checklistDocStatus')?.value || 'pending'
    });
    saveChecklist(docs);
    document.getElementById('checklistDocName').value = '';
    renderChecklist();
  });

  // Export renderChecklist inside or attach to an event if needed outside.
  // Because navigation between workbooks implies re-rendering, we should ideally listen to a 'renderAll' event or just render.
  renderChecklist();
}

// ═══════════════════════════════════════════════════
// CRONOGRAMA DO PREGÃO
// ═══════════════════════════════════════════════════
export function setupTimeline(getWorkbookFn, updateWorkbookFn) {
  const addBtn = document.getElementById('addTimelineEventBtn');
  if (!addBtn) return;

  function loadTimeline() {
    const wb = getWorkbookFn();
    return wb?.timeline || [];
  }

  function saveTimeline(events) {
    updateWorkbookFn(wb => {
      wb.timeline = events;
      return wb;
    }, { auditAction: "Cronograma", auditDetails: "Cronograma alterado" });
  }

  function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    const events = loadTimeline();
    if (!events.length) {
      container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-muted)">Nenhum marco registrado.</div>';
      return;
    }
    
    const today = new Date();
    container.innerHTML = events.map((e, index) => {
      const isPast = e.date && new Date(e.date) < today;
      const days = e.date ? Math.ceil((new Date(e.date) - today) / (1000*60*60*24)) : null;
      const daysLabel = days !== null
        ? (days < 0 ? `<span style="color:var(--text-muted);font-size:0.8rem">(${Math.abs(days)}d atrás)</span>`
          : `<span style="color:var(--warning);font-size:0.8rem;font-weight:600">(${days}d restantes)</span>`)
        : '';

      return `<div class="timeline-event ${isPast ? 'past' : 'future'}" style="--stagger: ${index + 1}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">${e.name}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${e.date ? new Date(e.date + 'T12:00').toLocaleDateString('pt-BR') : 'Sem data'} ${daysLabel}</div>
          </div>
          <button type="button" data-timeline-remove="${e.id}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1rem">×</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-timeline-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveTimeline(loadTimeline().filter(e => e.id !== btn.dataset.timelineRemove));
        renderTimeline();
      });
    });
  }

  addBtn.addEventListener('click', () => {
    const name = document.getElementById('timelineEventName')?.value.trim();
    const date = document.getElementById('timelineEventDate')?.value;
    if (!name) return;
    const events = loadTimeline();
    events.push({ id: Date.now().toString(), name, date: date || '' });
    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    saveTimeline(events);
    document.getElementById('timelineEventName').value = '';
    renderTimeline();
  });

  renderTimeline();
}

// ═══════════════════════════════════════════════════
// GERADOR DE IMPUGNAÇÃO
// ═══════════════════════════════════════════════════
export function setupImpugnacao(getWorkbookFn) {
  const btn = document.getElementById('generateImpugnacaoBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const workbook = getWorkbookFn();
    const type = document.getElementById('impugnacaoType')?.value || 'impugnacao';
    const text = document.getElementById('impugnacaoText')?.value?.trim();
    if (!text) return alert('Preencha o campo de fundamentação.');

    const header = workbook?.header || {};
    const title = type === 'impugnacao' ? 'IMPUGNAÇÃO AO EDITAL' : 'PEDIDO DE ESCLARECIMENTO';
    const doc = `
${title}

Processo: ${header.processNumber || '(não informado)'}
Órgão: ${header.agencyName || '(não informado)'}
Objeto: ${header.bidObject || '(não informado)'}
Data: ${new Date().toLocaleDateString('pt-BR')}

FUNDAMENTAÇÃO:

${text}

Ante o exposto, requer-se deferimento.

___________________________________
Representante Legal
    `.trim();

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_${header.processNumber || 'documento'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ═══════════════════════════════════════════════════
// SIMULADOR DE PRAZO DE PAGAMENTO
// ═══════════════════════════════════════════════════
export function setupPaymentSimulator(getWorkbookFn) {
  const btn = document.getElementById('calcPaymentCostBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const days = toNumber(document.getElementById('paymentDays')?.value || 60);
    const rate = toNumber(document.getElementById('capitalRate')?.value || 2.5);
    let proposalValue = toNumber(document.getElementById('paymentProposalValue')?.value || 0);

    // Se o campo estiver zerado, puxar automaticamente do workbook
    if (proposalValue === 0) {
      const workbook = getWorkbookFn();
      if (workbook) {
        const { calculateRow } = window.__pricingModule || {};
        // Fallback: somar direto dos itens
        workbook.items.forEach(item => {
          proposalValue += toNumber(item.quantity) * toNumber(item.unitPrice);
        });
        // Aplicar markup
        const markup = 1 + (workbook.settings.taxPercent + workbook.settings.marginPercent + workbook.settings.transportPercent + workbook.settings.warrantyPercent) / 100;
        proposalValue *= markup;
        document.getElementById('paymentProposalValue').value = proposalValue.toFixed(2);
      }
    }

    const dailyRate = rate / 30 / 100;
    const financialCost = proposalValue * dailyRate * days;
    const percentOfProposal = proposalValue > 0 ? (financialCost / proposalValue) * 100 : 0;
    const netProfit = proposalValue > 0 ? (proposalValue * (getWorkbookFn()?.settings?.marginPercent || 0) / 100) - financialCost : 0;

    const elCost = document.getElementById('paymentFinancialCost');
    const elPercent = document.getElementById('paymentFinancialPercent');
    const elNet = document.getElementById('paymentNetProfit');

    if (elCost) elCost.textContent = formatCurrency(financialCost);
    if (elPercent) elPercent.textContent = formatPercent(percentOfProposal);
    if (elNet) {
      elNet.textContent = formatCurrency(netProfit);
      elNet.style.color = netProfit >= 0 ? 'var(--green)' : 'var(--danger)';
    }
  });
}

// ═══════════════════════════════════════════════════
// RENTABILIDADE POR ÓRGÃO
// ═══════════════════════════════════════════════════
export function renderProfitability(getWorkbooksFn) {
  const container = document.getElementById('profitabilityDashboard');
  if (!container) return;

  try {
    const workbooks = JSON.parse(localStorage.getItem('precificacao-workbooks') || '[]');
    if (!workbooks.length) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">Nenhuma planilha encontrada.</div>';
      return;
    }

    const totals = {
      proposals: workbooks.length,
      finalTotal: 0,
      profitValue: 0,
      itemCount: 0
    };

    const agencies = new Map();
    const processes = new Map();
    const lots = new Map();

    workbooks.forEach((wb) => {
      const summary = summarizeWorkbook(wb);
      const agencyLabel = (wb.header?.agencyName || 'Sem órgão').trim() || 'Sem órgão';
      const processLabel = (wb.header?.processNumber || wb.header?.sheetName || wb.name || 'Sem processo').trim() || 'Sem processo';
      const bidObject = (wb.header?.bidObject || 'Objeto não informado').trim() || 'Objeto não informado';

      totals.finalTotal += summary.finalTotal;
      totals.profitValue += summary.profitValue;
      totals.itemCount += summary.itemCount;

      const agencyEntry = agencies.get(agencyLabel) || {
        label: agencyLabel,
        proposals: 0,
        processes: new Set(),
        finalTotal: 0,
        profitValue: 0,
        itemCount: 0
      };
      agencyEntry.proposals += 1;
      agencyEntry.processes.add(processLabel);
      agencyEntry.finalTotal += summary.finalTotal;
      agencyEntry.profitValue += summary.profitValue;
      agencyEntry.itemCount += summary.itemCount;
      agencies.set(agencyLabel, agencyEntry);

      const processEntry = processes.get(processLabel) || {
        label: processLabel,
        agency: agencyLabel,
        object: bidObject,
        finalTotal: 0,
        profitValue: 0,
        itemCount: 0,
        lotCount: 0
      };
      processEntry.agency = agencyLabel;
      processEntry.object = bidObject;
      processEntry.finalTotal += summary.finalTotal;
      processEntry.profitValue += summary.profitValue;
      processEntry.itemCount += summary.itemCount;
      processEntry.lotCount += summary.lotCount;
      processes.set(processLabel, processEntry);

      groupItemsByLot(wb.items || []).forEach((group) => {
        const lotSummary = calculateLotSubtotal(group.items, wb.settings || {});
        const lotKey = `${agencyLabel}::${processLabel}::${group.label}`;
        lots.set(lotKey, {
          label: group.label,
          agency: agencyLabel,
          process: processLabel,
          count: group.items.length,
          finalTotal: lotSummary.finalTotal,
          profitValue: lotSummary.profitValue,
          marginPercent: lotSummary.profitPercent
        });
      });
    });

    const agencyRows = [...agencies.values()]
      .map((entry) => ({
        ...entry,
        processCount: entry.processes.size,
        marginPercent: entry.finalTotal > 0 ? (entry.profitValue / entry.finalTotal) * 100 : 0
      }))
      .sort((a, b) => b.finalTotal - a.finalTotal)
      .slice(0, 6);

    const processRows = [...processes.values()]
      .map((entry) => ({
        ...entry,
        marginPercent: entry.finalTotal > 0 ? (entry.profitValue / entry.finalTotal) * 100 : 0
      }))
      .sort((a, b) => b.finalTotal - a.finalTotal)
      .slice(0, 6);

    const lotRows = [...lots.values()]
      .sort((a, b) => b.finalTotal - a.finalTotal)
      .slice(0, 6);

    const overallMargin = totals.finalTotal > 0 ? (totals.profitValue / totals.finalTotal) * 100 : 0;
    const agenciesCount = agencies.size;
    const processesCount = processes.size;
    const lotsCount = lots.size;
    const topAgency = agencyRows[0]?.label || 'Sem órgão';
    const topProcess = processRows[0]?.label || 'Sem processo';
    const topLot = lotRows[0]?.label || 'Sem lote';

    container.innerHTML = `
      <div class="dashboard-shell">
        <div class="dashboard-kpis">
          <div class="dashboard-kpi">
            <span>Volume total</span>
            <strong>${formatCurrency(totals.finalTotal)}</strong>
            <small>${totals.proposals} proposta(s) analisada(s)</small>
          </div>
          <div class="dashboard-kpi">
            <span>Lucro consolidado</span>
            <strong>${formatCurrency(totals.profitValue)}</strong>
            <small>Margem média ${formatPercent(overallMargin)}</small>
          </div>
          <div class="dashboard-kpi">
            <span>Órgãos e processos</span>
            <strong>${agenciesCount} / ${processesCount}</strong>
            <small>${lotsCount} lote(s) mapeado(s)</small>
          </div>
          <div class="dashboard-kpi">
            <span>Itens analisados</span>
            <strong>${totals.itemCount}</strong>
            <small>Maior órgão: ${escapeHtml(topAgency)}</small>
          </div>
        </div>

        <div class="dashboard-highlights">
          <div class="dashboard-highlight">
            <span>Processo de maior volume</span>
            <strong>${escapeHtml(topProcess)}</strong>
          </div>
          <div class="dashboard-highlight">
            <span>Lote com maior faturamento</span>
            <strong>${escapeHtml(topLot)}</strong>
          </div>
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-panel">
            <div class="dashboard-panel-header">
              <h3>Órgãos mais relevantes</h3>
              <p>Ranking por volume total das propostas.</p>
            </div>
            <div class="dashboard-list">
              ${agencyRows.length ? agencyRows.map((entry, index) => `
                <article class="dashboard-item" style="--stagger: ${index + 1}">
                  <div>
                    <strong>${escapeHtml(entry.label)}</strong>
                    <small>${entry.proposals} proposta(s) · ${entry.processCount} processo(s)</small>
                  </div>
                  <div class="dashboard-metrics">
                    <span>${formatCurrency(entry.finalTotal)}</span>
                    <small>Lucro ${formatPercent(entry.marginPercent)}</small>
                  </div>
                </article>
              `).join('') : '<div class="dashboard-empty">Sem dados de órgãos suficientes.</div>'}
            </div>
          </section>

          <section class="dashboard-panel">
            <div class="dashboard-panel-header">
              <h3>Processos com maior retorno</h3>
              <p>Comparativo por processo ou planilha salva.</p>
            </div>
            <div class="dashboard-list">
              ${processRows.length ? processRows.map((entry) => `
                <article class="dashboard-item">
                  <div>
                    <strong>${escapeHtml(entry.label)}</strong>
                    <small>${escapeHtml(entry.agency)} · ${entry.itemCount} item(ns) · ${entry.lotCount} lote(s)</small>
                  </div>
                  <div class="dashboard-metrics">
                    <span>${formatCurrency(entry.finalTotal)}</span>
                    <small>Lucro ${formatCurrency(entry.profitValue)}</small>
                  </div>
                </article>
              `).join('') : '<div class="dashboard-empty">Sem processos suficientes para comparar.</div>'}
            </div>
          </section>
        </div>

        <section class="dashboard-panel">
          <div class="dashboard-panel-header">
            <h3>Lotes com maior faturamento</h3>
            <p>Leitura rápida dos lotes mais fortes entre as propostas salvas.</p>
          </div>
          <div class="dashboard-list">
            ${lotRows.length ? lotRows.map((entry) => `
              <article class="dashboard-item">
                <div>
                  <strong>${escapeHtml(entry.label)}</strong>
                  <small>${escapeHtml(entry.process)} · ${escapeHtml(entry.agency)} · ${entry.count} item(ns)</small>
                </div>
                <div class="dashboard-metrics">
                  <span>${formatCurrency(entry.finalTotal)}</span>
                  <small>Margem ${formatPercent(entry.marginPercent)}</small>
                </div>
              </article>
            `).join('') : '<div class="dashboard-empty">Nenhum lote encontrado.</div>'}
          </div>
        </section>
      </div>
    `;
  } catch { /* silent */ }
}

// ═══════════════════════════════════════════════════
// CONTROLE DE EMPENHO
// ═══════════════════════════════════════════════════
const EMPENHO_KEY = 'precificacao-empenhos';

function loadEmpenhos() {
  try { return JSON.parse(localStorage.getItem(EMPENHO_KEY) || '[]'); }
  catch { return []; }
}

function saveEmpenhos(list) {
  localStorage.setItem(EMPENHO_KEY, JSON.stringify(list));
}

export function setupEmpenho() {
  const btn = document.getElementById('saveEmpenhoBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const number = document.getElementById('empenhoNumber')?.value.trim();
    if (!number) return;
    const list = loadEmpenhos();
    list.push({
      id: Date.now().toString(),
      number,
      value: toNumber(document.getElementById('empenhoValue')?.value || 0),
      deliveryDate: document.getElementById('empenhoDeliveryDate')?.value || '',
      paymentDate: document.getElementById('empenhoPaymentDate')?.value || ''
    });
    saveEmpenhos(list);
    document.getElementById('empenhoNumber').value = '';
    document.getElementById('empenhoValue').value = '';
    renderEmpenhos();
  });

  renderEmpenhos();
}

function renderEmpenhos() {
  const container = document.getElementById('empenhoList');
  if (!container) return;
  const list = loadEmpenhos();
  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-muted)">Nenhum empenho registrado.</div>';
    return;
  }

  container.innerHTML = list.map(e => `
    <div class="empenho-card">
      <div><div style="font-size:0.7rem;color:var(--text-muted)">Empenho</div><div style="font-weight:600">${e.number}</div></div>
      <div><div style="font-size:0.7rem;color:var(--text-muted)">Valor</div><div style="font-weight:600;color:var(--primary)">${formatCurrency(e.value)}</div></div>
      <div><div style="font-size:0.7rem;color:var(--text-muted)">Entrega</div><div>${e.deliveryDate ? new Date(e.deliveryDate + 'T12:00').toLocaleDateString('pt-BR') : '—'}</div></div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:0.7rem;color:var(--text-muted)">Pagamento</div><div style="color:${e.paymentDate ? 'var(--green)' : 'var(--warning)'}">${e.paymentDate ? new Date(e.paymentDate + 'T12:00').toLocaleDateString('pt-BR') : 'Pendente'}</div></div>
        <button type="button" data-empenho-remove="${e.id}" style="background:none;border:none;color:var(--danger);cursor:pointer">×</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-empenho-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveEmpenhos(loadEmpenhos().filter(e => e.id !== btn.dataset.empenhoRemove));
      renderEmpenhos();
    });
  });
}

// ═══════════════════════════════════════════════════
// IA - ANÁLISE DE EDITAL (conexão Ollama)
// ═══════════════════════════════════════════════════
export function setupEditalAnalysis() {
  const dropzone = document.getElementById('editalDropzone');
  const fileInput = document.getElementById('editalFileInput');
  const testBtn = document.getElementById('testOllamaBtn');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      if (e.dataTransfer.files.length) processEditalFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) processEditalFile(fileInput.files[0]);
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const url = document.getElementById('ollamaUrl')?.value || 'http://localhost:11434';
      try {
        const res = await fetch(url);
        if (res.ok) {
          testBtn.textContent = '✅ Conectado';
          testBtn.style.color = 'var(--green)';
        } else throw new Error();
      } catch {
        testBtn.textContent = '❌ Sem conexão';
        testBtn.style.color = 'var(--danger)';
      }
      setTimeout(() => { testBtn.textContent = '🔗 Testar Conexão'; testBtn.style.color = ''; }, 3000);
    });
  }
}

/**
 * Extrai texto de um arquivo PDF usando PDF.js
 * @param {File} file 
 * @returns {Promise<string>}
 */
async function extractTextFromPdf(file) {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n';
  }
  
  return fullText;
}

async function processEditalFile(file) {
  const resultEl = document.getElementById('editalAnalysisResult');
  const contentEl = document.getElementById('editalAnalysisContent');
  if (!resultEl || !contentEl) return;

  contentEl.textContent = '⏳ Processando arquivo... Aguarde.';
  resultEl.style.display = 'block';

  try {
    let text = '';
    if (file.name.endsWith('.pdf')) {
      contentEl.textContent = '📄 Extraindo texto do PDF...';
      text = await extractTextFromPdf(file);
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      contentEl.textContent = 'O arquivo está vazio ou não possui texto extraível.';
      return;
    }

    const url = document.getElementById('ollamaUrl')?.value || 'http://localhost:11434';
    const model = 'llama3'; // Conforme preferência do usuário
    
    contentEl.textContent = `🤖 Enviando para IA (${model})... Aguarde a análise.`;

    const prompt = `Analise o seguinte edital de licitação e identifique:\n
    1. RISCOS (penalidades, prazos apertados, exigências restritivas)\n
    2. DOCUMENTOS OBRIGATÓRIOS (habilitação jurídica, técnica, fiscal)\n
    3. PRAZOS IMPORTANTES (visita técnica, entrega de proposta, lances)\n
    4. REQUISITOS TÉCNICOS CRÍTICOS\n
    5. RESUMO EXECUTIVO\n\n
    Texto do edital:\n${text.substring(0, 10000)}`;

    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });

    if (!res.ok) throw new Error('Ollama não respondeu corretamente. Verifique se o modelo está baixado.');
    const data = await res.json();
    contentEl.textContent = data.response || 'Sem resposta da IA.';
  } catch (err) {
    contentEl.textContent = `❌ Erro: ${err.message}\n\nVerifique se o Ollama está rodando em ${document.getElementById('ollamaUrl')?.value || 'http://localhost:11434'} e o modelo llama3 está disponível.`;
  }
}

// ═══════════════════════════════════════════════════
// SUGESTÃO DE PREÇOS POR HISTÓRICO
// ═══════════════════════════════════════════════════
export function renderPriceSuggestions(getWorkbookFn) {
  const container = document.getElementById('priceSuggestionContainer');
  if (!container) return;

  try {
    const workbooks = JSON.parse(localStorage.getItem('precificacao-workbooks') || '[]');
    const currentWb = getWorkbookFn();
    if (!currentWb || !currentWb.items.length || workbooks.length < 2) {
      container.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--text-muted)">
          <span style="font-size:2rem;display:block;margin-bottom:12px">🧠</span>
          <p>Cadastre pelo menos 2 propostas para gerar sugestões baseadas no seu histórico de vendas.</p>
        </div>`;
      return;
    }

    // 1. Construir histórico de PREÇOS DE VENDA (finalUnitPrice)
    const sellingHistory = {};
    workbooks.forEach(wb => {
      if (wb.id === currentWb.id) return;
      const settings = wb.settings || {};
      wb.items?.forEach(item => {
        const key = (item.productName || '').toLowerCase().trim();
        if (!key) return;
        
        // Calcular o preço de venda que foi praticado naquela planilha
        const calc = calculateRow(item, settings);
        if (calc.finalUnitPrice <= 0) return;

        if (!sellingHistory[key]) sellingHistory[key] = [];
        sellingHistory[key].push(calc.finalUnitPrice);
      });
    });

    // 2. Analisar itens da planilha atual
    const suggestions = currentWb.items.map(item => {
      const key = (item.productName || '').toLowerCase().trim();
      const prices = sellingHistory[key] || [];
      if (prices.length === 0) return null;

      const calc = calculateRow(item, currentWb.settings);
      const minPrice = calc.minimumUnitPrice;
      const currentPrice = calc.finalUnitPrice;

      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minHist = Math.min(...prices);
      const maxHist = Math.max(...prices);
      
      // Alerta: Média de mercado abaixo do meu custo + impostos
      const isViable = avg >= minPrice;
      
      return {
        name: item.productName,
        current: currentPrice,
        minHist,
        maxHist,
        avg,
        count: prices.length,
        minPrice, // meu custo mínimo
        isViable
      };
    }).filter(Boolean);

    if (!suggestions.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--text-muted)">
          <span style="font-size:2rem;display:block;margin-bottom:12px">🔍</span>
          <p>Nenhum dos produtos da planilha atual possui histórico de venda em outras propostas.</p>
        </div>`;
      return;
    }

    // 3. Renderizar com UI "Premium"
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${suggestions.map((s, index) => {
          const statusColor = s.isViable ? 'var(--green)' : 'var(--danger)';
          const diff = s.current - s.avg;
          const diffColor = diff > 0 ? 'var(--warning)' : 'var(--green)';
          
          return `
            <div class="card" style="padding:16px; border-left: 4px solid ${statusColor}; background: var(--surface); --stagger: ${index + 1}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <h4 style="margin:0; font-size:1rem; color:var(--text-main);">${escapeHtml(s.name)}</h4>
                  <small style="color:var(--text-muted)">Baseado em ${s.count} referência(s) anterior(es)</small>
                </div>
                <div style="text-align:right">
                  <div style="font-size:0.75rem; color:var(--text-muted)">Preço Sugerido (Médio)</div>
                  <strong style="font-size:1.1rem; color:var(--primary);">${formatCurrency(s.avg)}</strong>
                </div>
              </div>
              
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; padding-top:12px; border-top:1px solid var(--border);">
                <div style="text-align:center">
                  <span style="display:block; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Seu Preço</span>
                  <span style="font-weight:600; font-size:0.85rem;">${formatCurrency(s.current)}</span>
                </div>
                <div style="text-align:center">
                  <span style="display:block; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Histórico Min</span>
                  <span style="font-weight:600; font-size:0.85rem;">${formatCurrency(s.minHist)}</span>
                </div>
                <div style="text-align:center">
                  <span style="display:block; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Histórico Max</span>
                  <span style="font-weight:600; font-size:0.85rem;">${formatCurrency(s.maxHist)}</span>
                </div>
                <div style="text-align:center">
                  <span style="display:block; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Diferença</span>
                  <span style="font-weight:700; font-size:0.85rem; color:${diffColor}">${diff > 0 ? '+' : ''}${formatCurrency(diff)}</span>
                </div>
              </div>

              ${!s.isViable ? `
                <div style="margin-top:12px; padding:8px; background: rgba(220, 38, 38, 0.1); border-radius: 4px; display:flex; gap:8px; align-items:center;">
                  <span style="font-size:1.1rem">⚠️</span>
                  <span style="font-size:0.8rem; color:var(--danger); font-weight:500;">
                    Atenção: A média histórica (${formatCurrency(s.avg)}) está ABAIXO do seu custo mínimo (${formatCurrency(s.minPrice)}). 
                    Verifique sua margem ou custos de compra.
                  </span>
                </div>
              ` : `
                <div style="margin-top:12px; padding:8px; background: rgba(16, 185, 129, 0.1); border-radius: 4px; display:flex; gap:8px; align-items:center;">
                  <span style="font-size:1.1rem">✅</span>
                  <span style="font-size:0.8rem; color:var(--green); font-weight:500;">
                    Preço competitivo. Mantém uma margem de segurança acima do custo unitário mínimo.
                  </span>
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>`;
  } catch (err) {
    console.error("Erro ao gerar sugestões:", err);
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--danger)">Erro ao processar histórico de preços.</div>';
  }
}

// ═══════════════════════════════════════════════════
// GERADOR DE PROPOSTA PDF
// ═══════════════════════════════════════════════════
export function setupPdfGenerator(getWorkbookFn) {
  const btn = document.getElementById('generatePdfBtn');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    if (!window.html2pdf) {
      alert("A biblioteca de PDF ainda está carregando ou foi bloqueada. Tente novamente em alguns segundos.");
      return;
    }
    
    const workbook = getWorkbookFn();
    if (!workbook || !workbook.items || !workbook.items.length) {
      alert("Não há itens na planilha para gerar a proposta.");
      return;
    }

    const h = workbook.header || {};
    const items = workbook.items;
    
    // Calcula o total geral simulando markup
    let totalGeral = 0;
    const markup = 1 + (workbook.settings.taxPercent + workbook.settings.marginPercent + workbook.settings.transportPercent + workbook.settings.warrantyPercent) / 100;
    
    const lotes = groupItemsByLot(items);
    
    const element = document.createElement("div");
    element.innerHTML = `
      <div style="font-family: 'Space Grotesk', sans-serif; padding: 40px; background: #0f121b; color: #f8fafc; font-size: 10pt; min-height: 100vh;">
        <!-- CABEÇALHO -->
        <div style="text-align: center; border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #d4af37; font-size: 24pt; margin: 0; text-transform: uppercase; letter-spacing: 2px;">PROPOSTA COMERCIAL</h1>
          <h2 style="color: #94a3b8; font-size: 14pt; margin: 10px 0 0 0;">${h.companyName || 'Empresa Emissora'}</h2>
          ${h.companyDocument ? `<p style="margin: 5px 0 0 0; color: #64748b;">CNPJ: ${h.companyDocument}</p>` : ''}
        </div>

        <!-- DADOS DO ÓRGÃO -->
        <div style="background: rgba(30, 41, 59, 0.5); border-left: 4px solid #d4af37; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><strong style="color: #cbd5e1;">Órgão Licitante:</strong> ${h.agencyName || '-'}</div>
            <div><strong style="color: #cbd5e1;">Nº Processo/Pregão:</strong> ${h.processNumber || '-'}</div>
            <div style="grid-column: span 2;"><strong style="color: #cbd5e1;">Objeto:</strong> ${h.bidObject || '-'}</div>
            <div><strong style="color: #cbd5e1;">Data da Disputa:</strong> ${h.bidDate || '-'}</div>
            <div><strong style="color: #cbd5e1;">Validade da Proposta:</strong> ${h.proposalValidity || '60 dias'}</div>
          </div>
        </div>
        
        <p style="margin-bottom: 30px; line-height: 1.6; color: #e2e8f0;">
          ${h.proposalIntro || 'Apresentamos nossa proposta comercial detalhada para fornecimento dos itens conforme exigências do edital.'}
        </p>

        <!-- ITENS -->
        <div style="margin-bottom: 40px;">
          ${lotes.map(lote => {
            let subtot = 0;
            const tableRows = lote.items.map(item => {
              const base = Number(item.quantity) * Number(item.unitPrice);
              const rowTotal = base * markup;
              const unitVenda = rowTotal / (Number(item.quantity) || 1);
              subtot += rowTotal;
              
              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                  <td style="padding: 12px 8px;">${item.productName}</td>
                  <td style="padding: 12px 8px;">${item.manufacturer || '-'}</td>
                  <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
                  <td style="padding: 12px 8px; text-align: right;">${formatCurrency(unitVenda)}</td>
                  <td style="padding: 12px 8px; text-align: right;">${formatCurrency(rowTotal)}</td>
                </tr>
              `;
            }).join('');
            
            totalGeral += subtot;
            
            return `
              <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <h3 style="color: #d4af37; text-transform: uppercase; border-bottom: 1px solid rgba(212, 175, 55, 0.5); padding-bottom: 8px; margin-bottom: 12px; font-size: 12pt;">
                  ${lote.label}
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                  <thead>
                    <tr style="background: rgba(212, 175, 55, 0.1); color: #d4af37;">
                      <th style="padding: 10px 8px; text-align: left;">Descrição</th>
                      <th style="padding: 10px 8px; text-align: left;">Marca/Fabricante</th>
                      <th style="padding: 10px 8px; text-align: center;">Qtd</th>
                      <th style="padding: 10px 8px; text-align: right;">V. Unitário</th>
                      <th style="padding: 10px 8px; text-align: right;">V. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" style="text-align: right; padding: 12px 8px; font-weight: bold; color: #cbd5e1;">SUBTOTAL LOTE:</td>
                      <td style="text-align: right; padding: 12px 8px; font-weight: bold; color: #d4af37;">${formatCurrency(subtot)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            `;
          }).join('')}
        </div>

        <!-- TOTAL GERAL -->
        <div style="background: #d4af37; color: #000; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; margin-bottom: 40px;">
          <h2 style="margin: 0; font-size: 16pt; color: #000;">TOTAL GERAL DA PROPOSTA</h2>
          <h2 style="margin: 0; font-size: 20pt; font-weight: 900; color: #000;">${formatCurrency(totalGeral)}</h2>
        </div>

        <!-- TERMOS GERAIS -->
        <div style="page-break-inside: avoid;">
            <p style="margin-bottom: 20px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${h.commercialTerms || 'Todos os impostos e taxas já estão inclusos no preço final ofertado.'}</p>
        </div>

        <!-- ASSINATURA -->
        <div style="margin-top: 60px; text-align: center; page-break-inside: avoid;">
            <div style="width: 300px; border-top: 1px solid #94a3b8; margin: 0 auto 10px auto;"></div>
            <strong style="color: #e2e8f0;">${h.responsibleName || 'Representante Legal'}</strong><br>
            <span style="color: #94a3b8; font-size: 9pt;">${h.companyName || 'Nossa Empresa'}</span>
        </div>
      </div>
    `;

    const opt = {
      margin:       0,
      filename:     `Proposta_${h.processNumber || 'Licitacao'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f121b' },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    btn.textContent = "⌛ Gerando PDF...";
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      alert("Erro ao exportar PDF.");
      console.error(e);
    } finally {
      btn.textContent = "📄 Proposta PDF";
    }
  });
}
