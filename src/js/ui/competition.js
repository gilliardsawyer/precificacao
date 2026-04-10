import { toNumber, formatCurrency } from '../core/utils.js';
import { calculateRow } from '../core/pricing.js';

// Estado em memória dos concorrentes (sessão atual)
let competitors = [];

/**
 * Inicializa o módulo de inteligência de concorrência.
 * @param {Function} getWorkbookFn - Função para obter a planilha ativa
 */
export function setupCompetition(getWorkbookFn) {
  const addBtn = document.getElementById('addCompetitorBtn');
  if (!addBtn) return;

  addBtn.addEventListener('click', () => {
    const nameEl = document.getElementById('competitorName');
    const sourceEl = document.getElementById('competitorSource');
    const name = nameEl?.value.trim();
    if (!name) return;

    const id = `comp_${Date.now()}`;
    competitors.push({ id, name, source: sourceEl?.value.trim() || '', prices: {} });

    nameEl.value = '';
    if (sourceEl) sourceEl.value = '';

    renderCompetitorsList(getWorkbookFn);
    renderRankingTable(getWorkbookFn);
  });

  // Renderizar quando a aba for clicada
  document.querySelector('[data-nav="analytics"]')?.addEventListener('click', () => {
    setTimeout(() => {
      renderCompetitorsList(getWorkbookFn);
      renderRankingTable(getWorkbookFn);
    }, 50);
  });
}

/** Renderiza os chips dos concorrentes cadastrados */
function renderCompetitorsList(getWorkbookFn) {
  const el = document.getElementById('competitorsList');
  if (!el) return;

  if (!competitors.length) {
    el.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">Nenhum concorrente cadastrado ainda.</span>';
    return;
  }

  el.innerHTML = competitors.map(c => `
    <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 12px;background:var(--primary-bg);border:1px solid var(--primary);border-radius:100px;font-size:0.85rem;">
      <span style="font-weight:600">${c.name}</span>
      ${c.source ? `<span style="color:var(--text-muted)">(${c.source})</span>` : ''}
      <button type="button" data-remove-id="${c.id}"
        style="background:none;border:none;color:var(--danger);cursor:pointer;padding:0;font-size:1rem;line-height:1">×</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-remove-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      competitors = competitors.filter(c => c.id !== btn.dataset.removeId);
      renderCompetitorsList(getWorkbookFn);
      renderRankingTable(getWorkbookFn);
    });
  });
}

/** Recria o cabeçalho da tabela de ranking com colunas dos concorrentes */
function updateRankingHeader() {
  const headerRow = document.getElementById('rankingTableHeader');
  if (!headerRow) return;

  const competitorCols = competitors.map(c =>
    `<th style="white-space:nowrap">${c.name}</th>`
  ).join('');

  headerRow.innerHTML = `
    <th style="min-width:200px">Item / Produto</th>
    <th>Seu Preço (R$)</th>
    ${competitorCols}
    <th>Posição</th>
    <th>Ajuste p/ 1º (R$)</th>
  `;
}

const MEDAL = ['🥇', '🥈', '🥉'];

/** Renderiza a tabela de ranking e as sugestões */
export function renderRankingTable(getWorkbookFn) {
  updateRankingHeader();

  const tbody = document.getElementById('rankingTableBody');
  const suggestionsEl = document.getElementById('rankingSuggestions');
  if (!tbody) return;

  const workbook = getWorkbookFn();
  if (!workbook || !workbook.items.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">Adicione itens na aba Precificação para ver o ranking.</td></tr>';
    return;
  }

  const suggestions = [];

  tbody.innerHTML = workbook.items.map(item => {
    const myPrice = (() => {
      try {
        const calc = calculateRow(item, workbook.settings);
        return calc.finalUnitPrice;
      } catch {
        return 0;
      }
    })();

    // Coletar preços de todos os concorrentes para este item
    const allPrices = [
      { name: 'Você', price: myPrice, isMe: true }
    ];

    competitors.forEach(c => {
      const price = toNumber(c.prices[item.id] || 0);
      if (price > 0) allPrices.push({ name: c.name, price, id: c.id });
    });

    // Ordenar do menor para o maior
    const sorted = [...allPrices].filter(p => p.price > 0).sort((a, b) => a.price - b.price);
    const myRank = sorted.findIndex(p => p.isMe) + 1;
    const lowestCompetitor = sorted.find(p => !p.isMe);

    const medal = MEDAL[myRank - 1] || `#${myRank}`;
    const rankColor = myRank === 1 ? 'var(--green)' : myRank === 2 ? 'var(--warning)' : 'var(--danger)';

    // Calcular ajuste necessário para 1º se não estiver
    let adjustText = '—';
    if (myRank > 1 && lowestCompetitor) {
      const needed = myPrice - lowestCompetitor.price;
      adjustText = `<span style="color:var(--danger);font-weight:700">▼ ${formatCurrency(needed)}</span>`;

      suggestions.push({
        item: item.productName,
        myPrice,
        targetPrice: lowestCompetitor.price - 0.01,
        competitor: lowestCompetitor.name,
        rank: myRank
      });
    }

    // Colunas de preços por concorrente com inputs editáveis
    const competitorCols = competitors.map(c => {
      const val = toNumber(c.prices[item.id] || '');
      return `<td style="padding:8px">
        <input type="number" min="0" step="0.01" value="${val || ''}" placeholder="0,00"
          data-comp-id="${c.id}" data-item-id="${item.id}"
          class="comp-price-input"
          style="width:90px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:transparent;font-size:0.85rem;color:var(--text-main)">
      </td>`;
    }).join('');

    return `<tr>
      <td style="padding:8px 12px;font-weight:500">${item.productName || '—'}</td>
      <td style="padding:8px 12px;font-weight:700;color:var(--primary)">${myPrice > 0 ? formatCurrency(myPrice) : '—'}</td>
      ${competitorCols}
      <td style="padding:8px 12px;font-size:1.2rem;text-align:center">
        <span title="Posição ${myRank}" style="color:${rankColor}">${medal}</span>
      </td>
      <td style="padding:8px 12px;text-align:center">${adjustText}</td>
    </tr>`;
  }).join('');

  // Eventos nos inputs de preço dos concorrentes
  tbody.querySelectorAll('.comp-price-input').forEach(input => {
    input.addEventListener('change', () => {
      const compId = input.dataset.compId;
      const itemId = input.dataset.itemId;
      const val = toNumber(input.value);
      const competitor = competitors.find(c => c.id === compId);
      if (competitor) {
        competitor.prices[itemId] = val;
        renderRankingTable(getWorkbookFn);
      }
    });
  });

  // Renderizar sugestões
  if (suggestionsEl) {
    if (!suggestions.length) {
      suggestionsEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--green);font-weight:600">✅ Parabéns! Você está em 1º lugar em todos os itens com concorrentes cadastrados.</div>';
    } else {
      suggestionsEl.innerHTML = suggestions.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--warning-bg);border-left:4px solid var(--warning);border-radius:var(--radius-sm);">
          <div>
            <div style="font-weight:600;margin-bottom:2px">${s.item}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Concorrente mais barato: <strong>${s.competitor}</strong> — reduza em <strong>${formatCurrency(s.myPrice - s.targetPrice)}</strong> para assumir o 1º lugar.</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.75rem;color:var(--text-muted)">Preço sugerido</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--green)">${formatCurrency(s.targetPrice)}</div>
          </div>
        </div>
      `).join('');
    }
  }
}
