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
let authBaseUrl = "";
let erpProfile = null;
let profileError = "";
let appLoaded = false;
let allowInviteActivation = false;
let authEnvironment = "unknown";

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function extractJwt(value) {
  const candidates = [
    value,
    value?.token,
    value?.access_token,
    value?.data?.token,
    value?.data?.access_token,
    value?.data?.session?.access_token,
    value?.session?.access_token
  ];
  return candidates.find((item) => typeof item === "string" && item.split(".").length === 3) || null;
}

async function getToken() {
  if (!authClient) return null;

  // Fetch the short-lived JWT from Neon Auth using its HttpOnly session cookie.
  // Do not use authClient.token(): SDK versions may return cached session data
  // rather than the signed JWT required by the ERP Worker.
  let endpointError = "";
  if (authBaseUrl) {
    try {
      const response = await fetch(authBaseUrl + "/token", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      const body = await readJson(response);
      const directToken = extractJwt(body);
      if (response.ok && directToken) return directToken;
      endpointError = response.ok
        ? "El servicio de acceso respondió, pero no entregó una sesión válida."
        : "El servicio de acceso respondió HTTP " + response.status + " al solicitar el JWT.";
    } catch (error) {
      endpointError = "No se pudo consultar el servicio de sesión. " +
        (error?.message || "Comprueba la conexión y las cookies del navegador.");
    }
  }

  // Use the documented client helper when available, then session payloads.
  try {
    if (typeof authClient.getJWTToken === "function") {
      const result = await authClient.getJWTToken();
      const helperToken = extractJwt(result);
      if (helperToken) return helperToken;
    }
  } catch (error) {
    if (!endpointError) endpointError = error?.message || "No se pudo renovar la sesión.";
  }

  const sessionToken = extractJwt(authSession);
  if (sessionToken) return sessionToken;

  throw new Error(endpointError || "No se recibió una sesión válida. Cierra sesión, vuelve a iniciar y comprueba que el navegador permita cookies.");
}

function updateSidebarIdentity(profile) {
  const name = String(profile?.name || "").trim() || "Usuario";
  const position = String(profile?.positionTitle || "").trim() ||
    (profile?.role === "owner" ? "Propietario" : "Cargo no asignado");
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => Array.from(part)[0]?.toLocaleUpperCase("es") || "")
    .join("") || "JB";

  const nameNode = document.getElementById("sidebar-profile-name");
  const positionNode = document.getElementById("sidebar-profile-position");
  const avatarNodes = [
    document.getElementById("sidebar-profile-avatar"),
    document.querySelector(".top-avatar")
  ];
  if (nameNode) nameNode.textContent = name;
  if (positionNode) positionNode.textContent = position;
  avatarNodes.forEach(node => {
    if (node) node.textContent = initials;
  });
  document.querySelector(".profile-button")?.setAttribute(
    "aria-label", "Cuenta de " + name + ", " + position
  );
  document.querySelector(".top-avatar")?.setAttribute(
    "aria-label", "Perfil de " + name
  );
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
  updateSidebarIdentity(null);

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
      updateSidebarIdentity(erpProfile);
    } else {
      profileError = body?.error?.message || body?.error?.code || "La cuenta todavía no tiene acceso al ERP.";
      updateSidebarIdentity(null);
    }
  } catch (error) {
    profileError = error?.message || "No se pudo validar el perfil del ERP.";
  }

  return erpProfile;
}

function setAuthMode(mode, email = "") {
  if (!authForm) return;
  const signingUp = mode === "signup";
  const verifying = mode === "verify";
  const recoveryRequest = mode === "recovery-request";
  const invitePasswordReset = mode === "invite-password-reset";
  const recoveryReset = mode === "recovery-reset" || invitePasswordReset;
  const signingIn = mode === "signin";
  const enteringPassword = signingIn || signingUp;
  const inviteVerifying = mode === "invite-verify";
  const showingOtp = verifying || inviteVerifying || recoveryReset;

  const previousMode = authForm.dataset.mode || "";
  authForm.dataset.mode = mode;
  $("#auth-name-field").hidden = !signingUp;
  $("#auth-name").required = signingUp;
  $("#auth-password-field").hidden = !enteringPassword;
  $("#auth-password").required = enteringPassword;
  $("#auth-password").autocomplete = signingUp ? "new-password" : "current-password";
  $("#auth-otp-field").hidden = !showingOtp;
  $("#auth-otp").required = showingOtp;
  $("#auth-new-password-field").hidden = !recoveryReset;
  $("#auth-new-password").required = recoveryReset;
  $("#auth-confirm-password-field").hidden = !recoveryReset;
  $("#auth-confirm-password").required = recoveryReset;
  $("#auth-resend-code").hidden = !showingOtp;
  $("#auth-email").readOnly = showingOtp;
  $("#auth-forgot-password").hidden = !signingIn;
  $("#auth-back-to-signin").hidden = signingIn;
  $("#auth-enroll-actions").hidden = !(signingIn && allowInviteActivation && !authUser);

  const otpLabel = $("#auth-otp-label");
  if (otpLabel) otpLabel.textContent = (verifying || inviteVerifying) ? "Código de verificación" : invitePasswordReset ? "Segundo código para crear contraseña" : "Código de recuperación";
  const gateNote = $(".auth-gate-note");
  if (gateNote) {
    gateNote.textContent = signingUp
      ? "El registro público está deshabilitado. Las cuentas las crea únicamente el propietario."
      : inviteVerifying
        ? "Ingresá el código de verificación que recibiste para confirmar tu correo. Después enviaremos un segundo código para crear tu contraseña."
        : invitePasswordReset
          ? "Tu correo ya está verificado. Ahora introducí el segundo código que acabamos de enviar para establecer tu contraseña. El primer código ya no sirve en este paso. Esto todavía no activa tu acceso al ERP."
          : "Iniciá sesión con una cuenta previamente creada y habilitada por el propietario. Verificar el correo no concede acceso al ERP por sí solo.";
  }
  const recoveryNote = $("#auth-recovery-note");
  if (recoveryNote) {
    recoveryNote.hidden = !(recoveryRequest || recoveryReset);
    recoveryNote.textContent = invitePasswordReset
      ? "Revisá el correo más reciente: introducí el segundo código enviado después de verificar tu correo. Luego establecé tu contraseña. No uses el código anterior."
      : recoveryReset
        ? "Escribe el código de seis dígitos recibido por correo y establece tu nueva contraseña. El SMS aún no está habilitado: requiere verificar el celular y conectar un proveedor de mensajes."
      : "Por ahora puedes recibir el código de recuperación en tu correo. El celular se guarda en RR. HH., pero todavía no está vinculado ni verificado para restablecer contraseñas por SMS.";
  }

  if (email) $("#auth-email").value = email;
  // Verification and password-reset OTPs are different credentials. Clear
  // the previous value whenever the UI advances to another authentication step.
  if (previousMode !== mode || !showingOtp) $("#auth-otp").value = "";
  if (!recoveryReset) {
    $("#auth-new-password").value = "";
    $("#auth-confirm-password").value = "";
  }
  if (!signingUp) $("#auth-name").value = "";

  $("#auth-submit").textContent = verifying
    ? "Verificar correo"
    : recoveryRequest
      ? "Enviar código"
      : recoveryReset
        ? "Cambiar contraseña"
        : inviteVerifying
          ? "Verificar invitación"
          : signingUp
          ? "Crear cuenta"
          : "Iniciar sesión";
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
    $("#auth-mode-switch")?.setAttribute("hidden", "");
    $("#auth-name-field")?.setAttribute("hidden", "");
    $("#auth-otp-field").hidden = true;
    $("#auth-enroll-actions")?.setAttribute("hidden", "");
  }

  if (message && authClient) setAuthFeedback(message, true);
  if (authDialog && !authDialog.open) authDialog.showModal();
}

function updateAuthControls() {
  const button = $("#auth-control");
  const pill = $("#connection-pill");
  if (pill) {
    const indicator = pill.querySelector("i") || document.createElement("i");
    const environmentLabel = authEnvironment === "production" ? "PRODUCCIÓN" : authEnvironment === "development" ? "DESARROLLO" : "ACCESO SEGURO";
    pill.replaceChildren(indicator, document.createTextNode(" " + (authClient ? environmentLabel : "ACCESO SEGURO")));
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
      await import("./app.js?v=20261110-access-mobile-1");
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
    authEnvironment = String(config.environment || "unknown").trim().toLowerCase();
    // The initial enrollment entry point is exposed only on the production deployment.
    allowInviteActivation = true;
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

  authBaseUrl = String(config.authBaseUrl);
  while (authBaseUrl.endsWith("/")) authBaseUrl = authBaseUrl.slice(0, -1);

  try {
    authClient = createAuthClient(authBaseUrl, {
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
    lockERP("No se pudo inicializar el servicio de acceso. " + (error?.message || "Intenta recargar."));
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
    async signUp(email, password, name) {
      const method = authClient?.signUp?.email;
      if (typeof method !== "function") throw new Error("El registro por correo y contraseña no está disponible.");
      const result = await method({ email, password, name });
      if (result?.error) throw new Error(result.error.message || "No se pudo crear la cuenta.");
      return result;
    },
    async signIn(email, password) {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) throw new Error(result.error.message || "No se pudo iniciar sesión.");
      await refreshProfile();
      return result;
    },
    async sendVerificationCode(email) {
      const method = authClient?.emailOtp?.sendVerificationOtp;
      if (typeof method !== "function") throw new Error("El envío de códigos de verificación no está disponible.");
      const result = await method({ email, type: "email-verification" });
      if (result?.error) throw new Error(result.error.message || "No se pudo enviar el código.");
      return result;
    },
    async createInvitedIdentity(email, name) {
      if (erpProfile?.role !== "owner" || authUser?.role !== "admin") {
        throw new Error("Solo el propietario puede crear invitaciones.");
      }
      const method = authClient?.admin?.createUser;
      if (typeof method !== "function") throw new Error("La API administrativa de Neon Auth no está disponible.");
      const bytes = new Uint8Array(36);
      crypto.getRandomValues(bytes);
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*-_";
      const temporaryPassword = "Aa1!" + Array.from(bytes, value => alphabet[value % alphabet.length]).join("");
      const result = await method({ email, name, password: temporaryPassword, role: "user" });
      if (result?.error) throw new Error(result.error.message || "Neon Auth no pudo crear la identidad.");
      const createdUser = result.data?.user || result.user || result.data || null;
      try {
        await window.JBAuth.sendVerificationCode(email);
      } catch (error) {
        const invitationError = new Error("La identidad se creó, pero no se pudo enviar el código de verificación. Reenvíalo desde Identidades pendientes. " + (error?.message || ""));
        invitationError.identityCreated = true;
        throw invitationError;
      }
      return createdUser;
    },
    async sendPasswordRecoveryCode(email) {
      const method = authClient?.forgetPassword?.emailOtp;
      if (typeof method !== "function") throw new Error("La recuperación de contraseña por correo no está disponible.");
      const result = await method({ email });
      if (result?.error) throw new Error(result.error.message || "No se pudo solicitar el código de recuperación.");
      return result;
    },
    async resetPasswordWithEmailOtp(email, otp, password) {
      const method = authClient?.emailOtp?.resetPassword;
      if (typeof method !== "function") throw new Error("El cambio de contraseña no está disponible.");
      const result = await method({ email, otp, password });
      if (result?.error) throw new Error(result.error.message || "El código no es válido o ya expiró.");
      return result;
    },
    async verifyEmail(email, otp) {
      const method = authClient?.emailOtp?.verifyEmail;
      if (typeof method !== "function") throw new Error("La verificación del código no está disponible.");
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
      updateSidebarIdentity(null);
    }
  };

  updateAuthControls();

  if (erpProfile) {
    await openERP();
  } else {
    lockERP(authUser
      ? (profileError || "Tu cuenta todavía no puede acceder. Verifica tu correo y vuelve a iniciar sesión.")
      : "Inicia sesión con una cuenta creada por el propietario. Si recibiste una invitación, usa Activar invitación para verificar tu correo y establecer tu contraseña.");
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


  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authClient || !authForm.reportValidity()) return;

    const data = new FormData(authForm);
    const mode = authForm.dataset.mode;
    const email = String(data.get("email") || "").trim();
    const submit = $("#auth-submit");
    submit.disabled = true;
    setAuthFeedback(mode === "verify" ? "Verificando correo…" : "Conectando…");

    try {
      if (mode === "signup") {
        const name = String(data.get("name") || "").trim();
        const password = String(data.get("password") || "");
        if (!name || name.length > 120) throw new Error("Escribe tu nombre completo (máximo 120 caracteres).");
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        await window.JBAuth.signUp(email, password, name);
        setAuthMode("verify", email);
        setAuthFeedback("Cuenta creada. Te enviamos un código de seis dígitos; verifica el correo para activar el acceso inicial del propietario.");
      } else if (mode === "invite-verify") {
        await window.JBAuth.verifyEmail(email, String(data.get("otp") || "").trim());
        // Move to the password step immediately. If email delivery fails, the
        // invitee can resend the reset code without reusing the consumed OTP.
        setAuthMode("invite-password-reset", email);
        setAuthFeedback("Correo verificado. Enviando el segundo código para crear tu contraseña…");
        await window.JBAuth.sendPasswordRecoveryCode(email);
        setAuthFeedback("Correo verificado. Te enviamos un segundo código. Revisá Gmail, introducilo aquí y establecé tu contraseña.");
      } else if (mode === "verify") {
        await window.JBAuth.verifyEmail(email, String(data.get("otp") || "").trim());
        if (erpProfile) {
          await openERP();
          authForm.reset();
        } else {
          setAuthMode("signin", email);
          setAuthFeedback("Correo verificado. Inicia sesión para validar tu perfil del ERP.");
        }
      } else if (mode === "recovery-request") {
        await window.JBAuth.sendPasswordRecoveryCode(email);
        setAuthMode("recovery-reset", email);
        setAuthFeedback("Si existe una cuenta con ese correo, enviamos un código de seis dígitos. Revisa también la carpeta de spam.");
      } else if (mode === "recovery-reset" || mode === "invite-password-reset") {
        const otp = String(data.get("otp") || "").trim();
        const password = String(data.get("newPassword") || "");
        const confirmation = String(data.get("confirmPassword") || "");
        if (password.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
        if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
        await window.JBAuth.resetPasswordWithEmailOtp(email, otp, password);
        setAuthMode("signin", email);
        $("#auth-password").value = "";
        setAuthFeedback("Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.");
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
      const message = mode === "recovery-request"
        ? "No pudimos iniciar la recuperación. Comprueba el correo e inténtalo nuevamente."
        : (error?.message || "No se pudo completar la operación.");
      setAuthFeedback(message, true);
    } finally {
      submit.disabled = false;
    }
  });

  $("#auth-signup-start")?.addEventListener("click", () => {
    if (!allowInviteActivation || authUser) return;
    const email = String($("#auth-email")?.value || "").trim();
    if (!email) {
      setAuthFeedback("Escribe el correo al que el propietario envió la invitación.", true);
      $("#auth-email")?.focus();
      return;
    }
    // The owner already sent the first verification OTP when creating the invite.
    // Do not invalidate it by sending a second code as soon as the invitee opens the form.
    setAuthMode("invite-verify", email);
    setAuthFeedback("Ingresa el código que llegó en la invitación. Si no lo encuentras, pulsa Reenviar código.");
  });

  $("#auth-forgot-password")?.addEventListener("click", () => {
    const email = String($("#auth-email")?.value || "").trim();
    setAuthMode("recovery-request", email);
  });

  $("#auth-back-to-signin")?.addEventListener("click", () => {
    const email = String($("#auth-email")?.value || "").trim();
    setAuthMode("signin", email);
  });

  $("#auth-resend-code")?.addEventListener("click", async () => {
    const email = String($("#auth-email")?.value || "").trim();
    const resend = $("#auth-resend-code");
    const mode = authForm?.dataset.mode;
    if (!email || !authClient || !["verify", "invite-verify", "recovery-reset"].includes(mode)) return;

    resend.disabled = true;
    setAuthFeedback("Enviando código…");
    try {
      if (mode === "recovery-reset" || mode === "invite-password-reset") {
        await window.JBAuth.sendPasswordRecoveryCode(email);
        setAuthFeedback(mode === "invite-password-reset"
          ? "Enviamos un nuevo segundo código para crear tu contraseña. Usá el más reciente."
          : "Si existe una cuenta con ese correo, enviamos un nuevo código.");
      } else {
        await window.JBAuth.sendVerificationCode(email);
        setAuthFeedback("Código enviado. Revisa tu bandeja de entrada y la carpeta de spam.");
      }
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
