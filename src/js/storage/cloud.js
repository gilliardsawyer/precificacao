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
