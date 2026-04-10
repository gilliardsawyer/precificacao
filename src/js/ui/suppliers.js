import { loadProducts, loadProductSuppliers, updateProductSuppliers } from '../storage/local.js';
import { formatCurrency, formatPercent, escapeHtml, toNumber } from '../core/utils.js';
import { showNotification } from './toasts.js';

export function setupSuppliersHub() {
  const module = document.getElementById('module-suppliers');
  if (!module) return;

  const form = document.getElementById('productSupplierForm');
  const tableBody = document.getElementById('productSupplierTableBody');
  const compareFilter = document.getElementById('supplierCompareProductFilter');
  const comparisonContainer = document.getElementById('supplierComparisonContainer');
  const reportsContainer = document.getElementById('supplierReportsContainer');
  const cancelEditButton = document.getElementById('cancelProductSupplierEditBtn');

  const fields = {
    id: document.getElementById('editingProductSupplierId'),
    productId: document.getElementById('supplierProductSelect'),
    supplierName: document.getElementById('supplierCompanyName'),
    supplierDocument: document.getElementById('supplierCompanyDocument'),
    quotedPrice: document.getElementById('supplierQuotedPrice'),
    leadTimeDays: document.getElementById('supplierLeadTime'),
    quoteDate: document.getElementById('supplierQuoteDate'),
    notes: document.getElementById('supplierNotes')
  };

  const reportFields = {
    productsCount: document.getElementById('supplierReportProductsCount'),
    suppliersCount: document.getElementById('supplierReportSuppliersCount'),
    averageQuotes: document.getElementById('supplierReportAverageQuotes'),
    uncoveredCount: document.getElementById('supplierReportUncoveredCount')
  };

  function getProducts() {
    return loadProducts();
  }

  function getProductMap() {
    return new Map(getProducts().map((product) => [product.id, product]));
  }

  function getProductLabel(relation, productMap = getProductMap()) {
    const product = productMap.get(relation.productId);
    return product?.name || relation.productNameSnapshot || 'Produto removido';
  }

  function fillProductSelectOptions() {
    const products = getProducts();
    const selectedFormValue = fields.productId?.value || '';
    const selectedCompareValue = compareFilter?.value || '';

    const optionsHtml = [
      '<option value="">Selecione um produto</option>',
      ...products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`)
    ].join('');

    if (fields.productId) {
      fields.productId.innerHTML = optionsHtml;
      fields.productId.value = products.some((product) => product.id === selectedFormValue) ? selectedFormValue : '';
    }

    if (compareFilter) {
      compareFilter.innerHTML = [
        '<option value="">Todos os produtos</option>',
        ...products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`)
      ].join('');
      compareFilter.value = products.some((product) => product.id === selectedCompareValue) ? selectedCompareValue : '';
    }
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    fields.id.value = '';
    const submitButton = document.getElementById('saveProductSupplierBtn');
    if (submitButton) {
      submitButton.textContent = 'Salvar vínculo';
    }
    cancelEditButton?.classList.add('hidden');
  }

  function renderSupplierLinks() {
    if (!tableBody) return;

    const productMap = getProductMap();
    const relations = [...loadProductSuppliers()].sort((a, b) => {
      const productCompare = getProductLabel(a, productMap).localeCompare(getProductLabel(b, productMap));
      if (productCompare !== 0) return productCompare;
      return (a.supplierName || '').localeCompare(b.supplierName || '');
    });

    if (!relations.length) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum vínculo de fornecedor cadastrado ainda.</td></tr>';
      return;
    }

    tableBody.innerHTML = relations.map((relation) => `
      <tr data-product-supplier-id="${relation.id}">
        <td>${escapeHtml(getProductLabel(relation, productMap))}</td>
        <td>${escapeHtml(relation.supplierName || '—')}</td>
        <td>${escapeHtml(relation.supplierDocument || '—')}</td>
        <td style="text-align:right;">${formatCurrency(relation.quotedPrice)}</td>
        <td style="text-align:center;">${relation.leadTimeDays ? `${escapeHtml(String(relation.leadTimeDays))} dias` : '—'}</td>
        <td style="text-align:center;">${escapeHtml(relation.quoteDate || '—')}</td>
        <td>${escapeHtml(relation.notes || '—')}</td>
        <td style="text-align:center; display:flex; gap:4px; justify-content:center;">
          <button type="button" class="product-action-btn edit" data-action="edit-product-supplier" data-id="${relation.id}" title="Editar">✏️</button>
          <button type="button" class="product-action-btn delete" data-action="delete-product-supplier" data-id="${relation.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function renderComparison() {
    if (!comparisonContainer) return;

    const selectedProductId = compareFilter?.value || '';
    const productMap = getProductMap();
    const relations = loadProductSuppliers().filter((relation) => !selectedProductId || relation.productId === selectedProductId);

    const grouped = new Map();
    relations.forEach((relation) => {
      if (!grouped.has(relation.productId)) {
        grouped.set(relation.productId, []);
      }
      grouped.get(relation.productId).push(relation);
    });

    if (!grouped.size) {
      comparisonContainer.innerHTML = '<div class="dashboard-empty">Nenhum comparativo disponível. Cadastre fornecedores vinculados a produtos primeiro.</div>';
      return;
    }

    comparisonContainer.innerHTML = [...grouped.entries()].map(([productId, offers]) => {
      const productName = getProductLabel(offers[0], productMap);
      const sorted = [...offers].sort((a, b) => toNumber(a.quotedPrice) - toNumber(b.quotedPrice));
      const best = sorted[0];
      const highest = sorted[sorted.length - 1];
      const spread = Math.max(0, toNumber(highest.quotedPrice) - toNumber(best.quotedPrice));
      const spreadPercent = toNumber(best.quotedPrice) > 0 ? (spread / toNumber(best.quotedPrice)) * 100 : 0;

      return `
        <div class="dashboard-panel">
          <div class="dashboard-panel-header">
            <h3>${escapeHtml(productName)}</h3>
            <p>${sorted.length} cotação(ões) cadastrada(s)</p>
          </div>
          <div class="dashboard-list">
            <article class="dashboard-item">
              <div>
                <strong>Melhor oferta</strong>
                <small>${escapeHtml(best.supplierName || 'Fornecedor não informado')}</small>
              </div>
              <div class="dashboard-metrics">
                <span>${formatCurrency(best.quotedPrice)}</span>
                <small>Prazo ${best.leadTimeDays ? `${escapeHtml(String(best.leadTimeDays))} dia(s)` : 'não informado'}</small>
              </div>
            </article>
            <article class="dashboard-item">
              <div>
                <strong>Amplitude de preço</strong>
                <small>Diferença entre menor e maior cotação</small>
              </div>
              <div class="dashboard-metrics">
                <span>${formatCurrency(spread)}</span>
                <small>${formatPercent(spreadPercent)}</small>
              </div>
            </article>
            ${sorted.slice(0, 4).map((offer, index) => `
              <article class="dashboard-item">
                <div>
                  <strong>${index + 1}º ${escapeHtml(offer.supplierName || 'Fornecedor')}</strong>
                  <small>${escapeHtml(offer.supplierDocument || 'Documento não informado')}</small>
                </div>
                <div class="dashboard-metrics">
                  <span>${formatCurrency(offer.quotedPrice)}</span>
                  <small>${offer.quoteDate ? escapeHtml(offer.quoteDate) : 'Sem data'}</small>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderReports() {
    if (!reportsContainer) return;

    const products = getProducts();
    const productMap = getProductMap();
    const relations = loadProductSuppliers();

    const uniqueSuppliers = new Set(relations.map((relation) => {
      const name = (relation.supplierName || '').trim().toLowerCase();
      const document = (relation.supplierDocument || '').trim().toLowerCase();
      return `${name}::${document}`;
    }).filter(Boolean));

    const coveredProducts = new Set(relations.map((relation) => relation.productId).filter(Boolean));
    const averageQuotes = coveredProducts.size > 0 ? relations.length / coveredProducts.size : 0;

    if (reportFields.productsCount) reportFields.productsCount.textContent = String(products.length);
    if (reportFields.suppliersCount) reportFields.suppliersCount.textContent = String(uniqueSuppliers.size);
    if (reportFields.averageQuotes) reportFields.averageQuotes.textContent = averageQuotes.toFixed(1).replace('.', ',');
    if (reportFields.uncoveredCount) reportFields.uncoveredCount.textContent = String(Math.max(0, products.length - coveredProducts.size));

    if (!relations.length) {
      reportsContainer.innerHTML = '<div class="dashboard-empty">Ainda não há dados suficientes para gerar relatórios.</div>';
      return;
    }

    const perSupplier = new Map();
    const bestOfferByProduct = new Map();

    relations.forEach((relation) => {
      const key = `${(relation.supplierName || '').trim()}::${(relation.supplierDocument || '').trim()}`;
      const supplierEntry = perSupplier.get(key) || {
        supplierName: relation.supplierName || 'Fornecedor sem nome',
        supplierDocument: relation.supplierDocument || '',
        quotes: 0,
        quotedAmount: 0,
        products: new Set()
      };
      supplierEntry.quotes += 1;
      supplierEntry.quotedAmount += toNumber(relation.quotedPrice);
      supplierEntry.products.add(getProductLabel(relation, productMap));
      perSupplier.set(key, supplierEntry);

      const currentBest = bestOfferByProduct.get(relation.productId);
      if (!currentBest || toNumber(relation.quotedPrice) < toNumber(currentBest.quotedPrice)) {
        bestOfferByProduct.set(relation.productId, relation);
      }
    });

    const supplierRows = [...perSupplier.values()]
      .map((entry) => {
        let bestWins = 0;
        bestOfferByProduct.forEach((bestRelation) => {
          const sameName = (bestRelation.supplierName || '') === entry.supplierName;
          const sameDocument = (bestRelation.supplierDocument || '') === entry.supplierDocument;
          if (sameName && sameDocument) {
            bestWins += 1;
          }
        });
        return {
          ...entry,
          bestWins,
          productCount: entry.products.size
        };
      })
      .sort((a, b) => b.bestWins - a.bestWins || b.quotes - a.quotes)
      .slice(0, 8);

    reportsContainer.innerHTML = supplierRows.map((entry) => `
      <article class="dashboard-item">
        <div>
          <strong>${escapeHtml(entry.supplierName)}</strong>
          <small>${escapeHtml(entry.supplierDocument || 'Documento não informado')} · ${entry.productCount} produto(s)</small>
        </div>
        <div class="dashboard-metrics">
          <span>${entry.bestWins} melhor(es) preço(s)</span>
          <small>${entry.quotes} cotação(ões) · ${formatCurrency(entry.quotedAmount)}</small>
        </div>
      </article>
    `).join('');
  }

  function editRelation(id) {
    const relation = loadProductSuppliers().find((entry) => entry.id === id);
    if (!relation) return;

    fields.id.value = relation.id;
    fields.productId.value = relation.productId || '';
    fields.supplierName.value = relation.supplierName || '';
    fields.supplierDocument.value = relation.supplierDocument || '';
    fields.quotedPrice.value = relation.quotedPrice || 0;
    fields.leadTimeDays.value = relation.leadTimeDays || '';
    fields.quoteDate.value = relation.quoteDate || '';
    fields.notes.value = relation.notes || '';
    const submitButton = document.getElementById('saveProductSupplierBtn');
    if (submitButton) {
      submitButton.textContent = 'Atualizar vínculo';
    }
    cancelEditButton?.classList.remove('hidden');
  }

  function deleteRelation(id) {
    if (!confirm('Deseja excluir este vínculo de fornecedor?')) return;

    updateProductSuppliers((relations) => relations.filter((relation) => relation.id !== id));
    showNotification('Vínculo removido com sucesso!', 'success');
    resetForm();
    refreshAll();
  }

  function refreshAll() {
    fillProductSelectOptions();
    renderSupplierLinks();
    renderComparison();
    renderReports();
  }

  if (tableBody) {
    tableBody.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      const id = actionButton.dataset.id;
      if (actionButton.dataset.action === 'edit-product-supplier') {
        editRelation(id);
      }
      if (actionButton.dataset.action === 'delete-product-supplier') {
        deleteRelation(id);
      }
    });
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!fields.productId.value) {
      showNotification('Selecione um produto para vincular o fornecedor.', 'warning');
      return;
    }
    if (!fields.supplierName.value.trim()) {
      showNotification('Informe o nome do fornecedor.', 'warning');
      return;
    }

    const product = getProductMap().get(fields.productId.value);
    const entry = {
      id: fields.id.value || crypto.randomUUID(),
      productId: fields.productId.value,
      productNameSnapshot: product?.name || '',
      supplierName: fields.supplierName.value.trim(),
      supplierDocument: fields.supplierDocument.value.trim(),
      quotedPrice: Math.max(0, toNumber(fields.quotedPrice.value)),
      leadTimeDays: Math.max(0, Math.round(toNumber(fields.leadTimeDays.value))),
      quoteDate: fields.quoteDate.value || '',
      notes: fields.notes.value.trim(),
      updatedAt: new Date().toISOString()
    };

    updateProductSuppliers((relations) => {
      if (fields.id.value) {
        return relations.map((relation) => relation.id === fields.id.value ? entry : relation);
      }
      return [...relations, entry];
    });

    showNotification(fields.id.value ? 'Vínculo atualizado com sucesso!' : 'Fornecedor vinculado ao produto!', 'success');
    resetForm();
    refreshAll();
  });

  cancelEditButton?.addEventListener('click', resetForm);
  compareFilter?.addEventListener('change', renderComparison);
  window.addEventListener('products:updated', refreshAll);

  refreshAll();
  resetForm();
}
