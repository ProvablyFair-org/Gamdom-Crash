# What Gamdom states

Every surface where Gamdom states Crash's return or its rakeback, as captured logged out. Each
folder holds the rendered page text on both dates, screenshots, and a `capture.json` with the
capture times and the sha256 of every file.

**Confirmed unchanged** means: every line of the rendered page text that mentions RTP, return to
player, 100%, 99%, zero edge, house edge, $5,000, $5k, rakeback, per day or daily is identical, line
for line, on both dates (the rule is written out in each `capture.json`).

| surface | url | first seen (UTC) | confirmed unchanged (UTC) | archive snapshot |
|---|---|---|---|---|
| [crash page](crash-page/) | https://gamdom.com/crash | 2026-09-19 11:47 | 2026-10-09 11:41, 11 of 11 lines | [web.archive.org, 2026-11-01 11:40](https://web.archive.org/web/20261101114059/https://gamdom.com/crash) |
| [crash FAQ](crash-faq/) | https://gamdom.com/crash (FAQ section) | 2026-09-19 11:47 | 2026-10-09 11:41, entry identical | [web.archive.org, 2026-11-01 11:40](https://web.archive.org/web/20261101114059/https://gamdom.com/crash) |
| [100% blog post](blog-100-rtp/) | https://gamdom.com/blog/gamdom-originals-100-rtp | 2026-09-19 13:24 | 2026-10-09 11:42, 25 of 25 lines | [web.archive.org, 2026-10-27 21:33](https://web.archive.org/web/20261027213327/https://gamdom.com/blog/gamdom-originals-100-rtp); [2026-11-01 11:41](https://web.archive.org/web/20261101114158/https://gamdom.com/blog/gamdom-originals-100-rtp) |
| [rewards page](rewards-page/) | https://gamdom.com/rewards | 2026-09-20 17:27 | 2026-10-09 11:42, 14 of 14 lines | [web.archive.org, 2026-10-27 21:34](https://web.archive.org/web/20261027213439/https://gamdom.com/rewards) |
| [rewards guide](rewards-guide/) | https://gamdom.com/blog/complete-guide-to-gamdom-rewards | 2026-09-19 13:25 | 2026-10-09 11:42, 7 of 7 lines | not linked: the web.archive.org replay of this page (2026-10-27 21:36) shows the 100% blog post text, so the capture in this folder is the record |
| [terms](terms/) | https://gamdom.com/help/terms | 2026-09-19 13:25 | 2026-10-09 11:42, all 15 search terms absent on both dates | [web.archive.org, 2026-10-27 21:37](https://web.archive.org/web/20261027213749/https://gamdom.com/help/terms) |
| [fairness page](help-fair/) | https://gamdom.com/help/fair | 2026-09-19 11:48 | 2026-10-09 11:42, Crash commitment and verifier link identical | [web.archive.org, 2026-10-27 21:32](https://web.archive.org/web/20261027213218/https://gamdom.com/help/fair); [2026-11-01 11:39](https://web.archive.org/web/20261101113920/https://gamdom.com/help/fair), Crash commitment unchanged |
| [game config](game-config/) | POST https://gamdom.com/client-api/gameConfigs/getGameConfigs | 2026-09-19 11:48; logged in 2026-10-08 (7 reads) | 2026-10-09 11:41, `internal_crash` identical | not applicable (API response) |

## What each one says

**Crash page.** "Crash pays out at 100% RTP for your first $5,000 in wagers, dropping to 99%
thereafter, giving it one of the highest RTPs available in online crash games." The game's
overview table: "RTP | 100% (up to $5,000 in wagers)". Further down: "For the first $5,000 in
wagers, Crash carries a 100% RTP with zero house edge, dropping to 99% thereafter", and "rounds are
short, the house edge is constant, and variance can be sharp". Logged in, the Crash tile carries a
"100%" badge (`../screenshots/zero-edge-badge-2026-10-08.png`). Outside those lines the page's stated
limits changed between the two dates: maximum bet $500,000 to $100,000, maximum profit $1,500,000
to $500,000. The game config already said `max_bet 100000`, `max_win 500000` on 19 September.

**Crash FAQ.** "What is the RTP of Gamdom Crash? 100% for the first $5,000 in wagers, then 99%
thereafter, giving a house edge of 1% beyond the Zero Edge limit."

**100% blog post** (published 19.11.2025, last updated 29.05.2026, as the page shows). "Get ready to
play all Gamdom Originals games like Dice, Mines, Plinko, Keno & Crash at 100% RTP. Instant rakeback
on your first $5k wagered daily." "All of our Gamdom Originals are now running at 100% RTP. That
means zero house edge and maximum returns." "True 100% returns / Zero house edge / The highest RTP in
crypto gaming." "With its 100% RTP, Gamdom Crash is now more rewarding than ever." Its own
definition: "a 97% RTP game would return $97 for every $100 wagered, on average."

**Rewards page.** "Rakeback rewards you for your bets in real time, calculated per bet rather than
as a flat percentage of your total wagering." "Rakeback is based on multiple factors like your bet
size, game RTP, and house edge, with each bet contributing individually to your total rewards."

**Rewards guide.** Instant, weekly and monthly rakeback, and 24 levels in 8 tiers ("Silver:
Progression rewards ramp up, offering better rakeback and surprises").

**Terms.** None of these 15 terms appears in the terms of service on either date: zero edge,
zeroedge, RTP, return to player, rakeback, rake back, $5,000, $5000, $5k, $50,000, $50k, house edge,
per day, daily, 24 hour (`terms/term-search.json`).

**Fairness page.** "The sample code to generate games hashes and calculate Crash results can be
found here", linking the verifier in `../verifier/`. "We're publishing a game's hash immediately after
the game ends." "The SHA256 of the final hash for Crash starting at game 5,257,547 is:
1d75b6cfadffdfc7dea5b7ed2c463c909571430c8f08fd3d0042b66661a8e4fc", the value the rounds in this pack
chain back to (`../results/chain-check.json`).

**Game config**, the configuration Gamdom's crash page loads: `internal_crash` with `rtp 99`,
`house_edge 1`, `min_bet 0.01`, `max_bet 100000`, `max_win 500000`, the same logged out on
19 September, logged in on 8 October and logged out on 9 October.

The crash page's live bets list (other players' names and bets) is removed from the page texts and
cropped out of the screenshots; each `capture.json` gives the sha256 of the uncut original.
