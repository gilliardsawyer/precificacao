const DEFAULT_CATEGORIES = [
  "Hardware",
  "Software",
  "Servicos",
  "Infraestrutura",
  "Licenciamento",
  "Material de Escritorio",
  "Informatica",
  "Moveis",
  "Equipamentos",
  "Eletronicos",
  "Limpeza",
  "EPIs",
  "Papelaria",
  "Outros"
];

const DEFAULT_UNITS = [
  "UN",
  "CX",
  "KIT",
  "PCT",
  "PAR",
  "PC",
  "FR",
  "GL",
  "KG",
  "G",
  "L",
  "ML",
  "M",
  "M2",
  "M3"
];

function normalizeKey(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toTitleCase(value) {
  return (value || "")
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const CATEGORY_ALIASES = new Map(
  DEFAULT_CATEGORIES.flatMap((category) => {
    const key = normalizeKey(category);
    return [
      [key, category],
      [key.replace(/\s+/g, ""), category]
    ];
  })
);

[
  ["ti", "Informatica"],
  ["informatica", "Informatica"],
  ["eletronico", "Eletronicos"],
  ["eletronicos", "Eletronicos"],
  ["mobilia", "Moveis"],
  ["moveis", "Moveis"],
  ["escritorio", "Material de Escritorio"],
  ["papelaria", "Papelaria"],
  ["epi", "EPIs"],
  ["epis", "EPIs"],
  ["servico", "Servicos"],
  ["servicos", "Servicos"]
].forEach(([alias, canonical]) => CATEGORY_ALIASES.set(alias, canonical));

const UNIT_ALIASES = new Map([
  ["un", "UN"],
  ["und", "UN"],
  ["unid", "UN"],
  ["unidade", "UN"],
  ["unidades", "UN"],
  ["cx", "CX"],
  ["caixa", "CX"],
  ["caixas", "CX"],
  ["kit", "KIT"],
  ["kits", "KIT"],
  ["pct", "PCT"],
  ["pacote", "PCT"],
  ["pacotes", "PCT"],
  ["par", "PAR"],
  ["pares", "PAR"],
  ["pc", "PC"],
  ["peca", "PC"],
  ["pecas", "PC"],
  ["fr", "FR"],
  ["frasco", "FR"],
  ["frascos", "FR"],
  ["gl", "GL"],
  ["galao", "GL"],
  ["galoes", "GL"],
  ["kg", "KG"],
  ["quilo", "KG"],
  ["quilograma", "KG"],
  ["g", "G"],
  ["grama", "G"],
  ["l", "L"],
  ["lt", "L"],
  ["litro", "L"],
  ["ml", "ML"],
  ["mililitro", "ML"],
  ["m", "M"],
  ["metro", "M"],
  ["m2", "M2"],
  ["m²", "M2"],
  ["metro quadrado", "M2"],
  ["m3", "M3"],
  ["m³", "M3"],
  ["metro cubico", "M3"]
]);

export function normalizeCategory(value) {
  const raw = (value || "").toString().trim();
  if (!raw) return "";
  const key = normalizeKey(raw).replace(/\s+/g, " ");
  return CATEGORY_ALIASES.get(key) || CATEGORY_ALIASES.get(key.replace(/\s+/g, "")) || toTitleCase(raw);
}

export function normalizeUnit(value) {
  const raw = (value || "").toString().trim();
  if (!raw) return "UN";
  const key = normalizeKey(raw);
  return UNIT_ALIASES.get(key) || raw.toUpperCase();
}

export function getCategoryOptions(products = []) {
  return [...new Set([
    ...DEFAULT_CATEGORIES,
    ...products.map((product) => normalizeCategory(product.category)).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b));
}

export function getUnitOptions(products = []) {
  return [...new Set([
    ...DEFAULT_UNITS,
    ...products.map((product) => normalizeUnit(product.unit)).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b));
}
