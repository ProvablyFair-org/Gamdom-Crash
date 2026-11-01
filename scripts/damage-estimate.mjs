// The cost to players: an estimate of what Crash has taken above its stated 1% edge.
//
//   node scripts/damage-estimate.mjs [--out-dir results]
//
// Inputs: the 44-hour recording of Gamdom's public Crash bet feed (data/feed-2026-10-26.csv with
// its capture.json, and its rounds in data/rounds-2026-10-26.csv), the two shorter recordings
// (data/feed-2026-09-21.csv, data/feed-2026-10-08.csv), Gamdom's sequential bet ids
// (data/bet-ids.json) and the coin price (data/units-2026-10-08.json).
//   1. Extra edge on real bets. A bet at cash-out x returns RTP(x) = 0.99 × 0.98 × x / (x − 0.02)
//      (METHOD.md, section 1); the extra edge is 99% − RTP(x), what the game takes above the
//      stated 1%. The feed shows a bet's cash-out only when it wins, so the mix of cash-outs is
//      rebuilt by inverse probability weighting: a win at x stands for 1 / P(win at x) bets,
//      P(win at x) = 0.99 × 0.98 / (x − 0.02). The crash point is fixed before anyone bets, so it
//      cannot depend on the cash-out. Extra edge = sum(stake × extra(x) / P) / sum(stake / P) over
//      the winning bets of the 26-28 October recording. Resampling its players (2,000 resamples,
//      fixed seed) gives a 95% range. The two shorter recordings, alone and pooled with the 44
//      hours, are given as a check.
//   2. A second estimate for the 26-28 October recording, whose crash points are all in data/, also
//      uses the losing bets: a bet that lost had a cash-out target above its round's crash point.
//      The stake-weighted Kaplan-Meier estimate of the target mix gives the extra edge from that.
//   3. Volume. Crash wagering per day over the 43.78 hours of the same recording, which covers
//      every hour of the day. Gamdom numbers every Crash bet in sequence; the numbers give the bet
//      rate from 21 September to 28 October, to show how typical the recording was.
//   4. Since 2 January 2026, when the published verifier was created, to 31 October 2026:
//      wagering per day × days × extra edge, for three cases (see "cases").
// Writes results/damage-estimate.json. Deterministic.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCsv, args, write } from "./lib.mjs";

const { outDir } = args();
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const COIN_USD = Number(json("units-2026-10-08.json").COINS.response.cryptoPrice);
const pWin = (x) => (0.99 * 0.98) / (x - 0.02);
const extra = (x) => 0.99 - x * pWin(x);
const EXTRA_LIMIT = 0.99 - 0.99 * 0.98;
const hours = (a, b) => (Date.parse(b) - Date.parse(a)) / 3_600_000;
const usd = (v) => Math.round(v);
const pct = (v, d = 4) => +(v * 100).toFixed(d);

function tally(bets) {
  let wagered = 0, wins = 0, ipw = 0, ipwExtra = 0;
  for (const b of bets) {
    wagered += b.usd;
    if (b.x !== null) {
      wins++;
      ipw += b.usd / pWin(b.x);
      ipwExtra += (b.usd * extra(b.x)) / pWin(b.x);
    }
  }
  return { bets: bets.length, wins, wagered, ipw, ipwExtra };
}

function loadWindow(day) {
  const meta = json(`feed-${day}.capture.json`);
  const bets = readCsv(path.join(ROOT, "data", `feed-${day}.csv`)).map((r) => ({
    game: Number(r.game_id),
    player: r.player,
    usd: Number(r.stake_coins) * COIN_USD,
    x: r.cashout === "" ? null : Number(r.cashout),
  }));
  const h = hours(meta.windowStartUtc, meta.windowEndUtc);
  const all = tally(bets);
  const top = tally(bets.filter((b) => b.player === "p1"));
  const exTop = tally(bets.filter((b) => b.player !== "p1"));
  return { day, meta, h, bets, all, top, exTop };
}

const windows = ["2026-09-21", "2026-10-08", "2026-10-26"].map(loadWindow);
const w44 = windows[2];

// 1. extra edge on the 44-hour recording, with a range from resampling its players
const extraEdge = w44.all.ipwExtra / w44.all.ipw;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 20261101, RESAMPLES = 2000;
const byPlayer = new Map();
for (const b of w44.bets) {
  let c = byPlayer.get(b.player);
  if (!c) byPlayer.set(b.player, (c = { ipw: 0, ipwExtra: 0 }));
  if (b.x !== null) {
    c.ipw += b.usd / pWin(b.x);
    c.ipwExtra += (b.usd * extra(b.x)) / pWin(b.x);
  }
}
const clusters = [...byPlayer.values()];
const rand = mulberry32(SEED);
const resampled = [];
for (let i = 0; i < RESAMPLES; i++) {
  let s = 0, se = 0;
  for (let k = 0; k < clusters.length; k++) {
    const c = clusters[Math.floor(rand() * clusters.length)];
    s += c.ipw;
    se += c.ipwExtra;
  }
  resampled.push(se / s);
}
resampled.sort((a, b) => a - b);
const lo = resampled[Math.floor(0.025 * RESAMPLES)];
const hi = resampled[Math.ceil(0.975 * RESAMPLES) - 1];

// the check: the two shorter recordings, and all three pooled
const pooled = windows.reduce(
  (a, w) => ({ bets: a.bets + w.all.bets, ipw: a.ipw + w.all.ipw, ipwExtra: a.ipwExtra + w.all.ipwExtra, wagered: a.wagered + w.all.wagered }),
  { bets: 0, ipw: 0, ipwExtra: 0, wagered: 0 }
);

// 2. the same recording, using the losing bets as well (Kaplan-Meier, stake-weighted)
const rounds26 = readCsv(path.join(ROOT, "data", "rounds-2026-10-26.csv"));
const round26 = new Map(rounds26.map((r) => [Number(r.game_id), r]));
function kaplanMeier(bets) {
  const won = new Map(), lost = new Map();
  let atRisk = 0;
  for (const b of bets) {
    const k = b.x !== null ? Math.round(b.x * 100) : Math.round(Number(round26.get(b.game).crash_point) * 100);
    const m = b.x !== null ? won : lost;
    m.set(k, (m.get(k) || 0) + b.usd);
    atRisk += b.usd;
  }
  const levels = [...new Set([...won.keys(), ...lost.keys()])].sort((a, b) => a - b);
  let surv = 1, mean = 0;
  for (const t of levels) {
    const d = won.get(t) || 0;
    if (d > 0) {
      const p = d / atRisk;
      mean += surv * p * extra(t / 100);
      surv *= 1 - p;
    }
    atRisk -= d + (lost.get(t) || 0);
  }
  return { extraEdge: mean + surv * EXTRA_LIMIT, stakeShareAboveEveryCrashSeen: surv };
}
const km = kaplanMeier(w44.bets);

// 3. volume: the recording by UTC day, and Gamdom's bet ids
const startOf = (b) => round26.get(b.game).created_utc;
const byDay = {};
for (const b of w44.bets) {
  const d = startOf(b).slice(0, 10);
  byDay[d] ??= { bets: 0, wagered: 0 };
  byDay[d].bets++;
  byDay[d].wagered += b.usd;
}
const between = (day, fromHour, toHour) =>
  w44.bets.reduce((s, b) => {
    const t = startOf(b), hh = Number(t.slice(11, 13));
    return s + (t.startsWith(day) && hh >= fromHour && hh < toHour ? b.usd : 0);
  }, 0);
const perDayWindow = (w44.all.wagered / w44.h) * 24;
const fullDay = byDay["2026-10-27"];
const usdPerBet = w44.all.wagered / w44.all.bets;

const ids = json("bet-ids.json");
const [i21, i08, i26] = ids.windows;
const [g1, g2] = ids.between;
const perDayRate = (n, a, b) => n / (hours(a, b) / 24);
const betRate = {
  window26to28Oct: perDayRate(i26.idsSpanned, i26.fromUtc, i26.toUtc),
  from21Septo8Oct: perDayRate(g1.idsAdvanced, g1.fromUtc, g1.toUtc),
  from9Octto26Oct: perDayRate(g2.idsAdvanced, g2.fromUtc, g2.toUtc),
  from21Septo28Oct: perDayRate(i21.idsSpanned + g1.idsAdvanced + i08.idsSpanned + g2.idsAdvanced + i26.idsSpanned - 2, i21.fromUtc, i26.toUtc),
};

// 4. since 2 January 2026
const FROM = "2026-01-02T00:00:00Z", TO = "2026-11-01T00:00:00Z";
const days = hours(FROM, TO) / 24;
const cases = {
  low: {
    volume: "27 October 2026, the one full UTC day in the recording",
    extraEdge: "lower end of the 95% range",
    perDay: fullDay.wagered,
    edge: lo,
  },
  central: {
    volume: "the recording, 43.78 hours",
    extraEdge: "the recording",
    perDay: perDayWindow,
    edge: extraEdge,
  },
  high: {
    volume: "the recording's wagering per bet, at the highest bet rate in Gamdom's bet ids (21 September to 8 October)",
    extraEdge: "upper end of the 95% range",
    perDay: usdPerBet * betRate.from21Septo8Oct,
    edge: hi,
  },
};
for (const c of Object.values(cases)) {
  const { perDay, edge } = c;
  delete c.perDay;
  delete c.edge;
  Object.assign(c, {
    wageringPerDay: usd(perDay),
    extraEdgePct: pct(edge),
    extraCostPerDay: usd(perDay * edge),
    wageringSince2Jan: usd(perDay * days),
    extraCostSince2Jan: usd(perDay * days * edge),
  });
}

const describe = (w) => ({
  file: `data/feed-${w.day}.csv`,
  windowUtc: [w.meta.windowStartUtc, w.meta.windowEndUtc],
  hours: +w.h.toFixed(3),
  rounds: w.meta.rounds,
  bets: w.all.bets,
  players: w.meta.players,
  wageredUsd: usd(w.all.wagered),
  wageredPerHourUsd: usd(w.all.wagered / w.h),
  largestPlayerSharePct: pct(w.top.wagered / w.all.wagered, 2),
  largestTenPlayersSharePct: pct(w.bets.filter((b) => /^p([1-9]|10)$/.test(b.player)).reduce((s, b) => s + b.usd, 0) / w.all.wagered, 2),
  winningBets: w.all.wins,
  reweightedWageringPctOfRecorded: pct(w.all.ipw / w.all.wagered, 1),
  extraEdgePct: pct(w.all.ipwExtra / w.all.ipw),
  withoutLargestPlayer: { wageredUsd: usd(w.exTop.wagered), wageredPerHourUsd: usd(w.exTop.wagered / w.h), extraEdgePct: pct(w.exTop.ipwExtra / w.exTop.ipw) },
});

const r1 = (v) => +v.toFixed(1);
const out = {
  definition: "extra edge = 99% minus the game's return at the bet's cash-out, i.e. what Crash takes above the stated 1% house edge",
  coinUsd: COIN_USD,
  windows: windows.map(describe),
  recording: {
    file: "data/feed-2026-10-26.csv",
    bets: w44.all.bets,
    wageredUsd: usd(w44.all.wagered),
    reweightedWageringPctOfRecorded: pct(w44.all.ipw / w44.all.wagered, 1),
    extraEdgePct: pct(extraEdge),
    range95Pct: [pct(lo), pct(hi)],
    rangeMethod: `players resampled, ${RESAMPLES.toLocaleString("en-US")} resamples, seed ${SEED}`,
    expectedReturnPct: pct(0.99 - extraEdge),
    effectiveHouseEdgePct: pct(0.01 + extraEdge),
    extraCostInRecordingUsd: usd(w44.all.wagered * extraEdge),
  },
  losingBetsToo: {
    kaplanMeierExtraEdgePct: pct(km.extraEdge),
    winningBetsOnlyExtraEdgePct: pct(extraEdge),
    stakeShareWithTargetAboveEveryCrashSeenPct: pct(km.stakeShareAboveEveryCrashSeen, 3),
    note: "A bet that lost had a target above its round's crash point. Using that as well as the winning bets' cash-outs gives the same extra edge.",
  },
  check: {
    shorterRecordings: windows.slice(0, 2).map((w) => ({ file: `data/feed-${w.day}.csv`, bets: w.all.bets, extraEdgePct: pct(w.all.ipwExtra / w.all.ipw) })),
    allThreePooled: { bets: pooled.bets, wageredUsd: usd(pooled.wagered), extraEdgePct: pct(pooled.ipwExtra / pooled.ipw) },
    note: "The two shorter recordings are one and three hours in the evening, the 21 September one mostly a single player, so the estimate uses the 44-hour recording alone. The 8 October recording and the pooled figure fall inside its 95% range; the 21 September one is just below it.",
  },
  volume: {
    recording: {
      hours: +w44.h.toFixed(3),
      wageredUsd: usd(w44.all.wagered),
      wageredPerDayUsd: usd(perDayWindow),
      bets: w44.all.bets,
      usdPerBet: +usdPerBet.toFixed(2),
    },
    byUtcDay: Object.fromEntries(Object.entries(byDay).map(([d, v]) => [d, { bets: v.bets, wageredUsd: usd(v.wagered) }])),
    sameHoursOnTwoDays: [
      { hoursUtc: "20:00-24:00", "2026-10-26": usd(between("2026-10-26", 20, 24)), "2026-10-27": usd(between("2026-10-27", 20, 24)) },
      { hoursUtc: "00:00-15:00", "2026-10-27": usd(between("2026-10-27", 0, 15)), "2026-10-28": usd(between("2026-10-28", 0, 15)) },
    ],
    betIds: {
      source: "data/bet-ids.json",
      crashBetsPerDay: Object.fromEntries(Object.entries(betRate).map(([k, v]) => [k, Math.round(v)])),
      recordingVersus21Septo28Oct: +(betRate.window26to28Oct / betRate.from21Septo28Oct).toFixed(4),
    },
  },
  period: { from: FROM, to: TO, days },
  cases,
  note: "An estimate. The extra edge and the volume are both measured on the 43.78-hour recording of 26 to 28 October 2026, and assumed to hold from 2 January. The estimate uses expected values, not what players happened to win or lose in the recording.",
};
write(outDir, "damage-estimate.json", JSON.stringify(out, null, 2) + "\n");
const m = out.recording;
console.log(`26-28 October: ${m.bets.toLocaleString("en-US")} bets, $${m.wageredUsd.toLocaleString("en-US")} wagered, extra edge ${m.extraEdgePct}% (95% range ${m.range95Pct[0]}% to ${m.range95Pct[1]}%), expected return ${m.expectedReturnPct}%, $${m.extraCostInRecordingUsd.toLocaleString("en-US")} above the stated edge`);
console.log(`losing bets used too: ${out.losingBetsToo.kaplanMeierExtraEdgePct}%; shorter recordings ${out.check.shorterRecordings.map((s) => s.extraEdgePct + "%").join(" and ")}; all three pooled ${out.check.allThreePooled.extraEdgePct}%`);
console.log(`$${out.volume.recording.wageredPerDayUsd.toLocaleString("en-US")} a day wagered; bet rate ${r1(100 * out.volume.betIds.recordingVersus21Septo28Oct)}% of the 21 September to 28 October average`);
for (const [k, c] of Object.entries(cases)) console.log(`${k.padEnd(7)} $${c.wageringPerDay.toLocaleString("en-US")} a day wagered at ${c.extraEdgePct}%, $${c.extraCostPerDay.toLocaleString("en-US")} a day extra, $${c.extraCostSince2Jan.toLocaleString("en-US")} since 2 January`);
