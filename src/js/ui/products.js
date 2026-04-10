import { loadProducts, saveProducts, updateProducts, loadProductSuppliers } from '../storage/local.js';
import { formatCurrency, escapeHtml, toNumber } from '../core/utils.js';
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

    if (!container) return;

    const QUOTE_STALE_DAYS = 30;

    function normalizeText(value) {
        return (value || '').toString().trim().toLowerCase();
    }

    function getSupplierStats(productId) {
        const links = loadProductSuppliers().filter((entry) => entry.productId === productId);
        if (!links.length) {
            return { supplierCount: 0, minPrice: null, quoteStatus: 'none' };
        }

        const supplierKeys = new Set();
        let minPrice = null;
        let latestQuoteDate = null;

        links.forEach((entry) => {
            const key = `${normalizeText(entry.supplierName)}::${normalizeText(entry.supplierDocument)}`;
            if (key !== '::') supplierKeys.add(key);
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

    function renderCategoryFilter(products) {
        if (!categoryFilter) return;
        const current = categoryFilter.value || '';
        const categories = [...new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
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

        const supplierStatsByProductId = new Map(
            products.map((product) => [product.id, getSupplierStats(product.id)])
        );
        
        const filtered = products.filter(p => {
            const matchName = (p.name || '').toLowerCase().includes(searchTerm);
            const matchCategory = !selectedCategory || (p.category || '').trim() === selectedCategory;
            return matchName && matchCategory;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                ${(term || selectedCategory) ? 'Nenhum produto encontrado para os filtros atuais.' : 'Nenhum produto cadastrado no catálogo.'}
            </td></tr>`;
            return;
        }

        container.innerHTML = filtered.map(product => `
            <tr data-product-id="${product.id}">
                <td class="product-name-cell">${escapeHtml(product.name)}</td>
                <td><span class="badge-category cat-outros">${escapeHtml(product.category || 'Geral')}</span></td>
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
        document.getElementById('prodCategory').value = product.category || '';
        document.getElementById('prodUnit').value = product.unit || 'UN';
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
            const productData = {
                id: id || Date.now().toString(),
                name: document.getElementById('prodName').value.trim(),
                category: document.getElementById('prodCategory').value.trim(),
                unit: document.getElementById('prodUnit').value.trim(),
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
            renderProducts(searchInput.value);
            updateProductSuggestions();
            window.dispatchEvent(new CustomEvent('products:updated'));
        });
    }

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
