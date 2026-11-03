import { createAuthClient } from "@neondatabase/auth";

const $ = (selector) => document.querySelector(selector);
const authDialog = $("#auth-dialog");
const authForm = $("#auth-form");
const authFeedback = $("#auth-feedback");
const API_BASE_URL = (document.querySelector('meta[name="jb-api-base-url"]')?.content || "").trim().replace(/\/+$/, "");
const apiUrl = (path) => API_BASE_URL + (path.startsWith("/") ? path : "/" + path);
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
        const response = await fetch(apiUrl("/api/auth/profile"), {
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

function setAuthMode(mode, email = "") {
  if (!authForm) return;
  const signUp = mode === "signup";
  const verifying = mode === "verify";
  authForm.dataset.mode = mode;
  $("#auth-mode-switch").hidden = verifying;
  $("#auth-name-field").hidden = !signUp;
  $("#auth-name").required = signUp;
  $("#auth-password-field").hidden = verifying;
  $("#auth-password").required = !verifying;
  $("#auth-otp-field").hidden = !verifying;
  $("#auth-otp").required = verifying;
  $("#auth-resend-code").hidden = !verifying;
  $("#auth-email").readOnly = verifying;
  if (email) $("#auth-email").value = email;
  if (!verifying) $("#auth-otp").value = "";
  $("#auth-submit").textContent = verifying ? "Verificar correo" : (signUp ? "Crear cuenta" : "Iniciar sesión");
  $("#auth-mode-signin").classList.toggle("active", mode === "signin");
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
    const response = await fetch(apiUrl("/api/config"), { cache: "no-store" });
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
    apiUrl,
    apiBaseUrl: API_BASE_URL,
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
    async sendVerificationCode(email) {
      const method = authClient?.emailOtp?.sendVerificationOtp;
      if (typeof method !== "function") throw new Error("Neon Auth no expone el envío de códigos OTP en esta configuración.");
      const result = await method({ email, type: "email-verification" });
      if (result?.error) throw new Error(result.error.message || "No se pudo enviar el código.");
      return result;
    },
    async verifyEmail(email, otp) {
      const method = authClient?.emailOtp?.verifyEmail;
      if (typeof method !== "function") throw new Error("Neon Auth no expone la verificación OTP en esta configuración.");
      const result = await method({ email, otp });
      if (result?.error) throw new Error(result.error.message || "El código no es válido o ha expirado.");
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
    const email = String(data.get("email") || "").trim();
    const submit = $("#auth-submit");
    submit.disabled = true;
    if (authFeedback) authFeedback.textContent = mode === "verify" ? "Verificando correo…" : "Conectando con Neon Auth…";
    try {
      if (mode === "signup") {
        await window.JBAuth.signUp(
          String(data.get("name") || "").trim(),
          email,
          String(data.get("password") || "")
        );
        if (erpProfile) {
          authDialog.close();
          authForm.reset();
        } else {
          setAuthMode("verify", email);
          if (authFeedback) authFeedback.textContent = "Cuenta creada. Revisa tu correo e introduce el código de verificación que te envió Neon Auth.";
        }
      } else if (mode === "verify") {
        await window.JBAuth.verifyEmail(email, String(data.get("otp") || "").trim());
        updateAuthControls();
        window.dispatchEvent(new CustomEvent("jb:auth-changed"));
        if (erpProfile) {
          authDialog.close();
          authForm.reset();
        } else if (authFeedback) {
          authFeedback.textContent = profileError || "Correo verificado. Inicia sesión nuevamente para abrir el ERP.";
        }
      } else {
        await window.JBAuth.signIn(email, String(data.get("password") || ""));
        updateAuthControls();
        window.dispatchEvent(new CustomEvent("jb:auth-changed"));
        if (erpProfile) {
          authDialog.close();
          authForm.reset();
        } else if (authFeedback) {
          authFeedback.textContent = profileError || "Sesión iniciada. Verifica tu correo para activar el perfil.";
        }
      }
    } catch (error) {
      if (authFeedback) authFeedback.textContent = error?.message || "No se pudo completar la operación.";
    } finally {
      submit.disabled = false;
    }
  });

  $("#auth-resend-code")?.addEventListener("click", async () => {
    const email = String($("#auth-email")?.value || "").trim();
    const resend = $("#auth-resend-code");
    if (!email || !authClient || authForm?.dataset.mode !== "verify") return;
    resend.disabled = true;
    if (authFeedback) authFeedback.textContent = "Enviando código…";
    try {
      await window.JBAuth.sendVerificationCode(email);
      if (authFeedback) authFeedback.textContent = "Código enviado. Revisa también la carpeta de spam.";
    } catch (error) {
      if (authFeedback) authFeedback.textContent = error?.message || "No se pudo enviar el código.";
    } finally {
      resend.disabled = false;
    }
  });

  window.dispatchEvent(new CustomEvent("jb:auth-ready"));
}

initialize().catch(async (error) => {
  console.error("[bootstrap] Failed to initialize:", error?.message || "unknown error");
  window.JBAuth = { mode: "demo", user: null, profile: null, getToken: async () => null };
  await import("./app.js");
});
