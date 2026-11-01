# Gamdom Crash: returns less than advertised, and not provably fair as implemented

An evidence pack by ProvablyFair.org, published with the report at
https://provablyfair.org/investigations/gamdom-crash. Capture window: 19 September to 1 November 2026 (UTC).
Every figure below comes from a file in this folder. The computed ones are rebuilt from `data/` by
the scripts in `scripts/`: `node scripts/reproduce.mjs` runs them all.

## Findings

### 1. Crash returns less than Gamdom advertises

**The house edge is not 1%.** Gamdom's game configuration declares Crash at `rtp 99`, `house_edge 1`,
and its Crash FAQ says the game pays "100% for the first $5,000 in wagers, then 99% thereafter, giving
a house edge of 1% beyond the Zero Edge limit" (`claims/`). The verifier Gamdom publishes for Crash
fixes the return of a bet with cash-out target x at

    RTP(x) = 0.99 × 0.98 × x / (x − 0.02)

That is 98.98% at 1.01x, 98.00% at 2x, 97.21% at 10x, falling toward 97.02%. The house edge is
2.00% at a 2x target and approaches 3% at high targets. At every target above 1.00x the game returns
less than the declared 99% (`METHOD.md`, `results/rtp-curve.csv`). The verifier has not changed since
2 January 2026, and the live rounds checked on 8, 26 to 28, and 31 October run it.

**What it costs players: an estimate.** On the bets players actually place, the extra edge comes
to about 1.1% of wagering. We recorded every bet in Gamdom's public Crash bet feed for 44 hours,
26 to 28 October 2026: 99,119 bets from 925 players, $850,279 wagered. The cash-outs players chose
give an expected return of 97.88% instead of 99%: an extra edge of 1.12% (95% range 1.00% to 1.25%)
and an effective house edge of 2.12%, double the stated 1%. That is $9,514 above the stated edge in
44 hours, or $5,215 a day at the recording's $466,117 a day of wagering. Gamdom numbers every Crash
bet in sequence, and those numbers put the 44 hours at 97% of the average bet rate from 21 September
to 28 October. From 2 January to 31 October 2026 that comes to about $1.58 million, in a range of
$1.35 million to $1.96 million (`results/damage-estimate.json`, `METHOD.md` section 6). Two shorter
recordings, on 21 September and 8 October, give an extra edge of 0.94% and 1.15%. The extra edge is
measured on real bets. The volume assumes January to September ran at about the pace measured in
October.

**The 100% is not 100%.** Gamdom advertises Crash at "100% RTP for your first $5,000 in wagers" and
its Originals at "zero house edge" and "True 100% returns", with "Instant rakeback on your first $5k
wagered daily". On a test account, instant rakeback was 1.00% of the stake at every target tested:
15 coins ($0.01) on each $1.00 bet, won or lost (`results/rakeback-by-batch.csv`). With instant
rakeback, the game returns 98.21% to 99.33% at the targets tested (`results/net-shortfall.csv`):

| cash-out target | game RTP | instant rakeback | net return | short of 100% |
|---|---|---|---|---|
| 1.50x | 98.33% | 1.00% | 99.33% | 0.67 points |
| 2.00x | 98.00% | 1.00% | 99.00% | 1.00 points |
| 5.00x | 97.41% | 1.00% | 98.41% | 1.59 points |
| 10.00x | 97.21% | 1.00% | 98.21% | 1.79 points |

The rakeback is flat and the edge rises with the target, so the gap widens as the target goes up.
Gamdom's rewards page says rakeback "is based on multiple factors like your bet size, game RTP, and
house edge"; measured, it was the same 1.00% of the stake at 1.50x as at 10.00x. We waited a full
monthly reward cycle to see whether a later reward would close the gap: on 1 November, after the
October monthly period closed, no weekly or monthly reward had been paid on that wagering
(`data/rewards-2026-11-01/`).

### 2. Crash is not provably fair as implemented

Every round checked follows Gamdom's published code: the 423 rounds captured on 19 September and
8 October, the 5,381 consecutive rounds recorded from 26 to 28 October, and 17 consecutive rounds
taken from the live game on 31 October (`results/parity-log.csv`, `results/live-chain-check.json`). What is missing is the proof that the rounds were fixed before
anyone bet.

A hash chain is provably fair because of a precommitment: the chain's final hash is published before
the first round is played, and every round can be walked back to it. That fixes the whole sequence in
advance.

- **The committed chain was replaced without notice.** Gamdom's fairness page commits to a
  10-million-hash chain for Crash "starting at game 5,257,547". Every round captured on 19 September
  and 8 October leads back to it. The 17 live rounds of 31 October link to each other, but walking
  back 10,500,000 hashes from the newest, more than the whole committed chain, reaches neither the
  commitment nor any round captured in September or early October. On the way it passes all 5,381
  rounds recorded from 26 to 28 October, in order. So Crash moved to a new chain between game
  12,080,359 (9 October, 00:01 UTC), the newest round captured on the committed chain, and game
  12,126,744 (26 October, 19:19 UTC). It was still on the new chain on 1 November: a round hash
  copied from Gamdom's verifier that day walks back to the newest 31 October round in 3,294 hashes.
  That makes at least 16,346 rounds played on a chain Gamdom has not committed to. The old chain had
  not run out: by the fairness page's own numbers, 3,177,188 of its rounds were still to be played on
  9 October, about three years at the rate the captured rounds ran (`results/live-chain-check.json`).
  We found no announcement of the change, no commitment for the new chain and no seeding event, and
  the fairness page still shows the old commitment (archived 27 October, and again on 1 November
  after the switch: https://web.archive.org/web/20261101113920/https://gamdom.com/help/fair).
- **The rounds played now are not precommitted.** They follow the code and link to each other, but
  nothing Gamdom published before they were played fixes them. Replacing a chain can be the right
  step, for example when its secret may have been exposed. Done properly, the new chain's commitment
  is published before it is used, and the chain is salted with a Bitcoin block mined after that.
- **The salt was public years before the chain.** The verifier salts every round with the hash of
  Bitcoin block 339,300, mined on 17 January 2015 (`verifier/sandbox-4nl2fc/math.js`, line 20). It is
  the salt Bustabit used for the chain in its January 2015 seeding event
  (https://bitcointalk.org/index.php?topic=922898.0). Bustabit published that chain's final hash on
  13 January 2015 and the block was mined on 17 January, so no one could know the salt when the
  chain was fixed. Gamdom's chains were created long after the block was public, so the outcomes of
  a chain could be computed before Gamdom committed to it. This applies to the old chain and the new
  one.

Players can check that each result follows the code. They cannot check that the sequence was not
chosen. We found no evidence that it was, and there is no way to check either way. The fix is a
fresh seeding event: publish the commitment for the current chain, then take the salt from a Bitcoin
block mined after it, announced in advance.

## Method

Full derivation and measurement: `METHOD.md`.

1. **The verifier.** Gamdom's fairness page links a CodeSandbox as its Crash verifier. Its source,
   as captured on 19 September 2026 with its file hashes and CodeSandbox metadata (created and last
   updated 2 January 2026), is in `verifier/`. `METHOD.md` derives RTP(x) from its `math.js` line by
   line.
2. **The derivation, tested against the code.** At all 99,900 cash-out targets from 1.01x to
   1000.00x, the code's own crossing point agrees with the formula to within one unit in 2^52
   (`results/rtp-derivation-check.json`). A 60,000,000-hash Monte Carlo of the code lands within
   1.13 standard errors of the formula at every target tested (`results/rtp-montecarlo.json`).
3. **The live game runs that code.** 5,804 settled rounds, 20 from 19 September, 403 consecutive
   from 8 October and 5,381 consecutive from 26 to 28 October, all recompute from their hashes, and
   every consecutive pair is linked by SHA-256 (`results/parity-log.csv`). 17 consecutive rounds
   taken from the live game on 31 October also recompute and link (`results/live-chain-check.json`).
4. **The commitment.** From the newest 8 October round, hashing back 6,822,812 times reaches the
   value Gamdom publishes for its Crash chain (`results/chain-check.json`). From the newest
   31 October round, 10,500,000 hashes back do not, and that walk passes every 26 to 28 October round
   (`results/live-chain-check.json`).
5. **Rakeback.** A test account placed 101 bets of $1.00 at four targets on 8 October 2026. Its
   instant rakeback, Gamdom's daily Originals-wagered counter and its USDT balance were read before
   play and after each batch, and the rakeback again after each round (`data/`,
   `results/rakeback-by-batch.csv`). The account's rewards were read again on 1 November 2026, after
   the October monthly period closed (`data/rewards-2026-11-01/`).
6. **Net return** = RTP(x) + the instant rakeback measured at that target.
7. **The cost to players.** Every bet in a 44-hour recording of Gamdom's public Crash bet feed, with
   the cash-out mix rebuilt from the winning bets, gives the extra edge on real play and the wagering
   per day. Gamdom's bet numbers show how typical the recording was, and two shorter recordings check
   the edge (`results/damage-estimate.json`).

What Gamdom states, surface by surface, with capture times and hashes: `claims/INDEX.md`.

## Data

| file | contents |
|---|---|
| `data/rounds-2026-10-08.csv` | 403 consecutive rounds, games 12,079,957 to 12,080,359, 8 October 2026 20:52 UTC to 9 October 00:01 UTC: game id, hash, crash point as Gamdom reported it, time |
| `data/rounds-2026-09-19.csv` | 20 rounds, games 12,022,932 to 12,022,951, 19 September 2026 11:41 to 11:48 UTC |
| `data/rounds-2026-10-26.csv` | 5,381 consecutive rounds, games 12,126,744 to 12,132,124, 26 October 2026 19:19 UTC to 28 October 15:06 UTC: game id, hash, crash point, start time |
| `data/rounds-2026-10-31-live.csv` | 17 consecutive rounds from the live game's round history, 31 October 2026, newest first: hash and the crash point the game showed. Game ids and times were not recorded (`rounds-2026-10-31-live.capture.json`) |
| `data/round-2026-11-01-verifier.json` | one round hash copied from Gamdom's Crash verifier on 1 November 2026; it walks back to the newest 31 October round in 3,294 hashes (`results/live-chain-check.json`) |
| `data/our-bets-2026-10-08.csv` | the test account's 101 bets: round, target, stake, crash point, cash-out, result, instant rakeback |
| `data/rewards-reads-2026-10-08.csv` | instant rakeback, daily Originals-wagered counter and USDT balance, before play and after each batch |
| `data/rewards-2026-11-01/` | the test account's rewards and wallets as Gamdom's Rewards page loaded them on 1 November 2026, 05:23 UTC, after the October monthly period closed: both responses as copied, with `capture.json` |
| `data/units-2026-10-08.json` | Gamdom's own rate for its coin unit: 1 coin = $1/1500 |
| `data/feed-2026-09-21.csv` | every bet in Gamdom's public Crash bet feed, 21 September 2026 16:20 to 17:26 UTC, 149 rounds, 3,453 bets: round, player (ranked label, names and ids removed), stake, cash-out if it won |
| `data/feed-2026-10-08.csv` | the same for 8 October 2026 21:02 UTC to 9 October 00:01 UTC, 383 rounds, 8,395 bets, including the test account's 101 (labelled `test`) |
| `data/feed-2026-10-26.csv` | the same for 26 October 2026 19:19 UTC to 28 October 15:06 UTC, 5,381 rounds, 99,119 bets from 925 players. Stakes are in Gamdom's coin unit whatever the player's wallet (`feed-2026-10-26.capture.json`) |
| `data/bet-ids.json` | Gamdom's sequential Crash bet numbers in the three feed recordings: how many numbers each recording spans and how far the numbers moved between them |

Bets notes:

- 101 bets of $1.00 from the USDT wallet with Autobet, 21:58 to 22:49 UTC on 8 October 2026: 25 at
  1.50x, 25 at 2.00x, 26 at 5.00x and 25 at 10.00x, including one autobet bet placed after the 25th
  5.00x bet (`screenshots/autobet-panel-2026-10-08.png`).
- Test account: Gamdom user id 48213257.
- Every bet checks out (`results/our-bets-check.csv`): its round is in the rounds file, its crash
  point recomputes from the round's hash, and it cashed out at its target exactly when the round
  reached the target. Gamdom's own record of the account's placed bets shows the target for 22 of
  them, equal to the Autobet setting each time.
- Payouts are stake times target on a win. Between reads the wallet balance moved by exactly the
  payouts minus the stakes: +2.00, −3.00, +19.00 and −15.00 USDT, from 200.06 to 203.06
  (`results/balance-reconciliation.csv`).
- Gamdom's daily Originals-wagered counter read 0 before the session and 151,500 coins ($101.00)
  after it: every bet was inside the first $5,000.
- After the session the Rewards panel showed "Claim $1.01" (1,516 coins: 1 held before the session
  and 1,515 earned on the 101 bets) and the account at "Unranked", 0% progress
  (`screenshots/rewards-panel-2026-10-08.jpg`). On 1 November it still showed "Claim $1.01", with
  weekly and monthly "Not available yet" and the USDT balance unchanged at 203.06
  (`screenshots/rewards-panel-2026-11-01.png`).
- The realised return of the four batches (108%, 88%, 173%, 40%) is sampling noise at 25 bets. The
  RTP figures come from the exact curve, not from these bets.

## Reproduce

Node.js 18 or later. Nothing to install.

    node scripts/reproduce.mjs

It recomputes the 5,804 rounds and their chain links, rebuilds the RTP curve and its check against the
code, rebuilds every table from `data/`, walks the hash chain to Gamdom's commitment, checks the
31 October live rounds, walks 10,500,000 hashes back from them through the 26 to 28 October rounds,
works out how much of the committed chain was left, rebuilds the cost estimate from the bet feed, compares each rebuilt file byte
for byte with `results/`, runs a fresh Monte Carlo, and checks every file against `SHA256SUMS`.
The steps one by one:

    node scripts/check-rounds.mjs                     # results/parity-log.csv
    node scripts/rtp-curve.mjs                        # results/rtp-curve.csv, rtp-derivation-check.json
    node scripts/build-tables.mjs                     # our-bets-check, rakeback-by-batch, net-shortfall, balance-reconciliation
    node scripts/chain-check.mjs                      # results/chain-check.json, realised-curve.csv
    node scripts/live-chain-check.mjs                 # results/live-chain-check.json
    node scripts/damage-estimate.mjs                  # results/damage-estimate.json
    node scripts/rtp-montecarlo.mjs 60000000 > mc.json
    shasum -a 256 -c SHA256SUMS

A fresh Monte Carlo draws new random hashes, so it matches `results/rtp-montecarlo.json` within
sampling error, not byte for byte.

## Check it yourself

Gamdom publishes each Crash round's hash after the round ends, and each hash is the SHA-256 of the
next round's hash. One hash is enough to check every round before it.

1. **Any round.** Take a round's hash, for example any line of `data/rounds-2026-10-08.csv`, and
   paste it into Gamdom's verifier (the link is in `verifier/SOURCE.md`). It lists that round's crash
   point and the rounds before it. `node scripts/chain.mjs <hash> 30` runs the same algorithm and
   prints the same list.
2. **Back to Gamdom's commitment.** Gamdom's fairness page publishes a value for the Crash chain
   "starting at game 5,257,547": `1d75b6cfadffdfc7dea5b7ed2c463c909571430c8f08fd3d0042b66661a8e4fc`.
   Starting from the newest round here, game 12,080,359, and hashing back 6,822,812 times gives
   exactly that value. On the way the walk passes the 422 other rounds captured on 19 September and 8 October, and every hash
   matches the one Gamdom showed (`results/chain-check.json`). Start instead from a round in the live
   game on 31 October and the walk never gets there (`node scripts/live-chain-check.mjs`).
3. **The curve from real rounds.** The walk produces the 57,428 games numbered 12,022,932
   (19 September, 11:41 UTC) to 12,080,359 (9 October, 00:01 UTC). Of these, 1.89% ended at 1.00x;
   the code's exact share is 2%. At every target from 1.01x to 1000x, the realised return is within
   2 standard errors of the exact curve (`results/realised-curve.csv`). Real rounds pay what the code
   says, and the code pays less than Gamdom states.

`node scripts/chain-check.mjs` does steps 2 and 3 in a few seconds.

## Limits

- Instant rakeback was measured on one account, at the Unranked tier, at four cash-out targets,
  with $1.00 stakes, inside the first $5,000 of Originals wagering. Other tiers and targets were not
  measured. Gamdom's 100% promise carries no tier condition.
- Weekly and monthly rakeback: after the October monthly period closed, Gamdom's rewards data for the
  test account listed only the instant rakeback, and the Rewards panel showed weekly and monthly as
  "Not available yet" (1 November 2026, `data/rewards-2026-11-01/`). The weekly for the session's own
  week, ending 12 October, was checked at the time and showed nothing; that check was not captured.
  Gamdom publishes no weekly or monthly rates.
- Instant rakeback above $5,000 a day was not tested and is not claimed.
- The new Crash chain began between 9 October 2026, 00:01 UTC, and 26 October, 19:19 UTC. Its exact
  start was not observed.
- The cost estimate measures Crash wagering over 43.78 hours in late October and assumes it held
  from 2 January. Gamdom's bet numbers put those hours at 97% of the average bet rate over the five
  weeks from 21 September; nothing in this pack measures January to August. Wagering is
  concentrated: the 10 largest players made 53% of the 44 hours' wagering, so how much high rollers
  play moves the total. The estimate covers all Crash wagering: the extra edge is measured against
  the stated 99%, so it holds above the $5,000 Zero Edge limit as well as below it.

Full capture pack (credentials redacted) archived privately, sha256 3887555d9d0dbfbfa0871f3c6df28b37f2ec33fca13e30392463071047688029, available to independent reviewers on request. The 28 October and 1 November screenshot originals are held privately as well; they were captured after that pack was sealed (`screenshots/capture.json`). So is the 26 to 28 October recording with player names (sha256 c5b694811091fa098a499d24d6e42f9f7057daf078da43fbd55b3cdab719037e, `data/feed-2026-10-26.capture.json`).

## License and citation

Scripts in `scripts/`: MIT. Data, results and text: CC BY 4.0. Gamdom's verifier source in
`verifier/sandbox-4nl2fc/` and the page captures in `claims/` are Gamdom's material, reproduced as
evidence and not covered by either license. See `LICENSE`.

Cite as: ProvablyFair.org, "Gamdom Crash RTP evidence pack", version 1.0, November 2026.
