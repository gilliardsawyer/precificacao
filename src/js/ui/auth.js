import { login, signUp, logout, checkSession, loadFromCloud } from '../storage/cloud.js';
import { showNotification } from './toasts.js';
import { saveWorkbooks, ensureWorkbooks } from '../storage/local.js';

let isUserLoggedIn = false;

export async function initAuth(renderAllCallback) {
  const loginButton = document.getElementById('navbarLoginBtn');
  const authModal = document.getElementById('authModal');
  const closeAuthBtn = document.getElementById('closeAuthBtn');
  const authGoBtn = document.getElementById('authGoBtn');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  
  if (!loginButton || !authModal) return;

  const session = await checkSession();
  if (session) {
    isUserLoggedIn = true;
    updateAuthUi(true, session.user.email);
    
    // Attempt download of cloud config
    try {
      const cloudData = await loadFromCloud();
      if (cloudData && cloudData.length > 0) {
        showNotification("Planilhas sincronizadas da nuvem!", "success");
        // Trigger a re-render of everything
        if (renderAllCallback) renderAllCallback();
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    updateAuthUi(false, null);
  }

  // Bind events
  loginButton.addEventListener('click', async () => {
    if (isUserLoggedIn) {
      // confirm logout
      if (confirm("Deseja sair do sistema?")) {
        await logout();
        isUserLoggedIn = false;
        updateAuthUi(false, null);
        showNotification("Você saiu do sistema", "info");
      }
    } else {
      authModal.style.display = 'flex';
    }
  });

  closeAuthBtn.addEventListener('click', () => {
    authModal.style.display = 'none';
  });

  authGoBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!email || !password) {
      return showNotification("Preencha e-mail e senha", "error");
    }
    
    try {
      authGoBtn.textContent = "Aguarde...";
      authGoBtn.disabled = true;
      
      // Attempt login
      const data = await login(email, password);
      
      isUserLoggedIn = true;
      authModal.style.display = 'none';
      updateAuthUi(true, data.user.email);
      showNotification("Login realizado com sucesso!", "success");
      
      const cloudData = await loadFromCloud();
      if (cloudData && cloudData.length > 0) {
        if (renderAllCallback) renderAllCallback();
      } else {
        // If they have local data, maybe we should sync it upwards
        const lWorkbooks = ensureWorkbooks();
        if (lWorkbooks && lWorkbooks.length > 0) {
           import('../storage/cloud.js').then(m => m.syncToCloud(lWorkbooks));
        }
      }
    } catch (e) {
      // If login failed, it might be because the user doesn't exist. Attempt sign up quietly
      if (e.message && e.message.includes('Invalid login credentials')) {
         try {
           const { user } = await signUp(email, password);
           isUserLoggedIn = true;
           authModal.style.display = 'none';
           updateAuthUi(true, email);
           showNotification("Conta criada e logada com sucesso!", "success");
           
           const lWorkbooks = ensureWorkbooks();
            if (lWorkbooks && lWorkbooks.length > 0) {
               import('../storage/cloud.js').then(m => m.syncToCloud(lWorkbooks));
            }
         } catch(e2) {
           showNotification("Erro: " + e2.message, "error");
         }
      } else {
         showNotification("Erro no acesso: " + e.message, "error");
      }
    } finally {
      authGoBtn.textContent = "Entrar / Cadastrar";
      authGoBtn.disabled = false;
    }
  });
}

function updateAuthUi(isLogged, email) {
  const loginButton = document.getElementById('navbarLoginBtn');
  if (!loginButton) return;
  if (isLogged) {
    loginButton.textContent = `☁️ Ativo: ${email.split('@')[0]}`;
    loginButton.classList.add('btn-cloud-active');
  } else {
    loginButton.textContent = `☁️ Nuvem Off`;
    loginButton.classList.remove('btn-cloud-active');
  }
}
