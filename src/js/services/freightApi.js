import { CONFIG } from '../core/config.js';
import { toNumber } from '../core/utils.js';

const DEFAULT_SETTINGS = {
  provider: 'melhorenvio',
  token: '',
  originZip: '',
  useSandbox: true
};

function sanitizeZip(value) {
  return (value || '').toString().replace(/\D/g, '');
}

export function loadFreightApiSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(localStorage.getItem(CONFIG.STORAGE.FREIGHT_API_SETTINGS_KEY)) || {})
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveFreightApiSettings(settings) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    originZip: sanitizeZip(settings?.originZip),
    token: (settings?.token || '').trim()
  };
  localStorage.setItem(CONFIG.STORAGE.FREIGHT_API_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function getMelhorEnvioBaseUrl(useSandbox) {
  return useSandbox
    ? 'https://sandbox.melhorenvio.com.br'
    : 'https://www.melhorenvio.com.br';
}

function normalizeQuote(entry) {
  const price = toNumber(entry.custom_price || entry.price || 0);
  const deliveryTime = entry.custom_delivery_time || entry.delivery_time || 0;
  return {
    id: entry.id || crypto.randomUUID(),
    name: entry.name || entry.company?.name || 'Servico',
    company: entry.company?.name || entry.company?.company_name || 'Transportadora',
    price,
    deliveryTime: toNumber(deliveryTime),
    error: entry.error || '',
    raw: entry
  };
}

function buildProductsPayload(analysis) {
  return (analysis?.rows || []).map((row, index) => ({
    id: String(row.id || index + 1),
    width: Math.max(1, Math.round(toNumber(row.dimWidth || 0))),
    height: Math.max(1, Math.round(toNumber(row.dimHeight || 0))),
    length: Math.max(1, Math.round(toNumber(row.dimLength || 0))),
    weight: Math.max(0.1, toNumber(row.weightKg || row.charged || 0.1)),
    insurance_value: Math.max(0, toNumber(row.baseTotal || 0)),
    quantity: Math.max(1, Math.round(toNumber(row.packageCount || row.qty || 1)))
  }));
}

export async function quoteFreightWithMelhorEnvio({
  settings,
  analysis,
  destinationZip
}) {
  const token = (settings?.token || '').trim();
  const originZip = sanitizeZip(settings?.originZip);
  const toZip = sanitizeZip(destinationZip);

  if (!token) {
    throw new Error('Informe o token do Melhor Envio.');
  }
  if (!originZip || originZip.length < 8) {
    throw new Error('Informe o CEP de origem para consultar o frete.');
  }
  if (!toZip || toZip.length < 8) {
    throw new Error('Informe o CEP de destino para consultar o frete.');
  }

  const products = buildProductsPayload(analysis).filter((product) =>
    product.width > 0 && product.height > 0 && product.length > 0 && product.weight > 0
  );

  if (!products.length) {
    throw new Error('Preencha peso e dimensoes dos itens antes de consultar a API.');
  }

  const response = await fetch(`${getMelhorEnvioBaseUrl(settings?.useSandbox)}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Aplicacao Precificacao (local)'
    },
    body: JSON.stringify({
      from: { postal_code: originZip },
      to: { postal_code: toZip },
      products,
      options: {
        receipt: false,
        own_hand: false,
        collect: false
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Falha ao consultar o frete na API.';
    throw new Error(message);
  }

  const quotes = Array.isArray(payload) ? payload : (payload?.data || []);
  return quotes.map(normalizeQuote);
}
