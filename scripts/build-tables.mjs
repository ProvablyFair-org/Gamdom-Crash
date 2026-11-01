// Table builder for the 8 October 2026 test-account session.
//
//   node scripts/build-tables.mjs [--out-dir results]
//
// Reads  data/our-bets-2026-10-08.csv      the 101 bets
//        data/rewards-reads-2026-10-08.csv the rewards panel and wallet read before play and after each batch
//        data/rounds-2026-10-08.csv        the rounds, to recompute each bet's crash point from its round hash
// Writes results/our-bets-check.csv         every bet: crash point recomputed, win rule, payout
//        results/rakeback-by-batch.csv      instant rakeback per batch as a share of the stake
//        results/net-shortfall.csv          game RTP + measured instant rakeback, against 100%
//        results/balance-reconciliation.csv wallet balance change per batch vs the bets' payouts
// Units: 1,500 coins = $1.00 (data/units-2026-10-08.json); USDT balances are in micro-USDT (1e-6).
import path from "node:path";
import { ROOT, readCsv, toCsv, args, write } from "./lib.mjs";
import { crashHundredthsFromHash, toHundredths, fmtHundredths, MOD } from "./verifier.mjs";

const { outDir } = args();
const D = (f) => readCsv(path.join(ROOT, "data", f));
const bets = D("our-bets-2026-10-08.csv");
const reads = D("rewards-reads-2026-10-08.csv");
const rounds = new Map(D("rounds-2026-10-08.csv").map((r) => [Number(r.game_id), r]));

const micro = (usd) => {
  const [i, f = ""] = usd.split(".");
  return Number(i) * 1e6 + Number((f + "000000").slice(0, 6));
};
const usdt = (m) => (m / 1e6).toFixed(2);
const rtp = (x) => (1 - 1 / MOD) * 0.98 * x / (x - 0.02);
let failures = 0;

// ── every bet ───────────────────────────────────────────────────────────────
const checked = bets.map((b) => {
  const round = rounds.get(Number(b.round));
  const targetH = toHundredths(b.target);
  const crashH = round ? crashHundredthsFromHash(round.hash) : null;
  const wonByRule = crashH != null && crashH >= targetH;
  const reportedWon = b.result === "won";
  const cashoutOk = reportedWon ? b.cashout_at !== "" && toHundredths(b.cashout_at) === targetH : b.cashout_at === "";
  const stakeCoins = Number(b.stake_coins);
  const payoutCoins = wonByRule ? Math.floor((stakeCoins * targetH) / 100) : 0;
  const payoutMicro = wonByRule ? Math.floor((micro(b.stake_usd) * targetH) / 100) : 0;
  const ok =
    round != null &&
    fmtHundredths(crashH) === Number(b.crash_point).toFixed(2) &&
    Number(round.crash_point).toFixed(2) === Number(b.crash_point).toFixed(2) &&
    wonByRule === reportedWon &&
    cashoutOk;
  if (!ok) failures++;
  return {
    ...b,
    targetH,
    stakeMicro: micro(b.stake_usd),
    payoutMicro,
    payoutCoins,
    row: {
      play_id: b.play_id,
      round: b.round,
      batch: b.batch,
      target: fmtHundredths(targetH),
      crash_point_reported: Number(b.crash_point).toFixed(2),
      crash_point_recomputed: crashH == null ? "" : fmtHundredths(crashH),
      won_by_rule: wonByRule ? "true" : "false",
      result_reported: b.result,
      cashout_at: b.cashout_at,
      cashout_consistent: cashoutOk ? "true" : "false",
      payout_coins: payoutCoins,
      payout_usdt: usdt(payoutMicro),
      all_checks_pass: ok ? "true" : "false",
    },
  };
});
write(outDir, "our-bets-check.csv", toCsv(checked.map((c) => c.row), Object.keys(checked[0].row)));
console.log(`bets: ${checked.length}; all checks pass on ${checked.filter((c) => c.row.all_checks_pass === "true").length}`);

// ── intervals between consecutive reads ─────────────────────────────────────
// The stake, the instant rakeback and the daily counter move when a bet is PLACED; a payout
// moves when the bet CASHES OUT. So a bet's stake and rakeback belong to the interval in which
// it was placed, and its payout to the interval in which it cashed out.
const within = (t, a, b) => t !== "" && t > a.read_started_utc && t < b.read_started_utc;
const intervals = [];
for (let i = 1; i < reads.length; i++) {
  const a = reads[i - 1], b = reads[i];
  intervals.push({
    from: a, to: b,
    bets: checked.filter((c) => within(c.placed_utc, a, b)),
    cashouts: checked.filter((c) => within(c.cashed_out_utc, a, b)),
  });
}
const placed = intervals.reduce((n, iv) => n + iv.bets.length, 0);
const cashed = intervals.reduce((n, iv) => n + iv.cashouts.length, 0);
const wonCount = checked.filter((c) => c.row.won_by_rule === "true").length;
if (placed !== checked.length || cashed !== wonCount) { console.log(`FAIL: ${placed}/${checked.length} placements and ${cashed}/${wonCount} cash-outs fall inside a read interval`); failures++; }
for (const iv of intervals) {
  if (Number(iv.to.our_bets_so_far) !== checked.filter((c) => c.placed_utc < iv.to.read_started_utc).length) { console.log(`FAIL: bet count at read ${iv.to.label}`); failures++; }
}

// ── instant rakeback per batch ──────────────────────────────────────────────
const rbRows = [];
const rakebackPctByTarget = new Map();
for (const iv of intervals.filter((x) => x.bets.length)) {
  const staked = iv.bets.reduce((s, c) => s + Number(c.stake_coins), 0);
  const delta = Number(iv.to.instant_rakeback_coins) - Number(iv.from.instant_rakeback_coins);
  const counter = Number(iv.to.daily_originals_wagered_coins) - Number(iv.from.daily_originals_wagered_coins);
  const perBet = iv.bets.filter((c) => c.instant_rakeback_coins !== "");
  const targets = [...new Set(iv.bets.map((c) => fmtHundredths(c.targetH)))];
  const pctOfStake = +((delta / staked) * 100).toFixed(4);
  if (targets.length === 1) rakebackPctByTarget.set(targets[0], pctOfStake);
  rbRows.push({
    batch: iv.to.label.replace(/^after-/, ""),
    target: targets.join("|"),
    bets: iv.bets.length,
    staked_coins: staked,
    staked_usd: (staked / 1500).toFixed(2),
    instant_before_coins: iv.from.instant_rakeback_coins,
    instant_after_coins: iv.to.instant_rakeback_coins,
    instant_delta_coins: delta,
    rakeback_pct_of_stake: pctOfStake,
    bets_with_own_read: perBet.length,
    sum_of_per_bet_reads_coins: perBet.reduce((s, c) => s + Number(c.instant_rakeback_coins), 0),
    daily_originals_wagered_delta_coins: counter,
    counter_equals_stake: counter === staked ? "true" : "false",
  });
}
write(outDir, "rakeback-by-batch.csv", toCsv(rbRows, Object.keys(rbRows[0])));

// ── net return at each measured target ──────────────────────────────────────
const nsRows = [...rakebackPctByTarget.entries()].map(([t, rb]) => {
  const x = Number(t);
  const these = checked.filter((c) => fmtHundredths(c.targetH) === t);
  const staked = these.reduce((s, c) => s + Number(c.stake_coins), 0);
  const paid = these.reduce((s, c) => s + c.payoutCoins, 0);
  const exact = +(rtp(x) * 100).toFixed(4);
  return {
    target: t,
    exact_rtp_pct: exact,
    shortfall_vs_100_before_rakeback_pct: +(100 - exact).toFixed(4),
    measured_instant_rakeback_pct: rb,
    net_pct: +(exact + rb).toFixed(4),
    net_shortfall_vs_100_pct: +(100 - exact - rb).toFixed(4),
    bets: these.length,
    wins: these.filter((c) => c.row.won_by_rule === "true").length,
    realised_return_pct: +((paid / staked) * 100).toFixed(4),
  };
});
write(outDir, "net-shortfall.csv", toCsv(nsRows, Object.keys(nsRows[0])));

// ── wallet balance per interval ─────────────────────────────────────────────
const balRows = intervals.map((iv) => {
  const expected = iv.cashouts.reduce((s, c) => s + c.payoutMicro, 0) - iv.bets.reduce((s, c) => s + c.stakeMicro, 0);
  const before = Number(iv.from.usdt_balance_micro), after = Number(iv.to.usdt_balance_micro);
  const match = after - before === expected;
  if (!match) failures++;
  return {
    from: iv.from.label,
    to: iv.to.label,
    bets_placed: iv.bets.length,
    cash_outs: iv.cashouts.length,
    usdt_before: usdt(before),
    usdt_after: usdt(after),
    expected_delta_usdt: usdt(expected),
    observed_delta_usdt: usdt(after - before),
    match: match ? "true" : "false",
  };
});
write(outDir, "balance-reconciliation.csv", toCsv(balRows, Object.keys(balRows[0])));
console.log(`balance: ${balRows.filter((r) => r.match === "true").length}/${balRows.length} intervals reconcile`);

if (failures) { console.log(`FAIL: ${failures}`); process.exit(1); }
