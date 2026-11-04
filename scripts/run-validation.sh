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
