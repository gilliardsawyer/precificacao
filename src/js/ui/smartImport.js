import { showNotification } from './toasts.js';
import { normalizePercent, toNumber } from '../core/utils.js';

let pendingRecords = [];
let availableHeaders = [];
const IMPORT_TEMPLATES_KEY = 'precificacao-import-mapping-templates';

function loadTemplates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORT_TEMPLATES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates) {
  localStorage.setItem(IMPORT_TEMPLATES_KEY, JSON.stringify(templates));
}

function buildHeadersSignature(headers) {
  return [...headers]
    .map((header) => String(header || '').trim().toLowerCase())
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function findMatchingTemplate(headers) {
  const signature = buildHeadersSignature(headers);
  return loadTemplates().find((template) => template.signature === signature) || null;
}

function saveTemplate({ name, headers, mappingConfig }) {
  const templates = loadTemplates();
  const signature = buildHeadersSignature(headers);
  const templateName = name?.trim() || `Modelo ${new Date().toLocaleDateString('pt-BR')}`;
  const nextTemplate = {
    id: crypto.randomUUID(),
    name: templateName,
    signature,
    headers: [...headers],
    mappingConfig: { ...mappingConfig },
    updatedAt: new Date().toISOString()
  };

  const withoutSameSignature = templates.filter((template) => template.signature !== signature);
  withoutSameSignature.unshift(nextTemplate);
  saveTemplates(withoutSameSignature.slice(0, 20));
  return nextTemplate;
}

export function setupSmartImporter(onImportComplete) {
  const modal = document.getElementById('importMappingModal');
  const container = document.getElementById('mappingFieldsContainer');
  const cancelBtn = document.getElementById('cancelImportMapBtn');
  const confirmBtn = document.getElementById('confirmImportMapBtn');
  const saveTemplateCheckbox = document.getElementById('saveImportTemplateCheckbox');
  const templateNameInput = document.getElementById('importTemplateName');
  const templateHint = document.getElementById('mappingTemplateHint');

  if (!modal) return;

  saveTemplateCheckbox?.addEventListener('change', () => {
    if (!templateNameInput) return;
    templateNameInput.style.display = saveTemplateCheckbox.checked ? 'block' : 'none';
    if (!saveTemplateCheckbox.checked) {
      templateNameInput.value = '';
    }
  });

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    pendingRecords = [];
  });

  confirmBtn.addEventListener('click', () => {
    // Process mappings
    const selects = container.querySelectorAll('select.mapper-select');
    const mappingConfig = {};
    selects.forEach(sel => {
      if (sel.value) {
         mappingConfig[sel.dataset.target] = sel.value;
      }
    });

    if (saveTemplateCheckbox?.checked) {
      const saved = saveTemplate({
        name: templateNameInput?.value || '',
        headers: availableHeaders,
        mappingConfig
      });
      showNotification(`Modelo "${saved.name}" salvo para futuras importações.`, 'success');
    }

    const items = pendingRecords.map(record => {
      return {
        id: crypto.randomUUID(),
        lotName: mappingConfig.lotName ? String(record[mappingConfig.lotName] || "") : "",
        productName: mappingConfig.productName ? String(record[mappingConfig.productName] || "") : "",
        manufacturer: mappingConfig.manufacturer ? String(record[mappingConfig.manufacturer] || "") : "",
        supplier: mappingConfig.supplier ? String(record[mappingConfig.supplier] || "") : "",
        quantity: Math.max(1, Math.round(toNumber(mappingConfig.quantity ? record[mappingConfig.quantity] : 1))),
        unitPrice: Math.max(0, toNumber(mappingConfig.unitPrice ? record[mappingConfig.unitPrice] : 0)),
        taxPercentOverride: mappingConfig.taxPercentOverride ? normalizePercent(record[mappingConfig.taxPercentOverride], true) : null,
        marginPercentOverride: mappingConfig.marginPercentOverride ? normalizePercent(record[mappingConfig.marginPercentOverride], true) : null,
        transportPercentOverride: mappingConfig.transportPercentOverride ? normalizePercent(record[mappingConfig.transportPercentOverride], true) : null,
        warrantyPercentOverride: mappingConfig.warrantyPercentOverride ? normalizePercent(record[mappingConfig.warrantyPercentOverride], true) : null
      };
    }).filter(item => item.productName || item.unitPrice > 0);

    modal.style.display = 'none';
    if (onImportComplete && items.length > 0) {
      onImportComplete(items);
    } else {
      showNotification("Nenhum item válido importado com este mapeamento.", "warning");
    }
  });
}

function renderMappingUI() {
  const modal = document.getElementById('importMappingModal');
  const container = document.getElementById('mappingFieldsContainer');
  const saveTemplateCheckbox = document.getElementById('saveImportTemplateCheckbox');
  const templateNameInput = document.getElementById('importTemplateName');
  const templateHint = document.getElementById('mappingTemplateHint');
  modal.style.display = 'flex';

  const fields = [
    { id: 'lotName', label: 'Item / Lote' },
    { id: 'productName', label: 'Nome do Produto (Obrigatório)' },
    { id: 'manufacturer', label: 'Marca/Fabricante' },
    { id: 'supplier', label: 'Fornecedor' },
    { id: 'quantity', label: 'Quantidade' },
    { id: 'unitPrice', label: 'Preço/Custo Base' },
    { id: 'taxPercentOverride', label: 'Imposto do Item (%)' },
    { id: 'marginPercentOverride', label: 'Margem do Item (%)' }
  ];

  container.innerHTML = fields.map(field => `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:20px;">
      <label style="font-weight:600; width:200px;">${field.label}:</label>
      <select class="search-input mapper-select" data-target="${field.id}" style="flex:1;">
        <option value="">-- Ignorar --</option>
        \${availableHeaders.map(h => \`<option value="\${h}">Planilha: \${h}</option>\`).join('')}
      </select>
    </div>
  `).join('');

  if (saveTemplateCheckbox) {
    saveTemplateCheckbox.checked = false;
  }
  if (templateNameInput) {
    templateNameInput.value = '';
    templateNameInput.style.display = 'none';
  }
  
  // Auto-guess heuristics
  const selects = container.querySelectorAll('.mapper-select');
  selects.forEach(select => {
     const target = select.dataset.target.toLowerCase();
     for (const option of select.options) {
        const check = option.value.toLowerCase();
        if (check && (
            (target.includes('product') && (check.includes('desc') || check.includes('produto') || check.includes('nome'))) ||
            (target.includes('lot') && (check.includes('lote') || check.includes('item'))) ||
            (target.includes('price') && (check.includes('preço') || check.includes('valor') || check.includes('custo'))) ||
            (target.includes('quantity') && (check.includes('qtd') || check.includes('quant'))) ||
            (target.includes('manufacturer') && (check.includes('marca') || check.includes('fab') || check.includes('mod'))) ||
            (target.includes('supplier') && (check.includes('fornecedor') || check.includes('distrib') || check.includes('empresa')))
        )) {
            select.value = option.value;
            break;
        }
     }
  });

  const matchedTemplate = findMatchingTemplate(availableHeaders);
  if (matchedTemplate) {
    selects.forEach((select) => {
      const savedValue = matchedTemplate.mappingConfig?.[select.dataset.target];
      if (savedValue && availableHeaders.includes(savedValue)) {
        select.value = savedValue;
      }
    });
    if (templateHint) {
      templateHint.textContent = `Modelo reconhecido: ${matchedTemplate.name}. O mapeamento foi preenchido automaticamente.`;
    }
  } else if (templateHint) {
    templateHint.textContent = 'Nenhum modelo salvo encontrado para estes cabeçalhos.';
  }
}

export function handleImportedSpreadsheet(records) {
  if (!records || records.length === 0) {
    return showNotification("Planilha vazia", "error");
  }
  
  pendingRecords = records;
  // Extrair todos os headers do primeiro objeto
  availableHeaders = Object.keys(records[0] || {});
  if (availableHeaders.length === 0) {
     return showNotification("Não foi possível ler as colunas (Cabeçalhos vazios)", "error");
  }
  
  renderMappingUI();
}
