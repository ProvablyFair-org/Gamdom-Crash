// Live-chain check: rounds taken from the live game on 31 October 2026, against the
// commitment on Gamdom's fairness page.
//
//   node scripts/live-chain-check.mjs [--out-dir results]
//
// Reads data/rounds-2026-10-31-live.csv: 17 consecutive rounds, newest first, with the hash and
// the crash point the live game showed for each (game ids and times were not recorded).
//   1. recomputes every crash point from its hash with Gamdom's published verifier code
//   2. checks that each round's hash is the SHA-256 of the hash of the round above it
//   3. walks the chain backwards from the newest round for 10,500,000 hashes, more than the
//      10,000,000-hash chain the fairness page says its commitment covers, looking for the
//      published commitment value and for any round in data/rounds-2026-10-08.csv or
//      data/rounds-2026-09-19.csv. Any round on the committed chain reaches the commitment
//      within 10,000,000 hashes.
//   4. works out how much of the committed chain was still unplayed at the newest captured round
//      on it, and how long that would have lasted at the rate the captured games ran
//   5. walks back from a later round hash, copied from Gamdom's verifier on 1 November 2026
//      (data/round-2026-11-01-verifier.json), until it meets one of the 31 October rounds
//   6. records where the walk in step 3 meets the 5,381 rounds recorded from 26 to 28 October 2026
//      (data/rounds-2026-10-26.csv, which carries game ids and times), which dates the switch to
//      the new chain between the newest round on the committed chain and the oldest of those
// Writes results/live-chain-check.json. Deterministic. Exits 0 when the checks ran; whether
// the walk reached the commitment is recorded in the output.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCsv, args, write } from "./lib.mjs";
import { crashPointFromHash, previousHash } from "./verifier.mjs";

const { outDir } = args();
const live = readCsv(path.join(ROOT, "data", "rounds-2026-10-31-live.csv"))
  .map((r) => ({ pos: Number(r.position_newest_first), hash: r.hash, shown: r.crash_point_shown }))
  .sort((a, b) => a.pos - b.pos);

// the commitment and the stated chain length, from the captured fairness page
const pageFile = path.join("claims", "help-fair", "page-text-2026-10-09.txt");
const pageText = fs.readFileSync(path.join(ROOT, pageFile), "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const li = pageText.findIndex((l) => /final hash for Crash starting at game/.test(l));
const published = pageText[li + 1];
if (!/^[0-9a-f]{64}$/.test(published)) throw new Error("commitment line not found in the help/fair page text");
const lenLine = pageText.find((l) => /chain of \d+ million SHA256 hashes/.test(l));
const chainLength = Number(lenLine.match(/chain of (\d+) million/)[1]) * 1_000_000;
const LIMIT = chainLength + 500_000;

// 1 and 2: recompute and link
const mismatches = [];
for (const r of live) {
  const c = crashPointFromHash(r.hash);
  if (c !== Number(r.shown).toFixed(2)) mismatches.push({ position: r.pos, shown: r.shown, recomputed: c });
}
let links = 0;
for (let i = 0; i + 1 < live.length; i++) if (previousHash(live[i].hash) === live[i + 1].hash) links++;

// 3: walk back past the length of the committed chain
const capturedRows = ["rounds-2026-10-08.csv", "rounds-2026-09-19.csv"].flatMap((f) => readCsv(path.join(ROOT, "data", f)));
const captured = new Map(capturedRows.map((r) => [r.hash, Number(r.game_id)]));
const rows26 = readCsv(path.join(ROOT, "data", "rounds-2026-10-26.csv")).map((r) => ({ gameId: Number(r.game_id), hash: r.hash, startUtc: r.created_utc }));
const oct26 = new Map(rows26.map((r) => [r.hash, r]));
const met26 = [];
const t0 = Date.now();
let h = live[0].hash, steps = 0, reachedCommitmentAt = null, reachedCapturedRound = null;
while (steps < LIMIT) {
  if (h === published) { reachedCommitmentAt = steps; break; }
  if (captured.has(h)) { reachedCapturedRound = { gameId: captured.get(h), afterHashes: steps }; break; }
  if (oct26.has(h)) met26.push({ ...oct26.get(h), afterHashes: steps });
  h = previousHash(h);
  steps++;
}

// 4: the committed chain at the newest captured round on it
const startGame = Number(pageText[li].match(/game ([\d,]+)/)[1].replace(/,/g, ""));
const byId = capturedRows
  .map((r) => ({ gameId: Number(r.game_id), time: r.created_utc || r.crash_seen_utc, timeField: r.created_utc ? "created_utc" : "crash_seen_utc" }))
  .sort((a, b) => a.gameId - b.gameId);
const first = byId[0], last = byId[byId.length - 1];
const used = last.gameId - startGame;
const left = chainLength - used;
const perDay = (last.gameId - first.gameId) / ((Date.parse(last.time) - Date.parse(first.time)) / 86_400_000);

// 5: a later round on the same chain
const laterFile = path.join("data", "round-2026-11-01-verifier.json");
const later = JSON.parse(fs.readFileSync(path.join(ROOT, laterFile), "utf8"));
const livePos = new Map(live.map((r) => [r.hash, r.pos]));
let lh = later.hash, lsteps = 0, laterReaches = null;
while (lsteps <= 1_000_000) {
  if (livePos.has(lh)) { laterReaches = { livePosition: livePos.get(lh), afterHashes: lsteps }; break; }
  lh = previousHash(lh);
  lsteps++;
}

// 6. the 26-28 October rounds on the walk
const newest26 = met26[0], oldest26 = met26[met26.length - 1];
const allMetInOrder = met26.length === rows26.length && met26.every((m, i) => m.gameId === newest26.gameId - i && m.afterHashes === newest26.afterHashes + i);
const newestCommitted = last;

const out = {
  liveRounds: {
    file: "data/rounds-2026-10-31-live.csv",
    rounds: live.length,
    newestHash: live[0].hash,
    oldestHash: live[live.length - 1].hash,
  },
  recomputed: { equal: live.length - mismatches.length, of: live.length, mismatches },
  links: { equal: links, of: live.length - 1 },
  walkFromNewestLiveRound: {
    commitment: { source: pageFile, text: pageText[li], value: published },
    chainLengthStatedOnFairnessPage: chainLength,
    hashesWalked: steps,
    reachedCommitment: reachedCommitmentAt !== null,
    reachedCommitmentAfterHashes: reachedCommitmentAt,
    reachedCapturedRound,
    note: "Every round on the committed chain reaches the commitment within the chain's stated length.",
  },
  committedChainLeft: {
    startGame,
    newestCapturedRoundOnIt: last,
    hashesUsed: used,
    chainLengthStatedOnFairnessPage: chainLength,
    hashesLeft: left,
    rate: { from: first, to: last, roundsPerDay: +perDay.toFixed(1) },
    daysLeftAtThatRate: +(left / perDay).toFixed(1),
    note: "Rounds still to be played on the committed chain at the newest captured round on it, by the chain length the fairness page states.",
  },
  laterRound: {
    file: laterFile,
    hash: later.hash,
    reaches31OctRound: laterReaches,
    note: "A later round on the same chain as the 31 October rounds, which do not reach the published commitment within 10,500,000 hashes.",
  },
  switchDated: {
    file: "data/rounds-2026-10-26.csv",
    rounds26to28OctMetByTheWalk: met26.length,
    of: rows26.length,
    metInGameOrder: allMetInOrder,
    newest26to28OctRound: newest26 && { gameId: newest26.gameId, startUtc: newest26.startUtc, hashesBackFromNewest31OctRound: newest26.afterHashes },
    oldest26to28OctRound: oldest26 && { gameId: oldest26.gameId, startUtc: oldest26.startUtc, hashesBackFromNewest31OctRound: oldest26.afterHashes },
    newestCapturedRoundOnCommittedChain: newestCommitted,
    roundsFromOldest26OctRoundTo1NovRound: oldest26 && laterReaches && laterReaches.livePosition === 1 ? oldest26.afterHashes + laterReaches.afterHashes + 1 : null,
    note: "The 26-28 October rounds lie on the walk back from the 31 October rounds, so they are on the new chain, which reaches neither the commitment nor any 19 September or 8 October round. The new chain was in use from game 12,126,744 at the latest; the committed chain was still in use at the newest round captured on 8-9 October.",
  },
};
write(outDir, "live-chain-check.json", JSON.stringify(out, null, 2) + "\n");
console.log(`live rounds: ${out.recomputed.equal}/${live.length} crash points recompute, ${links}/${live.length - 1} links hold`);
console.log(`walked ${steps.toLocaleString("en-US")} hashes back from the newest live round in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(out.walkFromNewestLiveRound.reachedCommitment
  ? `reached the published commitment after ${reachedCommitmentAt.toLocaleString("en-US")} hashes`
  : reachedCapturedRound
    ? `reached captured game ${reachedCapturedRound.gameId} after ${reachedCapturedRound.afterHashes} hashes`
    : `published commitment not reached within ${LIMIT.toLocaleString("en-US")} hashes (stated chain length ${chainLength.toLocaleString("en-US")}); no captured round reached`);
console.log(laterReaches ? `1 November hash walks back to 31 October round ${laterReaches.livePosition} after ${laterReaches.afterHashes.toLocaleString("en-US")} hashes` : "1 November hash: no 31 October round within 1,000,000 hashes");
console.log(oldest26 ? `the walk meets ${met26.length}/${rows26.length} of the 26-28 October rounds, games ${newest26.gameId} to ${oldest26.gameId}, ${newest26.afterHashes.toLocaleString("en-US")} to ${oldest26.afterHashes.toLocaleString("en-US")} hashes back, in game order: ${allMetInOrder}` : "the walk meets none of the 26-28 October rounds");
console.log(`committed chain: ${used.toLocaleString("en-US")} of ${chainLength.toLocaleString("en-US")} hashes used by game ${last.gameId}, ${left.toLocaleString("en-US")} left, about ${Math.round(left / perDay).toLocaleString("en-US")} days at ${Math.round(perDay).toLocaleString("en-US")} rounds a day`);
