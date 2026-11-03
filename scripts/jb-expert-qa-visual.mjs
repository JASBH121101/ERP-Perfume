import { createServer } from "node:http";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { auditViewports } from "../.jb-expert-qa/src/adapters/playwright/audit-url.js";
import { formatReport } from "../.jb-expert-qa/src/reporters/index.js";

await import("./build.mjs");

const root = await realpath(process.cwd());
const siteRoot = await realpath(resolve(root, "dist"));
const outputDir = resolve(root, ".ai-output/jb-expert-qa-visual");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname !== "/index.html" && !pathname.startsWith("/assets/")) {
    response.writeHead(403, { "cache-control": "no-store" });
    response.end("Only the ERP entry page and static assets are available in the QA preview.");
    return;
  }

  const filePath = resolve(siteRoot, "." + pathname);
  const relativePath = relative(siteRoot, filePath);
  if (relativePath === ".." || relativePath.startsWith(".." + sep)) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const fileStats = await lstat(filePath);
    const actualPath = await realpath(filePath);
    const actualRelative = relative(siteRoot, actualPath);
    if (fileStats.isSymbolicLink() || !fileStats.isFile() || actualRelative === ".." || actualRelative.startsWith(".." + sep)) {
      throw new Error("Not an allowed regular file");
    }
    const content = await readFile(actualPath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "content-length": content.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "cache-control": "no-store" });
    response.end("Not found");
  }
});

const config = {
  profile: "jb-parfums-erp-visual",
  weights: {
    responsive: 20,
    "ui-ux": 35,
    accessibility: 20,
    performance: 10,
    functional: 10,
    consistency: 5
  },
  severityPenalties: { critical: 25, high: 12, medium: 5, low: 2, info: 0 },
  thresholds: {
    minimumScore: 0,
    failOnCritical: true,
    minimumBodyFontPx: 11,
    largeEmptySpacePx: 240,
    minimumTargetSizePx: 24
  }
};

await mkdir(outputDir, { recursive: true });
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});

try {
  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port + "/";
  const report = await auditViewports(origin, {
    config,
    viewports: [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1365, height: 900 }
    ],
    screenshotDir: resolve(outputDir, "screenshots"),
    screenshotFullPage: false,
    timeout: 20000,
    runAxe: true,
    allowPrivateNetworks: true,
    sameOriginOnly: true,
    interactionExploration: true,
    maxInteractionActions: 12
  });

  const allOverlaps = report.viewports.flatMap((viewport) =>
    (viewport.findings ?? [])
      .filter((item) => item.id?.startsWith("UIUX-004-"))
      .map((item) => ({ viewport: viewport.name, finding: item }))
  );
  const highOverlaps = report.viewports.flatMap((viewport) =>
    (viewport.findings ?? [])
      .filter((item) => item.id?.startsWith("UIUX-004-") && item.severity === "high")
      .map((item) => ({ viewport: viewport.name, finding: item }))
  );

  await writeFile(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(resolve(outputDir, "report.html"), formatReport(report, "html"), "utf8");
  await writeFile(resolve(outputDir, "report.md"), formatReport(report, "markdown"), "utf8");

  console.log("JB Expert QA visual profile:", config.profile);
  console.log("Engine:", report.version);
  console.log("Viewports:", report.summary.viewportsChecked);
  console.log("Passed viewports:", report.summary.passedViewports);
  const interactionStates = report.viewports.reduce((sum, viewport) => sum + (viewport.evidence?.interactionStatesChecked ?? 0), 0);
  const interactionActions = report.viewports.reduce((sum, viewport) => sum + (viewport.evidence?.interactionActionsAttempted ?? 0), 0);
  console.log("Interactive states explored:", interactionStates);
  console.log("Interaction actions attempted:", interactionActions);
  console.log("Interactive collisions:", allOverlaps.length);
  console.log("High-severity blocked controls:", highOverlaps.length);
  console.log("Same-origin-only:", true);

  for (const item of highOverlaps) {
    console.error(
      "[" + item.viewport + "] " + item.finding.location + " — " +
      item.finding.description
    );
  }

  if (!report.passed || highOverlaps.length > 0) {
    console.error("JB Expert QA visual gate failed. Review .ai-output/jb-expert-qa-visual/report.html and screenshots.");
    process.exitCode = 1;
  } else {
    console.log("JB Expert QA visual gate passed.");
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
