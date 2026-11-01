// Chain check: one hash, every round back to Gamdom's published commitment.
//
//   node scripts/chain-check.mjs [--out-dir results]
//
// Starts from the hash of the newest round in data/rounds-2026-10-08.csv and walks the chain
// backwards (previous hash = SHA-256 of the current hash), the same walk Gamdom's verifier does.
//   1. On the way it passes every game in data/rounds-2026-10-08.csv and data/rounds-2026-09-19.csv
//      and compares the walked hash with the hash Gamdom showed for that game.
//   2. It keeps walking to game 5,257,547 and compares the walked hash with the value Gamdom
//      publishes on gamdom.com/help/fair for "Crash starting at game 5,257,547"
//      (read from claims/help-fair/page-text-2026-10-09.txt).
//   3. For every game from the oldest 19 September round to the newest 8 October round, it
//      computes the crash point and tallies the realised return at each cash-out target,
//      against the exact curve (results/realised-curve.csv).
// Writes results/chain-check.json and results/realised-curve.csv. Deterministic.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCsv, toCsv, args, write } from "./lib.mjs";
import { crashHundredthsFromHash, previousHash, MOD } from "./verifier.mjs";

const { outDir } = args();
const load = (f) => readCsv(path.join(ROOT, "data", f)).map((r) => ({ id: Number(r.game_id), hash: r.hash, crash: r.crash_point }));
const oct = load("rounds-2026-10-08.csv").sort((a, b) => b.id - a.id);
const sep = load("rounds-2026-09-19.csv").sort((a, b) => b.id - a.id);
const shown = new Map([...oct, ...sep].map((r) => [r.id, r.hash]));

const pageText = fs.readFileSync(path.join(ROOT, "claims", "help-fair", "page-text-2026-10-09.txt"), "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const li = pageText.findIndex((l) => /final hash for Crash starting at game/.test(l));
const startGame = Number(pageText[li].match(/game ([\d,]+)/)[1].replace(/,/g, ""));
const published = pageText[li + 1];
if (!/^[0-9a-f]{64}$/.test(published)) throw new Error("commitment line not found in the help/fair page text");

const top = oct[0];
const bottom = sep[sep.length - 1];
const span = top.id - bottom.id + 1;
const GRID = [1.01, 1.1, 1.2, 1.5, 2, 3, 5, 10, 20, 50, 100, 1000];
const gridH = GRID.map((x) => Math.round(x * 100));
const wins = new Array(GRID.length).fill(0);
let atOneX = 0;

let h = top.hash, id = top.id, compared = 0, equal = 0;
const firstMismatch = [];
const t0 = Date.now();
while (true) {
  if (id >= bottom.id) {
    const c = crashHundredthsFromHash(h);
    if (c === 100) atOneX++;
    for (let t = 0; t < gridH.length; t++) { if (c >= gridH[t]) wins[t]++; else break; }
  }
  if (id !== top.id && shown.has(id)) { compared++; if (shown.get(id) === h) equal++; else if (firstMismatch.length < 5) firstMismatch.push(id); }
  if (id === startGame) break;
  h = previousHash(h);
  id--;
}
const reachesCommitment = h === published;

const p = (x) => (1 - 1 / MOD) * 0.98 / (x - 0.02);
const curve = GRID.map((x, i) => {
  const exactP = p(x);
  const realised = (x * wins[i]) / span;
  const se = x * Math.sqrt((exactP * (1 - exactP)) / span);
  return {
    target: x,
    rounds: span,
    wins: wins[i],
    realised_return_pct: +(realised * 100).toFixed(4),
    exact_rtp_pct: +(x * exactP * 100).toFixed(4),
    standard_error_pp: +(se * 100).toFixed(4),
    deviation_from_exact_in_se: +((realised - x * exactP) / se).toFixed(2),
  };
});
write(outDir, "realised-curve.csv", toCsv(curve, Object.keys(curve[0])));

const oneSe = Math.sqrt((0.02 * 0.98) / span);
const out = {
  start: { game_id: top.id, hash: top.hash, from: "data/rounds-2026-10-08.csv (newest round)" },
  shownHashesCompared: {
    files: ["data/rounds-2026-10-08.csv", "data/rounds-2026-09-19.csv"],
    note: "every game in both files except the starting round itself",
    compared,
    equal,
    firstMismatches: firstMismatch,
    stepsFromNewest8OctToOldest19Sep: top.id - bottom.id,
  },
  publishedCommitment: {
    source: "claims/help-fair/page-text-2026-10-09.txt",
    text: pageText[li],
    value: published,
    startGame,
    stepsWalked: top.id - startGame,
    walkedHashAtStartGame: h,
    equal: reachesCommitment,
  },
  realisedOverSpan: {
    games: `${bottom.id}-${top.id}`,
    rounds: span,
    roundsAtOneX: atOneX,
    shareAtOneXPct: +((atOneX / span) * 100).toFixed(4),
    exactShareAtOneXPct: 2,
    standardErrorPp: +(oneSe * 100).toFixed(4),
    deviationInSe: +((atOneX / span - 0.02) / oneSe).toFixed(2),
    table: "results/realised-curve.csv",
  },
};
write(outDir, "chain-check.json", JSON.stringify(out, null, 2) + "\n");
console.log(`walked ${top.id - startGame} hashes in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`hashes Gamdom showed (both files, starting round excluded), compared with the walk: ${equal}/${compared} equal`);
console.log(`walked hash at game ${startGame} equals the value on gamdom.com/help/fair: ${reachesCommitment}`);
console.log(`games ${bottom.id}-${top.id} (${span} rounds): ${atOneX} at 1.00x = ${out.realisedOverSpan.shareAtOneXPct}% (exact 2%)`);
for (const r of curve.slice(0, 5)) console.log(`  ${String(r.target).padEnd(5)} realised ${r.realised_return_pct}%  exact ${r.exact_rtp_pct}%  SE ${r.standard_error_pp}pp  (${r.deviation_from_exact_in_se} SE from exact)`);
if (!reachesCommitment || equal !== compared) process.exit(1);
