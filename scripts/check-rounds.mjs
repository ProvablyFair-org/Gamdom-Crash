// Round checker: recompute every round's crash point from its hash, and check the chain.
//
//   node scripts/check-rounds.mjs [--out-dir results]
//
// Reads data/rounds-2026-09-19.csv, data/rounds-2026-10-08.csv and data/rounds-2026-10-26.csv
// (game_id, hash and the crash point Gamdom reported for each round). For every round:
//   - recomputes the crash point from the hash with Gamdom's published verifier code
//   - for every pair of consecutive game ids, checks SHA-256(hash of game N) == hash of game N-1
// Writes results/parity-log.csv. Exits 1 if any round fails to recompute or any link breaks.
import path from "node:path";
import { ROOT, readCsv, toCsv, args, write } from "./lib.mjs";
import { crashPointFromHash, previousHash } from "./verifier.mjs";

const { outDir } = args();
const DATASETS = ["rounds-2026-09-19.csv", "rounds-2026-10-08.csv", "rounds-2026-10-26.csv"];

const out = [];
let bad = 0;
for (const name of DATASETS) {
  const rows = readCsv(path.join(ROOT, "data", name)).map((r) => ({ ...r, id: Number(r.game_id) }));
  rows.sort((a, b) => a.id - b.id);
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = 0, links = 0, linksOk = 0;
  for (const r of rows) {
    const recomputed = crashPointFromHash(r.hash);
    const match = recomputed === Number(r.crash_point).toFixed(2);
    if (match) ok++; else bad++;
    const prev = byId.get(r.id - 1);
    let link = "";
    if (prev) {
      links++;
      const good = previousHash(r.hash) === prev.hash;
      if (good) linksOk++; else bad++;
      link = good ? "ok" : "BROKEN";
    }
    out.push({
      dataset: name.replace(/\.csv$/, ""),
      game_id: r.id,
      hash: r.hash,
      crash_point_reported: Number(r.crash_point).toFixed(2),
      crash_point_recomputed: recomputed,
      match: match ? "true" : "false",
      chain_link_to_previous_game: link,
    });
  }
  const span = rows[rows.length - 1].id - rows[0].id + 1;
  console.log(
    `${name}: ${rows.length} rounds, games ${rows[0].id}-${rows[rows.length - 1].id} (${span - rows.length} missing in span); ` +
      `crash point recomputes from hash ${ok}/${rows.length}; chain links ${linksOk}/${links}`
  );
}
write(outDir, "parity-log.csv", toCsv(out, ["dataset", "game_id", "hash", "crash_point_reported", "crash_point_recomputed", "match", "chain_link_to_previous_game"]));
if (bad) {
  console.log(`FAIL: ${bad} mismatch(es) or broken link(s)`);
  process.exit(1);
}
console.log("all rounds recompute, all links hold");
