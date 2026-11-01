// Monte Carlo cross-check of the RTP curve: Gamdom's verifier code run on random game hashes.
//
//   node scripts/rtp-montecarlo.mjs [samples] > results/rtp-montecarlo.json
//
// It shares no algebra with scripts/rtp-curve.mjs: it draws random 32-byte game hashes,
// computes each crash point with the published code, and tallies the realised return at each
// cash-out target. Each run uses fresh random hashes, so a new run differs from the shipped
// results/rtp-montecarlo.json by sampling error; scripts/reproduce.mjs checks that a fresh run
// lands within 4 standard errors of the exact curve at every target.
//
// This samples the CODE. That the live game follows the same code is shown separately, by
// recomputing settled rounds from their hashes (scripts/check-rounds.mjs).
//
// At high targets a win is rare (about 1 round in 1,020 at 1000x), so the estimate is loose
// there even at 60 million samples. The exact curve is the figure to quote; this run checks
// that it describes the code.
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import { crashHundredthsFromHash, MOD } from "./verifier.mjs";
import crypto from "crypto";

const GRID = [1.01, 1.1, 1.2, 1.5, 2, 3, 5, 10, 20, 50, 100, 1000];
const TARGET_HUNDREDTHS = GRID.map((x) => Math.round(x * 100));

function runChunk(n) {
  const wins = new Float64Array(GRID.length);
  let atOneX = 0;
  const buf = Buffer.allocUnsafe(32);
  for (let i = 0; i < n; i++) {
    crypto.randomFillSync(buf);
    const c = crashHundredthsFromHash(buf.toString("hex"));
    if (c === 100) atOneX++;
    for (let t = 0; t < TARGET_HUNDREDTHS.length; t++) {
      if (c >= TARGET_HUNDREDTHS[t]) wins[t]++;
      else break; // targets ascend: the first miss means every later one misses
    }
  }
  return { wins: Array.from(wins), atOneX, n };
}

if (!isMainThread) {
  parentPort.postMessage(runChunk(workerData.n));
} else {
  const N = Number(process.argv[2] || 60_000_000);
  const W = Math.max(1, Math.min(os.cpus().length - 2, 12));
  const per = Math.floor(N / W);
  const total = per * W;
  const started = process.hrtime.bigint();

  const results = await Promise.all(
    Array.from({ length: W }, () =>
      new Promise((res, rej) => {
        const w = new Worker(new URL(import.meta.url), { workerData: { n: per } });
        w.once("message", res);
        w.once("error", rej);
      })
    )
  );

  const wins = new Array(GRID.length).fill(0);
  let atOneX = 0;
  for (const r of results) {
    r.wins.forEach((v, i) => (wins[i] += v));
    atOneX += r.atOneX;
  }

  const closedForm = (x) => (1 - 1 / MOD) * 0.98 * x / (x - 0.02);
  const table = GRID.map((x, i) => {
    const p = wins[i] / total;
    const realized = x * p;
    const exact = closedForm(x);
    // SE of the mean payoff: pays x with probability p, 0 otherwise
    const se = x * Math.sqrt((p * (1 - p)) / total);
    return {
      target: x,
      wins: wins[i],
      pWin: p,
      realizedRtpPercent: +(realized * 100).toFixed(4),
      closedFormRtpPercent: +(exact * 100).toFixed(4),
      standardErrorPercentagePoints: +(se * 100).toFixed(4),
      deviationInStandardErrors: +((realized - exact) / se).toFixed(2),
    };
  });

  const worst = table.reduce((a, b) =>
    Math.abs(b.deviationInStandardErrors) > Math.abs(a.deviationInStandardErrors) ? b : a
  );

  console.log(
    JSON.stringify(
      {
        meta: {
          artifact: "rtp-montecarlo",
          game: "Gamdom Crash",
          method:
            "the published verifier on random game hashes; independent of the closed form",
          samples: total,
          workers: W,
          node: process.version,
          elapsedSeconds: +(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1),
        },
        oneXShare: {
          realized: atOneX / total,
          exact: 0.02,
          standardError: Math.sqrt((0.02 * 0.98) / total),
          deviationInStandardErrors: +(
            (atOneX / total - 0.02) / Math.sqrt((0.02 * 0.98) / total)
          ).toFixed(2),
        },
        agreement: {
          // every target within 3 SE of the closed form is what "the code
          // implements the formula" looks like at this sample size
          allWithin3SE: table.every((r) => Math.abs(r.deviationInStandardErrors) <= 3),
          worstTarget: worst.target,
          worstDeviationInStandardErrors: worst.deviationInStandardErrors,
        },
        table,
      },
      null,
      2
    )
  );
}
