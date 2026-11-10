const PREVIEW_HOST = "wrangler-preview.erp-perfume.pages.dev";
const enabled = window.location.hostname === PREVIEW_HOST &&
  new URLSearchParams(window.location.search).get("perf") === "1";

const entries = [];
let panel = null;
let rowsNode = null;
let isClosed = false;

function safeDetails(details = {}) {
  const result = {};
  if (Number.isFinite(Number(details.status))) result.status = Number(details.status);
  if (Number.isFinite(Number(details.bytes))) result.bytes = Math.max(0, Math.round(Number(details.bytes)));
  if (Number.isFinite(Number(details.count))) result.count = Math.max(0, Math.round(Number(details.count)));
  return result;
}

function formatMilliseconds(value) {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value) + " ms";
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return Math.round(value) + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  return (value / (1024 * 1024)).toFixed(2) + " MB";
}

function navigationMetrics() {
  const navigation = performance.getEntriesByType("navigation")[0];
  const paints = performance.getEntriesByType("paint");
  const fcp = paints.find(item => item.name === "first-contentful-paint");
  return {
    domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
    loadMs: navigation?.loadEventEnd ?? null,
    ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : null,
    fcpMs: fcp?.startTime ?? null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType || null,
      downlinkMbps: Number.isFinite(navigator.connection.downlink)
        ? navigator.connection.downlink : null,
      rttMs: Number.isFinite(navigator.connection.rtt)
        ? navigator.connection.rtt : null
    } : null
  };
}

function aggregateEntries() {
  const grouped = new Map();
  for (const entry of entries) {
    const current = grouped.get(entry.name) || {
      name: entry.name,
      calls: 0,
      totalMs: 0,
      maxMs: 0,
      bytes: 0,
      errors: 0,
      lastStatus: null
    };
    current.calls += 1;
    current.totalMs += entry.durationMs;
    current.maxMs = Math.max(current.maxMs, entry.durationMs);
    current.bytes += entry.bytes || 0;
    current.errors += entry.status != null && entry.status >= 400 ? 1 : 0;
    current.lastStatus = entry.status ?? current.lastStatus;
    grouped.set(entry.name, current);
  }
  return [...grouped.values()];
}

export function getPerformanceReport() {
  return {
    diagnostic: "JB PARFUMS ERP preview only",
    capturedAt: new Date().toISOString(),
    navigation: navigationMetrics(),
    stages: aggregateEntries().map(item => ({
      ...item,
      totalMs: Number(item.totalMs.toFixed(1)),
      maxMs: Number(item.maxMs.toFixed(1))
    }))
  };
}

function renderPanel() {
  if (!enabled || isClosed || !document.body) return;
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "jb-performance-diagnostics";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Diagnóstico de rendimiento");
    Object.assign(panel.style, {
      position: "fixed",
      left: "10px",
      bottom: "10px",
      width: "min(360px, calc(100vw - 20px))",
      maxHeight: "42vh",
      overflow: "auto",
      zIndex: "2147483000",
      background: "#171511",
      color: "#f5f1e9",
      border: "1px solid rgba(218,181,111,.55)",
      borderRadius: "12px",
      boxShadow: "0 8px 30px rgba(0,0,0,.28)",
      padding: "10px 12px",
      font: "12px/1.45 system-ui, sans-serif"
    });

    const heading = document.createElement("div");
    Object.assign(heading.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      fontWeight: "700",
      marginBottom: "7px"
    });
    const headingText = document.createElement("span");
    headingText.textContent = "Diagnóstico de carga · Preview";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Cerrar diagnóstico");
    Object.assign(close.style, {
      border: "0",
      background: "transparent",
      color: "inherit",
      fontSize: "20px",
      lineHeight: "1",
      padding: "0 4px",
      cursor: "pointer"
    });
    close.addEventListener("click", () => {
      isClosed = true;
      panel?.remove();
      panel = null;
    });
    heading.append(headingText, close);

    const nav = document.createElement("div");
    nav.id = "jb-performance-navigation";
    Object.assign(nav.style, {
      color: "#d6c9ad",
      borderBottom: "1px solid rgba(255,255,255,.14)",
      paddingBottom: "7px",
      marginBottom: "7px"
    });

    rowsNode = document.createElement("div");
    rowsNode.id = "jb-performance-stages";

    const footer = document.createElement("div");
    Object.assign(footer.style, {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: "8px"
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copiar métricas";
    Object.assign(copy.style, {
      border: "1px solid rgba(218,181,111,.65)",
      borderRadius: "7px",
      background: "transparent",
      color: "inherit",
      padding: "5px 8px",
      cursor: "pointer"
    });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(getPerformanceReport(), null, 2));
        copy.textContent = "Copiado";
      } catch {
        copy.textContent = "No disponible";
      }
    });
    footer.appendChild(copy);
    panel.append(heading, nav, rowsNode, footer);
    document.body.appendChild(panel);
  }

  const navData = navigationMetrics();
  const navNode = panel.querySelector("#jb-performance-navigation");
  navNode.textContent =
    "TTFB " + formatMilliseconds(navData.ttfbMs) +
    " · DOM " + formatMilliseconds(navData.domContentLoadedMs) +
    " · FCP " + formatMilliseconds(navData.fcpMs) +
    " · " + navData.viewport.width + "×" + navData.viewport.height;

  rowsNode.replaceChildren();
  const aggregated = aggregateEntries();
  if (!aggregated.length) {
    const empty = document.createElement("div");
    empty.textContent = "Esperando actividad de autenticación y módulos…";
    empty.style.color = "#d6c9ad";
    rowsNode.appendChild(empty);
    return;
  }
  for (const item of aggregated) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      gap: "8px",
      padding: "3px 0",
      borderBottom: "1px solid rgba(255,255,255,.08)"
    });
    const label = document.createElement("span");
    label.textContent = item.name + (item.calls > 1 ? " ×" + item.calls : "");
    label.style.color = item.errors ? "#ffc17a" : "#f5f1e9";
    const value = document.createElement("strong");
    value.textContent = formatMilliseconds(item.totalMs) +
      (item.bytes ? " · " + formatBytes(item.bytes) : "");
    value.style.whiteSpace = "nowrap";
    row.append(label, value);
    rowsNode.appendChild(row);
  }
}

export function recordPerformance(name, durationMs, details = {}) {
  if (!enabled || typeof name !== "string" || !name) return;
  entries.push({
    name: name.slice(0, 60),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Number(durationMs)) : 0,
    ...safeDetails(details)
  });
  renderPanel();
}

export function startPerformanceSpan(name) {
  if (!enabled) return () => {};
  const startedAt = performance.now();
  let finished = false;
  return (details = {}) => {
    if (finished) return;
    finished = true;
    recordPerformance(name, performance.now() - startedAt, details);
  };
}

if (enabled) {
  window.addEventListener("load", () => {
    window.setTimeout(renderPanel, 0);
  }, { once: true });
  window.addEventListener("jb:auth-ready", renderPanel);
  if (document.readyState !== "loading") renderPanel();
  else document.addEventListener("DOMContentLoaded", renderPanel, { once: true });
}
