import { loadProducts, saveProducts, updateProducts, loadProductSuppliers, loadSuppliers } from '../storage/local.js';
import { formatCurrency, escapeHtml, toNumber } from '../core/utils.js';
import { getCategoryOptions, getUnitOptions, normalizeCategory, normalizeUnit } from '../core/catalogStandards.js';
import { showNotification } from './toasts.js';

/**
 * Inicializa o módulo de Cadastro de Produtos
 */
export function setupProducts() {
    const openModalBtn = document.getElementById('openAddProductModalBtn');
    const modal = document.getElementById('addProductModal');
    const closeModalBtn = document.getElementById('closeProductModalBtn');
    const productForm = document.getElementById('productForm');
    const searchInput = document.getElementById('productSearchInput');
    const categoryFilter = document.getElementById('productCategoryFilter');
    const container = document.getElementById('productContainer');
    const categoryInput = document.getElementById('prodCategory');
    const unitInput = document.getElementById('prodUnit');
    const categoryList = document.getElementById('productCategoryList');
    const unitList = document.getElementById('productUnitList');

    if (!container) return;

    const QUOTE_STALE_DAYS = 30;

    function normalizeText(value) {
        return (value || '').toString().trim().toLowerCase();
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

    function getSupplierStats(productId, supplierMap) {
        const links = loadProductSuppliers().filter((entry) => entry.productId === productId);
        if (!links.length) {
            return { supplierCount: 0, minPrice: null, quoteStatus: 'none' };
        }

        const supplierKeys = new Set();
        let minPrice = null;
        let latestQuoteDate = null;

        links.forEach((entry) => {
            const supplier = entry.supplierId ? supplierMap.get(entry.supplierId) : null;
            const supplierName = supplier?.name || entry.supplierName || '';
            const supplierDocument = supplier?.document || entry.supplierDocument || '';
            const key = entry.supplierId || `${normalizeText(supplierName)}::${normalizeText(supplierDocument)}`;
            if (key && key !== '::') supplierKeys.add(key);
            const price = toNumber(entry.quotedPrice);
            if (price > 0 && (minPrice === null || price < minPrice)) {
                minPrice = price;
            }
            if (entry.quoteDate) {
                const dt = new Date(`${entry.quoteDate}T12:00:00`);
                if (!Number.isNaN(dt.getTime()) && (!latestQuoteDate || dt > latestQuoteDate)) {
                    latestQuoteDate = dt;
                }
            }
        });

        const now = new Date();
        const isStale = latestQuoteDate
            ? (Math.floor((now.getTime() - latestQuoteDate.getTime()) / (1000 * 60 * 60 * 24)) > QUOTE_STALE_DAYS)
            : false;

        return {
            supplierCount: supplierKeys.size || links.length,
            minPrice,
            quoteStatus: isStale ? 'stale' : 'ok'
        };
    }

    function getQuoteBadge(status) {
        if (status === 'ok') return '<span class="badge-category cat-societario">Cotado</span>';
        if (status === 'stale') return '<span class="badge-category cat-tecnica">Desatualizado</span>';
        return '<span class="badge-category cat-outros">Sem cotação</span>';
    }

    function renderStandards(products = loadProducts()) {
        const categories = getCategoryOptions(products);
        const units = getUnitOptions(products);

        if (categoryList) {
            categoryList.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">`).join('');
        }

        if (unitList) {
            unitList.innerHTML = units.map((unit) => `<option value="${escapeHtml(unit)}">`).join('');
        }

        return { categories, units };
    }

    function renderCategoryFilter(products) {
        if (!categoryFilter) return;
        const current = categoryFilter.value || '';
        const { categories } = renderStandards(products);
        categoryFilter.innerHTML = [
            '<option value="">Todas as categorias</option>',
            ...categories.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
        ].join('');
        categoryFilter.value = categories.includes(current) ? current : '';
    }

    function renderProducts(term = '') {
        const products = loadProducts();
        const searchTerm = term.trim().toLowerCase();
        renderCategoryFilter(products);
        const selectedCategory = (categoryFilter?.value || '').trim();

        const links = loadProductSuppliers();
        const supplierMap = new Map(loadSuppliers().map((s) => [s.id, s]));
        const supplierIndexByProductId = new Map();
        links.forEach((entry) => {
            if (!entry.productId) return;
            const list = supplierIndexByProductId.get(entry.productId) || [];
            list.push(entry);
            supplierIndexByProductId.set(entry.productId, list);
        });

        const supplierStatsByProductId = new Map(
            products.map((product) => [product.id, getSupplierStats(product.id, supplierMap)])
        );
        
        const filtered = products.filter(p => {
            const matchName = (p.name || '').toLowerCase().includes(searchTerm);
            const related = supplierIndexByProductId.get(p.id) || [];
            const matchLinked = searchTerm
                ? related.some((r) => {
                    const supplier = r.supplierId ? supplierMap.get(r.supplierId) : null;
                    const supplierName = supplier?.name || r.supplierName || '';
                    const haystack = `${supplierName} ${r.brand || ''} ${r.model || ''}`.toLowerCase();
                    return haystack.includes(searchTerm);
                })
                : false;
            const matchCategory = !selectedCategory || normalizeCategory(p.category || '') === selectedCategory;
            return (matchName || matchLinked) && matchCategory;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                ${(term || selectedCategory) ? 'Nenhum produto encontrado para os filtros atuais.' : 'Nenhum produto cadastrado no catálogo.'}
            </td></tr>`;
            return;
        }

        container.innerHTML = filtered.map(product => `
            <tr data-product-id="${product.id}">
                <td class="product-name-cell">${highlightHtml(product.name, term)}</td>
                <td><span class="badge-category cat-outros">${highlightHtml(normalizeCategory(product.category || 'Outros'), term)}</span></td>
                <td style="text-align:center; font-weight:700;">${supplierStatsByProductId.get(product.id).supplierCount}</td>
                <td class="product-cost">${supplierStatsByProductId.get(product.id).minPrice === null ? '—' : formatCurrency(supplierStatsByProductId.get(product.id).minPrice)}</td>
                <td style="text-align:center;">${getQuoteBadge(supplierStatsByProductId.get(product.id).quoteStatus)}</td>
                <td style="text-align: center; display: flex; gap: 4px; justify-content: center;">
                    <button class="product-action-btn compare" title="Abrir comparativo" data-compare-id="${product.id}">📊</button>
                    <button class="product-action-btn edit" title="Editar" data-id="${product.id}">✏️</button>
                    <button class="product-action-btn delete" title="Excluir" data-id="${product.id}">🗑️</button>
                </td>
            </tr>
        `).join('');

        // Wire up buttons
        container.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', () => editProduct(btn.dataset.id));
        });
        container.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
        });
        container.querySelectorAll('[data-compare-id]').forEach(btn => {
            btn.addEventListener('click', () => openComparisonForProduct(btn.dataset.compareId));
        });
    }

    function editProduct(id) {
        const products = loadProducts();
        const product = products.find(p => p.id === id);
        if (!product) return;

        document.getElementById('editingProdId').value = product.id;
        document.getElementById('prodName').value = product.name || '';
        document.getElementById('prodCategory').value = normalizeCategory(product.category || '');
        document.getElementById('prodUnit').value = normalizeUnit(product.unit || 'UN');
        document.getElementById('prodStatus').value = product.status || 'active';
        document.getElementById('prodDescription').value = product.technicalDescription || '';

        document.getElementById('saveProductBtn').textContent = 'Atualizar Produto';
        modal.style.display = 'flex';
    }

    function deleteProduct(id) {
        if (!confirm('Deseja realmente excluir este produto do catálogo?')) return;
        
        const products = loadProducts();
        const updated = products.filter(p => p.id !== id);
        saveProducts(updated);
        
        showNotification('Produto removido com sucesso!', 'success');
        renderProducts(searchInput ? searchInput.value : '');
        updateProductSuggestions();
        window.dispatchEvent(new CustomEvent('products:updated'));
    }

    // Eventos
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            productForm.reset();
            document.getElementById('editingProdId').value = '';
            document.getElementById('saveProductBtn').textContent = 'Salvar no Catálogo';
            const statusEl = document.getElementById('prodStatus');
            if (statusEl) statusEl.value = 'active';
            if (categoryInput) categoryInput.value = '';
            if (unitInput) unitInput.value = 'UN';
            renderStandards();
            modal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const id = document.getElementById('editingProdId').value;
            const normalizedCategory = normalizeCategory(document.getElementById('prodCategory').value);
            const normalizedUnit = normalizeUnit(document.getElementById('prodUnit').value);
            const productData = {
                id: id || Date.now().toString(),
                name: document.getElementById('prodName').value.trim(),
                category: normalizedCategory || 'Outros',
                unit: normalizedUnit || 'UN',
                status: document.getElementById('prodStatus').value || 'active',
                technicalDescription: document.getElementById('prodDescription').value.trim(),
                updatedAt: new Date().toISOString()
            };

            updateProducts(products => {
                if (id) {
                    return products.map(p => p.id === id ? productData : p);
                } else {
                    return [...products, productData];
                }
            });

            showNotification(id ? 'Produto atualizado!' : 'Produto cadastrado!', 'success');
            modal.style.display = 'none';
            renderStandards();
            renderProducts(searchInput.value);
            updateProductSuggestions();
            window.dispatchEvent(new CustomEvent('products:updated'));
        });
    }

    categoryInput?.addEventListener('blur', () => {
        categoryInput.value = normalizeCategory(categoryInput.value);
    });
    unitInput?.addEventListener('blur', () => {
        unitInput.value = normalizeUnit(unitInput.value);
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderProducts(searchInput.value);
        });
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            renderProducts(searchInput ? searchInput.value : '');
        });
    }

    // Inicializar Tabela
    renderStandards();
    renderProducts();
    updateProductSuggestions();
    hookProductSelection();
}

/**
 * Atualiza o datalist de sugestões de produtos na planilha principal
 */
export function updateProductSuggestions() {
    const datalist = document.getElementById('productSuggestions');
    if (!datalist) return;

    const products = loadProducts();
    datalist.innerHTML = products.map(p => `
        <option value="${escapeHtml(p.name)}">
    `).join('');
}

/**
 * Escuta mudanças no campo de nome do produto e auto-preenche se houver match
 */
export function hookProductSelection() {
    const nameInput = document.getElementById('productName');
    if (!nameInput) return;

    nameInput.addEventListener('input', () => {
        const products = loadProducts();
        const found = products.find(p => p.name === nameInput.value);
        
        if (found) {
            const unitPriceInput = document.getElementById('unitPrice');
            const links = loadProductSuppliers().filter((entry) => entry.productId === found.id);
            const minQuoted = links.reduce((min, entry) => {
                const value = toNumber(entry.quotedPrice);
                if (value <= 0) return min;
                return min === null || value < min ? value : min;
            }, null);

            if (unitPriceInput && minQuoted !== null) unitPriceInput.value = minQuoted;
            
            showNotification(`Produto "${found.name}" carregado do catálogo!`, 'info');
        }
    });
}

function openComparisonForProduct(productId) {
    const moduleTab = document.querySelector('.sub-tabs[data-group="suppliers"] [data-subtab="supplier-comparison"]');
    if (moduleTab) moduleTab.click();

    const filter = document.getElementById('supplierCompareProductFilter');
    if (filter) {
        filter.value = productId;
        filter.dispatchEvent(new Event('change'));
    }
}
