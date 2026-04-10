import { toNumber } from "./utils.js";
import { CONFIG } from "./config.js";

export function getEffectivePercents(item, settings) {
  return {
    taxPercent: item.taxPercentOverride ?? settings.taxPercent,
    marginPercent: item.marginPercentOverride ?? settings.marginPercent,
    transportPercent: item.transportPercentOverride ?? settings.transportPercent,
    warrantyPercent: item.warrantyPercentOverride ?? settings.warrantyPercent
  };
}

export function calculateRow(item, settings) {
  const quantity = Math.max(1, Math.round(toNumber(item.quantity)));
  const unitPrice = Math.max(0, toNumber(item.unitPrice));
  const baseTotal = quantity * unitPrice;
  const effective = getEffectivePercents(item, settings);

  const taxValue = baseTotal * (effective.taxPercent / 100);
  const transportValue = baseTotal * (effective.transportPercent / 100);
  const warrantyValue = baseTotal * (effective.warrantyPercent / 100);
  const profitValue = baseTotal * (effective.marginPercent / 100);
  
  const minimumTotal = baseTotal + taxValue + transportValue + warrantyValue;
  const minimumUnitPrice = minimumTotal / quantity;
  
  const finalTotal = minimumTotal + profitValue;
  const finalUnitPrice = finalTotal / quantity;
  
  const combinedPercent = effective.taxPercent + effective.transportPercent + effective.warrantyPercent + effective.marginPercent;
  const markup = 1 + (combinedPercent / 100);
  
  const profitPercentReal = finalTotal > 0 ? (profitValue / finalTotal) * 100 : 0;
  const maximumDiscountPercent = finalUnitPrice > 0
    ? Math.max(0, ((finalUnitPrice - minimumUnitPrice) / finalUnitPrice) * 100)
    : 0;
    
  const nearMinimum = finalUnitPrice > 0
    ? (((finalUnitPrice - minimumUnitPrice) / finalUnitPrice) * 100) <= CONFIG.PRICING.NEAR_MINIMUM_GAP_PERCENT
    : false;

  return {
    quantity,
    unitPrice,
    baseTotal,
    effective,
    taxValue,
    transportValue,
    warrantyValue,
    profitValue,
    minimumTotal,
    minimumUnitPrice,
    finalTotal,
    finalUnitPrice,
    combinedPercent,
    markup,
    profitPercentReal,
    maximumDiscountPercent,
    nearMinimum
  };
}

export function getLotLabel(item) {
  return item.lotName?.trim() || "Sem lote";
}

export function groupItemsByLot(items) {
  const groups = [];
  const map = new Map();
  items.forEach((item) => {
    const label = getLotLabel(item);
    if (!map.has(label)) {
      const group = { label, items: [] };
      map.set(label, group);
      groups.push(group);
    }
    map.get(label).items.push(item);
  });
  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

export function calculateLotSubtotal(items, settings) {
  const subtotal = {
    count: 0,
    baseTotal: 0,
    minimumTotal: 0,
    finalTotal: 0,
    taxValue: 0,
    transportValue: 0,
    warrantyValue: 0,
    profitValue: 0,
    minimumUnitAverage: 0,
    finalUnitAverage: 0,
    maximumDiscountAverage: 0,
    profitPercent: 0
  };

  if (!items || !items.length) {
    return subtotal;
  }

  items.forEach((item) => {
    const calc = calculateRow(item, settings);
    subtotal.count += calc.quantity;
    subtotal.baseTotal += calc.baseTotal;
    subtotal.minimumTotal += calc.minimumTotal;
    subtotal.finalTotal += calc.finalTotal;
    subtotal.taxValue += calc.taxValue;
    subtotal.transportValue += calc.transportValue;
    subtotal.warrantyValue += calc.warrantyValue;
    subtotal.profitValue += calc.profitValue;
  });

  if (subtotal.count > 0) {
    subtotal.minimumUnitAverage = subtotal.minimumTotal / subtotal.count;
    subtotal.finalUnitAverage = subtotal.finalTotal / subtotal.count;
  }

  if (subtotal.finalTotal > 0) {
    subtotal.profitPercent = (subtotal.profitValue / subtotal.finalTotal) * 100;
    subtotal.maximumDiscountAverage = Math.max(0, ((subtotal.finalTotal - subtotal.minimumTotal) / subtotal.finalTotal) * 100);
  }

  return subtotal;
}

export function summarizeWorkbook(workbook) {
  const { header, settings, items } = workbook;
  const stats = {
    itemCount: items.length,
    totalQuantity: 0,
    baseTotal: 0,
    minimumTotal: 0,
    finalTotal: 0,
    taxValue: 0,
    transportValue: 0,
    warrantyValue: 0,
    profitValue: 0,
    lowMarginCount: 0,
    lotCount: 0,
    sumPercent: settings.taxPercent + settings.transportPercent + settings.warrantyPercent + settings.marginPercent,
    globalMarkup: 1 + ((settings.taxPercent + settings.transportPercent + settings.warrantyPercent + settings.marginPercent) / 100)
  };

  const lots = new Set();
  items.forEach((item) => {
    const calc = calculateRow(item, settings);
    stats.totalQuantity += calc.quantity;
    stats.baseTotal += calc.baseTotal;
    stats.minimumTotal += calc.minimumTotal;
    stats.finalTotal += calc.finalTotal;
    stats.taxValue += calc.taxValue;
    stats.transportValue += calc.transportValue;
    stats.warrantyValue += calc.warrantyValue;
    stats.profitValue += calc.profitValue;

    if (calc.profitPercentReal < settings.minimumProfitAlert) {
      stats.lowMarginCount++;
    }

    if (item.lotName?.trim()) {
      lots.add(item.lotName.trim());
    }
  });

  stats.lotCount = lots.size;
  stats.minimumUnitAverage = stats.totalQuantity > 0 ? stats.minimumTotal / stats.totalQuantity : 0;
  stats.finalUnitAverage = stats.totalQuantity > 0 ? stats.finalTotal / stats.totalQuantity : 0;
  stats.profitPercent = stats.finalTotal > 0 ? (stats.profitValue / stats.finalTotal) * 100 : 0;
  stats.discountPercentAverage = stats.finalTotal > 0 ? Math.max(0, ((stats.finalTotal - stats.minimumTotal) / stats.finalTotal) * 100) : 0;

  // Gerar subtotais por lote para o painel de histórico/resumo
  const lotGroups = groupItemsByLot(items);
  stats.lotSummaries = lotGroups.map(group => calculateLotSubtotal(group.items, settings));

  return stats;
}

export function validateItemData(item) {
  if (!item.productName.trim()) {
    return "Informe o nome do produto.";
  }
  if (toNumber(item.quantity) <= 0) {
    return "A quantidade deve ser maior que zero.";
  }
  if (toNumber(item.unitPrice) < 0) {
    return "O custo de compra nao pode ser negativo.";
  }
  return "";
}
