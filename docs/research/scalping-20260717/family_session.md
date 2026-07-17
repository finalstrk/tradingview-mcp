# Session / Time-of-Day Family — Synthesis

**Family**: session
**Date**: 2026-07-17
**Inputs**: session_061, session_062, session_063, session_064, session_065, session_067, session_068, session_069 (session_066, session_070 errored/timed out, no data)

## Overall Assessment

This family is dominated by negative or non-actionable evidence. Every Grade-A academic result that shows a real statistical pattern (European fix reversal, EUR/USD regional drift, Ranaldo day-of-week reversal, Gao–Han–Li–Zhou close momentum, overnight-gap jump-diffusion reversion) either (a) explicitly reports the edge is negative or near-zero after realistic retail spread/commission, (b) requires cross-sectional stock-selection or fix/VWAP execution that cannot be replicated from single-symbol OHLCV, or (c) is built on 1990s–2000s interdealer data with no evidence the pattern survives in the current market (and in the one case where researchers re-ran it on 2021–2026 data — session_068 — it came back negative). The Grade-B/C candidates that do have discrete SL/TP structure suitable for a DT setup contract (opening-range breakouts, Asian-range breakouts) mostly fail on tiny out-of-sample windows (4 months, 19 trades, single month), heavy parameter search (4,947+ combinations in one thesis), or PF barely above 1.0 with no cost robustness. Only one candidate — the USD/JPY Asian-range breakout — has a multi-year, reasonably sized out-of-sample test (2022–2026, 1,012 trades) with a fixed stop and positive PF net of stated costs, and even that candidate carries real red flags (non-reproducible code/data, an internal reporting contradiction in the source, and a PF that is only marginally above break-even once costs are doubled). Everything else in this family is rejected.

## Ranking Table

| Logic | Source | Grade | Market/TF | Key metric | Verdict |
|---|---|---|---|---|---|
| European Fix Reversal | 061, 064 | A | G9 FX, 5m (fix-timed) | Win 55-56% pre-cost; retail liquidity-demander −0.98 to −7.34bp/day (t up to −7.72) | REJECT — proven negative post-cost |
| Timely Opening Range Breakout (TORB) | 062 | A | ES/NQ/YM, 1m | 8.95%/17.51% annual 2001-13; ES 2007-13 subsample insignificant | REJECT — no stop, decayed, no modern OOS |
| EUR/USD Regional Drift | 064 | A | EUR/USD, 1h | Sharpe 1.3/0.9, 1997-2007, no stop, no PF | REJECT — 20+yr old interdealer data, no risk mgmt |
| Ranaldo Day-of-Week Session Reversal | 065 | A | EUR/USD etc., 4h hold | 19.48%/yr Mon EUR/USD, breakeven cost 18.7 pips vs 2.9 pip spread, 1993-2005 | REJECT — no stop, no OOS, 20+yr old, multiple-testing across days/pairs |
| Weekend Gap Reversal (FX) | 065, 069 | A | 16 FX pairs, weekly | 10.4%/yr NZD/USD max; 2007-14 OOS | REJECT — weekly hold, not scalping; no per-trade stop |
| Jump-Diffusion Overnight-Gap Reversion | 067 | A | S&P500 stocks, 1m | Sharpe 2.38, 984-stock cross-section, 1998-2015 | REJECT — needs cross-sectional universe/market-neutral book, not single-symbol OHLCV |
| SPY Overnight-to-10:00 Reversal | 067 | B | SPY, 1-15m | Win 50.67% net, Sharpe 0.94, 1996-2024, author reports post-2010s decay | REJECT — no stop, thin/decaying edge |
| Gao–Han–Li–Zhou Close Momentum | 068 | A (hist.) / B (modern) | SPY, 30m | 6.67%/yr 1993-2013; but 2021-2026 replication: SPY −0.55bp/day (t=−2.3), IWM −26.6% | REJECT — modern OOS explicitly negative |
| 06:00–08:15 GBP/USD Range Breakout | 061 | B | GBP/USD, M15 | OOS 56 trades, PF 1.73, win 39.3%, 4-month window | REJECT — OOS too small, optimized SL/TP (80/226p) |
| EMA-Filter Night Range Breakout | 061 | B- | GBP/USD, M15 | OOS 56 trades, PF 2.67, win 71.4% | REJECT — selected from 4,947+ parameter combos, spec mismatch in source |
| NY Opening Range Break (MNQ) | 062, 064 | B | MNQ, 5m | Long-15bar 447 trades, win 55.5%, t=1.50 (not significant), no PF | REJECT — statistically insignificant, no price-based stop in base rule |
| FX Overlap 15m ORB | 064 | B | EUR/USD etc., 15m | 187 trades, PF 0.42, −38.43R | REJECT — clearly unprofitable even with modest costs |
| Asia Breakout Retest (Brno) | 063 | B | EUR/USD, NAS100 | PF 0.70-1.28, mostly negative years | REJECT — negative in most years, costs excluded |
| GBP/USD London Breakout (TV post) | 061, 063 | C | GBP/USD | PF 1.74, 19 trades, 1 month | REJECT — sample far too small |
| ICT 10:00 NY Reversal | 067 | C | Feeder Cattle | PF 2.04, 760 trades, but rule not formalized | REJECT — non-reproducible, unformalized rule |
| 13-pip FX Gap Fade | 069 | C | EUR/USD etc. | "~80% win" claimed, no PF/costs/OOS | REJECT — no verifiable data |
| BTC CME Gap Fill | 069 | C | BTC | "~77% eventual fill" | REJECT — no stop, structurally obsolete since 24/7 CME trading (2026-05-29) |
| **USD/JPY Asian-Range Breakout** | 063 | B | USD/JPY, 1m signal / range 01:00-04:00 UTC | PF 1.16, 1,012 OOS trades (2022-2026), PF 1.08 at 2x costs | **CANDIDATE (weak, provisional)** |

## Candidate Specs

### 1. USD/JPY Asian-Range Breakout (weak/provisional — forward-test only)

- **Evidence grade**: B (single non-peer-reviewed source, code/data not public, internal reporting contradiction noted below)
- **Source**: YuRa Trading blog, https://yuratrading.com/blogs/range-breakout (session_063)
- **Market**: USD/JPY only. The identical rule tested on EUR/USD failed (PF 1.00, 30.1% win rate, −72.5% max DD) — do not generalize across pairs.
- **Timeframe**: 1-minute signal bars (range measured on sub-hourly closes); entries on next-bar open.

**Entry rule**:
- Measure the high/low of the 01:00–04:00 UTC range (Asian session).
- If a 1-minute close prints outside the range (above high or below low), enter in the breakout direction at the next bar's open.
- Direction: long on upside close-break, short on downside close-break.
- Max 1 signal/day (first qualifying breakout only; no re-entry same session).

**Exit rule**:
- Stop-loss: opposite end of the measured Asian range (i.e., range high/low acts as the stop for the opposite trade — a full-range stop, not a tight ATR stop).
- Take-profit / time exit: fixed afternoon exit time (exact clock time not disclosed in source — must be reconstructed/re-optimized during Pine implementation and validated against fresh data before use). No TP1/TP2 split is defined in the source; a DT implementation should add TP1 at 1R (partial) and TP2 at time-exit to stay within the DT contract, but this is an addition, not evidence-backed.
- No explicit R-multiple SL/TP structure reported — this is the weakest part of the spec and needs re-derivation.

**Filters / session**: Asian range must be measured 01:00–04:00 UTC only; USD/JPY only; 1 trade/day cap.

**Risk parameters**: Source uses $3.50/lot round-trip; PF held up (1.08) even at $8.50/lot (2.4x costs) — modest cost cushion, not a wide margin.

**Expected metrics (source)**: OOS 2022–2026, 1,012 trades, win rate 45.75%, PF 1.16, $10,000→$20,230, max DD 23.7%.

**Known failure modes**:
- Source reports Monte Carlo drawdown stats on two different trade counts (1,012 vs 283) with contradictory "ruin rate" figures (4% vs 0%) — internal inconsistency not resolved in the raw material.
- Currency pair was selected as the winner between only two tested pairs (USD/JPY vs EUR/USD) — meaningful selection bias.
- No independent replication; no public backtest code or tick-level data to verify slippage/fill assumptions.
- PF 1.08–1.16 is thin; a further doubling of realistic execution costs (spread widening in low-liquidity Asian session, weekend/holiday gaps) could flip it negative.
- Time-based exit clock and exact stop/TP structure are underspecified for a DT-contract implementation — must be pinned down and re-tested before any live use, ideally as forward paper-trading only.

**Recommended status**: Do not adopt directly. Suitable only as a forward-test/replay candidate under `journal/registry.json` with `status: "candidate"`, not `"adopted"`, pending an independent re-backtest against current broker OHLCV.

## Rejected Ideas (with reasons)

- **European Fix Reversal (Grade A, Journal of Finance)** — the strongest academic evidence in the whole family, but the paper itself demonstrates the pattern is negative for retail liquidity-demanders after realistic bid/ask (−0.98 to −7.34 bp/day, t up to −7.72). Rejecting a Grade-A result on its own stated conclusion, not on implementation grounds.
- **TORB, EUR/USD Regional Drift, Ranaldo Reversal, Weekend Gap Reversal** — all Grade A but have no per-trade stop-loss (time-based decay/holds only), predate modern market structure by 15–30 years, and none report a walk-forward/holdout OOS test distinct from the discovery sample. Not compatible with a discrete SL/TP1/TP2 DT contract without inventing risk parameters the original research never tested.
- **Jump-Diffusion Overnight-Gap Reversion** — genuinely strong (Sharpe 2.38, explicit survivorship-bias control) but requires ranking and holding ~10 of 984 stocks market-neutral simultaneously; cannot be expressed as a single-symbol Pine v6 OHLCV setup.
- **Gao–Han–Li–Zhou Close Momentum** — the one case in this family with an actual modern out-of-sample re-test (2021–2026), and it came back negative (SPY −0.55bp/day, IWM −26.6% cumulative). Textbook evidence of alpha decay; do not deploy.
- **All breakout theses from Brno VUT (06:00-08:15 GBP breakout, EMA-filter breakout, Asia Breakout Retest)** — OOS windows of 4 months / 56 trades, or parameter selection from 4,000+ combinations. Classic overfitting signature; win rates/PF too fragile to trust.
- **NY Opening Range Break (MNQ)** — t=1.50 is not statistically significant at conventional thresholds; year-to-year instability noted directly in the source.
- **FX Overlap 15m ORB** — outright unprofitable (PF 0.42) even under the study's own cost assumptions. No case for adoption.
- **10:00 ET reversal candidates (SPY overnight-to-10:00, ICT NY reversal)** — SPY version has a real but very thin and decaying edge with no stop; ICT Feeder Cattle version is not mathematically formalized and has non-reproducible backtest claims.
- **13-pip Gap Fade, BTC CME Gap Fill** — Grade C, forum/blog claims with no PF, no cost accounting, no OOS. BTC gap trade is additionally structurally dead since CME crypto futures went 24/7 on 2026-05-29.

## Source List

- session_061.md — European Fix Reversal (Journal of Finance, https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13306); GBP/USD breakout theses (VUT theses, https://www.vut.cz/www_base/zav_prace_soubor_verejne.php?file_id=101749, file_id=106061); TradingView London breakout post
- session_062.md — TORB (IEEE Access, https://doi.org/10.1109/access.2019.2899177); Opening-price strangle (DiVA, https://www.diva-portal.org/smash/get/diva2%3A732318/FULLTEXT02.pdf); MNQ ORB falsification (arXiv, https://arxiv.org/pdf/2605.04004); Fractiz ORB backtest; Reddit ORB+FVG test
- session_063.md — USD/JPY & EUR/USD Asian breakout (YuRa Trading, https://yuratrading.com/blogs/range-breakout); Brno Asia Breakout Retest thesis (https://dspace.vut.cz/server/api/core/bitstreams/e6ccf939-cdf8-4ecc-a34c-16cd87460ca7/content); TradingView GBP/USD post
- session_064.md — EUR/USD Regional Drift (SNB/JMCB, https://c.mql5.com/forextsd/forum/205/working_paper_2011_04.n.pdf); European Fix Reversal (as above); NY ORB MNQ (ResearchGate, https://www.researchgate.net/publication/404476167); FX overlap 15m ORB (Fxglory)
- session_065.md — Ranaldo day-of-week reversal (SNB, https://www.snb.ch/public/asset/de/www-snb-ch/publications/research/working-papers/2007/working_paper_2007_03/publications0/working_paper_2007_03.n.pdf); Weekend gap reversal (Dao et al., https://irep.ntu.ac.uk/35555/1/13113_Dao.pdf); EBS session effect (AEA, https://www.aeaweb.org/conference/2009/retrieve.php?pdfid=301)
- session_067.md — Jump-diffusion overnight-gap reversion (MDPI, https://www.mdpi.com/1911-8074/12/2/51); SPY overnight-to-10:00 (SSRN, https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5807282); ICT NY reversal (Pine Script Forge); S&P futures gap continuation/reversal (JBF, https://www.sciencedirect.com/science/article/pii/S0378426604000949)
- session_068.md — Gao–Han–Li–Zhou close momentum (JFE, https://www.sciencedirect.com/science/article/pii/S0304405X18301351); APAC replications (Monash, https://researchmgt.monash.edu/ws/files/519509174/494419119_oa.pdf; Australia, https://www.sciencedirect.com/science/article/abs/pii/S0927538X21000068); modern replication (Vortex Capital, https://www.vortexcapitalgroup.com/insights/the-1pm-echo-treasury-auctions-are-the-last-living-signal-on-the-half-hour-clock; Wiley futures OOS, https://onlinelibrary.wiley.com/doi/abs/10.1002/fut.22375)
- session_069.md — FX weekend gap reversal (Dao et al., as above); 13-pip gap fade (Forex Factory); BTC CME gap fill claims (Zoomex, TradingView script); CME 24/7 crypto notice (https://www.cmegroup.com/markets/cryptocurrencies/24-7-crypto-trading.html); BTC intraday day-of-week null result (FRL, https://www.sciencedirect.com/science/article/pii/S1544612319301710)
