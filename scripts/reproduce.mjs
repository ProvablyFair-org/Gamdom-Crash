// Reproduce everything in results/ from the files in this folder. Node 18 or later, no install.
//
//   node scripts/reproduce.mjs                 full run (Monte Carlo at 6,000,000 samples)
//   node scripts/reproduce.mjs --mc 60000000   Monte Carlo at the size of the shipped run
//   node scripts/reproduce.mjs --no-mc         skip the Monte Carlo
//
// 1. runs every deterministic script into a fresh temporary folder and compares each output
//    byte for byte with the file in results/ (live-chain-check walks 10,500,000 hashes, so
//    this step takes a little while)
// 2. runs a fresh Monte Carlo (fresh random hashes) and checks every target lands within
//    4 standard errors of the exact curve; it cannot match results/rtp-montecarlo.json byte
//    for byte, because each run samples new hashes
// 3. checks every file against SHA256SUMS
// Exit code 0 only if all three pass.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib.mjs";

const argv = process.argv.slice(2);
const noMc = argv.includes("--no-mc");
const mcN = argv.includes("--mc") ? Number(argv[argv.indexOf("--mc") + 1]) : 6_000_000;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gamdom-crash-rtp-"));
const node = (script, ...a) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...a], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
let failed = 0;
const say = (ok, msg) => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };

console.log(`reproducing into ${tmp}\n`);
for (const s of ["check-rounds.mjs", "rtp-curve.mjs", "build-tables.mjs", "chain-check.mjs", "live-chain-check.mjs", "damage-estimate.mjs"]) {
  console.log(`$ node scripts/${s}`);
  try { process.stdout.write(node(s, "--out-dir", tmp).split("\n").filter((l) => l && !l.startsWith("wrote ")).map((l) => "  " + l).join("\n") + "\n"); }
  catch (e) { say(false, `${s} exited ${e.status}`); process.stdout.write(String(e.stdout || "")); }
}
console.log("");
const DETERMINISTIC = [
  "parity-log.csv", "rtp-curve.csv", "rtp-derivation-check.json", "our-bets-check.csv",
  "rakeback-by-batch.csv", "net-shortfall.csv", "balance-reconciliation.csv",
  "chain-check.json", "realised-curve.csv", "live-chain-check.json", "damage-estimate.json",
];
for (const f of DETERMINISTIC) {
  const a = path.join(ROOT, "results", f), b = path.join(tmp, f);
  say(fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b)), `results/${f} rebuilt byte for byte`);
}

if (!noMc) {
  console.log(`\n$ node scripts/rtp-montecarlo.mjs ${mcN}`);
  const mc = JSON.parse(node("rtp-montecarlo.mjs", String(mcN)));
  const worst = mc.table.reduce((w, r) => (Math.abs(r.deviationInStandardErrors) > Math.abs(w.deviationInStandardErrors) ? r : w));
  for (const r of mc.table) console.log(`  ${String(r.target).padEnd(5)} realised ${r.realizedRtpPercent}%  exact ${r.closedFormRtpPercent}%  (${r.deviationInStandardErrors} SE)`);
  console.log(`  1.00x share ${(mc.oneXShare.realized * 100).toFixed(4)}% (exact 2%, ${mc.oneXShare.deviationInStandardErrors} SE)`);
  say(mc.table.every((r) => Math.abs(r.deviationInStandardErrors) <= 4) && Math.abs(mc.oneXShare.deviationInStandardErrors) <= 4,
    `fresh Monte Carlo, ${mc.meta.samples.toLocaleString("en-US")} samples: every target within 4 SE of the exact curve (worst ${worst.target}x at ${worst.deviationInStandardErrors} SE)`);
}

console.log("");
const sums = fs.readFileSync(path.join(ROOT, "SHA256SUMS"), "utf8").trim().split("\n");
let ok = 0;
for (const line of sums) {
  const [hash, file] = [line.slice(0, 64), line.slice(66)];
  const p = path.join(ROOT, file);
  if (fs.existsSync(p) && crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") === hash) ok++;
  else console.log(`  hash mismatch or missing: ${file}`);
}
say(ok === sums.length, `SHA256SUMS: ${ok}/${sums.length} files match`);

console.log(`\n${failed === 0 ? "ALL RESULTS REPRODUCED" : `${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
