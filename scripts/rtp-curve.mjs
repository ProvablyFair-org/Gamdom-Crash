// RTP by cash-out target, exact, from Gamdom's verifier code. See METHOD.md for the derivation.
//
//   node scripts/rtp-curve.mjs [--out-dir results]
//
// Writes:
//   results/rtp-curve.csv              RTP(x) = (1 - 1/100) * 0.98 * x / (x - 0.02) at 12 targets + the limit
//   results/rtp-derivation-check.json  the derivation tested against the code itself: for every
//                                      target on the 0.01 grid from 1.01x to 1000.00x, the exact
//                                      52-bit value h at which the code's floored crash point first
//                                      reaches the target, compared with the algebraic boundary
// Deterministic: no sampling. The Monte Carlo cross-check is scripts/rtp-montecarlo.mjs.
import { MOD } from "./verifier.mjs";
import { toCsv, args, write } from "./lib.mjs";

const { outDir } = args();
const GRID = [1.01, 1.1, 1.2, 1.5, 2, 3, 5, 10, 20, 50, 100, 1000];

const pWin = (x) => (1 - 1 / MOD) * 0.98 / (x - 0.02);
const rtp = (x) => x * pWin(x);

// ── the curve ───────────────────────────────────────────────────────────────
const rows = GRID.map((x) => ({
  target: x,
  p_win: pWin(x),
  rtp_pct: +(rtp(x) * 100).toFixed(4),
  house_edge_pct: +((1 - rtp(x)) * 100).toFixed(4),
}));
const limitPct = +((1 - 1 / MOD) * 0.98 * 100).toFixed(4);
rows.push({ target: "limit", p_win: "", rtp_pct: limitPct, house_edge_pct: +(100 - limitPct).toFixed(4) });
write(outDir, "rtp-curve.csv", toCsv(rows, ["target", "p_win", "rtp_pct", "house_edge_pct"]));

// ── the derivation, checked against the code ────────────────────────────────
// Algebra: with u = h / 2^52, the code's crash point before the floor is c = (1 - u/50) / (1 - u),
// and c >= x  <=>  u >= (x - 1) / (x - 0.02). So the code should first reach target x at
// h* = ceil(2^52 * (x - 1) / (x - 0.02)). The code evaluates c in floating point, so find the
// h where the code itself crosses and measure the distance from h*.
const e = Math.pow(2, 52);
const cAt = (h) => Math.floor(((e - h / 50) / (e - h)) * 100); // code's floored result, hundredths
function crossing(targetH) {
  const x = targetH / 100;
  const hStar = Math.ceil(((x - 1) / (x - 0.02)) * e);
  for (let d = 0; d <= 64; d++) {
    for (const s of d === 0 ? [0] : [d, -d]) {
      const h = hStar + s;
      if (cAt(h) >= targetH && cAt(h - 1) < targetH) return { hStar, hCode: h, offset: s };
    }
  }
  return { hStar, hCode: null, offset: null };
}

const sample = GRID.map((x) => {
  const c = crossing(Math.round(x * 100));
  return { target: x, ...c, probabilityMassMoved: c.offset == null ? null : Math.abs(c.offset) / e };
});

let n = 0, exact = 0, maxAbs = 0, notFound = 0, below99 = 0;
for (let t = 101; t <= 100000; t++) {
  n++;
  const c = crossing(t);
  if (c.offset == null) { notFound++; continue; }
  if (c.offset === 0) exact++;
  maxAbs = Math.max(maxAbs, Math.abs(c.offset));
  if (rtp(t / 100) < 0.99) below99++;
}

const check = {
  formula: "RTP(x) = (1 - 1/MOD) * 0.98 * x / (x - 0.02), MOD = 100",
  method:
    "for each cash-out target x on the 0.01 grid, find the 52-bit value h at which the code's floored crash point first reaches x, and compare it with the algebraic boundary h* = ceil(2^52 (x-1)/(x-0.02))",
  gridTargets: { from: "1.01", to: "1000.00", step: "0.01", count: n },
  crossingFoundInCode: n - notFound,
  crossingExactlyAtAlgebraicBoundary: exact,
  largestOffsetInUnitsOf2pow52: maxAbs,
  largestProbabilityMassMoved: maxAbs / e,
  targetsWithRtpBelow99Percent: below99,
  holds: notFound === 0 && maxAbs <= 2,
  sampleTargets: sample,
  oneXShare: {
    description: "share of rounds that end at exactly 1.00x: the instant bust (1 in 100) plus the rounds the floor puts at 1.00",
    exact: "1/100 + (99/100) * (1 - 0.98/0.99) = 1/100 + 1/100 = 2/100",
    value: 0.02,
  },
  limit: { description: "RTP as the target grows without bound", value: (1 - 1 / MOD) * 0.98 },
};
write(outDir, "rtp-derivation-check.json", JSON.stringify(check, null, 2) + "\n");
console.log(
  `derivation vs code: ${check.crossingFoundInCode}/${n} targets cross where the algebra says ` +
    `(${exact} exactly, largest offset ${maxAbs} in 2^52); targets returning < 99%: ${below99}/${n}; holds: ${check.holds}`
);
if (!check.holds) process.exit(1);
