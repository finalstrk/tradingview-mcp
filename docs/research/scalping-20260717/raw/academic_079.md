# Research Report: Intraday Behavior Around Scheduled Announcements

**topic_id:** academic_079  
**family:** academic  
**date:** 2026-07-17  
**question:** Intraday behavior around scheduled announcements: exploit or avoid? Quantified.

---

The evidence favors **avoiding the immediate release window**. Only one intraday pattern looks tentatively exploitable, and it lacks genuine out-of-sample validation.

1. **Legacy pre-FOMC drift — now largely dead**

Market/timeframe: ES/S&P 500 futures; 1–15-minute data.  
Rule: buy exactly 24 hours before a scheduled FOMC statement; exit 15 minutes before release. No stop; FOMC days only.  
Evidence: 1994–2011, 131 events: mean +48.8 bp, 98/131 positive (74.8%). But 2011–2019, 70 events: only +4.7 bp; for 2016–2019 press-conference meetings, +9.2 bp and statistically insignificant. PF and costs were not reported. [Original study](https://www.newyorkfed.org/research/economists/medialibrary/media/research/staff_reports/sr512.pdf); [peer-reviewed decay study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7525326/).  
Grade: **A**. Pine v6: **partial**—event dates must be manually supplied; TradingView has no dependable historical FOMC-calendar API.  
Assessment: do not deploy. Publication/regime decay is unusually clear. Normal ES costs would have been small versus the original 49 bp, but not versus the later 5–9 bp. No constituent-survivorship issue, but continuous-futures rolls and announcement-time changes matter.

2. **CFTC-steepening-conditioned pre-FOMC timing**

Market/timeframe: ES; intraday.  
Rule: form a quarterly "STEEP" indicator from CFTC speculator positioning—positive excess net Eurodollar positioning and negative excess net 30-year Treasury positioning. Recursively regress same-day pre-FOMC return on STEEP. At 09:30 ET, buy ES if predicted return is positive, short if negative; exit 15 minutes before the statement. No stop.  
Evidence: training September 1997–December 2002; rolling OOS January 2003–July 2017. OOS \(R^2=16.8\%\); annualized Sharpe 1.085 versus 0.748 for always-long. Trade count, win rate and PF were not disclosed; costs were not deducted. [Federal Reserve paper](https://www.federalreserve.gov/econres/feds/files/2019025pap.pdf).  
Grade: **B**. Pine v6: **partial/no**—the historical COT transformations and recursive regression require external data or manually imported signals.  
Assessment: interesting research, not retail-ready. Likely specification-selection risk, stale Eurodollar contract assumptions, and no post-2017 test. Two ordinary ES fills should be survivable, but the reported advantage over naive timing is not demonstrated net of costs.

3. **Fade the pre-FOMC move through the announcement**

Market/timeframe: ES, one-minute.  
Rule: measure return from T−24h to 13:50 ET. At 13:50, buy if that return is negative and short if positive; exit two hours later at 15:50. No stop. Scheduled FOMC only.  
Evidence: 1997–2020, 180 meetings: average +17.86 bp, annualized Sharpe 1.02. The simulation buys at ask and sells at bid. A safer variant entering 20 minutes after release produced only +9.34 bp and Sharpe 0.34. Win rate, PF and true OOS results were not reported. [Working paper](https://www.researchgate.net/publication/362775066_The_FOMC_Announcement_Reversal).  
Grade: **B**. Pine v6: **yes**, with a manually maintained event calendar and extended-hours ES data.  
Assessment: best candidate, but still provisional. The rule is tested in-sample and crosses the most toxic liquidity interval; quoted bid/ask treatment does not fully model latency, stop-outs, gaps or exceptional slippage. Retail survival is plausible for ES at small size, but unproven.

4. **Hold through FOMC—recent negative replication**

Rule: buy ES at the prior session close; exit 30 minutes after the statement; no stop.  
Evidence: January 2023–March 2026, 38 trades: 31.6% wins, PF 0.86, 12.5% drawdown after $4.50 round-turn commission plus one tick slippage. [Backtest](https://pinescriptforge.com/es/fomc-drift/backtest).  
Grade: **C**—templated site, no downloadable code/data, tiny sample, internally incomplete statistics. Pine v6: **yes**.  
Assessment: negative after realistic baseline friction; reject.

Overall: scheduled releases reliably create volatility, but price discovery is generally completed within roughly one to five minutes while excess volatility persists longer ([Bund evidence](https://www.researchgate.net/publication/356335745_Which_News_Moves_the_Euro_Area_Bond_Market)). For retail execution, the quantified recommendation is: **block entries and cancel nearby stops from at least T−5 to T+5 minutes; preferably wait 15–20 minutes.** Research the FOMC reversal only as a fresh, pre-registered 2021-present OOS test with tick-level bid/ask and doubled slippage.
