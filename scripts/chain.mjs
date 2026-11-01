// Check it yourself: paste any Crash round hash, get the same list Gamdom's verifier shows.
//
//   node scripts/chain.mjs <game hash> [count] [--game <game id of that hash>]
//
// Prints the crash point for the hash given and for the `count` - 1 games before it,
// walking the chain backwards exactly as Gamdom's verifier does (previous hash = SHA-256
// of the current hash). With --game, each line also carries its game id.
//
// Example: take the hash on the last line of data/rounds-2026-10-08.csv (game 12080359)
//   node scripts/chain.mjs <that hash> 10 --game 12080359
// and the ten lines printed match the last ten lines of that file, newest first.
import { getPreviousResults } from "./verifier.mjs";

const argv = process.argv.slice(2);
let game = null;
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--game") game = Number(argv[++i]);
  else pos.push(argv[i]);
}
const [hash, countArg] = pos;
if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
  console.error("usage: node scripts/chain.mjs <64-hex-character game hash> [count] [--game <id>]");
  process.exit(2);
}
const count = Number(countArg || 30);
const rows = getPreviousResults(hash, count);
console.log(game == null ? "hash                                                              crash" : "game_id    hash                                                              crash");
rows.forEach((r, i) => {
  const id = game == null ? "" : String(game - i).padEnd(11);
  console.log(`${id}${r.hash}  ${r.result.padStart(8)}`);
});
