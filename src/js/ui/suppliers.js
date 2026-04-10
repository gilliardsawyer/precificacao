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
  const compareHeaderName = document.getElementById('licCompareProductName');
  const compareHeaderCategory = document.getElementById('licCompareProductCategory');
  const compareTechDescription = document.getElementById('licCompareTechDescription');
  const compareMinWarning = document.getElementById('supplierCompareMinWarning');
  const compareSupplierCount = document.getElementById('licCompareSupplierCount');
  const compareMinPrice = document.getElementById('licCompareMinPrice');
  const compareMaxPrice = document.getElementById('licCompareMaxPrice');
  const compareAvgPrice = document.getElementById('licCompareAvgPrice');
  const compareTableBody = document.getElementById('supplierCompareTableBody');
  const reportsContainer = document.getElementById('supplierReportsContainer');
  const cancelEditButton = document.getElementById('cancelProductSupplierEditBtn');
  const minSuppliersWarning = document.getElementById('supplierMinWarning');

  const fields = {
    id: document.getElementById('editingProductSupplierId'),
    productId: document.getElementById('supplierProductSelect'),
    supplierName: document.getElementById('supplierCompanyName'),
    supplierDocument: document.getElementById('supplierCompanyDocument'),
    brand: document.getElementById('supplierBrand'),
    model: document.getElementById('supplierModel'),
    quotedPrice: document.getElementById('supplierQuotedPrice'),
    leadTimeDays: document.getElementById('supplierLeadTime'),
    warranty: document.getElementById('supplierWarranty'),
    proposalValidity: document.getElementById('supplierProposalValidity'),
    quoteDate: document.getElementById('supplierQuoteDate'),
    meetsMinimum: document.getElementById('supplierMeetsMinimum'),
    techCharacteristics: document.getElementById('supplierTechCharacteristics'),
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
      tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum vínculo de fornecedor cadastrado ainda.</td></tr>';
      return;
    }

    const meetsBadge = (value) => {
      if (value === false || value === 'no') return '<span class="badge-category cat-fiscal">Não</span>';
      if (value === true || value === 'yes') return '<span class="badge-category cat-societario">Sim</span>';
      return '<span class="badge-category cat-outros">—</span>';
    };

    tableBody.innerHTML = relations.map((relation) => `
      <tr data-product-supplier-id="${relation.id}">
        <td>${escapeHtml(getProductLabel(relation, productMap))}</td>
        <td>${escapeHtml(relation.supplierName || '—')}</td>
        <td>${escapeHtml(`${relation.brand || '—'}${relation.model ? ` / ${relation.model}` : ''}`)}</td>
        <td style="text-align:right;">${toNumber(relation.quotedPrice) > 0 ? formatCurrency(relation.quotedPrice) : '—'}</td>
        <td style="text-align:center;">${relation.leadTimeDays ? `${escapeHtml(String(relation.leadTimeDays))} dias` : '—'}</td>
        <td style="text-align:center;">${escapeHtml(relation.warranty || '—')}</td>
        <td style="text-align:center;">${escapeHtml(relation.proposalValidity || '—')}</td>
        <td style="text-align:center;">${meetsBadge(relation.meetsMinimum)}</td>
        <td style="text-align:center;">${escapeHtml(relation.quoteDate || '—')}</td>
        <td>${escapeHtml(relation.techCharacteristics || '—')}</td>
        <td>${escapeHtml(relation.notes || '—')}</td>
        <td style="text-align:center; display:flex; gap:4px; justify-content:center;">
          <button type="button" class="product-action-btn edit" data-action="edit-product-supplier" data-id="${relation.id}" title="Editar">✏️</button>
          <button type="button" class="product-action-btn delete" data-action="delete-product-supplier" data-id="${relation.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function renderComparison() {
    if (!comparisonContainer || !compareTableBody) return;

    const selectedProductId = compareFilter?.value || '';
    const products = getProducts();
    const productMap = getProductMap();
    const product = products.find((p) => p.id === selectedProductId);

    if (!selectedProductId || !product) {
      if (compareHeaderName) compareHeaderName.textContent = 'Selecione um produto para comparar';
      if (compareHeaderCategory) compareHeaderCategory.textContent = '—';
      if (compareTechDescription) compareTechDescription.textContent = '—';
      if (compareMinWarning) compareMinWarning.style.display = 'none';
      if (compareSupplierCount) compareSupplierCount.textContent = '0';
      if (compareMinPrice) compareMinPrice.textContent = formatCurrency(0);
      if (compareMaxPrice) compareMaxPrice.textContent = formatCurrency(0);
      if (compareAvgPrice) compareAvgPrice.textContent = formatCurrency(0);
      compareTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Selecione um produto para ver o comparativo.</td></tr>';
      return;
    }

    if (compareHeaderName) compareHeaderName.textContent = product.name || 'Produto base';
    if (compareHeaderCategory) compareHeaderCategory.textContent = product.category ? `Categoria: ${product.category}` : 'Categoria: —';
    if (compareTechDescription) compareTechDescription.textContent = product.technicalDescription?.trim() || '—';

    const allLinks = loadProductSuppliers().filter((relation) => relation.productId === selectedProductId);
    const bySupplierKey = new Map();
    allLinks.forEach((relation) => {
      const key = `${(relation.supplierName || '').trim().toLowerCase()}::${(relation.supplierDocument || '').trim().toLowerCase()}`;
      const current = bySupplierKey.get(key);
      const currentDate = current?.quoteDate ? new Date(`${current.quoteDate}T12:00:00`) : null;
      const nextDate = relation.quoteDate ? new Date(`${relation.quoteDate}T12:00:00`) : null;
      const currentTime = currentDate && !Number.isNaN(currentDate.getTime()) ? currentDate.getTime() : 0;
      const nextTime = nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate.getTime() : 0;

      if (!current || nextTime > currentTime) {
        bySupplierKey.set(key, relation);
      }
    });

    const offers = [...bySupplierKey.values()].sort((a, b) => {
      const aMeets = a.meetsMinimum === false ? 0 : 1;
      const bMeets = b.meetsMinimum === false ? 0 : 1;
      if (aMeets !== bMeets) return bMeets - aMeets;
      return toNumber(a.quotedPrice) - toNumber(b.quotedPrice);
    });

    if (compareSupplierCount) compareSupplierCount.textContent = String(offers.length);
    if (compareMinWarning) compareMinWarning.style.display = offers.length < 3 ? 'block' : 'none';

    const priceValues = offers.map((o) => toNumber(o.quotedPrice)).filter((v) => v > 0);
    const min = priceValues.length ? Math.min(...priceValues) : 0;
    const max = priceValues.length ? Math.max(...priceValues) : 0;
    const avg = priceValues.length ? (priceValues.reduce((a, b) => a + b, 0) / priceValues.length) : 0;
    if (compareMinPrice) compareMinPrice.textContent = formatCurrency(min);
    if (compareMaxPrice) compareMaxPrice.textContent = formatCurrency(max);
    if (compareAvgPrice) compareAvgPrice.textContent = formatCurrency(avg);

    const meetsBadge = (value) => {
      if (value === false || value === 'no') return '<span class="badge-category cat-fiscal">Não</span>';
      if (value === true || value === 'yes') return '<span class="badge-category cat-societario">Sim</span>';
      return '<span class="badge-category cat-outros">—</span>';
    };

    compareTableBody.innerHTML = offers.length ? offers.map((offer) => {
      const price = toNumber(offer.quotedPrice);
      const isMin = priceValues.length && price > 0 && price === min;
      const meets = !(offer.meetsMinimum === false || offer.meetsMinimum === 'no');
      const rowClass = `${isMin ? 'compare-row-min' : ''} ${meets ? 'compare-row-meets' : ''}`.trim();
      const priceClass = isMin ? 'compare-price-min' : '';
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(offer.supplierName || '—')}</td>
          <td>${escapeHtml(offer.brand || '—')}</td>
          <td>${escapeHtml(offer.model || '—')}</td>
          <td style="text-align:right;" class="${priceClass}">${price > 0 ? formatCurrency(price) : '—'}</td>
          <td style="text-align:center;">${offer.leadTimeDays ? `${escapeHtml(String(offer.leadTimeDays))} dias` : '—'}</td>
          <td style="text-align:center;">${escapeHtml(offer.warranty || '—')}</td>
          <td style="text-align:center;">${meetsBadge(offer.meetsMinimum)}</td>
          <td>${escapeHtml(offer.notes || '—')}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum fornecedor vinculado a este produto ainda.</td></tr>';
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
    fields.brand.value = relation.brand || '';
    fields.model.value = relation.model || '';
    fields.quotedPrice.value = relation.quotedPrice || 0;
    fields.leadTimeDays.value = relation.leadTimeDays || '';
    fields.warranty.value = relation.warranty || '';
    fields.proposalValidity.value = relation.proposalValidity || '';
    fields.quoteDate.value = relation.quoteDate || '';
    fields.meetsMinimum.value = (relation.meetsMinimum === false || relation.meetsMinimum === 'no') ? 'no' : 'yes';
    fields.techCharacteristics.value = relation.techCharacteristics || '';
    fields.notes.value = relation.notes || '';
    const submitButton = document.getElementById('saveProductSupplierBtn');
    if (submitButton) {
      submitButton.textContent = 'Atualizar vínculo';
    }
    cancelEditButton?.classList.remove('hidden');
    updateMinSuppliersWarning();
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
    updateMinSuppliersWarning();
  }

  function updateMinSuppliersWarning() {
    if (!minSuppliersWarning || !fields.productId) return;
    const productId = fields.productId.value || '';
    if (!productId) {
      minSuppliersWarning.style.display = 'none';
      return;
    }
    const count = loadProductSuppliers().filter((entry) => entry.productId === productId).length;
    minSuppliersWarning.style.display = count < 3 ? 'block' : 'none';
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
      brand: fields.brand.value.trim(),
      model: fields.model.value.trim(),
      quotedPrice: Math.max(0, toNumber(fields.quotedPrice.value)),
      leadTimeDays: Math.max(0, Math.round(toNumber(fields.leadTimeDays.value))),
      warranty: fields.warranty.value.trim(),
      proposalValidity: fields.proposalValidity.value.trim(),
      quoteDate: fields.quoteDate.value || '',
      meetsMinimum: fields.meetsMinimum.value === 'no' ? false : true,
      techCharacteristics: fields.techCharacteristics.value.trim(),
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
  fields.productId?.addEventListener('change', updateMinSuppliersWarning);
  window.addEventListener('products:updated', refreshAll);

  refreshAll();
  resetForm();
}
