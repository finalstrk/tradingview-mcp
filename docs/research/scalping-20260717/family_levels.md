# Family Synthesis: Key Levels & Liquidity Sweep (levels)

**Date**: 2026-07-17
**Sources digested**: levels_021, levels_022, levels_023, levels_024, levels_025, levels_026, levels_028, levels_029 (levels_027 and levels_030 errored/empty in research phase — excluded, no content to synthesize)

## Overall Assessment

This family's evidence is **weak-to-negative overall**. Across 8 completed research topics covering PDH/PDL sweeps, turtle-soup/stop-hunt reversals, round-number levels, initial-balance/overnight-range breaks, previous-close mean reversion, S/R retests, gap-fill, and time-of-day breakout/fade — the pattern repeats: real, statistically-detectable microstructure phenomena exist (round-number order clustering, gap-fill tendency, overnight-range directional bias, close-to-open reversal), but **almost none of it survives translation into a complete, cost-inclusive, out-of-sample-validated retail scalping rule**. Several studies explicitly report negative results after adding realistic spread/commission/slippage (levels_025's Top-10 gap fade: −6.59%/yr; levels_026's Touch-and-Turn fade: PF 0.66–0.85 across 5,119 trades; levels_028's MNQ gap fade: t-stat −0.44 to −0.59; levels_024's 15-min ORB: PF 0.91–1.07). Grade-A evidence exists only for the *phenomenon* (round numbers affect order flow, gap continuation, IB/ON levels predict which side breaks first) — not for standalone profitability. The single most implementable, cost-inclusive, positive-PF candidate (AVWAP retest, levels_026) is explicitly flagged by its own source as unconfirmed pending independent-period validation, and one of its four tested markets (YM) already shows PF <1. No source in this family combines Grade A/B evidence + complete entry/exit/stop rules + realistic costs + genuine out-of-sample confirmation simultaneously.

## Ranking Table (all logics found, ranked by evidence strength)

| Rank | Logic | Source | Grade | Cost-inclusive? | OOS? | Net verdict |
|---|---|---|---|---|---|---|
| 1 | Round-number fade/continuation (phenomenon) | 023 | A (phenomenon only) | No | Partial | Real effect, no tradeable edge shown |
| 2 | S&P 500 overnight-jump reversal | 025 | A | Yes (20bp) | Rolling only | Strong but not single-symbol Pine-implementable (500-stock cross-section) |
| 3 | Top-10 gap fade (negative control) | 025 | A | Yes | Rolling only | Explicit negative result (−6.59%/yr) |
| 4 | Gap continuation (SPX) | 028 | A | No | No | Contradicts naive gap-fade logic; no cost test |
| 5 | Crude oil open-deviation breakout | 029 | A | Rough estimate only | No (in-sample threshold) | Lookahead bias in threshold; no stop/TP |
| 6 | TORB (Timely Opening Range Breakout) | 024 | A | Yes (0.01% flat) | Sub-period only | No stop/TP defined; heavy multi-window/multi-market selection bias |
| 7 | Opening-drive AVWAP retest | 026 | B | Yes ($2.75/order+slip) | No | Best implementable candidate; single year, not adopted by source |
| 8 | Inverse floor-pivot continuation | 026 | B | No (mid-price only) | No | Positive PF pre-cost only; narrow band likely erased by spread |
| 9 | 20-bar swing liquidity sweep | 021/022 (same source) | B/C | No | No | Same underlying study cited twice; PF 1.21–1.41 pre-cost |
| 10 | DJIA small-gap fade | 028 | B | No | No | Fill-rate stat, no stop, no PF |
| 11 | NQ ATR-conditioned gap fill | 028 | B | No | No | Fill-rate stat only, not a full rule |
| 12 | ES Gap Fade #1 | 028 | B | Yes ($20 RT) | Partial (extended IS) | PF 1.21 but costs ≈ net profit; 1998-2014 stale |
| 13 | IB break-retest continuation/reversal | 024 | B | No | No | Directional stat only, no entry/exit/PF |
| 14 | Overnight median-direction breakout | 024/029 | B | No | No | Distance artifact, not an edge |
| 15 | DJIA opening-gap fade | 025 | B | No (mid-quote insig.) | No | Reversal not significant after costs |
| 16 | Futures CO-OC cross-sectional reversal | 025 | B | No | No | Needs 35-instrument portfolio, not Pine-single-symbol |
| 17 | NQ Liquidity Sweep Reversal | 022 | C | Yes (already) | No | Already PF 1.06 post-friction; will not survive more slippage |
| 18 | ICT Turtle Soup + FVG carryover | 022 | B | No | No | Explicit negative result (8.2% vs 29.5% baseline) |
| 19 | EMA-ECR Stop-Hunt | 022 | "A" (peer-reviewed) but unreproducible | No | No | No trade count/PF/costs reported; low practical confidence |
| 20 | TJR Liquidity-Based Intraday Trading | 021 | B | No | Tiny fwd sample (6 trades) | Forward PF collapsed to 0.68 |
| 21 | Previous-Day Extreme Contrarian (EUR/USD) | 021 | B | No | Claimed, weak | $40 net over 5yrs/886 trades — economically meaningless |
| 22 | Kathy Lien "Fading the Double Zeros" | 023 | C | No | No | Anecdotal cherry-picked examples only |
| 23 | USD/JPY half-yen touch fade | 023 | B methodology, weak evidence | No | Discovered accidentally long-only | Data integrity failure |
| 24 | 5-min ORB + RelVol filter | 029 | B | Partial ($0.0035/share) | No | Needs 7,000-symbol daily ranking, not single-symbol Pine |
| 25 | MNQ 25-min ORB | 029 | B | Yes (2pt RT) | Yes (expanding window) | Explicit negative/non-significant result |
| 26 | NQ "Magic Hour" fade | 029 | B, incomplete rule | No | No | Not a tradeable rule; touches-center stat only |
| 27 | Opening-range "Touch and Turn" fade | 026 | B | Yes (2bp RT) | No | Explicit negative result, all markets unprofitable |
| 28 | DAX ORB breakout-retest-continuation | 026 | B | Yes (0.5pt slip) | No | Explicit negative result (PF 0.51, n=64) |
| 29 | Simple 15-min ORB | 024 | B | Yes | No | Explicit negative/marginal result (PF 0.91–1.07) |

## Candidate Selection

**Zero candidates meet the full bar** of (a) Grade A/B evidence with a positive cost-inclusive result **and** independent out-of-sample confirmation, (b) clean single-symbol Pine v6 OHLCV implementability, and (c) DT contract compatibility (discrete entry/SL/TP1/TP2, session filter, max signals/day) simultaneously.

Given the instruction to be honest rather than force three picks, this synthesis puts forward **one exploratory candidate** below — it is the single logic in the family with a complete, cost-inclusive, positive rule set, but it is explicitly **not adopted-grade**: single-year sample, no independent OOS, and one of its four tested markets already shows PF <1. It should enter the DT pipeline (if at all) as a `candidate` status requiring a full walk-forward re-test on TradingView's own data/costs before any `adopted` promotion — not as a live signal.

No Grade-A-and-clean-cost-survival PDH/PDL sweep, turtle-soup, round-number, or gap-fade logic exists in this family's evidence to justify a second or third candidate.

### Candidate 1 (exploratory only — NOT adopted-grade): Opening-Drive Anchored VWAP Retest

- **Evidence grade**: B (single-year backtest, commission+slippage included, no independent OOS; author's own conclusion: "not for adoption until independently re-verified")
- **Source**: levels_026, citing https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/
- **Markets tested**: NQ, ES, RTY, YM futures — NQ/ES/RTY showed PF >1, YM showed PF 0.98 (i.e., failed)
- **Timeframe**: 5-minute bars, RTH only, 2024 sample only

**Entry rule**: Identify the highest-volume 5-minute bar in the first 30 minutes of RTH as the VWAP anchor point. Compute an anchored VWAP (AVWAP) from that bar forward. Determine trend direction from the AVWAP's slope over the last 10 bars. Enter in the direction of that slope when a bar closes back within 0.1% of the AVWAP line (a "retest").

**Exit rule**: Take-profit at 0.5% from entry; stop-loss at 0.3% from entry (asymmetric 1.67:1 reward:risk as tested — for DT's TP1/TP2 structure, TP1 could be set at 0.3% [~1R] and TP2 at 0.5% [as tested], trailing/scaling per DT convention). Time-stop: close any open position after 30 bars (2.5 hours on 5-min) if neither TP nor SL is hit.

**Filters/session**: RTH only (cash session). No explicit max-signals/day cap in the source — DT contract should impose one (e.g., 1 signal per instrument per session, since the anchor is set once per day at the 30-minute mark).

**Risk parameters as tested**: Commission $2.75/order plus modeled slippage already included in the reported PF. Position sizing not specified by source — apply DT's standard per-trade risk sizing.

**Reported metrics (source)**:
- NQ: 505 trades, win rate 50.69%, PF 1.21, Sharpe 1.83
- ES: 519 trades, win rate 50.48%, PF 1.29, Sharpe 2.32
- RTY: PF 1.20
- YM: PF 0.98 (failed)

**Known failure modes**:
1. Single calendar year (2024) — no independent out-of-sample period tested; regime-dependent risk is unassessed.
2. One of four tested markets (YM) already fails (PF <1) — the logic is not market-agnostic.
3. Source code/data are not published — the exact volume-bar anchor selection and AVWAP slope-window logic must be re-derived and may not replicate exactly in Pine.
4. Setup-selection bias: this was the only "plausibly viable" result among ~15+ logics tested across levels_021–029; family-wide multiple-testing risk means a single positive result should be treated with strong skepticism until re-verified on fresh data.
5. Reported Sharpe/PF reflect the specific 0.1%-band retest and 0.5%/0.3% TP/SL; small changes to these thresholds are untested and could easily flip the result negative, as seen in nearly every other logic in this family.

**DT integration guidance**: If implemented, register as `candidate` (not `adopted`) in `journal/registry.json`, gated behind a fresh walk-forward backtest via `/setup-verify` on at least 2 independent years of TradingView data with realistic commission/slippage, before it can feed `/trade-judge`.

## Rejected Ideas (with reasons)

- **PDH/PDL sweep-and-reverse (levels_021)**: No Grade A source; best forward-test collapsed to PF 0.68; EUR/USD contrarian variant netted only $40 over 5 years/886 trades (economically meaningless); 20-bar wick sweep is Grade C with no cost model.
- **Turtle-soup / stop-hunt reversal (levels_022)**: No logic meets complete-rules + sample size + cost + OOS simultaneously; NQ liquidity sweep reversal already PF 1.06 post-friction (will not survive more slippage); ICT Turtle Soup + FVG explicitly failed (8.2% vs 29.5% baseline reversal rate); EMA-ECR Stop-Hunt is unreproducible (no trade count/PF/costs despite "peer-reviewed" framing).
- **Round-number levels (levels_023)**: Grade A evidence is for the *phenomenon* only (order clustering, 0.3–0.9 pip-equivalent edge) — no study combines this with realistic retail costs, trade count, and OOS. Kathy Lien's rule is anecdotal (cherry-picked examples, no denominator). USD/JPY half-yen fade had a data-integrity failure (accidentally long-only).
- **Initial balance / overnight range (levels_024)**: TORB (Grade A) has no stop/take-profit defined and suffers heavy window/market-selection bias across the multi-window optimization; the "raw" 15-min ORB test (2023–2024, realistic costs) explicitly fails (PF 0.91–1.07). IB retest and overnight-median-direction stats describe reaching a level, not profiting from it — no PF, no OOS.
- **Previous-close mean reversion (levels_025)**: The one genuinely strong result (S&P 500 overnight-jump reversal, Sharpe 2.38, cost-inclusive) requires cross-sectional ranking across 500 constituents with market-hedging — not implementable as a single-symbol Pine strategy. The naive Top-10 gap-fade control explicitly loses money after costs (−6.59%/yr). DJIA gap fade is statistically insignificant at mid-quote. Futures cross-sectional reversal needs a 35-instrument dollar-neutral portfolio.
- **S/R retest (levels_026)**: Opening-range Touch-and-Turn fade is an explicit, large-sample (5,119 trades) negative result (PF 0.67–0.85, all markets losing). DAX ORB retest-continuation is a small-sample explicit failure (PF 0.51, n=64). Inverse floor-pivot continuation is positive only at mid-price with no spread/commission — the tight 0.01% band variant is almost certainly erased by real FX spreads.
- **Gap-fill statistics (levels_028)**: Fill-rate phenomenon (77.8–93.1% depending on ATR bucket) is real but is not a trading rule — no stop, no PF for most variants. ES Gap Fade #1 nominally survives costs (PF 1.21) but total costs (~$26,000) are nearly as large as net profit (~$28,837) over a stale 1998–2014 sample; MNQ gap-fade walk-forward test is an explicit negative result (t-stat −0.44 to −0.59 across all three entry times).
- **Time-of-day breakout/fade (levels_029)**: Crude-oil open-deviation breakout (Grade A) has no stop/take-profit and uses an in-sample-estimated threshold (lookahead risk). 5-min ORB + RelVol filter needs a 7,000-symbol daily cross-sectional ranking, not implementable single-symbol in Pine. MNQ 25-min ORB is an explicit non-significant negative result. NQ "Magic Hour" fade and overnight high/low breakout are incomplete rules (no stop/exit/PF) describing reach-probability, not profitability.

## Source List

- levels_021: TJR Liquidity-Based Intraday Trading (diva-portal.org paper), Previous-Day Extreme Contrarian (mql5.com), 20-bar Wick Sweep (puravidaedge.com), Edgeful PDH/PDL continuation blog, TradingStats PDH/PDL sweep probability
- levels_022: 20-bar swing liquidity sweep (puravidaedge.com), NQ Liquidity Sweep Reversal (pinescriptforge.com), ICT Turtle Soup + FVG (seasonaledge.app), EMA-ECR Stop-Hunt (repository.petra.ac.id), Heston-Korajczyk-Sadka (arxiv.org/abs/1005.3535)
- levels_023: Round-number fade/continuation (ideas.repec.org; newyorkfed.org/sr150.pdf), Kathy Lien double-zeros (onlinelibrary.wiley.com), USD/JPY half-yen fade (note.com)
- levels_024: TORB (researchgate.net IEEE Access), Raw 15-min ORB (fractiz.com), IB break-retest (tradingstats.net), Overnight median-direction (tradingstats.net)
- levels_025: S&P 500 overnight-jump reversal + Top-10 gap fade (mdpi.com), DJIA opening-gap fade (researchgate.net), Futures CO-OC cross-sectional reversal (cicfconf.org)
- levels_026: Opening-range Touch and Turn fade, DAX ORB retest-continuation (warchhold.com), Inverse floor-pivot continuation (lup.lub.lu.se), Opening-drive AVWAP retest (fractiz.com), RUB/USD SPA-corrected technical rules (sciencedirect.com)
- levels_028: DJIA small-gap fade (iosrjournals.org), NQ ATR-conditioned gap fill (tradingstats.net), ES Gap Fade #1 (easylanguagemastery.com), MNQ gap-fade walk-forward (arxiv.org/abs/2605.04004), SPX gap continuation (sciencedirect.com)
- levels_029: Crude oil open-deviation breakout (sciencedirect.com), 5-min ORB + RelVol (concretumgroup.com), MNQ 25-min ORB (arxiv.org/pdf/2605.04004), NQ Magic Hour fade + overnight high/low breakout (tradingstats.net)
