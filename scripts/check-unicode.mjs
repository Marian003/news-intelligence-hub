// Fails the build if any tracked text file contains a non-printing Unicode
// character: zero-width chars, a byte-order mark, or bidirectional control
// marks. These are invisible in most editors and can be used to smuggle hidden
// content past review, so the repo must provably contain none. Wired into
// `pnpm lint`.
//
// No dependencies — runs on a clean checkout before `pnpm install`.

import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, extname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');

// Directories we never descend into.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
]);

// Only text-like files are scanned; anything else (images, lockfiles binary
// blobs) is skipped to avoid false positives.
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.css',
  '.scss',
  '.html',
  '.sql',
  '.sh',
  '.example',
]);

// Each entry: the offending code point and a human label for the report.
const FORBIDDEN = new Map([
  [0x200b, 'zero-width space'],
  [0x200c, 'zero-width non-joiner'],
  [0x200d, 'zero-width joiner'],
  [0xfeff, 'byte-order mark / zero-width no-break space'],
  [0x200e, 'left-to-right mark'],
  [0x200f, 'right-to-left mark'],
  [0x202a, 'left-to-right embedding'],
  [0x202b, 'right-to-left embedding'],
  [0x202c, 'pop directional formatting'],
  [0x202d, 'left-to-right override'],
  [0x202e, 'right-to-left override'],
  [0x2066, 'left-to-right isolate'],
  [0x2067, 'right-to-left isolate'],
  [0x2068, 'first strong isolate'],
  [0x2069, 'pop directional isolate'],
]);

/** @param {string} dir @param {string[]} out */
function collectFiles(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectFiles(full, out);
    } else if (SCAN_EXTENSIONS.has(extname(name))) {
      out.push(full);
    }
  }
}

/** @param {string} file @returns {Array<{line: number, col: number, label: string}>} */
function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const hits = [];
  let line = 1;
  let col = 1;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (ch === '\n') {
      line += 1;
      col = 1;
      continue;
    }
    const label = FORBIDDEN.get(code);
    if (label !== undefined) {
      hits.push({line, col, label});
    }
    col += 1;
  }
  return hits;
}

const files = [];
collectFiles(repoRoot, files);

let total = 0;
for (const file of files) {
  const hits = scanFile(file);
  for (const hit of hits) {
    const where = `${relative(repoRoot, file)}:${hit.line}:${hit.col}`;
    console.error(`${where}  forbidden character (${hit.label})`);
    total += 1;
  }
}

if (total > 0) {
  console.error(`\nUnicode scan failed: ${total} forbidden character(s).`);
  process.exit(1);
}

console.log(`Unicode scan clean: ${files.length} file(s) checked.`);
