import { describe, expect, it } from "vitest";
import {
  calculateLotSubtotal,
  calculateRow,
  getEffectivePercents,
  getLotLabel,
  groupItemsByLot,
  summarizeWorkbook,
  validateItemData
} from "./pricing.js";

const baseSettings = {
  taxPercent: 5,
  marginPercent: 20,
  transportPercent: 2,
  warrantyPercent: 3,
  minimumProfitAlert: 12
};

describe("calculateRow", () => {
  it("calcula base, minimo, final, markup e desconto maximo corretamente", () => {
    const item = { quantity: 10, unitPrice: 100 };

    const result = calculateRow(item, baseSettings);

    expect(result.baseTotal).toBe(1000);
    expect(result.taxValue).toBe(50);
    expect(result.transportValue).toBe(20);
    expect(result.warrantyValue).toBe(30);
    expect(result.minimumTotal).toBe(1100);
    expect(result.minimumUnitPrice).toBe(110);
    expect(result.profitValue).toBe(200);
    expect(result.finalTotal).toBe(1300);
    expect(result.finalUnitPrice).toBe(130);
    expect(result.markup).toBeCloseTo(1.3, 8);
    expect(result.profitPercentReal).toBeCloseTo(15.38461538, 8);
    expect(result.maximumDiscountPercent).toBeCloseTo(15.38461538, 8);
    expect(result.nearMinimum).toBe(false);
  });

  it("aplica overrides por item acima dos percentuais globais", () => {
    const item = {
      quantity: 5,
      unitPrice: 200,
      taxPercentOverride: 8,
      marginPercentOverride: 25,
      transportPercentOverride: 4,
      warrantyPercentOverride: 1
    };

    const effective = getEffectivePercents(item, baseSettings);
    const result = calculateRow(item, baseSettings);

    expect(effective).toEqual({
      taxPercent: 8,
      marginPercent: 25,
      transportPercent: 4,
      warrantyPercent: 1
    });
    expect(result.baseTotal).toBe(1000);
    expect(result.minimumTotal).toBe(1130);
    expect(result.finalTotal).toBe(1380);
    expect(result.finalUnitPrice).toBe(276);
  });

  it("marca item como proximo do minimo quando a margem de manobra e pequena", () => {
    const item = { quantity: 2, unitPrice: 100 };
    const settings = {
      taxPercent: 2,
      marginPercent: 1,
      transportPercent: 1,
      warrantyPercent: 1,
      minimumProfitAlert: 8
    };

    const result = calculateRow(item, settings);

    expect(result.maximumDiscountPercent).toBeCloseTo(0.95238095, 8);
    expect(result.nearMinimum).toBe(true);
  });
});

describe("agrupamento e subtotais", () => {
  const items = [
    { id: "1", lotName: "Lote A", productName: "Papel", manufacturer: "Marca 1", quantity: 10, unitPrice: 100 },
    { id: "2", lotName: "Lote A", productName: "Caneta", manufacturer: "Marca 2", quantity: 5, unitPrice: 50 },
    { id: "3", lotName: "", productName: "Pasta", manufacturer: "Marca 3", quantity: 4, unitPrice: 25 }
  ];

  it("agrupa itens por lote, incluindo itens sem lote", () => {
    const groups = groupItemsByLot(items);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Lote A");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].label).toBe("Sem lote");
    expect(getLotLabel(items[2])).toBe("Sem lote");
  });

  it("calcula subtotal por lote com medias e totais corretos", () => {
    const subtotal = calculateLotSubtotal(items.slice(0, 2), baseSettings);

    expect(subtotal.count).toBe(15);
    expect(subtotal.baseTotal).toBe(1250);
    expect(subtotal.minimumTotal).toBe(1375);
    expect(subtotal.finalTotal).toBe(1625);
    expect(subtotal.minimumUnitAverage).toBeCloseTo(91.6666667, 7);
    expect(subtotal.finalUnitAverage).toBeCloseTo(108.3333333, 7);
    expect(subtotal.maximumDiscountAverage).toBeCloseTo(15.3846154, 7);
    expect(subtotal.profitPercent).toBeCloseTo(15.3846154, 7);
  });
});

describe("summarizeWorkbook", () => {
  it("gera resumo geral com contagens, totais e lotes", () => {
    const workbook = {
      header: {
        sheetName: "Teste"
      },
      settings: baseSettings,
      items: [
        { id: "1", lotName: "Lote A", productName: "Papel", manufacturer: "Marca 1", quantity: 10, unitPrice: 100 },
        { id: "2", lotName: "Lote B", productName: "Caneta", manufacturer: "Marca 2", quantity: 5, unitPrice: 50, marginPercentOverride: 2 }
      ]
    };

    const summary = summarizeWorkbook(workbook);

    expect(summary.itemCount).toBe(2);
    expect(summary.totalQuantity).toBe(15);
    expect(summary.baseTotal).toBe(1250);
    expect(summary.minimumTotal).toBe(1375);
    expect(summary.finalTotal).toBe(1580);
    expect(summary.taxValue).toBe(62.5);
    expect(summary.transportValue).toBe(25);
    expect(summary.warrantyValue).toBe(37.5);
    expect(summary.profitValue).toBe(205);
    expect(summary.lowMarginCount).toBe(1);
    expect(summary.lotCount).toBe(2);
    expect(summary.minimumUnitAverage).toBeCloseTo(91.6666667, 7);
    expect(summary.finalUnitAverage).toBeCloseTo(105.3333333, 7);
    expect(summary.profitPercent).toBeCloseTo(12.97468354, 8);
    expect(summary.discountPercentAverage).toBeCloseTo(12.97468354, 8);
    expect(summary.lotSummaries).toHaveLength(2);
  });
});

describe("validateItemData", () => {
  it("bloqueia item sem nome", () => {
    expect(
      validateItemData({ productName: "", quantity: 1, unitPrice: 10 })
    ).toBe("Informe o nome do produto.");
  });

  it("bloqueia quantidade zero", () => {
    expect(
      validateItemData({ productName: "Item", quantity: 0, unitPrice: 10 })
    ).toBe("A quantidade deve ser maior que zero.");
  });

  it("bloqueia custo negativo", () => {
    expect(
      validateItemData({ productName: "Item", quantity: 1, unitPrice: -1 })
    ).toBe("O custo de compra nao pode ser negativo.");
  });

  it("aceita item valido", () => {
    expect(
      validateItemData({ productName: "Item", quantity: 1, unitPrice: 10 })
    ).toBe("");
  });
});
