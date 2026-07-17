# VWAP Reversion / Continuation Family — Synthesis

**Date**: 2026-07-17
**Sources**: vwap_012, vwap_014, vwap_015, vwap_016, vwap_017, vwap_018, vwap_019, vwap_020 (8 raw files; vwap_011 and vwap_013 errored out — Codex timeout, no analysis body, excluded)

## Overall Assessment

This family's evidence is **weak to negative**. Across eight independent research passes covering first-touch pullbacks, anchored VWAP retests, slope/regime filters, 2σ/3σ band fades, breakout-retest continuation, cross-market comparison (futures/FX/crypto), and the "magnet into close" hypothesis, **no research pass found Grade-A evidence that survives realistic retail costs and genuine out-of-sample (OOS) testing**. The two nominally "Grade A" items (VWAP Trend Trading / "Holy Grail" reversal on QQQ/TQQQ, and BTCUSDT VWAP trend filter) earned that grade only for having *reproducible code*, not for *surviving OOS* — both are explicitly reported to degrade sharply (Sharpe ~2.1 → ~0.7, or breakeven under 1bp cost) once realistic frictions or later time windows are applied. Every recurring Grade-B candidate (morning VWAP-RSI pullback, anchored VWAP retest, VWAP slope pullback) was tuned and evaluated on the **same single year/sample** it is reported on, with no disclosed OOS split, which every researcher independently flagged as data-snooping / multiple-testing risk. A direct counter-test (Binance VWAP pullback, 5m, real transaction costs) produced PF 0.22–0.37 — near-total capital loss. A separate counter-study found mega-cap price *continues* past +2σ from VWAP 72–98% of the time into the close, contradicting the fade thesis.

**Conclusion: do not treat this family as a validated live-trading edge.** The two candidates below are included only because they (a) recur across multiple independent researchers with roughly consistent numbers, (b) have explicit, Pine-implementable rules, and (c) show PF meaningfully above 1 with cost assumptions disclosed — i.e., they are the *least bad* hypotheses in the family, worth a walk-forward validation gate before real capital, not worth trading as-is.

---

## Ranking Table

| Rank | Logic | Grade | Markets | PF / metric | OOS? | Costs disclosed? | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | QQQ Morning VWAP-RSI(2) Pullback | B | QQQ 5m | PF 2.08 (186 trades, 9:45–11:30) / PF 1.54 all-day (312) | No | Yes ($0.02/share) | Candidate — validate first |
| 2 | Opening-Drive Anchored VWAP Retest | B | ES/NQ/RTY 5m (YM fails) | PF 1.21–1.29 (ES/NQ/RTY), PF 0.98 YM | No | Yes (unspecified model) | Candidate — validate first, thin margin |
| — | VWAP Slope Pullback Continuation | B | NQ/ES/YM 5m | PF 1.01–1.11 | No | Partial | Rejected — margin too thin to survive real slippage |
| — | VWAP Trend / "Holy Grail" reversal | A (code) / weak (OOS) | QQQ/TQQQ 1m | Sharpe 2.1 in-sample → ~0.7 OOS; breakeven <1bp cost | Yes, and it fails | Zero slippage assumed | Rejected — no discrete SL/TP, fails OOS, DT contract incompatible |
| — | BTC VWAP trend filter | A (code) / weak | BTCUSDT 15m | Sharpe 0.84, PF n/a | No | Yes (2bp) | Rejected — no discrete SL/TP, crypto session structure doesn't fit RTH-based DT contract |
| — | 2σ/3σ VWAP band fades (XLE, NQ, NG) | B/B− | Various 5m | PF 1.22–1.78 (claimed) | No | Partial/none | Rejected — vendor-only sources, contradicted by continuation counter-evidence |
| — | 0.60% VWAP short fade | B | NQ/ES/YM/RTY 5m | PF 1.00–2.01 (YM n=35 only positive) | No | No | Rejected — short-only overfit to 2024 uptrend, most markets PF≈1.00 |
| — | VWAP "magnet into close" fades | C | Unspecified | Win rate 74% (unaudited) | No | No | Rejected — unverifiable, no sample/period/PF disclosed |
| — | AVWAP event-anchored (CPI, prior-day H/L) | C/B | ES 15m / USDJPY | n=11 or n=30 only | No | No/partial | Rejected — sample too small to draw conclusions |

---

## Candidate Specs

### Candidate 1: QQQ Morning VWAP-RSI(2) Reclaim/Pullback

**Evidence grade**: B (recurs consistently across vwap_012, vwap_014, vwap_017, vwap_019, vwap_020 — same underlying study, ~18-month backtest 2024-01 to 2025-06)

**Markets**: QQQ (equity ETF). Not yet tested on futures/other tickers by this study.

**Timeframe**: 5-minute bars, RTH only.

**Entry rule**:
- Long: after 09:45 ET, price closes above VWAP for 3 consecutive bars → price touches/dips to VWAP AND RSI(2) < 25 on that touch bar → enter long on the next bullish (up) bar close, provided that bar closes back above VWAP.
- Short: symmetric — 3 consecutive closes below VWAP, touch with RSI(2) > 75, enter short on next bearish bar closing back below VWAP.
- Max one trade per direction per day (i.e., ≤2 trades/day total).

**Exit / stop rule**:
- Stop-loss: 1.5×ATR(14) placed beyond VWAP on the entry side.
- Take-profit: prior day's high (long) / prior day's low (short); if that level is already broken intraday, use 2×ATR(14) instead.
- Hard session close: flatten by 15:00 ET (all sources use 15:00, not 16:00, as the cutoff for this specific setup).

**Filters / session**: Only active 09:45–15:00 ET. The reported PF splits sharply by sub-window — 09:45–11:30 (PF 2.08, 186 trades, 62.4% WR) vastly outperforms the 11:30–15:00 remainder (PF 0.69 midday, 0.53 afternoon). **This morning-only window was extracted post-hoc from the same sample** — every researcher flags this as a multiple-testing red flag, not a pre-registered filter.

**Risk parameters**: Fixed 100-share size in the source study (not %-risk based). For a DT-contract implementation, recommend translating to fixed fractional risk sized off the 1.5×ATR stop distance, not fixed share count.

**Expected metrics (source)**: All-day: 312 trades, 52.6% win rate, PF 1.54, net +$11,230 (0.02$/share/side cost only, no slippage/spread modeled). Morning-only (09:45–11:30): 186 trades, 62.4% win rate, PF 2.08, net +$17,190. Source: [pinegen.ai](https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest) — vwap_012, vwap_014, vwap_017, vwap_019, vwap_020 notes.

**Known failure modes**:
- No OOS split — entire reported edge is in-sample over the exact period tested (2024-01 to 2025-06).
- Morning-window outperformance is very likely a selected-after-the-fact artifact (same researcher note appears independently across 5 separate research passes).
- No slippage/spread modeled — only a flat $0.02/share commission. QQQ spread + any adverse fill on a 5m bar close could erode a meaningful fraction of the ~$0.34 avg trade P&L implied by the全体 PF.
- RSI(2), the 3-bar confirmation, and the ATR multiplier are three simultaneously-tunable parameters with no disclosed sensitivity/robustness check — high risk of joint overfitting.
- **Before any live use**: re-run on 2025-07 onward, unmodified parameters, QQQ + at least one other liquid ETF/future, with realistic spread+slippage; require PF > 1.3 to survive (per vwap_017's own recommended rejection threshold).

---

### Candidate 2: Opening-Drive Anchored VWAP Retest (Index Futures)

**Evidence grade**: B (recurs in vwap_014, vwap_017, vwap_018, vwap_020 — same underlying 2024 study across ES/NQ/YM/RTY)

**Markets**: ES, NQ, RTY perform acceptably; YM fails (PF 0.98, below breakeven). Do not trade YM with this logic.

**Timeframe**: 5-minute bars, RTH (09:30–16:00 ET) only.

**Entry rule**:
- Anchor VWAP to the highest-volume (or highest-price, sources differ slightly — vwap_020 says "highest bar of first 30 minutes," vwap_014/017 say "highest bar of first 6 bars") bar of the opening drive (first 30 min of RTH).
- Compute the AVWAP's 10-bar slope.
- If slope is positive: enter long when price returns to within ±0.1% of the AVWAP.
- If slope is negative: enter short on the same ±0.1% retest.
- No stated re-entry limit disclosed beyond implicit one-trade-per-signal; recommend capping at 1 signal per session per instrument for DT contract compliance.

**Exit / stop rule**:
- Take-profit: +0.5% from entry.
- Stop-loss: −0.3% from entry.
- Time stop: 30 bars (2.5 hours) elapsed.
- Hard exit: flatten at the close (16:00 ET) regardless.

**Filters / session**: RTH only, 09:30–16:00 ET. No explicit day-of-week or volatility-regime filter disclosed.

**Risk parameters**: Percentage-based TP/SL (0.5%/0.3%) — translates cleanly to a DT contract using ATR-scaled or fixed-tick equivalents per instrument. Reward:risk ≈ 1.67:1 nominal, but realized win rates near 50% mean the edge is thin and highly sensitive to fill quality.

**Expected metrics (source)**: 2024 full year, "realistic slippage" and commissions claimed but the calculation formula is not disclosed in any of the four independent write-ups. ES: 519 trades, 50.48% WR, PF 1.29, Sharpe 2.32, MDD 7.62%. NQ: 505 trades, 50.69% WR, PF 1.21, MDD 8.66%. RTY: 464 trades, 50.22% WR, PF 1.20. YM: 510 trades, 46.08% WR, PF 0.98 (losing). Source: [fractiz.com](https://www.fractiz.com/strategies/anchored-vwap/) — vwap_014, vwap_017, vwap_018, vwap_020.

**Known failure modes**:
- Single calendar year (2024), no OOS. The anchor definition itself ("highest bar of first N bars") was selected from among multiple candidate anchors tested in the same year — explicit anchor-selection overfitting flagged by 3 of 4 researchers.
- Cross-market inconsistency (YM fails outright) indicates the edge, if real, is fragile and not a robust cross-asset property of VWAP structure — treat any single market's positive PF with caution.
- PF 1.20–1.29 is thin; a realistic retail futures cost model (spread + 1 tick slippage + commission per side) could plausibly erase it, and the source's own slippage methodology is undisclosed/unverifiable.
- Continuous-futures roll handling is not documented — roll-date discontinuities could contaminate the AVWAP anchor and the 10-bar slope calculation.
- **Before any live use**: require an independently-computed slippage/commission model (not vendor-supplied), test 2025 data unmodified, and demand PF > 1.3 with n > 300 per instrument to justify risking capital, consistent with the rejection bar candidate 1 also needs to clear.

---

## Rejected Candidates (with reasons)

1. **VWAP Trend Trading / "Holy Grail" always-in reversal** (QQQ/TQQQ, 1m) — Grade A for code reproducibility only; OOS Sharpe collapses from 2.1 (in-sample) to ~0.7 (post-2023-09), and the strategy is documented to break even or lose money under round-trip costs of ~1bp, well within normal QQQ spread. Also structurally incompatible with the DT setup contract: it has no discrete entry/SL/TP — it is an always-in reversal system with no stop-loss, exiting only on the next opposite VWAP cross. Rejected on both evidence and contract-fit grounds.

2. **BTC VWAP trend/long-flat filter** (BTCUSDT, 15m) — Also Grade A for reproducibility, Sharpe 0.84 is modest evidence at best (not strong), no PF or OOS reported, results explicitly labeled "illustrative" by the source. No discrete SL/TP (binary long/flat on VWAP side), no session structure (24h crypto) — doesn't map cleanly onto a session-filtered DT contract designed around RTH futures/equities. Rejected.

3. **VWAP Slope Pullback Continuation** (NQ/ES/YM, 5m) — Same family/structure as Candidate 2 but with PF only 1.01–1.11, i.e., near-breakeven before any realistic cost adjustment. Multiple researchers (vwap_012, vwap_015, vwap_017) independently concluded this specific variant would not survive normal commissions + 1-2 ticks slippage. Rejected as too thin to be worth a validation slot.

4. **2σ/3σ VWAP band fades** (XLE, NQ, NG via TrendSpider/Pineify/PineScriptForge) — All vendor-sourced with undisclosed sample periods, no OOS, several stat fields showing placeholder zeros. Directly contradicted by an independent counter-study: mega-cap stocks trading above +2σ from VWAP at 10:30 remained above VWAP into the close 72–98% of the time — i.e., continuation, not mean reversion, which undermines the entire fade thesis for this variant. Rejected.

5. **0.60% VWAP short-fade** (NQ/ES/YM/RTY, 5m) — Short-only, parameters and direction both selected from the same 2024 uptrending sample (obvious regime-selection bias). 3 of 4 markets show PF ≈ 1.00 (breakeven or worse before costs); only YM (n=35, too small to trust) looks attractive. Rejected.

6. **VWAP "magnet into the close" fades** — No credible statistical evidence found; peer-reviewed literature on VWAP execution describes price *pressure* from VWAP-benchmarked order flow, not late-session mean reversion toward VWAP. One market-microstructure study found price inertia is *highest*, not lowest, near the close — the opposite of what a magnet/reversion effect would predict. Rejected outright; this is not a viable candidate even for further validation.

7. **Event-anchored AVWAP (CPI-anchor, prior-day-H/L-anchor)** — Sample sizes of n=11 (ES CPI-anchor) and n=30 (USDJPY dual-anchor) are far too small to draw any statistical conclusion, regardless of the reported PF/Sharpe. Rejected for insufficient sample.

---

## Source List

- vwap_012: https://tosindicators.com/research/what-moving-average-pullback-is-best-for-qqq-5-min-chart ; https://pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest ; https://www.fractiz.com/strategies/vwap-pullback/ ; https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4631351 ; https://strategyverdict.com/verdicts/
- vwap_014: https://papers.ssrn.com/sol3/Delivery.cfm/4631351.pdf?abstractid=4631351&mirid=1 ; https://www.quantconnect.com/terminal/cache/embedded_backtest_b115d0894231d55994b1068202f6c0ae.html ; https://www.fractiz.com/strategies/anchored-vwap/ ; https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/ ; https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest ; https://scalpradar.com/blog/2024/3/backtesting-an-anchored-vwap-strategy/
- vwap_015: https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf ; https://www.fractiz.com/strategies/vwap-pullback/ ; https://www.fractiz.com/strategies/vwap-fade/ ; https://www.manifoldbt.com/strategies/vwap-strategy-python
- vwap_016: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6454659 ; https://charts.trendspider.com/shared/64c3d68a1e74100015bd88c5?t=1 ; https://pineify.app/vwap-strategy-tradingview ; https://pinescriptforge.com/nq/vwap-deviation/backtest ; https://pinescriptforge.com/ng/vwap-deviation/backtest ; https://www.fractiz.com/strategies/vwap-fade/ ; https://www.vortexcapitalgroup.com/insights/the-10-30-vwap-decision-point-distance-as-an-end-of-day-probability-gauge
- vwap_017: https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest ; https://www.fractiz.com/strategies/vwap-pullback/ ; https://www.fractiz.com/backtest-samples/vwap-pullback-strategy-nq-5m-2024/ ; https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf ; https://fibalgo.com/education/vwap-trading-strategy-institutional-benchmark
- vwap_018: https://www.fractiz.com/strategies/anchored-vwap/ ; https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-es-5m-2024/ ; https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4631351 ; https://www.quantconnect.com/terminal/cache/embedded_backtest_b115d0894231d55994b1068202f6c0ae.html ; https://forextester.com/blog/anchored-vwap/ ; https://www.bis.org/publ/work1094.htm ; https://www.manifoldbt.com/strategies/vwap-strategy-python ; https://www.coinquant.ai/blog/vwap-strategy-on-bitcoin-what-3-months-of-intraday-backtest-data-shows
- vwap_019: https://infinityalgo.com/tools/learn/strategy-guides ; https://www.fractiz.com/strategies/vwap-fade/ ; https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4631351 ; https://www.quantconnect.com/terminal/cache/embedded_backtest_b115d0894231d55994b1068202f6c0ae.html ; https://par.nsf.gov/servlets/purl/10278879 ; https://arxiv.org/abs/2601.04959
- vwap_020: https://www.manifoldbt.com/strategies/vwap-strategy-python ; https://github.com/Jimmy7892/manifoldbt ; https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf ; https://www.quantconnect.com/terminal/cache/embedded_backtest_acf328725ee542884ccb12ed0be5d316.html ; https://www.fractiz.com/strategies/anchored-vwap/ ; https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/ ; https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-es-5m-2024/ ; https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest

**Excluded from synthesis**: vwap_011 and vwap_013 (Codex research timed out, no analysis body produced — status: error in structured summaries).
