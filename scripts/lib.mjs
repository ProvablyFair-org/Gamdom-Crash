// Small shared helpers for the scripts in this folder. No dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// CSV as used in data/ and results/: comma-separated, header row, no quoted fields
// (no value in this pack contains a comma, a quote or a newline).
export function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").trimEnd();
  const [head, ...lines] = text.split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const v = l.split(",");
    if (v.length !== cols.length) throw new Error(`${file}: expected ${cols.length} fields, got ${v.length}: ${l}`);
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  });
}

export function toCsv(rows, cols) {
  const cell = (x) => {
    const s = x == null ? "" : String(x);
    if (/[",\n]/.test(s)) throw new Error(`value not allowed in this CSV format: ${s}`);
    return s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

// --out-dir <dir> (default results/) and positional arguments.
export function args(argv = process.argv.slice(2)) {
  const out = { positional: [], outDir: path.join(ROOT, "results") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out-dir") out.outDir = path.resolve(argv[++i]);
    else out.positional.push(argv[i]);
  }
  fs.mkdirSync(out.outDir, { recursive: true });
  return out;
}

export function write(outDir, name, content) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, content);
  const rel = path.relative(ROOT, p);
  console.log(`wrote ${rel.startsWith("..") ? p : rel}`);
}

// Fixed-point percent with up to 4 decimals, trailing zeros dropped (98.3311, 98, 1.6689).
export const pct4 = (x) => +(x * 100).toFixed(4);
