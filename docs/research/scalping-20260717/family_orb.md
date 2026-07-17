# Family Synthesis — Opening Range Breakout (ORB)

Date: 2026-07-17
Sources reviewed: orb_002 – orb_009 (orb_001, orb_010 returned no data — Codex companion timeout, excluded)

## 1. Overall Assessment

The ORB family has more raw research volume than most scalping families, but the evidence is **weak-to-mixed once cost and out-of-sample discipline are applied**. Two studies carry Grade A sourcing (peer-reviewed / refereed): the "Timely ORB" (TORB) index-futures study and the volatility-state / Stocks-in-Play relative-volume replication. Both still have real cracks — TORB's edge disappears in one sub-period (S&P 2007–2013, p=14.6%) and depends on picking the best OR-window length from the same sample; the RVOL filter's headline Sharpe 2.81 result has no independent OOS window and ignores spread/slippage/market impact. Every other logic in this family (failed-breakout fades, gap-direction filters, day-type classifiers, crypto session-open breaks, FX London/Asia-range breaks, ATR-stop optimization) is Grade B/C, and the majority show the edge **shrinking or flipping negative once realistic costs, larger samples, or independent replication are applied** (orb_003 Asia liquidity-grab fade: −2.20pt post-cost; orb_002 NQ volume-tercile filter: edge vanished on larger sample; orb_004 EUR/USD London breakout: PF 1.00, net loss; orb_007 ES gap filter: 0% incremental effect; orb_008 crypto ORB: PF collapses from 1.86 to 0.53 with 3bp slippage). No logic in this family has been shown to survive realistic retail execution costs with a genuine, non-cherry-picked out-of-sample test. This is a family where **base-rate skepticism is warranted**: ORB is a heavily mined, heavily marketed setup, and most of the "positive" results here are either in-sample-optimized, definition-dependent, or drawn from studies that never subtracted spread/slippage.

Three candidates are selected below because they are the *least bad* — best sourcing tier, largest samples, and technically implementable in Pine v6 on OHLCV — not because any of them is a validated, cost-robust edge. All three should be treated as **hypotheses to paper-trade/backtest locally**, not as adopted setups, until independently re-verified with realistic costs.

## 2. Ranking Table (all logics found, best to worst evidence)

| # | Logic | Source topic | Grade | Market | Key metric | Cost-adjusted? | OOS? | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | TORB (time-based ORB, EOD exit, no stop) | orb_005, orb_009 | A | DJIA/S&P/Nasdaq/HSI/TAIEX futures, 1-min | S&P 8.95%/yr, Nasdaq 17.51%/yr, p<3% (best N per instrument) | Yes (0.01%/trade) | Weak — best-N chosen in-sample; S&P 2007–13 subperiod not significant (p=14.6%) | Best-sourced but N-selection overfitting risk |
| 2 | Stocks-in-Play 5-min ORB + RVOL filter | orb_002, orb_006, orb_009 | A (replication) / B (full claim) | ~7,000 US equities, 5-min | Sharpe 0.48→2.81, win 41.4%→48.4%, total return 29%→1,637% (2016–23) | Commission-only ($0.0035/shr); no spread/slippage/impact | No independent OOS window disclosed | Largest effect size found in family, but weakest cost realism |
| 3 | Volatility-state ORB (ex-post decile) | orb_006 | A (refereed) | Crude oil, S&P futures, 1991–2011 | ~200bp/day crude, ~150bp/day S&P (top vs bottom vol decile) | Yes (8bp/6bp round-trip assumed) | Ex-post only | **Not implementable** — classifier uses that day's close, unknown at entry |
| 4 | 5-min directional ORB + range-edge stop, EOD exit | orb_005 | B | QQQ ETF, 5-min, 2016–23 | Sharpe 1.12, win rate 24%, total return 675%, α p=0.0025 | Commission only, no spread/slippage | No | Positive but very low win rate — fragile to fill quality |
| 5 | DAX overnight-range breakout (H1) | orb_007 | B | DAX/DE40, H1, 2013–26 | PF 1.25, Sharpe 1.46 (2,199 trades) | "Realistic spread" claimed | Split-sample + Monte Carlo | M15 version degrades to PF 0.96 post-slippage; cross-market (US500/US100) fails (PF 0.90–0.99) |
| 6 | 30-min ORB + 1.3× volume filter | orb_002 | B | US equities, 2005–10 | PF 1.45, ROI 131.9% vs 92.9% B&H | $8/trade | No | Selected 22 winners out of 250 tickers — severe selection bias |
| 7 | GAORB (range-proportional stop, no TP) | orb_005 | A | TAIEX futures, 1-min, 2007–18 | Sharpe 2.495, PF 1.177, win 39.0% | Not disclosed | Rolling pseudo-OOS (GA re-optimized monthly) | Monthly GA re-optimization not realistic for retail Pine deployment |
| 8 | VVG day-type classifier | orb_006 | B | MNQ, 5-min, 2021–25 | 127 OOS trades, 52.0% win, +7.80pt/trade, T=1.46 | 2pt round-trip charged | Yes, and fails: 2024 lost −26.75pt | Fails year-stability gate |
| 9 | USD/JPY Asian-range breakout | orb_004 | B | USD/JPY | OOS PF 1.16, win 45.75% | $3.50/side/lot | Yes, but | Internal data inconsistency (1,012 vs 283 trades in same report) — low trust |
| 10 | NQ overnight-range/gap direction filter | orb_007 | B | NQ futures, 5-min | 75.6–76.2% directional accuracy | None | No | No PF, no exit rule — direction-only, not a strategy |
| 11 | Asia liquidity-grab fade | orb_003 | B | MNQ, 5-min | **−2.20pt post-cost** (n=6,442) | Yes | Walk-forward | Negative result — cost kills the edge |
| 12 | ES 15-min ORB + gap/volume/range filter | orb_007 | B | ES futures | Gap adds 0% incremental effect (37.7%→37.7%) | No | Walk-forward (classification only) | No profitability evidence, ML accuracy ≠ PF |
| 13 | NQ breakout volume-tercile filter | orb_002 | B | NQ futures, 5-min | No differential across terciles on full sample | No | Sample-expansion test | Initial apparent edge vanished |
| 14 | London Breakout 2015 retracement (GBP/USD) | orb_004 | B | GBP/USD, H1 | Win 45.90%, avg 2R (2011–15 only) | Not disclosed | No | No trade count, PF, or cost data |
| 15 | EUR/USD London-range breakout | orb_004 | B | EUR/USD | **PF 1.00, −$5,245** (n=1,301) | Yes | In-sample window selection | Net loss |
| 16 | 6%+ gap-up stocks + 5-min ORB | orb_007 | B | ~7,000 US equities | "No profitability" | N/A | CRSP-based, no survivorship bias | Negative finding |
| 17 | 5-min ORB first-break stop-and-reverse | orb_003 | B | ES/NQ | 99.5%/99.0% "reversal rate" | No | No | Metric defined by look-ahead (post-close classification), not tradable as stated |
| 18 | Bollinger/Keltner failed-expansion fade | orb_003 | C | Mixed markets | Win 74.38% (claimed) | No | No | Data/code/period undisclosed; self-reported numbers don't reconcile |
| 19 | Crypto: daily opening-candle breakout | orb_008 | B | BTCUSDT, 10-15min | PF ~1.12–1.15 (est.), ~2–3.4bp/trade | No | No | Edge smaller than typical crypto spread+fee |
| 20 | Crypto: NY open ORB + 61.8% retracement | orb_008 | B | BTC/ETH/SOL, 5-min | PF 1.86 optimistic → **PF 0.53** with 3bp slippage | Partial | Holdout | Collapses under realistic fill assumption |
| 21 | ETH daily-open +4.5% breakout | orb_008 | C | ETH, 15-min | DD $9,100 on $10k position | No | No | Post-hoc threshold search (0–10% range) |
| 22 | Opening-range-width classifier (contradictory pair) | orb_006 | B | Various | 51.0%→34.6% win rate (one study) vs 77.5%/74.2% continuation (another) | No | No | Two studies contradict on the same variable; not resolved |

## 3. Selected Candidates (max 3)

All three below are Pine v6 / OHLCV implementable and can be fit into the DT setup contract (discrete entry/SL/TP1/TP2, session filter, max signals/day). None has clean, cost-adjusted, genuinely-out-of-sample validation — this is flagged in each "Known failure modes" section. Treat as backtest-first candidates, not adopted setups, per `journal/registry.json` gating.

---

### Candidate 1: TORB — Time-based ORB, EOD exit, session-fixed OR window

**Evidence grade:** A (refereed, IEEE Access / ResearchGate — orb_005, orb_009)
**Source metric:** DJIA 4-min OR: 2,677 trades, 12.89%/yr; S&P 1-min OR: 3,096 trades, 8.95%/yr; Nasdaq 1-min OR: 3,099 trades, 17.51%/yr; all p<3% on best-N-per-instrument, 2001/03–2013, cost 0.01%/trade included. Caveat: S&P 2007–2013 subperiod not significant (p=14.62%); DJIA first-half also not significant. Source: `orb_005.md` #4 (TORB), `orb_009.md` #2.

**Entry rule:**
- Fix the OR window length per instrument at session start using the *smallest OR window that has literature support for that instrument type* — do not re-optimize N in Pine (this reproduces the original paper's overfitting risk). Recommended starting point for a DT index-futures adaptation: 1-minute OR window (matches S&P/Nasdaq best-N in source).
- At the close of the OR window, mark OR high and OR low.
- First 1-minute (or configurable, but fixed) bar to close outside the OR range in either direction triggers entry in that direction, market/stop order at OR high (long) or OR low (short).

**Exit rule (adapted for DT contract — deviates from source, flagged):**
- Source strategy has **no stop and no take-profit** — it exits only at session/instrument close (EOD). This is a documented source of the strategy's edge (letting winners run; orb_005's synthesis explicitly notes fixed 1R take-profit underperforms EOD exits in this family).
- DT contract requires discrete SL/TP1/TP2. Adaptation: SL = opposite side of OR range (protective stop only, not part of the tested edge — added for risk control). TP1 = 50% position at 1× OR range extension (booking partial profit, acknowledged as *not* backtested). TP2 = remaining position held to session close (approximates the tested EOD-exit behavior).
- This adaptation should be flagged in any backtest report as a variant, not a replication, of the source study.

**Filters/session:** Instrument-specific regular trading session only (index futures RTH). Single trade per session (matches source "first break only"). No news/day-type filter (day-type filters were rejected — see Section 4).

**Risk parameters:** Risk-per-trade should be sized off SL distance (OR range width), not fixed dollar/point. Max 1 signal/day per instrument (matches source methodology).

**Expected metrics (source, unadapted strategy):** ~9–18%/yr on index futures with sub-3% significance on pooled sample; **not guaranteed to replicate with the DT SL/TP1/TP2 overlay**, since that overlay was not tested.

**Known failure modes:**
- Best OR-window-length (N) was chosen from the full sample in the source paper — using a different N without re-testing reproduces the same in-sample bias.
- S&P and DJIA sub-period splits show the edge is not stable across the full history (loses significance in part of the sample).
- The DT-required SL/TP1/TP2 overlay is untested; it may reduce or eliminate the edge that came specifically from unlimited EOD-exit upside.
- No commission/slippage beyond the flat 0.01%/trade assumption — real index futures spread + slippage on a stop-market OR-break entry (typically the highest-slippage moment of the session) could be materially worse.

---

### Candidate 2: Stocks-in-Play 5-min ORB + Relative-Volume (RVOL) filter, single-symbol adaptation

**Evidence grade:** A for the QuantConnect code replication (Sharpe 2.396), B for the full 2016–2023 claim (orb_002, orb_006, orb_009 — same underlying paper cited across all three).
**Source metric:** Base ORB → RVOL-filtered: total return 29%→1,637%, IRR 3.2%→41.6%, Sharpe 0.48→2.81, win rate 41.4%→48.4%, MDD 13%→12% (2016–2023, ~7,000 US equities, $0.0035/share commission only — no spread/slippage/impact). Independent replication (QuantConnect) confirms directionally (Sharpe 2.396) but flags that adding market impact "significantly worsened" results.

**Entry rule:**
- On the chosen single symbol (not a market-wide top-20 screen — see implementation note below), mark the 9:30–9:35 ET candle.
- RVOL = first-5-minute volume ÷ (14-day average volume in the same 5-minute slot). Require RVOL ≥ 1.0.
- If the 9:30–9:35 candle closes bullish (close > open) and RVOL ≥ 1: buy-stop at the candle high.
- If bearish and RVOL ≥ 1: sell-stop at the candle low.
- Doji (open == close) → no trade.
- Filters at symbol-selection time (not enforceable inside Pine, must be pre-screened by the trader): price > $5, 14-day ADV > 1,000,000 shares, ATR(14) > $0.50.

**Exit rule:**
- SL: 0.10 × daily ATR(14) from entry (source-specified).
- TP1/TP2 (DT adaptation, not in source): source uses no fixed take-profit — position runs to 16:00 ET close or stop. For DT contract compliance: TP1 = partial exit at 1× the initial SL distance (booking some gain), TP2 = remainder held to 16:00 ET flat (matches source's EOD exit). As with Candidate 1, the TP1 partial-exit is an untested adaptation.
- Hard exit: 16:00 ET flat if neither stop nor TP2 hit.

**Filters/session:** US equity RTH open only (9:30–9:35 ET setup window). Max 1 signal/day per symbol.

**Risk parameters:** 1% account risk per trade, max leverage 4× (source-specified — should be reduced for a discretionary/manual DT context; 4× leverage on single names is aggressive).

**Implementation note (important limitation):** The source strategy's actual edge comes from trading the **top-20 RVOL names market-wide each day** — a cross-sectional screen that Pine v6 cannot perform (no access to real-time cross-market ranking). This candidate is only implementable as: apply the RVOL/entry/exit rule to *a symbol the trader has already identified as high-RVOL through an external scanner*. The backtested Sharpe 2.81 / win 48.4% numbers reflect the full ranked universe, not a single pre-selected symbol — performance on any one symbol chosen ad hoc will differ, likely substantially, from the aggregate.

**Known failure modes:**
- No independent OOS test window disclosed for the 2016–2023 headline number.
- No spread, slippage, or market-impact modeling — QuantConnect's own replication attempt explicitly states results worsen significantly once impact is added.
- Single-symbol performance is not what was tested; the reported edge is a portfolio effect from selecting the most active names market-wide each day, which is exactly the piece this Pine adaptation cannot reproduce.
- 4× leverage amplifies any of the above degradations.

---

### Candidate 3: 5-min directional ORB + range-edge stop, EOD exit (single-symbol, low-win-rate variant)

**Evidence grade:** B (orb_005 — Wealth-Lab working paper, not peer-reviewed, but methodology and cost assumptions are transparent).
**Source metric:** QQQ, 5-min, 2016–2023: 1,795 trades, win rate 24%, avg 0.13R/trade, total return 675%, annualized 31%, Sharpe 1.12, annualized alpha 33% (p=0.0025). Commission $0.0005/share included; **no spread or slippage**.

**Entry rule:**
- Mark the 9:30–9:35 ET candle on the chosen symbol (source used QQQ specifically — single, highly liquid ETF; generalization to other names is unverified).
- If candle closes bullish: buy at 9:35 open (source enters at the open of the *next* bar after the OR candle, not on a stop-break — this is a same-direction-as-candle continuation entry, not a classic breakout-of-range entry).
- If bearish: sell at 9:35 open.
- No RVOL or other filter (source ran unfiltered, once/day).

**Exit rule:**
- SL: opposite extreme of the OR candle (long stops below the OR candle's low; short stops above its high).
- TP1/TP2 (DT adaptation): source used 10R target or EOD, whichever first, with no partial profit-taking. DT adaptation: TP1 = partial exit at 3R (below the source's 10R ceiling, to bank some of the fat right tail earlier), TP2 = remainder held to 10R or 16:00 ET EOD flat, whichever comes first.

**Filters/session:** US equity RTH, single symbol, once per day only.

**Risk parameters:** Given the source's 24% win rate, this setup depends entirely on a small number of large winners (0.13R average across all trades, driven by tail trades reaching multiple R). Position sizing must assume long strings of small losses are normal — this is psychologically and operationally demanding for a discretionary DT context and should carry a hard daily-loss-limit override.

**Known failure modes:**
- 24% win rate makes the strategy extremely sensitive to fill quality; any added slippage that turns marginal 1R-scratch trades into losers will erode the already-thin edge quickly (the source explicitly has zero spread/slippage modeling).
- Single-instrument (QQQ) evidence only — no cross-symbol validation.
- No OOS period; the entire 2016–2023 window was used to report the headline number.
- The DT-required TP1 partial exit at 3R was not tested and works against the source's core mechanism (letting rare large winners run uncapped to 10R/EOD).

---

## 4. Rejected Ideas (with reasons)

| Idea | Source | Reason for rejection |
|---|---|---|
| Volatility-state ORB (ex-post decile classifier) | orb_006 | Highest-grade evidence in the family (A, refereed), but the profitable classifier uses that day's realized close-to-open return, which is unknown at the time of entry. Not implementable as a real-time Pine filter. |
| NQ overnight-range/gap direction filter | orb_007 | 75–76% directional accuracy but no exit rule, no PF, no cost data — not a strategy, only a directional bias indicator. Author explicitly disclaims it as a mechanical system. |
| Asia liquidity-grab fade | orb_003 | Best-sampled fade logic in the family (n=6,442) and it is **net negative** post-cost (−2.20pt/trade). Directly disqualifying. |
| EUR/USD London-range breakout | orb_004 | PF 1.00 (net loss of $5,245 over 1,301 trades) — negative result on a major, liquid pair. |
| ES 15-min ORB + gap/volume/range filter | orb_007 | Gap filter shows exactly 0% incremental effect (37.7%→37.7%); reported "accuracy" is a classification metric, not a profit factor. |
| NQ breakout volume-tercile filter | orb_002 | Initial apparent volume-based edge vanished when the sample was expanded (78 → 159 sessions). |
| 5-min ORB first-break stop-and-reverse (99% reversal claim) | orb_003 | The 99.5%/99.0% figures are defined by post-close classification (look-ahead), not a real-time tradable signal — the paper's own definition makes it non-tradable as stated. |
| Day-type classifiers generally (VVG, opening-range-width) | orb_006 | VVG fails its own year-stability test (2024 lost −26.75pt after a positive OOS window). Opening-range-width classifier contradicts a second study on the same variable (win rate falls with width in one paper, continuation rises with width in another) — unresolved and not usable as a filter. |
| Crypto session-open ORB (BTC/ETH, all variants) | orb_008 | All three logics found either have a rough edge under 3.4bp/trade (smaller than typical crypto taker fees + spread) or collapse from PF 1.86 to PF 0.53 once a 3bp realistic slippage assumption is applied. Academic corroboration (2024 BTC 1-min study) shows range-breakout predictive power has declined since 2017. |
| London Breakout 2015 retracement (GBP/USD) | orb_004 | No trade count, PF, spread, commission, or OOS data disclosed — insufficient to size or trust despite a positive headline return. |
| DAX overnight-range breakout | orb_007 | Included in ranking table as #5 but not selected as a candidate: M15 version degrades to PF 0.96 with 3-point slippage, and the identical logic fails when applied to US500 (PF 0.99) and US100 (PF 0.90), indicating the DAX H1 result (PF 1.25) is likely a market-specific artifact rather than a generalizable ORB edge. Borderline — could be revisited as a 4th candidate if the user specifically trades DAX/DE40. |
| 6%+ gap-up stocks + 5-min ORB | orb_007 | Explicitly reported by the authors as showing "no profitability" on both the basic and complex exit versions, using a survivorship-bias-free CRSP dataset (9,794 events) — a credible negative result. |
| GAORB (range-proportional stop, monthly GA re-optimization) | orb_005 | Grade A evidence (Sharpe 2.495) but requires monthly genetic-algorithm re-optimization of stop parameters, which is not a fixed, deployable Pine v6 rule — disqualified on implementability, not evidence quality. |

## 5. Source List

- orb_002.md — Relative-volume/volume filters on ORB (Stocks-in-Play RVOL, NQ MBO volume terciles, 30-min ORB + volume)
- orb_003.md — ORB failed-breakout fade strategies (Asia liquidity-grab, ES/NQ stop-and-reverse, BB/Keltner failed-expansion)
- orb_004.md — London/Asian-range breakout on FX majors
- orb_005.md — ORB stop/target structure comparisons (ATR vs range-based, TORB, GAORB)
- orb_006.md — Day-type (trend vs range) classification as ORB filter
- orb_007.md — Overnight gap/range as context filters for opening breakouts
- orb_008.md — Session-open range strategies in crypto (BTC/ETH)
- orb_009.md — ORB robustness across OR window lengths (5/15/30/60 min)
- orb_001.md, orb_010.md — Excluded: Codex companion process timed out before producing analysis output; no candidate logics extracted.
