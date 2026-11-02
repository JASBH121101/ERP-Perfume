import fs from 'node:fs/promises';

const allowed = new Set(['index.html', 'assets/css/styles.css', 'assets/js/app.js']);
const patchPath = process.argv[2] || '.ai-output/repair.patch';
const planPath = '.ai-output/repair-plan.json';

function fail(message) {
  console.error('AI PATCH REJECTED:', message);
  process.exit(1);
}

const patch = await fs.readFile(patchPath, 'utf8');
const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));

if (plan.decision !== 'safe_fix' || plan.risk_level !== 'low') fail('AI classification is not low risk.');
if (!patch.trim() || patch.length > 24_000) fail('Patch is empty or too large.');
if (/^(new file mode|deleted file mode|rename from|rename to|copy from|copy to|GIT binary patch)/m.test(patch)) {
  fail('New, deleted, renamed, copied or binary files are not permitted.');
}
if (patch.includes(String.fromCharCode(0))) fail('Binary content is not permitted.');

const headers = [...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)];
if (!headers.length || headers.length > allowed.size) fail('Patch must contain one to three ordinary file diffs.');

const actualPaths = [];
for (const header of headers) {
  const oldPath = header[1];
  const newPath = header[2];
  if (oldPath !== newPath) fail('Renames are not permitted.');
  if (oldPath.startsWith('/') || oldPath.includes('..') || oldPath.includes(String.fromCharCode(92))) {
    fail('Unsafe path detected.');
  }
  if (!allowed.has(oldPath)) fail('File is outside the UI allowlist: ' + oldPath);
  actualPaths.push(oldPath);
}

if (new Set(actualPaths).size !== actualPaths.length) fail('Duplicate file sections are not permitted.');

const declared = [...new Set(plan.changed_paths || [])].sort();
const actual = [...actualPaths].sort();
if (JSON.stringify(declared) !== JSON.stringify(actual)) fail('Declared file list does not match patch headers.');

for (const file of actualPaths) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('Only existing regular files may be changed: ' + file);
  } catch {
    fail('The patch references a file that does not already exist: ' + file);
  }
}

console.log('PASS: low-risk classification, path allowlist, existing files and patch structure.');
