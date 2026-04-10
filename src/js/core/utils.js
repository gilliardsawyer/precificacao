export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function toNumber(value, min = -Infinity, max = Infinity) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizePercent(value, allowBlank = false) {
  if (allowBlank && value === "") {
    return null;
  }
  return Math.min(100, Math.max(0, toNumber(value, 0, 100)));
}

export function escapeHtml(text) {
  if (typeof text !== "string") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function debounce(func, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

export function formatPercent(value) {
  return `${percentFormatter.format(value || 0)}%`;
}
