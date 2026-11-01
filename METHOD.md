# Method

How the figures in the README are obtained: the return of the game, derived from Gamdom's own
verifier code; the rakeback, measured on a test account; the two added together; the commitment, the
live chain and the salt; and an estimate of what the extra edge costs players.

## 1. RTP(x) from Gamdom's verifier code

Gamdom's fairness page links its Crash verifier, a CodeSandbox, as "the sample code to generate
games hashes and calculate Crash results" (`claims/help-fair/`). Its `math.js` is in
`verifier/sandbox-4nl2fc/math.js`; the line numbers below refer to that file.

**What the code does with a round's hash** (`crashPointFromHash`, lines 25–36):

| line | code | meaning |
|---|---|---|
| 27 | `hash = HmacSHA256(salt, serverSeed)` | HMAC-SHA256 with the round's hash as key and a fixed salt (line 20) as message: a 256-bit value |
| 29 | `if (divisible(hash, 100)) return 1.00` | if that 256-bit value is a multiple of 100, the round ends at 1.00x (the instant bust) |
| 32 | `h = parseInt(hash.slice(0, 52 / 4), 16)` | otherwise take its first 13 hex digits, the top 52 bits, as an integer h, 0 ≤ h < 2^52 |
| 33 | `e = 2^52` | |
| 35 | `floor(100 * (e - h/50) / (e - h)) / 100` | the crash point, rounded down to two decimals |

**Step 1, the instant bust.** `divisible` (lines 56–66) reduces the whole 256-bit value modulo 100.
For a uniformly random 256-bit value that is a multiple of 100 with probability 1/100, and the
answer does not depend on the top 52 bits (given those bits, the other 204 are still uniform, so
the residue mod 100 is uniform to within 100/2^204). So a round busts instantly with probability

    P(bust) = 1/100

**Step 2, the crash point.** Write u = h / 2^52, uniform on [0, 1). Before rounding, the code's crash
point is

    c(u) = (1 − u/50) / (1 − u)

**Step 3, when a cash-out target wins.** A bet with target x wins when the displayed crash point
reaches x. Targets have two decimals, so 100x is a whole number, and rounding down to two decimals
does not change the comparison: floor(100c)/100 ≥ x exactly when c ≥ x. Then

    c(u) ≥ x  ⇔  1 − u/50 ≥ x(1 − u)
              ⇔  u (x − 1/50) ≥ x − 1
              ⇔  u ≥ (x − 1) / (x − 0.02)

so, among rounds that do not bust instantly,

    P(c ≥ x) = 1 − (x − 1)/(x − 0.02) = 0.98 / (x − 0.02)

**Step 4, the return.** A winning bet pays x times the stake, a losing one nothing. Both conditions
must hold, so

    P(win at x) = 0.99 × 0.98 / (x − 0.02)
    RTP(x)      = x × P(win at x) = 0.99 × 0.98 × x / (x − 0.02)

The **0.99** is the instant bust (1 − 1/100, line 29). The **0.98** is the `/50` term (1 − 1/50,
line 35). This is the same expression as the formula usually quoted for this game; the code gives
nothing different. It holds for every target with two decimals from 1.01x up, which covers every
target a player can set; u moves in steps of 2^−52, which changes P(win) by at most 2^−52.

**What it means.**

| target | RTP | house edge |
|---|---|---|
| 1.01x | 98.98% | 1.02% |
| 1.50x | 98.33% | 1.67% |
| 2.00x | 98.00% | 2.00% |
| 5.00x | 97.41% | 2.59% |
| 10.00x | 97.21% | 2.79% |
| 100.00x | 97.04% | 2.96% |
| limit | 97.02% | 2.98% |

(`results/rtp-curve.csv`, exact to four decimals.)

- RTP(x) falls as x rises: x/(x − 0.02) decreases for every x above 0.02. The house edge is a
  function of how the player plays, not a constant.
- **No target returns 99%.** RTP(x) < 0.99 means 0.9702x < 0.99x − 0.0198, that is x > 1. So at
  every target above 1.00x the game returns less than the 99% Gamdom's configuration declares.
- The share of rounds that end at exactly 1.00x is the instant bust plus the rounds rounded down to
  1.00: 1/100 + 0.99 × (1 − 0.98/0.99) = 2/100.
- **A 99% version.** The instant bust alone takes the stated 1%. Without the `/50` term the crash
  point before rounding is 1/(1 − u), so P(c ≥ x) = 1/x, P(win at x) = 0.99/x, and the return is 99%
  at every target. The `/50` term takes a second edge on top of the first: 0.02 points at 1.01x,
  1.00 at 2x, 1.98 at the limit.

**Checked against the code, not just on paper.**

- `results/rtp-derivation-check.json`: for every target on the 0.01 grid from 1.01x to 1000.00x
  (99,900 targets), the script finds the exact value of h at which the code's floored result first
  reaches the target and compares it with the boundary from step 3. All 99,900 cross within one
  unit in 2^52 of it (65,957 exactly on it); the most probability any of them moves is 2.2 × 10^−16.
  All 99,900 return less than 99%.
- `results/rtp-montecarlo.json`: the code run on 60,000,000 random hashes, sharing no algebra with
  the formula. At every target in the table the realised return is within 1.13 standard errors of
  RTP(x), and 1.99989% of the rounds end at 1.00x.
- `results/parity-log.csv`: the live game runs this code. All 5,804 settled rounds in `data/`
  (20 from 19 September, 403 consecutive from 8 October, 5,381 consecutive from 26 to 28 October)
  recompute from their hashes, and each consecutive pair is linked by SHA-256 (19 of 19, 402 of 402
  and 5,380 of 5,380 links). The 17 rounds taken from the live game on 31 October also recompute and
  link (17 of 17, 16 of 16). The 26 to 28 October and 31 October rounds are on a different chain
  (section 5).

## 2. Rakeback, measured

**Session.** One test account, logged in, 8 October 2026, 21:58–22:49 UTC. 101 bets of $1.00 from
the USDT wallet with Autobet: 25 at 1.50x, 25 at 2.00x, 26 at 5.00x, 25 at 10.00x
(`data/our-bets-2026-10-08.csv`). Over the session the daily Originals counter and the USDT balance
moved only by these bets (below, and section 4).

**Reads.** While logged in, three of Gamdom's account endpoints were read before play and after each
batch: the available rewards (`/client-api/reward/getAvailableRewards`, instant rakeback), the daily
Originals-wagered counter (`/client-api/profile/dailyOriginalsWagered`) and the wallets
(`/client-api/profile/get-wallets`, USDT balance) (`data/rewards-reads-2026-10-08.csv`). The instant
rakeback was read again after each round in which the account had a bet (`instant_rakeback_coins` in
the bets file). After the session it stood at 1,516 coins, and the Rewards panel showed
"Claim $1.01" (`screenshots/rewards-panel-2026-10-08.jpg`). Rakeback is held in coins; Gamdom's own currency
endpoint prices one coin at $0.000666… = $1/1500 (`data/units-2026-10-08.json`), and a $1.00 stake
appears in Gamdom's bet feed as 1,500.

**Assignment.** A bet's stake, its rakeback and the daily counter move when the bet is placed; its
payout moves when it cashes out. Each bet is counted in the interval between reads in which it was
placed, and its payout in the interval in which it cashed out (`scripts/build-tables.mjs`).

**Result** (`results/rakeback-by-batch.csv`):

| batch | bets | staked | instant rakeback | share of stake |
|---|---|---|---|---|
| 1.50x | 25 | 37,500 coins ($25.00) | +375 coins | 1.00% |
| 2.00x | 25 | 37,500 coins ($25.00) | +375 coins | 1.00% |
| 5.00x | 26 | 39,000 coins ($26.00) | +390 coins | 1.00% |
| 10.00x | 25 | 37,500 coins ($25.00) | +375 coins | 1.00% |

Per bet, every one of the 100 bets with a read of its own added 15 coins ($0.01), the 39 that won
and the 61 that lost alike. The 101st bet has no per-round read of its own; the 5.00x batch total
(390 coins on 26 bets) includes it. The daily counter rose by exactly the stake of each batch: it
read 0 before the session and 151,500 coins ($101.00) after it, so by Gamdom's own counter every bet
fell inside the first $5,000 of Originals wagering.

Instant rakeback is therefore a flat 1.00% of the stake: the same at 1.50x as at 10.00x, whether
the bet wins or loses. It does not follow the game's edge, which rises with the target.

**Weekly and monthly.** Gamdom's rewards page says weekly and monthly rewards build in the background
and appear at the end of their period; it publishes no rates. The Rewards panel showed the October
monthly period ending about 1 November 2026, 00:00 UTC (23d 1h left on 8 October at 22:51 UTC,
3d 10h left on 28 October at 13:52 UTC). On 1 November at 05:23 UTC the account's rewards were read
again from the Rewards page (`data/rewards-2026-11-01/`): one pending reward, the instant rakeback of
1,516 coins ($1.01), unchanged since the session, and no weekly or monthly reward. The panel showed
weekly and monthly as "Not available yet", the account still Unranked and the USDT balance unchanged
at 203.06 (`screenshots/rewards-panel-2026-11-01.png`). The weekly for the session's own week, ending
12 October, was checked at the time and showed nothing; that check was not captured.

## 3. Net return

Rakeback is paid as a share of the stake, so per $1 staked a player gets back RTP(x) from the game
and r from rakeback:

    net(x) = RTP(x) + r,    shortfall(x) = 100% − net(x)

with r the instant rakeback measured at that target (`results/net-shortfall.csv`):

| target | RTP(x) | r | net(x) | short of 100% |
|---|---|---|---|---|
| 1.50x | 98.3311% | 1.00% | 99.3311% | 0.6689 pts |
| 2.00x | 98.0000% | 1.00% | 99.0000% | 1.0000 pts |
| 5.00x | 97.4096% | 1.00% | 98.4096% | 1.5904 pts |
| 10.00x | 97.2144% | 1.00% | 98.2144% | 1.7856 pts |

Only the four measured targets are netted. The session's own realised return (108%, 88%, 173% and
40% for the four batches) is sampling noise at 25 bets and plays no part in these figures.

## 4. Payouts and balance

Each bet's payout is its stake times its target when the round's crash point reaches the target,
and nothing otherwise (`results/our-bets-check.csv`). Between consecutive reads the USDT balance
moved by exactly the payouts minus the stakes of the bets in that interval: +2.00, −3.00, +19.00
and −15.00 USDT, from 200.06 to 203.06 (`results/balance-reconciliation.csv`).

## 5. The commitment, the live chain and the salt

**The commitment.** Gamdom's fairness page says it has "generated a chain of 10 million SHA256
hashes for each game" and publishes, for Crash, "the SHA256 of the final hash for Crash starting at
game 5,257,547": `1d75b6cfadffdfc7dea5b7ed2c463c909571430c8f08fd3d0042b66661a8e4fc`
(`claims/help-fair/`). Each round's hash is the SHA-256 of the next round's hash, so walking back from
any round on that chain reaches the published value within 10,000,000 hashes. Publishing that value
before the chain is played is the precommitment: it fixes every round on the chain in advance.

- From the newest 8 October round, game 12,080,359, the walk reaches it after 6,822,812 hashes,
  passing all 422 other rounds captured on 19 September and 8 October on the way (`scripts/chain-check.mjs`,
  `results/chain-check.json`).
- `data/rounds-2026-10-31-live.csv` holds 17 consecutive rounds from the live game's round history
  on 31 October 2026, newest first. All 17 crash points recompute from their hashes with the
  published code and all 16 links hold. From the newest of them, 10,500,000 hashes back reach neither
  the published value nor any round captured on 19 September or 8 October
  (`scripts/live-chain-check.mjs`, `results/live-chain-check.json`).
- `data/round-2026-11-01-verifier.json` holds one round hash copied from Gamdom's Crash verifier on
  1 November 2026. Walking back from it reaches the newest 31 October round after 3,294 hashes, so it
  is a later round on the same chain. Only the operator holding a chain can produce a hash further
  along it.
- `data/rounds-2026-10-26.csv` holds 5,381 consecutive rounds recorded from 26 to 28 October 2026,
  with game ids and start times. The walk back from the newest 31 October round meets all of them,
  in order: game 12,132,124 after 7,671 hashes, game 12,126,744 after 13,051. They are on the same
  chain as the 31 October rounds (`results/live-chain-check.json`, `switchDated`).

So between game 12,080,359 (9 October, 00:01 UTC), the newest round captured on the committed chain,
and game 12,126,744 (26 October, 19:19 UTC), Crash moved to a chain the fairness page does not commit
to, and it was still on that chain on 1 November: from game 12,126,744 to the 1 November round is
16,346 rounds. The committed chain had not run out: by game 12,080,359
it had used 6,822,812 of its stated 10,000,000 hashes, leaving 3,177,188. Games 12,022,932 to
12,080,359 ran at 2,942.9 a day, at which rate the rest would have lasted 1,079.6 days
(`results/live-chain-check.json`). We found no announcement of the change, no commitment for the new
chain and no seeding event, and the fairness page still shows the old commitment (web.archive.org,
1 November 2026, 11:39 UTC: https://web.archive.org/web/20261101113920/https://gamdom.com/help/fair). The rounds played
now are therefore not precommitted: they follow the code and link to each other, but nothing
published before they were played fixes them.

**The salt.** `math.js` (line 20) salts every round with
`000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a`, the hash of Bitcoin block 339,300,
mined on 17 January 2015 at 05:08 UTC
(https://blockstream.info/block/000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a).
Bustabit used the same salt for the chain in its January 2015 seeding event
(https://bitcointalk.org/index.php?topic=922898.0), and published that chain's final hash on
13 January 2015, before the block existed. A salt protects players only if it is unknown when the
chain is committed: then the operator cannot know a chain's outcomes when it commits to it. This salt
was public long before either of Gamdom's chains was created, so a chain's outcomes could be computed
before committing to it. Players
can verify that every result follows the code; they cannot verify that the sequence was not chosen.
Nothing in this pack shows that a chain was chosen for its outcomes.

## 6. The cost to players: an estimate

**What is estimated.** The extra edge: what Crash takes above the stated 1% house edge. A bet of
stake s at cash-out x returns s × RTP(x) on average (section 1), against s × 99% at the stated
edge, so the extra edge on that bet is s × (99% − RTP(x)): 0.67% of the stake at 1.50x, 1.00% at
2.00x, 1.79% at 10.00x. Within the $5,000 Zero Edge limit this is also the shortfall from 100%,
because instant rakeback adds a flat 1.00% (section 3); above the limit it is the shortfall from the
stated 99%.

**Real bets.** `data/feed-2026-10-26.csv` holds every bet in Gamdom's public Crash bet feed from
26 October 2026, 19:19 UTC, to 28 October, 15:06 UTC: 5,381 rounds, 99,119 bets from 925 players,
$850,279 wagered. Gamdom numbers every Crash bet in sequence, and the recording holds 99,119 of the
99,143 numbers its bets span (`data/bet-ids.json`). Stakes are in Gamdom's coin unit whatever the
player's wallet (`data/feed-2026-10-26.capture.json`). The feed shows a bet's cash-out only when the
bet wins. A bet at x wins with probability P(x) = 0.99 × 0.98 / (x − 0.02) whatever the player does,
because the crash point is fixed before the round, so each winning bet at x stands for 1/P(x) bets
at x (inverse probability weighting). The reweighted wins account for 96.9% of the recorded
wagering, and

    extra edge = Σ s × (99% − RTP(x)) / P(x)  ÷  Σ s / P(x),   over winning bets
               = 1.119%

Resampling players gives a 95% range of 1.005% to 1.246%. So the expected return on the bets players
placed is 97.88%, an effective house edge of 2.12%: $9,514 above the stated edge in the 44 hours.
Without the largest player it is 1.17%. A second estimate also uses the losing bets, whose targets
were above their round's crash point (stake-weighted Kaplan-Meier): 1.120%.

**A check.** Two shorter recordings hold every bet in the feed for 21 September 2026, 16:20 to
17:26 UTC (149 rounds, 3,453 bets, 76 players, $107,821 wagered), and for 8 October, 21:02 UTC, to
9 October, 00:01 UTC (383 rounds, 8,395 bets, 139 players, $59,707): `data/feed-2026-09-21.csv` and
`data/feed-2026-10-08.csv`. They give 0.94% and 1.15%, and all three recordings pooled give 1.098%.
They cover one and three evening hours, and one player made 77% of the 21 September wagering, so the
estimate uses the 44 hours alone.

**Volume.** In the 26 to 28 October recording players wagered $850,279 in 43.78 hours: $466,117 a
day. The recording covers every hour of the day, most of them twice. The same hours differ from day
to day: $105,379 from 20:00 to 24:00 UTC on 26 October against $54,219 on 27 October, and $293,825
from 00:00 to 15:00 UTC on 27 October against $295,497 on 28 October. 27 October, the one full UTC
day in the recording, had $442,320. Gamdom's bet numbers show how typical the recording was
(`data/bet-ids.json`): Crash took 54,349 bets a day during it, against 56,196 a day on average from
21 September to 28 October, 60,551 a day from 21 September to 8 October and 52,061 a day from 9 to
26 October.

**Since January.** From 2 January 2026, when the verifier was created, to 31 October 2026 (303
days) (`scripts/damage-estimate.mjs`, `results/damage-estimate.json`):

| case | Crash wagering a day | extra edge | extra a day | 2 January to 31 October |
|---|---|---|---|---|
| low: 27 October, at the low end of the range | $442,320 | 1.005% | $4,445 | $1,346,883 |
| central: the 44-hour recording | $466,117 | 1.119% | $5,215 | $1,580,281 |
| high: the recording's wagering per bet at the 21 September to 8 October bet rate, at the high end of the range | $519,425 | 1.246% | $6,474 | $1,961,655 |

The estimate assumes Crash wagering from January to September ran at about the pace measured in late
October; Gamdom's bet numbers cover only the five weeks from 21 September. Wagering is concentrated:
the 10 largest players made 53% of the 44 hours' wagering, so how much high rollers play in a given
month moves the total. The extra edge per dollar is the firm part. The estimate uses expected values,
not what players happened to win or lose in the recording.

**Per bet.** The same quantity prices each bet. A bet of stake s at cash-out x was charged

    s × (99% − RTP(x)) = s × 1.98% × (1 − 0.98 / (x − 0.02))

more than the stated edge, whether it won or lost: $6.69 per $1,000 at 1.50x, $10.00 at 2.00x,
$17.86 at 10.00x. Re-settling past rounds under a 99% formula gives the same amount on average (at
1.50x, the 99% version above turns 0.45% of bets from losses into wins, each paid 1.5 times its
stake, which is 0.67% of the stake), but it hands that amount to the few bets that lost narrowly,
cannot be done for manual cash-outs that busted, and depends on which 99% formula is chosen.
