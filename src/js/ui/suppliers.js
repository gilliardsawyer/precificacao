import { loadProducts, loadProductSuppliers, updateProductSuppliers, loadSuppliers, updateSuppliers, upsertSupplierByDocumentOrName } from '../storage/local.js';
import { formatCurrency, formatPercent, escapeHtml, toNumber } from '../core/utils.js';
import { showNotification } from './toasts.js';

export function setupSuppliersHub() {
  const module = document.getElementById('module-suppliers');
  if (!module) return;

  const globalSearchInput = document.getElementById('productSearchInput');
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
  const historyFilter = document.getElementById('supplierHistoryFilter');
  const historyTableBody = document.getElementById('supplierHistoryTableBody');
  const expiredCountEl = document.getElementById('supplierExpiredCount');
  const expiredHintEl = document.getElementById('supplierExpiredHint');
  const supplierRegistrySearch = document.getElementById('supplierRegistrySearch');
  const supplierRegistryBody = document.getElementById('supplierRegistryTableBody');
  const openSupplierModalBtn = document.getElementById('openSupplierModalBtn');
  const supplierModal = document.getElementById('addSupplierModal');
  const supplierForm = document.getElementById('supplierForm');
  const closeSupplierModalBtn = document.getElementById('closeSupplierModalBtn');
  const reportsContainer = document.getElementById('supplierReportsContainer');
  const cancelEditButton = document.getElementById('cancelProductSupplierEditBtn');
  const minSuppliersWarning = document.getElementById('supplierMinWarning');

  const fields = {
    id: document.getElementById('editingProductSupplierId'),
    productId: document.getElementById('supplierProductSelect'),
    supplierName: document.getElementById('supplierCompanyName'),
    supplierDocument: document.getElementById('supplierCompanyDocument'),
    supplierId: document.getElementById('supplierId'),
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

  function getGlobalSearchTerm() {
    return (globalSearchInput?.value || '').trim().toLowerCase();
  }

  function highlightHtml(text, term) {
    const source = (text || '').toString();
    const query = (term || '').trim();
    if (!query) return escapeHtml(source);
    const escaped = escapeHtml(source);
    const safe = escapeHtml(query);
    try {
      const re = new RegExp(`(${safe.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'ig');
      return escaped.replace(re, '<mark class="search-highlight">$1</mark>');
    } catch {
      return escaped;
    }
  }

  function parseValidityToDays(text) {
    const raw = (text || '').toString().trim().toLowerCase();
    if (!raw) return null;
    const match = raw.match(/(\d+)/);
    if (!match) return null;
    const value = Math.max(0, Number(match[1]));
    if (!Number.isFinite(value) || value === 0) return null;
    if (raw.includes('ano')) return value * 365;
    if (raw.includes('mes')) return value * 30;
    return value; // default dias
  }

  function computeExpiryDate(quoteDate, proposalValidity) {
    if (!quoteDate) return null;
    const base = new Date(`${quoteDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    const days = parseValidityToDays(proposalValidity);
    if (!days) return null;
    const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return expires;
  }

  function isExpiredQuote(quoteDate, proposalValidity) {
    const expires = computeExpiryDate(quoteDate, proposalValidity);
    if (!expires) return false;
    return Date.now() > expires.getTime();
  }

  function getProductMap() {
    return new Map(getProducts().map((product) => [product.id, product]));
  }

  function getSupplierMap() {
    return new Map(loadSuppliers().map((s) => [s.id, s]));
  }

  function normalizeSupplierKey(name, document) {
    return `${(name || '').trim().toLowerCase()}::${(document || '').trim().toLowerCase()}`;
  }

  function normalizeDocument(document) {
    return (document || '').toString().replace(/\D/g, '');
  }

  function resolveSupplierFromInputs(name, document) {
    const suppliers = loadSuppliers();
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedDoc = normalizeDocument(document);

    if (normalizedDoc) {
      const byDoc = suppliers.find((s) => normalizeDocument(s.document) === normalizedDoc);
      if (byDoc) return byDoc;
    }

    if (normalizedName) {
      const byName = suppliers.find((s) => (s.name || '').trim().toLowerCase() === normalizedName);
      if (byName) return byName;
    }

    return null;
  }

  function ensureSupplierForRelation(relation) {
    if (relation.supplierId) return relation.supplierId;
    const name = (relation.supplierName || '').trim();
    if (!name) return null;
    return upsertSupplierByDocumentOrName({
      name,
      document: (relation.supplierDocument || '').trim()
    });
  }

  function migrateRelationsToSupplierIds() {
    const relations = loadProductSuppliers();
    let changed = false;
    const next = relations.map((r) => {
      if (r.supplierId) return r;
      const supplierId = ensureSupplierForRelation(r);
      if (!supplierId) return r;
      changed = true;
      return { ...r, supplierId };
    });
    if (changed) {
      updateProductSuppliers(() => next);
    }
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
    if (fields.supplierId) fields.supplierId.value = '';
    const submitButton = document.getElementById('saveProductSupplierBtn');
    if (submitButton) {
      submitButton.textContent = 'Salvar vínculo';
    }
    cancelEditButton?.classList.add('hidden');
  }

  function syncSupplierFromInputs(preferDocument = false) {
    if (!fields.supplierId || !fields.supplierName || !fields.supplierDocument) return;

    const currentSupplierId = (fields.supplierId.value || '').trim();
    const name = fields.supplierName.value || '';
    const document = fields.supplierDocument.value || '';

    if (currentSupplierId) {
      const supplier = getSupplierMap().get(currentSupplierId);
      if (!supplier) {
        fields.supplierId.value = '';
        return;
      }

      const sameName = (supplier.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase();
      const supDoc = normalizeDocument(supplier.document);
      const doc = normalizeDocument(document);
      const sameDoc = !supDoc || !doc ? true : supDoc === doc;

      // If user changed values away from the selected supplier, we release the selection.
      if (!sameName || !sameDoc) {
        fields.supplierId.value = '';
      }
      return;
    }

    const resolved = resolveSupplierFromInputs(name, document);
    if (!resolved) return;

    fields.supplierId.value = resolved.id;

    if (preferDocument || !fields.supplierName.value.trim()) {
      fields.supplierName.value = resolved.name || fields.supplierName.value;
    }
    if (!fields.supplierDocument.value.trim() && resolved.document) {
      fields.supplierDocument.value = resolved.document;
    }
  }

  function renderSupplierLinks() {
    if (!tableBody) return;

    const productMap = getProductMap();
    const supplierMap = getSupplierMap();
    const term = getGlobalSearchTerm();
    const relations = [...loadProductSuppliers()].sort((a, b) => {
      const productCompare = getProductLabel(a, productMap).localeCompare(getProductLabel(b, productMap));
      if (productCompare !== 0) return productCompare;
      const aSupplier = a.supplierId ? supplierMap.get(a.supplierId) : null;
      const bSupplier = b.supplierId ? supplierMap.get(b.supplierId) : null;
      const aName = (aSupplier?.name || a.supplierName || '').toString();
      const bName = (bSupplier?.name || b.supplierName || '').toString();
      return aName.localeCompare(bName);
    });

    if (!relations.length) {
      tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum vínculo de fornecedor cadastrado ainda.</td></tr>';
      return;
    }

    const filtered = term
      ? relations.filter((relation) => {
        const supplier = relation.supplierId ? supplierMap.get(relation.supplierId) : null;
        const supplierName = supplier?.name || relation.supplierName || '';
        const supplierDocument = supplier?.document || relation.supplierDocument || '';
        const haystack = [
          getProductLabel(relation, productMap),
          supplierName,
          supplierDocument,
          relation.brand,
          relation.model,
          relation.warranty,
          relation.proposalValidity,
          relation.techCharacteristics,
          relation.notes
        ].join(' ').toLowerCase();
        return haystack.includes(term);
      })
      : relations;

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum vínculo encontrado para a busca atual.</td></tr>';
      return;
    }

    const meetsBadge = (value) => {
      if (value === false || value === 'no') return '<span class="badge-category cat-fiscal">Não</span>';
      if (value === true || value === 'yes') return '<span class="badge-category cat-societario">Sim</span>';
      return '<span class="badge-category cat-outros">—</span>';
    };

    tableBody.innerHTML = filtered.map((relation) => {
      const supplier = relation.supplierId ? supplierMap.get(relation.supplierId) : null;
      const supplierName = supplier?.name || relation.supplierName || '—';
      const supplierDoc = supplier?.document || relation.supplierDocument || '';
      return `
      <tr data-product-supplier-id="${relation.id}">
        <td class="supplier-product-cell">${highlightHtml(getProductLabel(relation, productMap), term)}</td>
        <td class="supplier-name-cell">${highlightHtml(supplierName, term)}${supplierDoc ? `<div style="font-size:0.75rem;color:var(--text-muted)">${highlightHtml(supplierDoc, term)}</div>` : ''}</td>
        <td class="supplier-brand-cell">${highlightHtml(`${relation.brand || '—'}${relation.model ? ` / ${relation.model}` : ''}`, term)}</td>
        <td style="text-align:right;">${toNumber(relation.quotedPrice) > 0 ? formatCurrency(relation.quotedPrice) : '—'}</td>
        <td style="text-align:center;">${relation.leadTimeDays ? `${escapeHtml(String(relation.leadTimeDays))} dias` : '—'}</td>
        <td style="text-align:center;">${escapeHtml(relation.warranty || '—')}</td>
        <td style="text-align:center;">${escapeHtml(relation.proposalValidity || '—')}</td>
        <td style="text-align:center;">${meetsBadge(relation.meetsMinimum)}</td>
        <td style="text-align:center;">${escapeHtml(relation.quoteDate || '—')}</td>
        <td class="supplier-tech-cell">${highlightHtml(relation.techCharacteristics || '—', term)}</td>
        <td class="supplier-notes-cell">${highlightHtml(relation.notes || '—', term)}</td>
        <td class="supplier-actions-cell" style="text-align:center; display:flex; gap:4px; justify-content:center;">
          <button type="button" class="product-action-btn edit" data-action="edit-product-supplier" data-id="${relation.id}" title="Editar">✏️</button>
          <button type="button" class="product-action-btn delete" data-action="delete-product-supplier" data-id="${relation.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
    }).join('');
  }

  function renderComparison() {
    if (!comparisonContainer || !compareTableBody) return;

    const selectedProductId = compareFilter?.value || '';
    const term = getGlobalSearchTerm();
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
    const supplierMap = getSupplierMap();
    const bySupplierKey = new Map();
    allLinks.forEach((relation) => {
      const key = relation.supplierId || normalizeSupplierKey(relation.supplierName, relation.supplierDocument);
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
      const supplier = offer.supplierId ? supplierMap.get(offer.supplierId) : null;
      const supplierName = supplier?.name || offer.supplierName || '—';
      const supplierDocument = supplier?.document || offer.supplierDocument || '';
      const show = !term || [
        supplierName,
        supplierDocument,
        offer.brand,
        offer.model,
        offer.warranty,
        offer.notes
      ].join(' ').toLowerCase().includes(term);
      if (!show) return '';
      return `
        <tr class="${rowClass}">
          <td>${highlightHtml(supplierName, term)}${supplierDocument ? `<div style="font-size:0.75rem;color:var(--text-muted)">${highlightHtml(supplierDocument, term)}</div>` : ''}</td>
          <td>${highlightHtml(offer.brand || '—', term)}</td>
          <td>${highlightHtml(offer.model || '—', term)}</td>
          <td style="text-align:right;" class="${priceClass}">${price > 0 ? formatCurrency(price) : '—'}</td>
          <td style="text-align:center;">${offer.leadTimeDays ? `${escapeHtml(String(offer.leadTimeDays))} dias` : '—'}</td>
          <td style="text-align:center;">${highlightHtml(offer.warranty || '—', term)}</td>
          <td style="text-align:center;">${meetsBadge(offer.meetsMinimum)}</td>
          <td>${highlightHtml(offer.notes || '—', term)}</td>
        </tr>
      `;
    }).join('').trim() || '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum fornecedor encontrado para a busca atual.</td></tr>' : '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum fornecedor vinculado a este produto ainda.</td></tr>';
  }

  function renderReports() {
    if (!reportsContainer) return;

    const products = getProducts();
    const productMap = getProductMap();
    const relations = loadProductSuppliers();
    const supplierMap = getSupplierMap();

    const getSupplierKey = (relation) => {
      if (relation?.supplierId) return relation.supplierId;
      const key = normalizeSupplierKey(relation?.supplierName, relation?.supplierDocument);
      if (key && key !== '::') return key;
      return relation?.id ? `relation:${relation.id}` : '';
    };

    const uniqueSuppliers = new Set(relations.map(getSupplierKey).filter(Boolean));

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
      const key = getSupplierKey(relation);
      const supplier = relation.supplierId ? supplierMap.get(relation.supplierId) : null;
      const supplierNameResolved = supplier?.name || relation.supplierName || 'Fornecedor sem nome';
      const supplierDocumentResolved = supplier?.document || relation.supplierDocument || '';
      const supplierEntry = perSupplier.get(key) || {
        supplierKey: key,
        supplierName: supplierNameResolved,
        supplierDocument: supplierDocumentResolved,
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
          if (getSupplierKey(bestRelation) === entry.supplierKey) {
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

  function renderSupplierHistory() {
    if (!historyTableBody) return;

    const productMap = getProductMap();
    const supplierMap = getSupplierMap();
    const term = (historyFilter?.value || '').trim().toLowerCase();

    const relations = loadProductSuppliers().map((relation) => {
      const expiresAt = computeExpiryDate(relation.quoteDate, relation.proposalValidity);
      const expired = isExpiredQuote(relation.quoteDate, relation.proposalValidity);
      const supplier = relation.supplierId ? supplierMap.get(relation.supplierId) : null;
      return {
        ...relation,
        productLabel: getProductLabel(relation, productMap),
        expiresAt,
        expired,
        supplierNameResolved: supplier?.name || relation.supplierName || '',
        supplierDocumentResolved: supplier?.document || relation.supplierDocument || ''
      };
    });

    const expiredCount = relations.filter((r) => r.expired).length;
    if (expiredCountEl) expiredCountEl.textContent = String(expiredCount);
    if (expiredHintEl) expiredHintEl.textContent = expiredCount ? 'Revise validade e recote' : 'Sem alertas';
    if (expiredHintEl) expiredHintEl.style.color = expiredCount ? 'var(--warning)' : 'var(--text-muted)';

    if (!relations.length) {
      historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhuma cotação cadastrada ainda.</td></tr>';
      return;
    }

    const filtered = term
      ? relations.filter((r) => {
        const haystack = [
          r.supplierNameResolved,
          r.supplierDocumentResolved,
          r.productLabel,
          r.brand,
          r.model,
          r.warranty,
          r.proposalValidity,
          r.notes
        ].join(' ').toLowerCase();
        return haystack.includes(term);
      })
      : relations;

    const sorted = filtered.sort((a, b) => {
      const ad = a.quoteDate ? new Date(`${a.quoteDate}T12:00:00`).getTime() : 0;
      const bd = b.quoteDate ? new Date(`${b.quoteDate}T12:00:00`).getTime() : 0;
      return bd - ad;
    });

    if (!sorted.length) {
      historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhuma cotação encontrada para o filtro.</td></tr>';
      return;
    }

    const statusBadge = (relation) => {
      if (relation.expired) return '<span class="badge-category cat-fiscal">Vencida</span>';
      if (relation.quoteDate && relation.proposalValidity) return '<span class="badge-category cat-societario">Válida</span>';
      return '<span class="badge-category cat-outros">Sem validade</span>';
    };

    historyTableBody.innerHTML = sorted.map((relation) => {
      const price = toNumber(relation.quotedPrice);
      const expiresLabel = relation.expiresAt
        ? relation.expiresAt.toLocaleDateString('pt-BR')
        : '—';
      const rowClass = relation.expired ? 'quote-expired' : '';
      return `
        <tr class="${rowClass}">
          <td>${highlightHtml(relation.supplierNameResolved || '—', term)}${relation.supplierDocumentResolved ? `<div style="font-size:0.75rem;color:var(--text-muted)">${highlightHtml(relation.supplierDocumentResolved, term)}</div>` : ''}</td>
          <td>${highlightHtml(relation.productLabel || '—', term)}</td>
          <td>${highlightHtml(relation.brand || '—', term)}</td>
          <td>${highlightHtml(relation.model || '—', term)}</td>
          <td style="text-align:right;">${price > 0 ? formatCurrency(price) : '—'}</td>
          <td style="text-align:center;">${escapeHtml(relation.quoteDate || '—')}</td>
          <td style="text-align:center;">${highlightHtml(relation.proposalValidity || '—', term)}${relation.expiresAt ? ` <span style="color:var(--text-muted); font-size:0.8rem;">(até ${expiresLabel})</span>` : ''}</td>
          <td style="text-align:center;">${statusBadge(relation)}</td>
        </tr>
      `;
    }).join('');
  }

  function editRelation(id) {
    const relation = loadProductSuppliers().find((entry) => entry.id === id);
    if (!relation) return;

    const supplierMap = getSupplierMap();
    const supplier = relation.supplierId ? supplierMap.get(relation.supplierId) : null;

    fields.id.value = relation.id;
    fields.productId.value = relation.productId || '';
    if (fields.supplierId) fields.supplierId.value = relation.supplierId || '';
    fields.supplierName.value = supplier?.name || relation.supplierName || '';
    fields.supplierDocument.value = supplier?.document || relation.supplierDocument || '';
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
    migrateRelationsToSupplierIds();
    fillProductSelectOptions();
    updateSupplierDatalist();
    renderSupplierLinks();
    renderComparison();
    renderReports();
    updateMinSuppliersWarning();
    renderSupplierHistory();
    renderSupplierRegistry();
  }

  function updateMinSuppliersWarning() {
    if (!minSuppliersWarning || !fields.productId) return;
    const productId = fields.productId.value || '';
    if (!productId) {
      minSuppliersWarning.style.display = 'none';
      return;
    }
    const links = loadProductSuppliers().filter((entry) => entry.productId === productId);
    const unique = new Set(links.map((e) => e.supplierId || normalizeSupplierKey(e.supplierName, e.supplierDocument)));
    const count = unique.size;
    minSuppliersWarning.style.display = count < 3 ? 'block' : 'none';
  }

  function renderSupplierRegistry() {
    if (!supplierRegistryBody) return;
    const term = (supplierRegistrySearch?.value || '').trim().toLowerCase();
    const suppliers = loadSuppliers();
    const filtered = term
      ? suppliers.filter((s) => `${s.name || ''} ${s.document || ''}`.toLowerCase().includes(term))
      : suppliers;

    if (!filtered.length) {
      supplierRegistryBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum fornecedor encontrado.</td></tr>';
      return;
    }

    supplierRegistryBody.innerHTML = filtered.map((s) => `
      <tr data-supplier-id="${s.id}">
        <td>${highlightHtml(s.name || '—', term)}</td>
        <td>${highlightHtml(s.document || '—', term)}</td>
        <td>${highlightHtml(s.contactName || '—', term)}</td>
        <td>${highlightHtml(s.phone || '—', term)}</td>
        <td>${highlightHtml(s.email || '—', term)}</td>
        <td style="text-align:center; display:flex; gap:4px; justify-content:center;">
          <button type="button" class="product-action-btn edit" data-action="edit-supplier" data-id="${s.id}" title="Editar">✏️</button>
          <button type="button" class="product-action-btn delete" data-action="delete-supplier" data-id="${s.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function updateSupplierDatalist() {
    const datalist = document.getElementById('supplierSuggestions');
    if (!datalist) return;
    const suppliers = loadSuppliers();
    const existing = [...datalist.querySelectorAll('option')].map((o) => (o.value || '').trim()).filter(Boolean);
    const names = [...new Set([...existing, ...suppliers.map((s) => (s.name || '').trim()).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">`).join('');
  }

  function openSupplierModal(supplier) {
    if (!supplierModal || !supplierForm) return;
    document.getElementById('editingSupplierId').value = supplier?.id || '';
    document.getElementById('supName').value = supplier?.name || '';
    document.getElementById('supDoc').value = supplier?.document || '';
    document.getElementById('supContactName').value = supplier?.contactName || '';
    document.getElementById('supPhone').value = supplier?.phone || '';
    document.getElementById('supEmail').value = supplier?.email || '';
    document.getElementById('supNotes').value = supplier?.notes || '';
    const saveBtn = document.getElementById('saveSupplierBtn');
    if (saveBtn) saveBtn.textContent = supplier ? 'Atualizar fornecedor' : 'Salvar fornecedor';
    supplierModal.style.display = 'flex';
  }

  function closeSupplierModal() {
    if (!supplierModal) return;
    supplierModal.style.display = 'none';
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
    const supplierId = (fields.supplierId?.value || '').trim() || upsertSupplierByDocumentOrName({
      name: fields.supplierName.value.trim(),
      document: fields.supplierDocument.value.trim()
    });

    if (!supplierId) {
      showNotification('Não foi possível identificar o fornecedor. Verifique o nome/CNPJ.', 'warning');
      return;
    }

    const supplierResolved = getSupplierMap().get(supplierId);
    const supplierNameResolved = supplierResolved?.name || fields.supplierName.value.trim();
    const supplierDocumentResolved = supplierResolved?.document || fields.supplierDocument.value.trim();

    const entry = {
      id: fields.id.value || crypto.randomUUID(),
      productId: fields.productId.value,
      productNameSnapshot: product?.name || '',
      supplierId,
      supplierName: supplierNameResolved,
      supplierDocument: supplierDocumentResolved,
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
    updateSupplierDatalist();
    refreshAll();
  });

  cancelEditButton?.addEventListener('click', resetForm);
  compareFilter?.addEventListener('change', renderComparison);
  fields.productId?.addEventListener('change', updateMinSuppliersWarning);
  fields.supplierName?.addEventListener('input', () => syncSupplierFromInputs(false));
  fields.supplierDocument?.addEventListener('input', () => syncSupplierFromInputs(true));
  fields.supplierName?.addEventListener('blur', () => syncSupplierFromInputs(false));
  fields.supplierDocument?.addEventListener('blur', () => syncSupplierFromInputs(true));
  window.addEventListener('products:updated', refreshAll);
  globalSearchInput?.addEventListener('input', () => {
    renderSupplierLinks();
    renderComparison();
    renderReports();
    updateMinSuppliersWarning();
  });
  globalSearchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      globalSearchInput.value = '';
      globalSearchInput.dispatchEvent(new Event('input'));
    }
  });
  historyFilter?.addEventListener('input', renderSupplierHistory);

  // Cadastro unico de fornecedores
  supplierRegistrySearch?.addEventListener('input', renderSupplierRegistry);

  openSupplierModalBtn?.addEventListener('click', () => openSupplierModal(null));
  closeSupplierModalBtn?.addEventListener('click', closeSupplierModal);
  supplierModal?.addEventListener('click', (event) => {
    if (event.target === supplierModal) {
      closeSupplierModal();
    }
  });

  supplierRegistryBody?.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const supplierId = actionButton.dataset.id;
    if (!supplierId) return;

    if (actionButton.dataset.action === 'edit-supplier') {
      const supplier = loadSuppliers().find((s) => s.id === supplierId);
      if (supplier) openSupplierModal(supplier);
      return;
    }

    if (actionButton.dataset.action === 'delete-supplier') {
      const used = loadProductSuppliers().some((r) => r.supplierId === supplierId);
      if (used) {
        showNotification('Este fornecedor está vinculado a produtos. Edite em vez de excluir.', 'warning');
        return;
      }
      if (!confirm('Deseja excluir este fornecedor do cadastro único?')) return;
      updateSuppliers((suppliers) => suppliers.filter((s) => s.id !== supplierId));
      showNotification('Fornecedor removido com sucesso!', 'success');
      updateSupplierDatalist();
      refreshAll();
      return;
    }
  });

  supplierForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const editingId = (document.getElementById('editingSupplierId')?.value || '').trim();
    const payload = {
      name: (document.getElementById('supName')?.value || '').trim(),
      document: (document.getElementById('supDoc')?.value || '').trim(),
      contactName: (document.getElementById('supContactName')?.value || '').trim(),
      phone: (document.getElementById('supPhone')?.value || '').trim(),
      email: (document.getElementById('supEmail')?.value || '').trim(),
      notes: (document.getElementById('supNotes')?.value || '').trim()
    };

    if (!payload.name) {
      showNotification('Informe o nome do fornecedor.', 'warning');
      return;
    }

    if (editingId) {
      const all = loadSuppliers();
      const normalizedDoc = normalizeDocument(payload.document);
      const conflict = normalizedDoc
        ? all.find((s) => s.id !== editingId && normalizeDocument(s.document) === normalizedDoc)
        : null;

      if (conflict) {
        showNotification('Já existe outro fornecedor com este CNPJ/Documento. Abra o existente para editar.', 'warning');
        return;
      }

      updateSuppliers((suppliers) => suppliers.map((s) => {
        if (s.id !== editingId) return s;
        return {
          ...s,
          ...payload,
          name: payload.name,
          document: payload.document,
          updatedAt: new Date().toISOString()
        };
      }));

      showNotification('Fornecedor atualizado com sucesso!', 'success');
    } else {
      upsertSupplierByDocumentOrName(payload);
      showNotification('Fornecedor salvo com sucesso!', 'success');
    }

    closeSupplierModal();
    updateSupplierDatalist();
    refreshAll();
  });

  refreshAll();
  resetForm();
}
