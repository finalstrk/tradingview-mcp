# VWAP 2-Sigma/3-Sigma Band Fade Research

**Topic ID:** vwap_016  
**Family:** vwap  
**Date:** 2026-07-17  
**Research Question:** 2-sigma/3-sigma VWAP band fade strategies: win rate, PF, and when they blow up

---

No Grade A evidence was found. Peer-reviewed VWAP research mainly studies execution, not speculative band fades; the closest 2026 SSRN proposal explicitly leaves backtesting to future work. Thus, claims that ±2σ contains 95% or ±3σ 99.7% of prices should not be treated as trade probabilities: intraday prices are non-normal, serially correlated, and regime-dependent. [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6454659)

1. **XLE lower-2σ fade — TrendSpider.** XLE, 5-minute RTH. After 09:40, buy next open when close ≤ session-VWAP lower-2σ; exit when bar high reaches VWAP; stop after a bar closes >0.75% below entry. Reported: 69% wins, 0.62 average win/loss, approximately PF 1.38 implied, 7.3% return versus 10.5% buy-and-hold, 0.08% average trade, 3.6% drawdown. Sample size, dates, costs and OOS are absent. **Grade B. Pine v6: yes.** Single surviving ETF and unpublished period create severe selection risk. An eight-basis-point gross trade is vulnerable to spread, slippage and commissions. [Source](https://charts.trendspider.com/shared/64c3d68a1e74100015bd88c5?t=1)

2. **NQ 20-bar 2σ fade — Pineify.** NQ, 5-minute. Bands are session VWAP ±2×rolling 20-bar price SD. Enter immediately on cross outside either band; exit on VWAP cross, 1.5% stop, or 3% target. Six-month simulation: 142 trades, 58.45% wins, PF 1.78, 18.45% net profit, 6.2% drawdown, 0.13% average trade. No dates, commissions, slippage or OOS. **Grade B. Pine v6: yes**—public v5 code ports trivially. Results are not independently reproducible from disclosed data; the unusually wide percentage stop makes trend-day tail losses important. [Source](https://pineify.app/vwap-strategy-tradingview)

3. **2σ→VWAP/3σ stop — PineScriptForge.** NQ and NG, principally 5-minute: long/short at ±2σ after an undefined "confirmation candle"; partial at ±1σ, remainder at VWAP; stop at ±3σ. Claimed Jan-2023–Mar-2026 post-friction results: NQ 570 trades, 53.5%, PF 1.71, DD 4.3%; NG 722 trades, 49.7%, PF 1.22, DD 17.7%. Costs claim $4.50 round-turn plus one tick/side and "walk-forward + Monte Carlo." **Grade B−; Pine: partial.** Confirmation, partial size, session anchor and OOS split are missing; detailed-stat fields display zeros and neither code nor data is supplied. NQ might survive stated costs if genuine; NG's PF 1.22 probably does not survive EIA/news spreads and gap slippage. [NQ](https://pinescriptforge.com/nq/vwap-deviation/backtest), [NG](https://pinescriptforge.com/ng/vwap-deviation/backtest)

4. **0.60%-VWAP short fade — Fractiz robustness check.** Not sigma-scaled, but a useful 5-minute RTH baseline: short close ≥0.60% above 09:30-anchored VWAP; cover at VWAP, +0.40% adverse stop, 30 bars, or 16:00. 2024 results: NQ 79 trades/48.1%/PF1.00; ES 36/52.8%/1.20; YM 35/62.9%/2.01; RTY 147/41.5%/1.00. **Grade B; Pine: yes.** Short-only and parameters were chosen from the same 2024 sweep—clear overfitting; three of four markets are economically marginal before uncertain costs. [Source](https://www.fractiz.com/strategies/vwap-fade/)

A particularly damaging contrary result: among 528 mega-cap sessions, stocks already above +2σ at 10:30 remained above VWAP at the close 72% of the time (n=81); by 15:00 the rate was 98%. That is continuation, not fade evidence. [Source](https://www.vortexcapitalgroup.com/insights/the-10-30-vwap-decision-point-distance-as-an-end-of-day-probability-gauge)

Bottom line: blow-ups occur on trend/news/gap days, especially when repeatedly fading an expanding band with bar-close stops. Evidence is weak and vendor-dominated; no published result demonstrates robust 2σ/3σ fade alpha across independent markets, realistic costs and genuine OOS data.
