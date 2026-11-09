export const DEVELOPMENT_API_BASE_URL =
  "https://jb-parfums-erp-api.jaredblancoh19.workers.dev";

export function resolveApiBaseUrl({
  deploymentTarget = "preview",
  apiBaseUrl = ""
} = {}) {
  const target = String(deploymentTarget || "preview").trim().toLowerCase();
  if (!["preview", "production"].includes(target)) {
    throw new Error("ERP_DEPLOY_TARGET must be preview or production.");
  }

  const configured = String(apiBaseUrl || "").trim();
  if (target === "production" && !configured) {
    throw new Error("Production builds require ERP_API_BASE_URL; refusing to use the Development API.");
  }

  const candidate = configured || DEVELOPMENT_API_BASE_URL;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("ERP_API_BASE_URL must be a valid absolute HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new Error("ERP_API_BASE_URL must use HTTPS and must not contain credentials, a query, or a fragment.");
  }

  const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  if (target === "production" && normalized === DEVELOPMENT_API_BASE_URL) {
    throw new Error("Production cannot use the Neon Development API endpoint.");
  }
  return normalized;
}

export function injectApiBaseUrl(html, apiBaseUrl) {
  const tagPattern = /<meta\s+name=["']jb-api-base-url["']\s+content=["'][^"']*["']\s*\/?>/i;
  if (!tagPattern.test(String(html))) {
    throw new Error('The HTML shell is missing the jb-api-base-url meta tag.');
  }
  return String(html).replace(tagPattern, '<meta name="jb-api-base-url" content="' +
    String(apiBaseUrl).replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">');
}
