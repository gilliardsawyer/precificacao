import Sortable from 'sortablejs';
import { updateActiveWorkbook } from '../storage/local.js';
import { showNotification } from './toasts.js';

export function setupSortableTable(renderCallback) {
  const itemsTableBody = document.getElementById('itemsTableBody');
  if (!itemsTableBody) return;

  new Sortable(itemsTableBody, {
    animation: 150,
    handle: '.group-base', // You can drag by grabbing anything in the base columns
    filter: '.lot-row, .lot-subtotal-row', // Do not drag headers and footers
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;

      // Pegar a nova ordem visual baseando-se explicitamente apenas nas linhas de itens (ignorando lot-row)
      const visualRows = Array.from(itemsTableBody.querySelectorAll('tr[data-item-id]'));
      const newOrderIds = visualRows.map(row => row.dataset.itemId);

      updateActiveWorkbook(workbook => {
        // Criar um mapa rápido pra não perder a referência dos objetos inteiros
        const itemsMap = new Map();
        workbook.items.forEach(item => itemsMap.set(item.id, item));

        // Refazer o array na nova ordem
        const reorderedItems = [];
        newOrderIds.forEach(id => {
           if (itemsMap.has(id)) {
             reorderedItems.push(itemsMap.get(id));
             itemsMap.delete(id); // Marca como processado
           }
        });
        
        // Se algum item ficou de fora por falha da DOM, adiciona no fim como safety fallback
        itemsMap.forEach(item => reorderedItems.push(item));

        workbook.items = reorderedItems;
        return workbook;
      }, { versionLabel: "Reordenação Drag & Drop" });

      if (renderCallback) renderCallback();
      showNotification("Ordem atualizada", "info");
    }
  });
}
