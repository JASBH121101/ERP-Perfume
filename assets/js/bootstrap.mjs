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
let appLoaded = false;

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

async function getToken() {
  if (!authClient) return null;

  let sdkToken = null;
  let sdkError = null;
  try {
    if (typeof authClient.token === "function") {
      const result = await authClient.token();
      if (result?.error) throw new Error(result.error.message || "No se pudo renovar la sesión.");
      sdkToken = result?.data?.token || result?.token || result?.data?.access_token || result?.access_token || null;
    }
  } catch (error) {
    sdkError = error;
  }

  // Neon Auth 0.7 exposes the JWT through token(). Some session responses
  // also include the short-lived JWT directly as session.access_token.
  const sessionToken =
    authSession?.access_token ||
    authSession?.session?.access_token ||
    authSession?.data?.session?.access_token ||
    null;

  const token = sdkToken || sessionToken;
  if (token) return token;
  if (sdkError) throw new Error(sdkError.message || "No se pudo renovar la sesión.");
  return null;
}

async function refreshProfile() {
  if (!authClient) return null;
  const result = await authClient.getSession();
  if (result?.error) throw new Error(result.error.message || "No se pudo consultar la sesión.");

  const data = result?.data || null;
  authSession = data?.session || (data?.user ? data : null);
  authUser = data?.user || authSession?.user || null;
  erpProfile = null;
  profileError = "";

  if (!authUser) return null;

  try {
    const token = await getToken();
    if (!token) {
      profileError = "No se pudo obtener un token válido de la sesión.";
      return null;
    }

    const response = await fetch(apiUrl("/api/auth/profile"), {
      headers: { authorization: "Bearer " + token },
      cache: "no-store"
    });
    const body = await readJson(response);
    if (response.ok && body.user) {
      erpProfile = body.user;
    } else {
      profileError = body?.error?.message || body?.error?.code || "La cuenta todavía no tiene acceso al ERP.";
    }
  } catch (error) {
    profileError = error?.message || "No se pudo validar el perfil del ERP.";
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

function setAuthFeedback(message, isError = false) {
  if (!authFeedback) return;
  authFeedback.textContent = message || "";
  authFeedback.classList.toggle("is-error", Boolean(isError));
}

function lockERP(message = "") {
  document.body.classList.remove("auth-pending", "erp-authorized");
  document.body.classList.add("auth-locked");

  const close = $("#auth-close");
  if (close) close.hidden = true;

  const controls = authForm?.querySelectorAll("input, button") || [];
  controls.forEach((control) => {
    if (control.id === "auth-close") return;
    control.disabled = !authClient;
  });

  if (authClient && authForm) {
    setAuthMode("signin");
    controls.forEach((control) => { control.disabled = false; });
  } else {
    setAuthFeedback(message || "El servicio de autenticación no está disponible. Recarga la página o contacta al administrador.", true);
    const submit = $("#auth-submit");
    if (submit) submit.disabled = true;
    $("#auth-mode-switch").hidden = true;
    $("#auth-name-field").hidden = true;
    $("#auth-otp-field").hidden = true;
  }

  if (message && authClient) setAuthFeedback(message, true);
  if (authDialog && !authDialog.open) authDialog.showModal();
}

function updateAuthControls() {
  const button = $("#auth-control");
  const pill = $("#connection-pill");
  if (pill) {
    const indicator = pill.querySelector("i") || document.createElement("i");
    pill.replaceChildren(indicator, document.createTextNode(" " + (authClient ? "NEON · DESARROLLO" : "ACCESO SEGURO")));
    pill.classList.toggle("connected", Boolean(authClient));
  }

  if (button) {
    button.hidden = !authClient;
    button.textContent = authUser && erpProfile ? "Cerrar sesión" : "Cuenta";
    button.setAttribute("aria-label", authUser && erpProfile ? "Cerrar sesión" : "Abrir acceso");
  }

  const identity = $("#auth-identity");
  if (identity) identity.textContent = erpProfile?.name || authUser?.name || authUser?.email || "Sin sesión";
}

async function openERP() {
  if (!erpProfile) {
    lockERP(profileError || "Verifica tu cuenta antes de acceder al ERP.");
    return false;
  }

  try {
    if (!appLoaded) {
      await import("./app.js");
      appLoaded = true;
    }

    document.body.classList.remove("auth-pending", "auth-locked");
    document.body.classList.add("erp-authorized");

    if (authDialog?.open) authDialog.close();
    if (authFeedback) authFeedback.textContent = "";
    updateAuthControls();
    window.dispatchEvent(new CustomEvent("jb:auth-ready"));
    return true;
  } catch (error) {
    lockERP("No se pudo cargar el ERP: " + (error?.message || "error inesperado"));
    return false;
  }
}

async function initialize() {
  document.body.classList.add("auth-pending");
  let config;

  try {
    const response = await fetch(apiUrl("/api/config"), { cache: "no-store" });
    if (!response.ok) throw new Error("El backend respondió con estado " + response.status + ".");
    config = await readJson(response);
  } catch (error) {
    window.JBAuth = { mode: "unavailable", user: null, profile: null, getToken: async () => null };
    lockERP("No se pudo contactar al servicio seguro del ERP. " + (error?.message || "Intenta recargar."));
    return;
  }

  if (!config.authBaseUrl || config.mode !== "authenticated") {
    window.JBAuth = { mode: "unavailable", user: null, profile: null, getToken: async () => null };
    lockERP("La autenticación todavía no está configurada. Los módulos permanecen bloqueados.");
    return;
  }

  try {
    authClient = createAuthClient(config.authBaseUrl, {
      // Pages and Neon Auth are on different origins. Include the managed
      // Better Auth session cookie so token() can return the user's JWT.
      fetchOptions: { credentials: "include" }
    });
    await refreshProfile();
  } catch (error) {
    console.error("[auth] Initialization failed:", error?.message || "unknown error");
    authClient = null;
    authSession = null;
    authUser = null;
    erpProfile = null;
    lockERP("No se pudo inicializar Neon Auth. " + (error?.message || "Intenta recargar."));
    return;
  }

  window.JBAuth = {
    apiUrl,
    apiBaseUrl: API_BASE_URL,
    mode: "authenticated",
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

  updateAuthControls();

  if (erpProfile) {
    await openERP();
  } else {
    lockERP(authUser
      ? (profileError || "Tu cuenta todavía no puede acceder. Verifica tu correo y vuelve a iniciar sesión.")
      : "Inicia sesión o crea una cuenta para acceder. Ningún módulo se muestra antes de validar tu perfil.");
  }

  $("#auth-control")?.addEventListener("click", async () => {
    if (!authClient) return;

    if (authUser && erpProfile) {
      try {
        await window.JBAuth.signOut();
        updateAuthControls();
        lockERP("Sesión cerrada. Inicia sesión para volver a acceder.");
      } catch (error) {
        setAuthFeedback(error?.message || "No se pudo cerrar sesión.", true);
        if (authDialog && !authDialog.open) authDialog.showModal();
      }
      return;
    }

    if (authDialog && !authDialog.open) authDialog.showModal();
  });

  $("#auth-close")?.addEventListener("click", () => {
    if (!document.body.classList.contains("auth-locked")) authDialog?.close();
  });

  authDialog?.addEventListener("cancel", (event) => {
    if (document.body.classList.contains("auth-locked") || document.body.classList.contains("auth-pending")) {
      event.preventDefault();
    }
  });

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
    setAuthFeedback(mode === "verify" ? "Verificando correo…" : "Conectando con Neon Auth…");

    try {
      if (mode === "signup") {
        await window.JBAuth.signUp(
          String(data.get("name") || "").trim(),
          email,
          String(data.get("password") || "")
        );

        if (erpProfile) {
          await openERP();
          authForm.reset();
        } else {
          setAuthMode("verify", email);
          setAuthFeedback(authUser?.emailVerified === false
            ? "Cuenta creada. Revisa tu correo e introduce el código de verificación."
            : "Cuenta creada. Si Neon Auth requiere verificación, revisa tu correo e introduce el código recibido.");
        }
      } else if (mode === "verify") {
        await window.JBAuth.verifyEmail(email, String(data.get("otp") || "").trim());
        if (erpProfile) {
          await openERP();
          authForm.reset();
        } else {
          setAuthMode("signin", email);
          setAuthFeedback("Correo verificado. Inicia sesión para validar tu perfil del ERP.");
        }
      } else {
        await window.JBAuth.signIn(email, String(data.get("password") || ""));
        if (erpProfile) {
          await openERP();
          authForm.reset();
        } else {
          lockERP(profileError || "La sesión existe, pero el perfil del ERP no fue autorizado.");
        }
      }
    } catch (error) {
      setAuthFeedback(error?.message || "No se pudo completar la operación.", true);
    } finally {
      submit.disabled = false;
    }
  });

  $("#auth-resend-code")?.addEventListener("click", async () => {
    const email = String($("#auth-email")?.value || "").trim();
    const resend = $("#auth-resend-code");
    if (!email || !authClient || authForm?.dataset.mode !== "verify") return;

    resend.disabled = true;
    setAuthFeedback("Enviando código…");
    try {
      await window.JBAuth.sendVerificationCode(email);
      setAuthFeedback("Código enviado. Revisa tu bandeja de entrada y la carpeta de spam.");
    } catch (error) {
      setAuthFeedback(error?.message || "No se pudo enviar el código.", true);
    } finally {
      resend.disabled = false;
    }
  });
}

initialize().catch((error) => {
  console.error("[bootstrap] Failed to initialize:", error?.message || "unknown error");
  window.JBAuth = { mode: "unavailable", user: null, profile: null, getToken: async () => null };
  lockERP("No se pudo iniciar el acceso seguro. " + (error?.message || "Intenta recargar."));
});
