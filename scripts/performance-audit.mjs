import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baselineUrl = process.env.PERF_BASELINE_URL || "https://erp-perfume.pages.dev";
const previewUrl = process.env.PERF_PREVIEW_URL || "https://wrangler-preview.erp-perfume.pages.dev";
const repetitions = Math.max(3, Math.min(7, Number(process.env.PERF_REPETITIONS || 5)));
const outputPath = process.env.PERF_OUTPUT || "performance-report.json";

const profiles = [
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    latency: 150,
    cpuThrottlingRate: 4
  },
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    downloadThroughput: 10_000_000 / 8,
    uploadThroughput: 2_000_000 / 8,
    latency: 40,
    cpuThrottlingRate: 1
  }
];

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseline: baselineUrl,
  preview: previewUrl,
  repetitions,
  profiles: {}
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function summarize(samples) {
  const keys = [
    "ttfbMs", "domContentLoadedMs", "loadMs", "lcpMs",
    "transferredBytes", "jsBytes", "cssBytes", "resourceCount"
  ];
  const result = {};
  for (const key of keys) {
    const values = samples.map(sample => sample[key]).filter(Number.isFinite);
    result[key] = values.length ? median(values) : null;
  }
  result.failedRequests = median(samples.map(sample => sample.failedRequests));
  result.pageErrors = median(samples.map(sample => sample.pageErrors));
  return result;
}

async function measure(url, profile) {
  const samples = [];
  for (let iteration = 0; iteration < repetitions; iteration += 1) {
    const context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch
    });
    const page = await context.newPage();
    const failed = [];
    let pageErrors = 0;

    await page.addInitScript(() => {
      window.__jbPerf = { lcpMs: null };
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            window.__jbPerf.lcpMs = entry.startTime;
          }
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
    });
    page.on("requestfailed", request => {
      failed.push({
        resourceType: request.resourceType(),
        error: request.failure()?.errorText || "request failed"
      });
    });
    page.on("pageerror", () => { pageErrors += 1; });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: profile.downloadThroughput,
      uploadThroughput: profile.uploadThroughput,
      latency: profile.latency
    });
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: profile.cpuThrottlingRate
    });

    let responseStatus = null;
    try {
      const response = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
      responseStatus = response?.status() ?? null;
      await page.waitForTimeout(1_000);
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const bytes = entries => entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
        const paints = performance.getEntriesByType("paint");
        return {
          ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : null,
          domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
          loadMs: navigation?.loadEventEnd ?? null,
          lcpMs: window.__jbPerf?.lcpMs ?? paints.find(entry => entry.name === "first-contentful-paint")?.startTime ?? null,
          transferredBytes: bytes(resources) + (navigation?.transferSize || 0),
          jsBytes: bytes(resources.filter(entry => /\.m?js(?:$|\?)/i.test(entry.name))),
          cssBytes: bytes(resources.filter(entry => /\.css(?:$|\?)/i.test(entry.name))),
          resourceCount: resources.length,
          documentTitle: document.title,
          bodyPresent: Boolean(document.body)
        };
      });
      if (responseStatus === null || responseStatus >= 400 || !metrics.bodyPresent) {
        throw new Error("The page did not return a successful document response.");
      }
      samples.push({
        ...metrics,
        failedRequests: failed.length,
        pageErrors,
        responseStatus
      });
    } catch (error) {
      samples.push({
        ttfbMs: null, domContentLoadedMs: null, loadMs: null, lcpMs: null,
        transferredBytes: null, jsBytes: null, cssBytes: null, resourceCount: 0,
        failedRequests: failed.length, pageErrors, responseStatus,
        error: String(error?.message || error)
      });
    } finally {
      await context.close();
    }
  }

  const successful = samples.filter(sample => sample.responseStatus && sample.responseStatus < 400 && !sample.error);
  return {
    samples,
    summary: successful.length ? summarize(successful) : null,
    successfulRuns: successful.length,
    failedRuns: samples.length - successful.length
  };
}

function deltaPercent(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  return Number(((after - before) / before * 100).toFixed(1));
}

try {
  for (const profile of profiles) {
    console.log("Measuring " + profile.name + " profile...");
    const baseline = await measure(baselineUrl, profile);
    const preview = await measure(previewUrl, profile);

    const comparison = {};
    for (const metric of [
      "ttfbMs", "domContentLoadedMs", "loadMs", "lcpMs",
      "transferredBytes", "jsBytes", "cssBytes"
    ]) {
      comparison[metric + "ChangePercent"] = deltaPercent(
        baseline.summary?.[metric],
        preview.summary?.[metric]
      );
    }
    report.profiles[profile.name] = { baseline, preview, comparison };
  }

  const diagnosticsContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  try {
    const diagnosticsPage = await diagnosticsContext.newPage();
    await diagnosticsPage.goto(new URL("/?perf=1", previewUrl).href, {
      waitUntil: "load",
      timeout: 45_000
    });
    const diagnosticsPanel = diagnosticsPage.locator("#jb-performance-diagnostics");
    await diagnosticsPanel.waitFor({ state: "visible", timeout: 5_000 });
    const panelText = await diagnosticsPanel.innerText();
    if (!panelText.includes("Diagnóstico de carga")) {
      throw new Error("The preview-only diagnostics panel did not render its expected heading.");
    }
    report.diagnosticsPanel = { visible: true, previewOnly: true };
  } finally {
    await diagnosticsContext.close();
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  for (const [profileName, result] of Object.entries(report.profiles)) {
    console.log(JSON.stringify({
      profile: profileName,
      baseline: result.baseline.summary,
      preview: result.preview.summary,
      comparison: result.comparison
    }));
  }

  if (Object.values(report.profiles).some(value =>
    value.baseline.successfulRuns < 3 || value.preview.successfulRuns < 3
  )) {
    throw new Error("Fewer than three successful page loads were measured for a target/profile.");
  }
} finally {
  await browser.close();
}
