#!/usr/bin/env bash
set -Eeuo pipefail

mkdir -p .ai-output
LOG_FILE=".ai-output/validation.log"
exec > >(tee "$LOG_FILE") 2>&1

echo "=== JB PARFUMS ERP validation ==="
echo "Node: $(node --version)"
echo "Python: $(python3 --version)"

echo
echo "=== JavaScript syntax ==="
node --check assets/js/app.js
node --check assets/js/bootstrap.mjs
node --check playwright.config.mjs
node --check scripts/ai-repair.mjs
node --check scripts/validate-ai-patch.mjs
bash -n scripts/run-validation.sh

echo
echo "=== Dependency remediation gate ==="
node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages || {};
const renderer = packages["node_modules/@react-email/render"];
const htmlToText = Object.entries(packages).find(([path]) => /(^|\/)node_modules\/html-to-text$/.test(path));
const vulnerable = Object.keys(packages).filter((path) => /(^|\/)node_modules\/deepmerge$/.test(path));
if (renderer?.version !== "2.2.0") {
  throw new Error("Expected @react-email/render 2.2.0 in the resolved package lock.");
}
if (!htmlToText || Number(htmlToText[1]?.version?.split(".")[0]) < 10) {
  throw new Error("Expected html-to-text v10 or newer in the resolved package lock.");
}
if (vulnerable.length) {
  throw new Error("Vulnerable deepmerge package remains in the resolved package lock: " + vulnerable.join(", "));
}
console.log("PASS: @react-email/render 2.2.0; html-to-text v10+; no deepmerge package.");
NODE

echo
echo "=== Build Cloudflare Pages output ==="
npm run build

echo "=== Static structure and asset checks ==="
python3 scripts/check-ui.py

echo
echo "=== Import/API deterministic unit tests ==="
npm run test:unit

echo
echo "=== Browser end-to-end tests (Chromium; no screenshots) ==="
npm test -- --reporter=line

echo
echo "=== VALIDATION PASSED ==="
