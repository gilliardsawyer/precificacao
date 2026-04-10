import { showNotification } from './toasts.js';
import { getActiveWorkbook, updateActiveWorkbook, ensureWorkbookShape } from '../storage/local.js';

export const MassEditState = {
  selectedItems: new Set()
};

export function setupMassEdit(renderCallback) {
  const selectAllCheckbox = document.getElementById('selectAllItems');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const massActionBar = document.getElementById('massActionBar');
  const massActionCount = document.getElementById('massActionCount');
  const massActionField = document.getElementById('massActionField');
  const massActionValue = document.getElementById('massActionValue');
  const massActionApplyBtn = document.getElementById('massActionApplyBtn');
  const massActionDeleteBtn = document.getElementById('massActionDeleteBtn');

  if (!itemsTableBody || !massActionBar) return;

  function updateActionBar() {
    const count = MassEditState.selectedItems.size;
    if (count > 0) {
      massActionBar.style.display = 'flex';
      massActionCount.textContent = `${count} itens selecionados`;
    } else {
      massActionBar.style.display = 'none';
    }
  }

  // Delegation hook for individual checkboxes
  itemsTableBody.addEventListener('change', (e) => {
    if (e.target.matches('.item-checkbox')) {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const itemId = tr.dataset.itemId;
      
      if (e.target.checked) {
        MassEditState.selectedItems.add(itemId);
      } else {
        MassEditState.selectedItems.delete(itemId);
        // Desmarcar o 'select all' se um for desmarcado
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
      }
      updateActionBar();
    }
  });

  // Select All Checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const checkboxes = itemsTableBody.querySelectorAll('.item-checkbox');
      
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const tr = cb.closest('tr');
        if (tr && tr.dataset.itemId) {
          if (isChecked) {
            MassEditState.selectedItems.add(tr.dataset.itemId);
          } else {
            MassEditState.selectedItems.delete(tr.dataset.itemId);
          }
        }
      });
      updateActionBar();
    });
  }

  // Apply Mass Action
  massActionApplyBtn.addEventListener('click', () => {
    const field = massActionField.value;
    const valueStr = massActionValue.value;

    if (!field) return showNotification("Selecione um campo para aplicar", "warning");
    if (valueStr === "") return showNotification("Digite um valor numérico", "warning");

    let numValue = parseFloat(valueStr);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      return showNotification("Valor percentual inválido (0-100)", "warning");
    }

    if (confirm(`Deseja alterar "${massActionField.options[massActionField.selectedIndex].text}" para ${numValue}% em ${MassEditState.selectedItems.size} itens?`)) {
      updateActiveWorkbook((workbook) => {
         workbook.items = workbook.items.map(item => {
           if (MassEditState.selectedItems.has(item.id)) {
              return { ...item, [field]: numValue };
           }
           return item;
         });
         return workbook;
      }, { versionLabel: "Edição em lote" });
      
      // Cleanup selection
      MassEditState.selectedItems.clear();
      updateActionBar();
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      if (renderCallback) renderCallback();
      showNotification("Edição concluída com sucesso!", "success");
    }
  });

  // Mass Delete
  massActionDeleteBtn.addEventListener('click', () => {
    if (confirm(`Atenção! Você está apagando ${MassEditState.selectedItems.size} itens. Isso não pode ser desfeito. Continuar?`)) {
      updateActiveWorkbook((workbook) => {
         workbook.items = workbook.items.filter(item => !MassEditState.selectedItems.has(item.id));
         return workbook;
      }, { versionLabel: "Exclusão em lote" });
      
      // Cleanup selection
      MassEditState.selectedItems.clear();
      updateActionBar();
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      if (renderCallback) renderCallback();
      showNotification("Itens excluídos com sucesso!", "success");
    }
  });
}
