# Risk Family Synthesis — Risk / Execution / Cost (2026-07-17)

Source topics: risk_082 – risk_090 (risk_081 errored out during research — Codex companion timed out, no analysis body was generated, excluded from this synthesis).

## 0. Framing note

This family's nine topics do not each describe an independent trading edge. They cluster around a small number of underlying primary studies (Stocks-in-Play 5-min ORB, TORB, SPY Noise-Area Momentum, MNQ negative-result paper, GAORB Taiwan, QQQ/TQQQ ORB, etc.) that get cited repeatedly across different risk-mechanics questions (stop placement, TP scaling, sizing, loss limits, slippage assumptions, break-even stops). Treat repeated appearances of the same paper across multiple topic files as **the same piece of evidence cited multiple times, not independent replication.**

Most of what this family actually tested — daily loss limits, kill switches, TP1/TP2 scaling, break-even stop moves, tilt control — came back **weak, mixed, or explicitly negative**. That is itself the most important, most consistent finding of the sweep and is reported honestly below rather than papered over.

## 1. Ranking table (unique underlying studies, deduplicated across files)

| Study | Grade | Where cited | Verdict |
|---|---|---|---|
| TORB (IEEE Access, 10.1109/ACCESS.2019.2899177) | A | risk_087, risk_088 | Peer-reviewed, p=3.1×10⁻⁵, but probe-time chosen in-sample without multiple-testing correction; no post-2014 OOS |
| GAORB stop-only (Knowledge-Based Systems, 10.1016/j.knosys.2021.106769) | A | risk_083, risk_084 | Peer-reviewed, monthly walk-forward, but 65,536-parameter GA re-optimized monthly — not statically reproducible in Pine |
| Crude oil ORB no-stop (Finance Research Letters) | A | risk_083 | Peer-reviewed but not robust to sub-period splits; recent high-vol period dominates result |
| SPY/ETF open→close momentum (JFE / SSRN 2440866) | A | risk_085 | 21-yr peer-reviewed, but relies on closing-auction fills not reproducible with standard bar execution |
| Crypto 5-min pair mean reversion (IEEE Access, 10.1109/ACCESS.2020.3024619) | A | risk_082 | Explicit survivorship bias, short-selling frictions excluded, dynamic pair selection not Pine-implementable |
| PDT Strategic Trailing (Sciencedirect/arXiv) | A (peer-reviewed venue only) | risk_090 | Trading evidence itself is weak (1.18% test return, no costs); "A" grade reflects publication venue, not edge strength |
| Coval–Shumway CBOT loss-behavior study | A (behavioral evidence only) | risk_085, risk_089 | Documents post-loss risk-taking; does NOT test whether a stop-loss switch improves outcomes |
| Stocks-in-Play 5-min ORB + Rel. Vol (SSRN 4729284) | B | risk_082, risk_083, risk_086, risk_087, risk_088 | Best Sharpe (2.81) in the family; survivorship controlled but no OOS, no spread/slippage, full-market ranking not Pine-native |
| SPY Noise-Area Intraday Momentum (concretumgroup) | B | risk_086, risk_088 | Sharpe 1.24–1.33 post-cost; no independent OOS |
| MNQ 25-min ORB (arXiv 2605.04004) | B (negative) | risk_082, risk_085, risk_086, risk_087 | t=1.50, unstable by year, fails walk-forward; useful negative control |
| QQQ/TQQQ 5-min ORB, ATR-optimized (SSRN 4416622) | B | risk_083, risk_085 | In-sample stop/target optimization on same data; leveraged ETF |
| DAX night-range structure stop | B | risk_083 | PF only 1.11–1.25 before costs, thin margin |
| XAUUSD structural-break asymmetric exit (SSRN 6941458) | B | risk_084 | Undisclosed proprietary signal — not independently implementable |
| Cameron ICT high-RR scalp | B (fails OOS) | risk_087 | PF 1.68 in-sample → PF 0.95 (loss) on corrected OOS — reject |
| BTC 15-min StochRSI+ML | B (negative) | risk_082 | Sharpe 0.14, misses cost-adjusted breakeven win rate |
| Value-Area Breakout, ES (SSRN 6350238) | B | risk_090 | Near-zero raw edge before friction; needs 1-second data, not OHLCV |
| Probability Trailing Stop (EUR/USD etc.) | B (negative) | risk_090 | Every reported PF ≤1.00 gross — negative before costs |
| Daily equity-loss limiter, crude oil | B | risk_089 | $2,500 threshold hand-picked from $500–$10,000 grid on one strategy/market — textbook overfit |
| Post-loss cooling-off | B (negative) | risk_089 | Explicit negative result: cooling-off reduced net return and worsened drawdown |
| 5-min momentum + layered kill switches, ES/NQ | B (low confidence) | risk_089 | No ablation isolates the switches' contribution; OOS Sharpe drops to 0.94 |
| Nifty 30-min ORB, structure vs ATR stop | B | risk_083 | n=42 per arm, single 3-month window |
| NQ break-even/ATR trail comparison | C | risk_090 | Undisclosed entry rule/sample size, no costs |
| Chicago Fed prop-firm risk-limit survey | Descriptive | risk_085 | Confirms limits are used industry-wide; measures nothing about whether they improve outcomes |
| Locke–Mann CME loss-behavior study | B (contradicts Coval–Shumway) | risk_085, risk_089 | Found no risk-adjusted deterioration after losses — undercuts the case for forced stand-down rules |

## 2. Cross-cutting risk-mechanics findings (not standalone logics — apply as overlay constraints to whichever entry logic is used)

- **Breakeven win-rate math** (risk_082): breakeven WR = (1+c)/(1+r) where c = round-trip cost in R, r = reward in R. At 0.2R costs (typical for tight scalp stops), a 2R target needs 40% WR, not the naively assumed 33%. Any candidate below must be checked against this formula using its *actual* stop distance and realistic cost estimate, not the paper's often-omitted cost figure.
- **TP1/TP2 partial scaling** (risk_084): best available evidence (GAORB Taiwan, Grade A) shows adding a take-profit/partial-exit layer to a stop-only breakout system raised win rate (39.0%→43.6%) but roughly **halved** Sharpe (2.495→1.320) and annual return (9.3%→4.1%). No Grade-A or Grade-B evidence in this family shows partial exits improving risk-adjusted return for scalps. If a DT contract requires TP1/TP2 fields, prefer a small TP1 (structural, e.g. 1R) and let TP2 run uncapped/EOD rather than capping the whole position early.
- **Stop type** (risk_083): no clean head-to-head Grade-A comparison of ATR-multiple vs structure stops exists; the one controlled 42-trade comparison favored structure stops, but sample size is too small to generalize.
- **Daily loss limits / kill switches / cooling-off / tilt control** (risk_085, risk_089): evidence is weak-to-negative across every design tested. Chicago Fed confirms industry adoption but not efficacy; Coval–Shumway documents post-loss risk-taking but doesn't test a switch; Locke–Mann directly contradicts the "stand down after a loss" logic; the one quantified crude-oil kill-switch backtest is overfit to a single hand-picked threshold; cooling-off explicitly hurt returns in that same test. **Recommendation: use daily loss limits as an operational/psychological guardrail, not as a claimed source of edge, and size the threshold from the strategy's own trade-by-trade Monte Carlo rather than a round number.**
- **Break-even stop moves** (risk_090): no candidate shows a clean, cost-adjusted expectancy improvement from moving to break-even; it truncates trades that would have recovered from normal adverse excursion. Treat break-even moves as drawdown-shape management, not an expectancy source.
- **Slippage/fill modeling** (risk_086, risk_087): TradingView's Bar Magnifier reduces same-bar ordering ambiguity but does not model book depth, real spread, queue position, or partial fills. Recommended defaults: market fills at next-bar open with commission + half-spread + stress-tested extra slippage (test at 1×, 2×, 3× baseline); limit fills require ≥1 tick of price-through (2 ticks under stress) and must allow "no fill" as an outcome — never assume a touch = full fill. Any of the candidate metrics below that omit spread/slippage (most do) should be treated as upper bounds, not expected live performance.

## 3. Selected candidates (max 3, DT-contract compatible)

All three below require an explicit deviation from their source papers to fit the DT setup contract (discrete entry/SL/TP1/TP2, session filter, max signals/day), because none of the underlying studies used a TP1/TP2 structure. This deviation is called out per-candidate and lowers confidence versus the as-tested versions — re-validate with realistic TradingView bar-magnifier fills before adoption.

### Candidate 1 — Timely Opening-Range Breakout (TORB)

- **Evidence grade:** A (peer-reviewed, IEEE Access, 10.1109/ACCESS.2019.2899177) — strongest single study in the family, but overfitting risk on the probe-time parameter is real (see failure modes).
- **Markets:** liquid index futures (source used DJIA, S&P 500, NASDAQ, HSI, TAIEX cash-session equivalents); adapt to ES/NQ/YM or similar continuous futures.
- **Timeframe:** 1-minute.
- **Entry:** from cash-session open, build a running high/low up to a market-specific "probe time" (source values: DJIA 4 min, S&P/NASDAQ 1 min, HSI 151 min, TAIEX 37 min — these were chosen in-sample per market with no multiple-testing correction and must be re-derived or held out on your target instrument, not copied blindly). After the probe window, enter long on the first 1-min close above the probe-window high, short on the first close below the probe-window low. One trade per direction per session (first breakout only).
- **Exit/Stop (DT adaptation — not in source):** SL at the opposite boundary of the probe-window range (structural stop, consistent with the risk_083 preference for structure stops over arbitrary ATR multiples). TP1 = 1R (partial, e.g. 50%), TP2 = source's original rule of flat at cash-session close (let the runner ride to EOD rather than capping it, per the risk_084 finding that caps hurt Sharpe).
- **Session/filters:** cash-market active hours only; max 1 signal per side per day (2 max/day total, first breakout only — matches source design).
- **Risk parameters:** size off the probe-window range as the stop distance; 0.5–1% equity risk per trade; treat the probe-time parameter as instrument-specific and requiring its own calibration/holdout, not reuse of the paper's exact minute values.
- **Expected metrics (source, 2003–2013, ~10-yr per-market samples, N=1,381–3,099 trades):** annual net return 8.95%–20.28% (TAIEX best) with an assumed 0.01% transaction cost; p=3.1×10⁻⁵ full-sample. Win rate and PF not reported. [Source](https://doi.org/10.1109/ACCESS.2019.2899177)
- **Known failure modes:** no OOS beyond 2013 (13+ year gap to today); probe time optimized without correction — high risk that re-derivation on current data gives a different, weaker probe time; no explicit stop/TP in the original — the DT SL/TP1/TP2 wrapper here is untested and must be backtested independently; 0.01% assumed cost is thin for anything but the most liquid contracts.

### Candidate 2 — 5-min Opening-Range Breakout with Relative-Volume filter (single-symbol adaptation of "Stocks in Play")

- **Evidence grade:** B (SSRN 4729284; consistently cited across risk_082, 083, 086, 087, 088 — same paper each time, not independent confirmation).
- **Markets:** liquid US equities selected manually/by the trader (price >$5, 14-day avg volume >1M shares, ATR(14) >$0.50) — the source's full-universe "top-20 by relative volume" cross-sectional ranking is **not** Pine-implementable; use it as a pre-session watchlist filter applied by the trader/DT screener instead, then run the Pine logic per symbol.
- **Timeframe:** 5-minute.
- **Entry:** at 09:35 ET, if the 09:30–09:35 opening bar closed bullish (and opening-bar volume ≥ its 14-day same-time average), buy-stop at the opening bar's high; if bearish, sell-stop at the opening bar's low. No trade on a doji opening bar.
- **Exit/Stop:** SL = entry price ± 10% of the 14-day daily ATR (source's exact stop rule). TP1 = 1R partial exit (DT adaptation, not in source). TP2 = uncapped, exit at 16:00 ET flat (matches source; avoids the profit-cap-truncates-winners problem documented in risk_084).
- **Session/filters:** US regular trading hours only; one entry per symbol per day; recommend capping to 1–3 symbols/day at the DT/watchlist level since the source's edge depended on picking the day's most active names, which a single Pine instance cannot do on its own.
- **Risk parameters:** 0.5–1% equity risk per trade sized off the ATR-based stop distance; do not use 4× leverage as in the source's reported sizing — that inflated the compounded 1,637% headline figure and materially increases blow-up risk if the edge doesn't hold live.
- **Expected metrics (source, 2016–2023, 7,000+ symbols, CRSP universe incl. delisted names):** hit rate 48.4%, Sharpe 2.81, annualized return 41.6%, MDD 12%; costs limited to $0.0035/share commission only — no spread or slippage modeled. [Source](https://alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content)
- **Known failure modes:** no independent OOS; filter (price/volume/ATR/rel-vol) was discovered on the same sample it was tested on — classic in-sample selection; the single-symbol Pine adaptation loses the cross-sectional "pick the day's most active names" component that likely drove much of the edge, so live results should be expected to underperform the reported figures, possibly substantially; spread/slippage on high-relative-volume names (often more volatile) is exactly where naive fill assumptions fail hardest per the risk_086/087 slippage findings.

### Candidate 3 — SPY Noise-Area Intraday Momentum

- **Evidence grade:** B (concretumgroup working paper; cited in risk_086 and risk_088 — same source).
- **Markets:** SPY (or similarly liquid single-name/ETF proxy); not validated on futures or other symbols.
- **Timeframe:** designed on 1-minute bars with 30-minute decision points; 5–15 min Pine implementation is only a partial approximation of the source (flag this explicitly).
- **Entry:** compute time-of-day upper/lower bands from the prior 14 sessions' mean absolute move from the session open, gap-adjusted by prior close. At each 30-minute mark (HH:00/HH:30), if price is above the upper band, buy (momentum continuation); if below the lower band, sell.
- **Exit/Stop (DT adaptation):** source exits/reverses when price crosses back through the same-side band or VWAP, flat at 16:00 ET, with no explicit stop-loss. For DT compliance, add a protective SL at the ATR-based distance beyond entry (since the source's band-cross exit is a de facto invalidation, not a hard stop) — treat this as an added risk control, not a tested feature. TP1 = band re-cross (source's exit rule) as a partial exit; TP2 = VWAP cross or 16:00 flat, whichever comes first.
- **Session/filters:** RTH only; entries only at :00/:30 marks; cap to 2 signals/day for DT contract compliance (source averaged ~1.6 trades/session over 2007–2024).
- **Risk parameters:** simplify the source's 2%-daily-volatility-target/4×-leverage sizing to plain fixed-fractional (0.5–1% equity risk per trade) for DT use — the leveraged variant reported higher Sharpe (1.33 vs 1.24) but also materially higher MDD (25% vs 12%).
- **Expected metrics (source, 2007–early 2024, 7,668 trades):** 37% trade hit rate, Sharpe 1.24 (unlevered) to 1.33 (vol-targeted), MDD 12–25%, cumulative return 380–1,985% depending on sizing; costs assumed $0.0035/share commission + $0.001/share slippage — likely optimistic versus real market-order spread capture. [Source](https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf)
- **Known failure modes:** no independent OOS — the exit rule (band/VWAP cross) was refined on the same sample used to report performance; 5–15 min Pine bars cannot faithfully reproduce the source's 1-min/30-min decision cadence, so expect signal timing drift; assumed slippage is thin, and SPY's own high liquidity may not transfer to how a retail account fills market orders at decision points that coincide with many other systematic strategies' rebalancing.

## 4. Rejected ideas (evidence present but not selected) and why

| Idea | Grade | Reason rejected |
|---|---|---|
| GAORB stop-only (Taiwan futures) | A | Requires a rolling genetic-algorithm re-optimization every month (65,536-parameter search space) — not reproducible as a static Pine v6 script |
| Crude oil ORB, no stop | A | Not robust across sub-period splits; a single recent high-volatility period drives the whole result; also lacks any stop/exit structure compatible with DT contract |
| SPY/ETF open→close momentum (JFE) | A | Entry/exit rely on closing-auction and 15:30/16:00 marks with auction-specific fills not reproducible by ordinary bar execution in Pine |
| Crypto 5-min pair mean reversion | A | Explicit survivorship bias (only continuously-listed pairs kept), short-selling costs excluded, and dynamic top-20 pair selection with two-legged execution is not Pine-implementable |
| PDT Strategic Trailing (ML tree) | A (venue only) | Requires training a Permutation Decision Tree dynamically; a frozen exported tree is feasible but the reported edge (1.18% over a 3-month test) is too small and undocumented on costs to trust |
| QQQ/TQQQ 5-min ORB (ATR-optimized variant) | B | Stop distance and target were both optimized in-sample on the same data used to report the 9,350% headline figure; also relies on leveraged ETF decay/tracking dynamics |
| DAX night-range structure stop | B | PF only 1.11–1.25 before any modeled costs — too thin a margin to survive spread/commission on an index CFD |
| XAUUSD structural-break asymmetric exit | B | Entry signal formula is proprietary/undisclosed in the source — cannot be independently implemented or verified |
| Cameron ICT high-RR scalp | B | Catastrophic OOS failure: PF 1.68 in-sample collapses to PF 0.95 (net loss of 3,271 points) on corrected out-of-sample data — reject outright |
| BTC 15-min StochRSI+ML | B (negative) | OOS Sharpe 0.14, misses the cost-adjusted breakeven win rate (39.5% actual vs ~40% required at 0.2R costs) |
| MNQ 25-min ORB | B (negative) | t=1.50 (not significant), unstable year-to-year, fails walk-forward across all 14 tested variants in the companion negative-evidence study — useful as a negative benchmark, not a candidate |
| Value-Area Breakout (ES) | B | Requires one-second event-level data and precise volume-at-price construction; not reproducible from 1–15m OHLCV |
| Probability Trailing Stop | B (negative) | Every reported gross PF is ≤1.00 across six instruments — negative expectancy before any costs are even applied |
| Nifty 30-min ORB, structure vs ATR | B | n=42 trades per arm over a single 3-month window — too small to generalize either stop method |
| Daily equity-loss limiter (crude oil) | B | The $2,500 threshold was cherry-picked from a $500–$10,000 grid search on one strategy/market — textbook overfitting, not a transferable rule |
| Post-loss cooling-off | B (negative) | Directly measured to reduce net return and worsen drawdown — explicit negative evidence against the mechanism |
| 5-min momentum + layered kill switches | B (low confidence) | No ablation isolates whether the kill switches helped or hurt; OOS Sharpe (0.94) is well below in-sample; extra 0.5-tick slippage alone cut CAGR by 2.7pp |
| NQ break-even/ATR trail comparison | C | Undisclosed entry rule and sample size, no costs modeled — lowest-quality evidence in the family |
| Chicago Fed prop-firm survey | Descriptive | Confirms industry adoption of P&L limits but explicitly does not measure whether they improve trader outcomes |

## 5. Source list

- SSRN 4729284 — "Stocks in Play" 5-min ORB — https://alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content
- IEEE Access 10.1109/ACCESS.2019.2899177 — TORB — https://doi.org/10.1109/ACCESS.2019.2899177
- Knowledge-Based Systems 10.1016/j.knosys.2021.106769 — GAORB — https://doi.org/10.1016/j.knosys.2021.106769
- Finance Research Letters — Crude oil ORB — https://www.sciencedirect.com/science/article/abs/pii/S1544612312000438
- SSRN 2440866 / Journal of Financial Economics — open→close momentum — https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2440866 / https://www.sciencedirect.com/science/article/pii/S0304405X18301351
- IEEE Access 10.1109/ACCESS.2020.3024619 — Crypto pair mean reversion — https://doi.org/10.1109/ACCESS.2020.3024619
- Sciencedirect S0960077925013657 / arXiv 2504.12828 — PDT Strategic Trailing — https://www.sciencedirect.com/science/article/pii/S0960077925013657
- Coval–Shumway (2005) — CBOT loss-behavior — https://www.tylergshumway.org/Coval-BehavioralBiasesAffect-2005.pdf
- concretumgroup "Beat the Market" — SPY Noise-Area Momentum — https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf
- arXiv 2605.04004 — MNQ 25-min ORB negative result — https://arxiv.org/pdf/2605.04004
- SSRN 4416622 — QQQ/TQQQ ORB — https://papers.ssrn.com/sol3/Delivery.cfm/4416622.pdf
- fxvps.biz blog — DAX night range — https://fxvps.biz/blog/dax-opening-range-breakout-14-year-study/
- SSRN 6941458 — XAUUSD structural break — https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6941458
- github hindsight-finance — Cameron ICT scalp — https://github.com/hindsight-finance/ict-cameron-scalp-model
- preprints.org — BTC StochRSI+ML — https://www.preprints.org/frontend/manuscript/384a120c45428509aa846cf34b2c8121/download_pub
- SSRN 6350238 — Value-Area Breakout ES — https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6350238
- investing.com — Probability Trailing Stop — https://www.investing.com/analysis/trading-with-probability-trailing-stops-145698
- easylanguagemastery.com — Daily equity-loss limiter / cooling-off — https://easylanguagemastery.com/building-strategies/algorithmic-trading-tip-building-risk-protection-into-your-trading/
- misango.me — 5-min momentum + layered switches — https://misango.me/static/Papers/Intraday_Momentum_Paper/Intraday_Momentum_Research_Report.pdf
- dailybulls.in — Nifty 30-min ORB structure vs ATR — https://dailybulls.in/orb-intraday-trading-strategy-backtest/
- proptradingvibes.com — NQ break-even/ATR trail — https://proptradingvibes.com/blog/trailing-stop-loss-strategy
- Chicago Fed policy discussion paper — prop-firm risk limits — https://www.chicagofed.org/-/media/publications/policy-discussion-papers/2012/pdp2012-1-pdf.pdf
- Locke–Mann (2009) — CME loss-behavior contradiction — https://www.sciencedirect.com/science/article/pii/S1386418109000421
- arXiv 2407.16527 — limit-order negative drift — https://arxiv.org/pdf/2407.16527
- arXiv 2409.12721 — adverse selection simulation — https://arxiv.org/pdf/2409.12721
- TradingView Pine Script docs — strategy realism / Bar Magnifier — https://www.tradingview.com/pine-script-docs/concepts/strategies/, https://www.tradingview.com/support/solutions/43000669285-what-is-bar-magnifier-backtesting-mode/
