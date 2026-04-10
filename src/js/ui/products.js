import { loadProducts, saveProducts, updateProducts } from '../storage/local.js';
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
    const container = document.getElementById('productContainer');

    if (!container) return;

    function renderProducts(term = '') {
        const products = loadProducts();
        const searchTerm = term.trim().toLowerCase();
        
        const filtered = products.filter(p => 
            (p.name || '').toLowerCase().includes(searchTerm) ||
            (p.sku || '').toLowerCase().includes(searchTerm) ||
            (p.brand || '').toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            container.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                ${term ? 'Nenhum produto encontrado para sua busca.' : 'Nenhum produto cadastrado no catálogo.'}
            </td></tr>`;
            return;
        }

        container.innerHTML = filtered.map(product => `
            <tr data-product-id="${product.id}">
                <td><span class="product-sku">${escapeHtml(product.sku || '—')}</span></td>
                <td class="product-name-cell">${escapeHtml(product.name)}</td>
                <td><span class="product-brand-cell">${escapeHtml(product.brand || '—')}</span></td>
                <td><span class="badge-category cat-outros">${escapeHtml(product.category || 'Geral')}</span></td>
                <td class="product-cost">${formatCurrency(product.costPrice)}</td>
                <td style="text-align: center;">${escapeHtml(product.unit || 'UN')}</td>
                <td style="text-align: center; display: flex; gap: 4px; justify-content: center;">
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
    }

    function editProduct(id) {
        const products = loadProducts();
        const product = products.find(p => p.id === id);
        if (!product) return;

        document.getElementById('editingProdId').value = product.id;
        document.getElementById('prodSku').value = product.sku || '';
        document.getElementById('prodName').value = product.name || '';
        document.getElementById('prodBrand').value = product.brand || '';
        document.getElementById('prodCategory').value = product.category || '';
        document.getElementById('prodUnit').value = product.unit || 'UN';
        document.getElementById('prodCost').value = product.costPrice || 0;

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
    }

    // Eventos
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            productForm.reset();
            document.getElementById('editingProdId').value = '';
            document.getElementById('saveProductBtn').textContent = 'Salvar no Catálogo';
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
                sku: document.getElementById('prodSku').value.trim(),
                name: document.getElementById('prodName').value.trim(),
                brand: document.getElementById('prodBrand').value.trim(),
                category: document.getElementById('prodCategory').value.trim(),
                unit: document.getElementById('prodUnit').value.trim(),
                costPrice: toNumber(document.getElementById('prodCost').value)
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
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderProducts(searchInput.value);
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
            const manufacturerInput = document.getElementById('manufacturer');
            const unitPriceInput = document.getElementById('unitPrice');
            // Nota: Se houver campo de fornecedor ou unidade no form principal, preencher aqui também
            
            if (manufacturerInput) manufacturerInput.value = found.brand || '';
            if (unitPriceInput) unitPriceInput.value = found.costPrice || 0;
            
            showNotification(`Produto "${found.name}" carregado do catálogo!`, 'info');
        }
    });
}
