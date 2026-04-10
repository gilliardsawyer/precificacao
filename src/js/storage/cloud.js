import { createClient } from '@supabase/supabase-js';
import { showNotification } from '../ui/toasts.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return session;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function syncToCloud(workbooks) {
  const session = await checkSession();
  if (!session) return;
  
  const userId = session.user.id;
  const updates = workbooks.map(wb => ({
    id: wb.id,
    user_id: userId,
    name: wb.name,
    payload: wb,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase.from('workbooks').upsert(updates, { onConflict: 'id' });
  if (error) {
    console.error("Erro ao sincronizar nuvem", error);
    showNotification("Erro na nuvem: não foi possível enviar backup", "error");
  } else {
    // Optionally update UI for sync status
    const autosaveStatus = document.getElementById("autosaveStatus");
    if (autosaveStatus) {
      autosaveStatus.textContent = `Nuvem ☁️ (Salvo as ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})`;
    }
  }
}

export async function loadFromCloud() {
  const session = await checkSession();
  if (!session) return null;
  
  const { data, error } = await supabase.from('workbooks').select('*');
  if (error) {
    console.error("Erro ao carregar banco do Supabase", error);
    return null;
  }
  
  if (data && data.length > 0) {
    return data.map(row => row.payload);
  }
  return null;
}

// ============================================================================
// Backend do módulo de licitação (mínimo necessário)
// ============================================================================

export async function listBidProducts() {
  const session = await checkSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('bid_products')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBidProduct(payload) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const record = {
    user_id: session.user.id,
    name: payload.name || '',
    category: payload.category || '',
    technical_description: payload.technical_description || '',
    unit: payload.unit || 'UN',
    status: payload.status || 'draft'
  };
  const { data, error } = await supabase
    .from('bid_products')
    .insert(record)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateBidProduct(id, patch) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('bid_products')
    .update({
      ...patch
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBidProduct(id) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('bid_products').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function listBidProductSuppliers(productId) {
  const session = await checkSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('bid_product_suppliers')
    .select('*')
    .eq('product_id', productId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertBidProductSupplier(payload) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const record = {
    id: payload.id || undefined,
    user_id: session.user.id,
    product_id: payload.product_id,
    supplier_name: payload.supplier_name,
    supplier_document: payload.supplier_document || '',
    brand: payload.brand || '',
    model: payload.model || '',
    unit_price: payload.unit_price || 0,
    lead_time_days: payload.lead_time_days || 0,
    warranty: payload.warranty || '',
    proposal_validity: payload.proposal_validity || '',
    tech_characteristics: payload.tech_characteristics || '',
    meets_minimum: payload.meets_minimum !== false,
    notes: payload.notes || '',
    quote_date: payload.quote_date || null
  };

  const { data, error } = await supabase
    .from('bid_product_suppliers')
    .upsert(record, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBidProductSupplier(id) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('bid_product_suppliers').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getBidProductComparison(productId) {
  const session = await checkSession();
  if (!session) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('get_bid_product_comparison', { p_product_id: productId });
  if (error) throw error;
  return data;
}
