# Academic Research: WM/R Fix Pattern Post-2015 Reforms

**Topic ID:** academic_076  
**Family:** academic  
**Date:** 2026-07-17  
**Question:** Is the WM/R fix pattern still exploitable after 2015 reforms?

---

The WM/R "fix" edge is not supported as a robust retail strategy today. The 2015 reform widened the window to 15:57:30–16:02:30 London time. Early post-reform inefficiencies appeared, but subsequent evidence shows rapid decay; a peer-reviewed 2015–2023 study finds no statistically significant reversal in almost every quarter across six major pairs. No credible public GitHub backtest with both code and data was found.

1. End-of-month post-fix reversal — Grade A

- Markets/timeframe: AUD/USD, EUR/GBP, EUR/JPY, EUR/USD, GBP/USD, USD/CAD, USD/CHF, USD/JPY; tick/1-minute approximation.
- Entry: last trading day of month. If the return from approximately 15:47:30 to 16:00 is positive, short at 16:02:30; if negative, long.
- Exit/stop: time exit after 1, 5, or 15 minutes; no stop.
- Post-reform evidence: February 2015–June 2016, only about 16 month-ends. After spreads, 15-minute mean profit was +1.21 bp EUR/USD, +2.03 bp GBP/USD, +2.39 bp USD/JPY, +4.26 bp AUD/USD and +6.19 bp USD/CHF. Reported annualized Sharpes were 2.28, 2.20, 6.99, 7.84 and 14.0 respectively. One-minute results were negative for every pair. Win rate and profit factor were not reported. The authors explicitly warn that annualizing a monthly opportunity using daily scaling exaggerates Sharpe. [Ito–Yamada paper and Table 2](https://www.nber.org/system/files/working_papers/w23327/w23327.pdf)
- Pine v6: partial. A 1-minute chart can approximate the signal and timed exit, but not 30-second benchmark boundaries or executable bid/ask fills; 5–15-minute bars are inadequate.
- Verdict: severe small-sample/data-snooping risk. Later evidence below substantially invalidates it.

2. First-half fix-window price momentum — Grade B

- Markets/timeframe: AUD/USD, EUR/USD, GBP/USD, USD/CHF, USD/JPY; sub-minute.
- Entry: at 16:00, buy if price rose during 15:57:30–16:00; short if it fell.
- Exit/stop: 16:02:30; no stop or magnitude filter reported.
- Evidence: roughly four months, February 15–June 15, 2015 (about 80 trading days per pair). Average second-half continuation was approximately 2 bp, followed by reversion. No win rate, PF, significance test, costs, or out-of-sample test. [Pragma methodology note](https://www.pragmatrading.com/wp-content/uploads/2017/05/New-Trading-Patterns-around-the-WMR-Fix-2015.pdf)
- Pine v6: partial only on 1-minute bars; exact half-window execution is impossible.
- Verdict: 2 bp gross is comparable to fix-period spread plus retail commission/slippage. Survival for retail is implausible.

3. First-30-second signed-order-flow momentum — Grade A

- Markets/timeframe: same eight pairs; EBS tick/order-book data.
- Entry: measure signed aggressive order flow during 15:57:30–15:58:00; trade in its direction at 15:58, particularly beyond the 90th/95th percentile.
- Exit/stop: 16:02:30; no stop.
- Evidence: first 179-day subsample showed EUR/USD positive-flow profits after spread of 4.52 pips at q90 and 6.8 at q95. In the next 179 days these became −1.81 and −2.14 pips: an unusually clear edge-decay result. Most cross-pair predictability disappeared. [Ito–Yamada Table 4](https://www.nber.org/system/files/working_papers/w23327/w23327.pdf)
- Pine v6: no. TradingView volume/price bars do not contain EBS signed interdealer order flow.
- Verdict: initially exploitable by professional order-book participants, already decayed by mid-2016.

The strongest current evidence is negative: proprietary millisecond data for AUD/USD, USD/CAD, EUR/USD, GBP/USD, JPY/USD and NZD/USD from February 2015 through December 2023 confirms absence of significant 15-minute pre/during versus post-fix reversal in nearly every quarter. [Peer-reviewed pre-registered study](https://cris.unibo.it/retrieve/handle/11585/1001540/57f7f7d3-6fdc-4a67-acd7-17ff719ca97e/1-s2.0-S0927538X24004049-main.pdf)

Overall: no Pine-implementable WM/R scalping rule presently has convincing cost-adjusted, out-of-sample evidence. Pair selection, tiny month-end samples, proprietary-data dependence, and publication/overfitting bias dominate; realistic retail execution likely turns the remaining gross pattern negative.
