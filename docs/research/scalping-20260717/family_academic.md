# Academic Family Synthesis — Scalping Evidence Sweep (2026-07-17)

Source topics: academic_071 through academic_080 (10 raw research files, 38 total candidate logics reported by researchers).

## 1. Overall Assessment

This family's evidence is **weak-to-negative for retail scalping viability**. The literature does document statistically credible intraday patterns (first/last-half-hour continuation, fixing-time reversals, LOB imbalance, ML-based short-horizon prediction), and several are Grade A peer-reviewed publications with large samples and t-stats > 3. But almost none survive the combination of (a) realistic retail spreads/commissions, (b) genuine out-of-sample testing, and (c) execution constraints available on a retail OHLCV feed:

- The single most-repeated, best-evidenced pattern (Gao–Han–Li–Zhou SPY first-half-hour → last-half-hour momentum, appearing independently in academic_071, academic_074, and academic_080) has a **documented negative out-of-sample code replication**: Sharpe −0.628 on SPY/IWM/IYR 2015–2020, versus the original 1993–2013 Sharpe of 1.08 (academic_071). This is a serious, source-confirmed red flag on the family's flagship result.
- FX fixing-time reversals (academic_075, academic_076) are explicitly reported as unprofitable after realistic client spreads ("有意にマイナス" — significantly negative net of spread) and further decayed to statistical insignificance after the 2015 WM/R reform.
- Futures cross-market/time-of-day continuation (academic_072, academic_073) is either pre-cost only, statistically weak post-cost (t≈1.5), or explicitly rejected in the most reproducible case (MNQ 25-min ORB, academic_073).
- ML/LOB-based approaches (academic_077, academic_078) require order-book/tick data or dynamic model retraining that Pine v6 with OHLCV-only cannot reproduce, and win rates cluster at 40–55% (near random) once thresholds are cost-aware.
- Event-driven (FOMC) patterns (academic_079) are in-sample only, cross the most toxic liquidity window, and a recent independent replication was outright negative (PF 0.86).
- Base-rate studies (academic_080) confirm the meta-picture: >97% of surviving Brazilian retail day-traders lose money after costs; <1% of Taiwanese traders show persistently predictable profitability, and that group's edge is attributed to information/stock-picking skill, not a publishable technical rule.

Given this, **only 2 candidates** are promoted below, both with explicit high-risk caveats, and both should be treated as forward-test-only, not "adopted," until independently re-validated on current data and real spreads. A third candidate (opening+penultimate consensus) was considered and rejected — see Section 4.

## 2. Ranking Table (all logics surfaced by researchers, ranked)

| # | Logic | Source | Grade | Post-cost / OOS status | Pine v6 fit | Verdict |
|---|-------|--------|-------|------------------------|-------------|---------|
| 1 | GHLZ first-half-hour → last-half-hour momentum (SPY, 30m) | 071/074/080 | A | Positive in-sample (Sharpe 1.08); **negative genuine OOS replication (Sharpe −0.628, 2015–2020)** | Yes | Promoted, high-risk caveat |
| 2 | SPY Noise-Area momentum + VWAP stop (SPY, 1m/30m grid) | 071/074/080 | B | No independent OOS; optimistic slippage assumption; consistent across 3 independent write-ups | Yes | Promoted, moderate-risk caveat |
| 3 | Opening + penultimate consensus (SPY, 30m) | 071 | A | Higher win rate (77%) but lower Sharpe (0.98); cost-adjusted 4.74% vs 5.5% gross; same decay risk as #1 (shares underlying signal) | Yes | Rejected — redundant with #1, not independently validated |
| 4 | Return-to-close futures momentum (equity/bond/commodity/FX futures) | 071 | A | Costs mostly omitted; only ES-class liquid contracts plausible | Partial | Rejected — portfolio-level, not single-setup |
| 5 | Nikkei 225 cross-market reversal (US close → Nikkei open) | 072 | A | Reported net of cost, 3.59%/yr, Sharpe 0.58 | Partial | Rejected — auction-fill assumption unreproducible, weak Sharpe |
| 6 | NASDAQ crash rebound / Nasdaq-100 "1-min crash" reversal | 072 | A | Old market structure (2000-02) or bid/ask microstructure (2014-19) not reproducible retail | No/Partial | Rejected — needs NBBO/tick, stale data |
| 7 | BTC RSI+Bollinger mean reversion | 072 | B | ROI −21.47%, Sharpe −6.78 | Yes | Rejected — explicitly unprofitable |
| 8 | CSI300 IF futures 60m→60m continuation | 073 | A | Cost-adjusted t=1.49 (weak), China-specific session/roll issues | Partial | Rejected — weak significance, non-US session |
| 9 | Chinese commodity futures 30m→30m | 073 | A | **Pre-cost only**, author-acknowledged high cost sensitivity | Partial | Rejected — no cost-adjusted figures |
| 10 | FTSE100/EuroStoxx50 pre-close 30m regression | 073 | A | t=1.49–1.72 (weak), OOS R²<2% | Partial | Rejected — statistically weak |
| 11 | MNQ 25-min Opening Range Breakout | 073/074 | B | **Explicitly negative/unstable** across years (−1.42/+2.43/+7.04 pt) | Yes | Rejected — negative result |
| 12 | 5-min ORB (QQQ/TQQQ first-bar-direction) | 074 | B | No slippage modeled, same-bar optimistic fill, win rate 24% | Yes | Rejected — unrealistic fill assumption |
| 13 | European-fix USD reversal (G9 vs USD) | 075 | A | **Explicitly negative net of realistic client spread** | Yes (single pair) | Rejected — source states net-negative |
| 14 | Month-end 5-min Fix fade (AUD/USD etc.) | 075 | A | No true cost model, multiple-testing across 21 pairs×3 windows | Partial | Rejected — multi-testing risk, unreplicable Fix execution |
| 15 | S&P month-end hedge-flow momentum | 075 | B | Win rate collapsed 62%→45% post-2018 | Partial | Rejected — regime-broken |
| 16 | End-of-month post-fix reversal (WM/R) | 076 | A | Tiny sample (~16 month-ends), authors warn against annualizing | Partial | Rejected — sample too small, warned against by authors |
| 17 | First-half fix-window momentum | 076 | B | 2bp gross ≈ spread+commission | Partial | Rejected — no net edge |
| 18 | First-30-second signed-order-flow momentum | 076 | A | Requires EBS order-book data; decayed to negative within a year | No | Rejected — no OHLCV feasibility |
| 19 | SPY-constituent → SPY 5-min ML prediction | 077 | A | Cost-aware but requires ~500-stock real-time features, model retraining | Partial/No | Rejected — infeasible in Pine |
| 20 | BTC cost-threshold XGBoost | 077 | B | High overfitting risk, no live-model support in Pine | Partial | Rejected — needs external ML inference |
| 21 | Positional-context PPO (commodities/FX) | 077 | A | Expected value 0.03–0.25bp/trade — vanishes under retail costs | Partial | Rejected — near-zero net edge |
| 22 | Queue-imbalance directional (Nasdaq) | 078 | B | Random-split OOS (weak), no LOB access in Pine | No | Rejected — no data access |
| 23 | DeepLOB CNN-LSTM reversal | 078 | A | Median edge 1/10th of spread | No | Rejected — no data access, negative net |
| 24 | Imbalance-aware at-touch market making | 078 | A | Simulated fills only, no LOB access | No | Rejected — no data access |
| 25 | Legacy pre-FOMC drift | 079 | A | Decayed from +48.8bp to +4.7bp; largely dead | Partial | Rejected — decayed |
| 26 | CFTC-steepening pre-FOMC timing | 079 | B | No costs, external COT data needed | No | Rejected — external data dependency |
| 27 | Fade pre-FOMC move through announcement | 079 | B | In-sample only, crosses toxic liquidity window | Yes | Rejected — no genuine OOS, high risk window |
| 28 | Hold through FOMC (recent replication) | 079 | C | PF 0.86, negative | Yes | Rejected — negative |
| 29 | KOSPI late-day 3-signal consensus | 080 | A | No true transaction cost deduction, index untradeable directly | Partial | Rejected — cost-unverified, basis risk |
| 30 | 5-min ORB + relative volume (US stocks) | 080 | B | No slippage/spread modeled, universe-scan infeasible in Pine | Partial | Rejected — infeasible universe scan, cost gaps |

(Remaining minor variants noted by researchers as "no" Pine feasibility or explicitly negative are omitted from the table for brevity; all are accounted for in Section 4.)

## 3. Candidate Specs (max 3 — 2 promoted)

### Candidate A: GHLZ Intraday Momentum (Opening Half-Hour → Closing Half-Hour), SPY-class

**Evidence grade: A** (peer-reviewed, Journal of Financial Economics), but carries a **confirmed negative out-of-sample replication** — treat as decayed/high-risk, not a live edge.

- **Market**: SPY (or SPY-proxy futures/ETF with comparable liquidity, e.g., ES/MES during RTH). Do not extend to illiquid symbols.
- **Timeframe**: 30-minute bars (can be built from 1-minute OHLCV aggregation in Pine).
- **Entry rule**: At 15:30 ET, compute `r = close[15:30] / close[prev session 16:00 close] − 1` measured to `close[10:00]` (i.e., return from previous day's close to today's 10:00 bar close). If `r > 0`, enter long at the 15:30 bar close/next bar open; if `r < 0`, enter short. No entry if `r == 0`.
- **Exit rule**: Flat by 16:00 ET session close (hard time exit). No native stop/target in the original study.
  - **DT-contract adaptation (not source-validated)**: since the DT contract requires SL/TP1/TP2, impose a synthetic risk cage: SL = 1.0× the 10:00–15:30 realized volatility (ATR of that window) from entry; TP1 = 0.5R at 50% size; TP2 = time-exit at 16:00 for remainder. This modification is an extrapolation beyond the paper and must be forward-tested before being trusted — the original edge (Sharpe 1.08) already collapsed to −0.628 OOS without any stop-loss modification, so added structure will not fix an already-decayed statistical premise.
- **Filters / session**: RTH only; one trade per session; skip FOMC/CPI/NFP days (per academic_079 finding that entries near scheduled releases are hazardous); optionally require above-median opening 30-minute volume (paper reports the effect is stronger under high opening volatility/volume, academic_071).
- **Max signals/day**: 1 (single daily directional bet, matches published rule exactly).
- **Risk parameters**: Position sized to a fixed % risk against the synthetic ATR-based SL described above; no leverage assumed beyond 1×.
- **Expected metrics (source, in-sample 1993–2013, academic_071/074/080)**: 54.37% win rate, 6.67%/yr, Sharpe 1.08, cost-adjusted ~6.52% (2005–2013 subperiod, proportional spreads).
- **Known failure modes (source-documented)**:
  - Genuine coded OOS replication on SPY/IWM/IYR 2015–2020 returned **Sharpe −0.628** (academic_071) — only the COVID-crash subperiod was profitable (Sharpe 1.452), suggesting the edge may only fire in extreme-volatility regimes rather than persistently.
  - International replication mixed: 12/16 developed markets replicated, Australia/Hong Kong/Singapore did not (academic_071).
  - Parameter/data-snooping risk from the 30-minute window choice (recursive OOS R² only 1.2–1.7%, i.e., very low explanatory power even in-sample).
- **Recommended status**: Paper-trade / forward-test only, gated behind a fresh 2021-present OOS check before any live sizing. Do not treat as an adopted DT setup.

### Candidate B: SPY "Noise-Area" Momentum Breakout with VWAP Trailing Stop

**Evidence grade: B**, but this is the only candidate in the family with (1) a real, source-defined stop-loss mechanism (not just a time exit) and (2) independent replication across three separate research write-ups (academic_071, academic_074, academic_080) citing the same underlying paper/dataset (2007–2024 SPY, 7,668 trades).

- **Market**: SPY (liquid, tight-spread ETF; do not extend to illiquid names).
- **Timeframe**: 1-minute bars, decision points at each HH:00/HH:30 from 10:00 ET onward.
- **Entry rule**: For each 30-minute checkpoint, compute the mean absolute intraday move (open→same-clock-time) over the prior 14 sessions, gap-adjusted using the larger/smaller of today's open vs yesterday's close. Set:
  - Upper band = `max(today_open, yesterday_close) × (1 + mean_abs_move_14d)`
  - Lower band = `min(today_open, yesterday_close) × (1 − mean_abs_move_14d)`
  - Long entry when price breaks above the upper band; short entry when price breaks below the lower band.
- **Exit rule (source-defined)**: For longs, exit when price crosses below `max(current lower/upper band, VWAP)`; for shorts, exit when price crosses above `min(band, VWAP)`. Hard flat at 16:00 ET. Reversal (flip position) permitted on an opposite breakout.
  - **DT-contract mapping**: SL = the VWAP/band trailing level at entry (converted to a fixed initial stop distance for DT contract purposes, then trailed per the source rule); TP1 = first touch of the *opposite-side* band at half size; TP2 = 16:00 time exit or full trailing-stop exit for the remainder. This TP1/TP2 split is a DT-contract adaptation, not literally in the source, and should be validated in forward-test before being relied on.
- **Filters / session**: RTH from 10:00 ET onward only (skip the first 30 minutes); one entry per HH:00/HH:30 checkpoint; recommend capping at 2–4 signals/day to stay within realistic overtrading limits (source reports ~7,668 trades over 17 years ≈ 1.75 trades/day average, consistent with a max-signals/day of 2–3).
- **Risk parameters**: Source used up to 4× leverage in the volatility-scaled variant (Sharpe 1.33) vs. 1× fixed size (Sharpe 1.24, 9.7%/yr); recommend starting at 1× fixed size given leverage compounds the unvalidated cost assumptions below.
- **Expected metrics (source, academic_071/074/080)**: 7,668 trades (2007–2024), 43% hit rate (37% in one cross-check write-up, academic_080 — note the discrepancy between sources), 9.7%/yr at 1× (Sharpe 1.24) or 19.6%/yr with vol-scaling and up to 4× leverage (Sharpe 1.33), 12–25% max drawdown depending on sizing. Costs assumed: $0.0035/share + $0.001/share slippage.
- **Known failure modes (source-documented)**:
  - No independent/clean holdout — band, VWAP stop, volatility targeting, and leverage were all selected on the same sample (sequential refinement = overfitting risk).
  - The $0.001/share slippage assumption is called out by researchers as "exceptionally optimistic" (academic_071); real retail slippage on SPY during breakout moments is typically higher.
  - Win rate is low (37–43%) — the strategy depends on a small number of large winners; a live trader may abandon it during a losing streak before the tail wins arrive (behavioral/implementation risk, not in the source but material to real usage).
  - Two independent write-ups of the same underlying paper report different win rates (43% vs 37%) — treat exact metric figures as approximate, not precise.
- **Recommended status**: Forward-test candidate with tight initial size; more implementable than Candidate A because it has a genuine stop-loss mechanism, but still lacks independent out-of-sample validation.

## 4. Rejected Ideas (top-level reasons)

- **Opening + penultimate consensus (SPY 30m, academic_071)** — same underlying signal family as Candidate A (uses the same first-half-hour predictor plus a second confirming leg); rejected as a separate candidate to avoid redundancy/correlated risk within a DT setup slate. Its higher win rate (77%) is a hit-rate artifact from abstaining on disagreement, not a higher-expectancy edge (Sharpe 0.98 < Candidate A's 1.08).
- **All futures cross-market/time-of-day continuation logics (Nikkei, CSI300, Chinese commodities, FTSE/EuroStoxx, MNQ ORB)** — either pre-cost only, statistically weak (t≈1.5), session/roll mechanics not reproducible on a retail OHLCV feed, or explicitly negative (MNQ ORB).
- **All FX fixing-time patterns (European-fix reversal, month-end Fix fade, WM/R post-reform patterns)** — source papers explicitly report negative or insignificant results net of realistic retail spreads/commissions after the 2015 reform; largest and most careful study found no significant reversal in nearly every quarter 2015–2023.
- **All ML/LOB-based logics** — require tick/order-book data, dynamic model retraining, or hundreds of simultaneous constituent feeds; none are reproducible with Pine v6 OHLCV-only, and reported net edges are near zero or negative once thresholded for realistic costs.
- **FOMC-window trades** — best candidate (fade the pre-FOMC move) is in-sample only and crosses the single most illiquid/toxic window of the trading day; a separately-sourced recent replication of a related hold-through-FOMC rule was outright unprofitable (PF 0.86). The academic consensus in this raw file is to *avoid* trading through scheduled releases, not to trade them.
- **5-min ORB variants (QQQ/TQQQ, US-stock-universe with RVOL scan)** — rely on unrealistic same-bar/optimistic fills or a full-market relative-volume scan that cannot run inside a single Pine indicator/strategy script.
- **BTC RSI+Bollinger mean reversion** — explicitly and clearly unprofitable in its own backtest (ROI −21.47%, Sharpe −6.78).

## 5. Source List

- academic_071.md — Gao–Han–Li–Zhou intraday momentum, opening+penultimate consensus, futures return-to-close, SPY Noise-Area breakout
- academic_072.md — Nikkei/US cross-market reversal, NASDAQ crash rebounds, Nasdaq-100 1-min crash reversal, BTC RSI+BB
- academic_073.md — CSI300, Chinese commodity futures, FTSE/EuroStoxx pre-close regression, MNQ ORB (negative)
- academic_074.md — GHLZ momentum (JFE), SPY Noise-Area + VWAP stop, 5-min ORB (QQQ/TQQQ), MNQ ORB (negative)
- academic_075.md — European-fix USD reversal, month-end 5-min Fix fade, S&P month-end hedge-flow momentum
- academic_076.md — WM/R post-2015-reform reversal, first-half fix-window momentum, first-30-second order-flow momentum, peer-reviewed 2015–2023 null result
- academic_077.md — SPY-constituent ML prediction, BTC cost-threshold XGBoost, positional-context PPO
- academic_078.md — Queue-imbalance directional, DeepLOB CNN-LSTM, imbalance-aware market making
- academic_079.md — Legacy pre-FOMC drift, CFTC-steepening pre-FOMC timing, fade-the-move FOMC reversal, negative FOMC replication
- academic_080.md — Brazil/Taiwan base-rate studies, GHLZ momentum, KOSPI consensus, 5-min ORB+RVOL, SPY Noise-Area momentum
