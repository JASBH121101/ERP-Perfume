import { createAuthClient } from "@neondatabase/auth";

const $ = (selector) => document.querySelector(selector);
const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");
const authFeedback = $("#auth-feedback");
let authClient = null;
let authSession = null;
let authUser = null;
let erpProfile = null;
let profileError = "";

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

async function getToken() {
  if (!authClient) return null;
  const result = await authClient.token();
  if (result?.error) throw new Error(result.error.message || "No se pudo renovar la sesión.");
  return result?.data?.token || result?.token || null;
}

async function refreshProfile() {
  if (!authClient) return null;
  const result = await authClient.getSession();
  if (result?.error) throw new Error(result.error.message || "No se pudo consultar la sesión.");
  const data = result?.data || null;
  authSession = data?.session || data || null;
  authUser = data?.user || authSession?.user || null;
  erpProfile = null;
  profileError = "";

  if (authUser) {
    try {
      const token = await getToken();
      if (token) {
        const response = await fetch("/api/auth/profile", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store"
        });
        const body = await readJson(response);
        if (response.ok && body.user) erpProfile = body.user;
        else profileError = body?.error?.message || "La cuenta todavía no tiene acceso al ERP.";
      }
    } catch (error) {
      profileError = error?.message || "No se pudo validar el perfil del ERP.";
    }
  }
  return erpProfile;
}

function setAuthMode(mode) {
  if (!authForm) return;
  authForm.dataset.mode = mode;
  const signUp = mode === "signup";
  $("#auth-name-field").hidden = !signUp;
  $("#auth-name").required = signUp;
  $("#auth-submit").textContent = signUp ? "Crear cuenta" : "Iniciar sesión";
  $("#auth-mode-signin").classList.toggle("active", !signUp);
  $("#auth-mode-signup").classList.toggle("active", signUp);
  if (authFeedback) authFeedback.textContent = "";
}

function updateAuthControls() {
  const button = $("#auth-control");
  const pill = $("#connection-pill");
  if (pill) {
    const indicator = pill.querySelector("i") || document.createElement("i");
    pill.replaceChildren(indicator, document.createTextNode(" " + (authClient ? "NEON · DESARROLLO" : "MODO DEMO")));
    pill.classList.toggle("connected", Boolean(authClient));
  }
  if (button) {
    button.hidden = !authClient;
    button.textContent = authUser ? "Cerrar sesión" : "Iniciar sesión";
    button.setAttribute("aria-label", authUser ? "Cerrar sesión" : "Iniciar sesión");
  }
  const identity = $("#auth-identity");
  if (identity) {
    identity.textContent = erpProfile?.name || authUser?.name || (authUser ? authUser.email : "Sin sesión");
  }
}

async function initialize() {
  let config = { mode: "demo", authBaseUrl: null };
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) config = { ...config, ...(await readJson(response)) };
  } catch {
    // Local source tests run without Cloudflare Functions; remain in DEMO mode.
  }

  if (config.authBaseUrl && config.mode === "authenticated") {
    try {
      authClient = createAuthClient(config.authBaseUrl);
      await refreshProfile();
    } catch (error) {
      console.error("[auth] Initialization failed:", error?.message || "unknown error");
      authClient = null;
      authSession = null;
      authUser = null;
      erpProfile = null;
    }
  }

  window.JBAuth = {
    mode: authClient ? "authenticated" : "demo",
    client: authClient,
    get user() { return authUser; },
    get profile() { return erpProfile; },
    get profileError() { return profileError; },
    getToken,
    refreshProfile,
    async signIn(email, password) {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) throw new Error(result.error.message || "No se pudo iniciar sesión.");
      await refreshProfile();
      return result;
    },
    async signUp(name, email, password) {
      const result = await authClient.signUp.email({ name, email, password });
      if (result?.error) throw new Error(result.error.message || "No se pudo crear la cuenta.");
      await refreshProfile();
      return result;
    },
    async signOut() {
      if (!authClient) return;
      const result = await authClient.signOut();
      if (result?.error) throw new Error(result.error.message || "No se pudo cerrar sesión.");
      authSession = null;
      authUser = null;
      erpProfile = null;
      profileError = "";
    }
  };

  await import("./app.js");
  updateAuthControls();

  $("#auth-control")?.addEventListener("click", async () => {
    if (!authClient) return;
    if (authUser) {
      try {
        await window.JBAuth.signOut();
        updateAuthControls();
        window.dispatchEvent(new CustomEvent("jb:auth-changed"));
        if (authFeedback) authFeedback.textContent = "";
      } catch (error) {
        if (authFeedback) authFeedback.textContent = error.message;
        authDialog?.showModal();
      }
      return;
    }
    setAuthMode("signin");
    authDialog?.showModal();
  });

  $("#auth-close")?.addEventListener("click", () => authDialog?.close());
  $("#auth-mode-signin")?.addEventListener("click", () => setAuthMode("signin"));
  $("#auth-mode-signup")?.addEventListener("click", () => setAuthMode("signup"));

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authClient || !authForm.reportValidity()) return;
    const data = new FormData(authForm);
    const mode = authForm.dataset.mode;
    const submit = $("#auth-submit");
    submit.disabled = true;
    if (authFeedback) authFeedback.textContent = "Conectando con Neon Auth…";
    try {
      if (mode === "signup") {
        await window.JBAuth.signUp(
          String(data.get("name") || "").trim(),
          String(data.get("email") || "").trim(),
          String(data.get("password") || "")
        );
      } else {
        await window.JBAuth.signIn(
          String(data.get("email") || "").trim(),
          String(data.get("password") || "")
        );
      }
      updateAuthControls();
      window.dispatchEvent(new CustomEvent("jb:auth-changed"));
      if (erpProfile) {
        authDialog.close();
        authForm.reset();
      } else {
        if (authFeedback) authFeedback.textContent = profileError || "Sesión iniciada. Verifica tu correo y vuelve a iniciar sesión para activar el perfil.";
      }
    } catch (error) {
      if (authFeedback) authFeedback.textContent = error?.message || "No se pudo completar la operación.";
    } finally {
      submit.disabled = false;
    }
  });

  window.dispatchEvent(new CustomEvent("jb:auth-ready"));
}

initialize().catch(async (error) => {
  console.error("[bootstrap] Failed to initialize:", error?.message || "unknown error");
  window.JBAuth = { mode: "demo", user: null, profile: null, getToken: async () => null };
  await import("./app.js");
});
