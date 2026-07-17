# Pullback Family — Evidence Synthesis (2026-07-17)

**Scope**: 10 research topics (pullback_031–040), 1 errored (031, Codex timeout — excluded, no data).
**Verdict**: Evidence for the pullback/momentum-continuation family is **mostly weak or negative** on 1–15m bars once realistic costs are applied. Only 2 candidates clear the bar for a DT setup spec, both with significant reservations. This is a **downgraded result (2 of 3 slots filled)** — the family does not support a third defensible candidate.

---

## 1. Ranking Table

| # | Logic | Market / TF | Grade | Key metric (source) | Verdict |
|---|-------|-------------|-------|----------------------|---------|
| 1 | Stationary Bollinger breakout (negative control) | CSI300 futures, 15–60s | **A** | Best variant: 50.79% WR, Sharpe 2.33 gross — **all 72 variants lost money after exchange costs** (arXiv:1710.07470) | Negative — demonstrates cost destruction, not usable |
| 2 | 83 Japanese candlestick continuation rules | DJIA-30, 5m | **A** | 26–27/83 rules significant gross; **0/83 beat buy-and-hold after 5bp + Bonferroni** (SSRN 2125889) | Negative |
| 3 | SPY 1-min RSI(14) reversal | SPY, 1m | **A** | Only 2% of 3,582 trades profitable after $1/trade fee; gross ≈ +$16.70 (ResearchGate 339897193) | Negative — near-zero gross edge |
| 4 | Market Intraday Momentum (time-of-day, adjacent) | SPY, 30-min decision | **A** | Sharpe 1.08 (1993–2013), Sharpe 1.00 post-2005 w/ real spreads (JFE, S0304405X18301351) | Real edge but **not a pullback entry** — single directional bet at 15:30, no discrete pullback trigger. Excluded from this family's candidates. |
| 5 | ATB + 15m FVG filter | NQ/MNQ, 15m+5m | **A** (code+data) | PF 3.08, n=78, +$7,306 (GitHub, prashanthaitha24/nq-atb-bot-archived) | High overfit risk — n=78, day-of-week/gap/FVG-distance filters selected on same sample, 3-commit repo |
| 6 | RTH Confluence ATR Pullback | MNQ, 5m | B | OOS 196 trades: +11.82pt avg, t=3.11 (arXiv 2605.04004) | Not reproducible — GMM regime/Markov transition model undisclosed |
| 7 | QQQ VWAP + RSI(2) Pullback | QQQ, 5m | B | 312 trades, WR 52.6%, PF 1.54, +$11,230, $0.02/share costed (pinegen.ai) | **Selected as Candidate 1** — fully disclosed rules, but no code/trade-log, no OOS, session-filter subset (9:45–11:30, PF 2.08) is in-sample cherry-pick |
| 8 | Sunrise Ogle 1–3 candle pullback | XAU/USD, 5m | B | 175 trades, WR 55.43%, PF 1.64, Sharpe 0.892, DD 5.81% (GitHub, ilahuerta-IA) | **Selected as Candidate 2** — code+5yr CSV available, but single market/parameter set, no OOS, README/code ATR-multiplier mismatch |
| 9 | USA500 BB extreme pullback + 30m trend | USA500 CFD, 1m | B | 162 trades, WR 40.74%, PF 1.30, avg trade 1.3bp | Rejected — average trade too small to survive any retail spread |
| 10 | BTC/ETH RSI+BB oversold | BTC/ETH, 5–15m | B | PF 0.82–0.91, all net negative (coinquant.ai) | Rejected — negative PF |
| 11 | Session-VWAP Pullback Continuation | NQ/ES/YM, 5m | B | PF 1.01–1.11, no cost disclosed (fractiz.com) | Rejected — PF too close to 1.0 pre-cost |
| 12 | EMA100 + daily VWAP pullback | BTC, 5–15m | B | PF 0.22–0.37, WR 11–15% (strategyverdict.com) | Rejected — strong negative result |
| 13 | Automatic 1-2-3 trend activation | FX/DAX/Gold/Oil, 10m | B | P2-breakout rate 42–52%, no PF/cost (Tandfonline / arXiv 1409.5321) | Rejected — near coin-flip, no PF |
| 14 | MNQ ORB Pullback (5pt retest) | MNQ, 5m | B | 83 trades, WR 19.3%, avg −4.44pt (arXiv 2605.04004) | Rejected — clear negative |
| 15 | DAX ORB Retest | DAX CFD, 15m | B | 64 trades, PF 0.51, −330pt (warchhold.com) | Rejected — clear negative |
| 16 | 5min ORB Retest (large-cap US) | AAPL/META/NFLX/NVDA/TSLA, 1m | B | 55 trades, WR 40%, PF 0.71–1.01 all losing (whatdoesntwork.com) | Rejected — negative, tiny sample |
| 17 | Dynamic EMA Filter Flag | DJIA futures, 15m | A (peer-reviewed) | 1,751 trades, +286% cumulative, 4,224-rule template search (riunet.upv.es) | Rejected — not a simple pullback; requires 10×10 template matching + quarterly re-optimization, not portable to a static Pine rule |
| 18 | 5min signal + 15min agreement (MTF) | ETH/USDT, 5m+15m | B | MTF: 9 trades, PF 0.722, p=0.687 vs single-TF PF 0.106 | Rejected — MTF "improvement" is still PF<1, n=9 |
| 19 | 15m Opening Range + 5m breakout (MTF) | NQ/ES/YM, 15m+5m | B | NQ PF 1.07, ES PF 1.02, YM PF 0.91, no cost disclosed | Rejected — PF ~1, no costs |
| 20 | Time-of-day Volatility-Band Momentum | SPY, 1m/30m decision | B | Sharpe 1.33 (1.17 w/ impact), degraded to ~+1% in 2025 (concretumgroup.com) | Rejected from this family — band-breakout, not pullback; also documented performance decay |
| 21 | 0.5×ATR Session-Open Breakout | SPY, 15m | B | CAGR 13%+, Sharpe 0.87, no trade count/PF/slippage | Rejected — insufficient detail, breakout not pullback |
| 22 | Asia Expansion Continuation | MNQ, 5m | B | All thresholds negative, WR 35.5–48.5% | Rejected — negative |
| 23 | KOSPI last-30-min momentum | KOSPI, 30m | A | WR 66.81% buy-only, Sharpe 0.291 | Rejected from family — not pullback, not directly tradable (index), no OOS |
| 24 | Triple-confirmed divergence | NASDAQ-100, 15m | C | Sharpe 2.99, 1,116 trades, no WR/PF/cost | Rejected — insufficient disclosure |
| 25 | MNQ volume-spike momentum | MNQ, 5m | B | Net losses both directions, t≈0.07/−0.64 | Rejected — negative |
| 26 | Keltner centreline pullback | S&P 500 stocks | C | Marketing claims, no trades/code/data | Rejected — unverifiable |

---

## 2. Selected Candidates

### Candidate 1: VWAP + RSI(2) Pullback Continuation

- **Evidence grade**: B (single-source, disclosed rules, costed, no code/trade-log, no OOS)
- **Source**: pullback_036, citing https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest — QQQ, 5-minute, Jan 2024–Jun 2025, 312 trades, WR 52.6%, PF 1.54, net +$11,230 after $0.02/share round-trip cost.
- **Markets**: QQQ-proxy futures/CFDs with tight spreads (NQ/MNQ preferred for a Pine strategy since QQQ itself is an ETF); also testable on ES/SPY given VWAP+RSI(2) is instrument-agnostic. Evidence is QQQ-only — **treat other markets as untested extrapolation**.
- **Timeframe**: 5-minute.
- **Entry rule (long)**:
  1. Session VWAP is rising (VWAP[0] > VWAP[3], i.e., positive slope over last 3 bars) and price has closed above VWAP for 3 consecutive bars prior to the pullback.
  2. Price pulls back and touches/crosses within 0.15% of VWAP (`abs(close - vwap) / vwap <= 0.0015`).
  3. RSI(2) < 25 at or near the touch bar.
  4. Next bar closes back above VWAP (confirms the bounce) → enter at that bar's close, or next bar open for realistic fill.
  - Short is the mirror: VWAP falling, 3 closes below VWAP, RSI(2) > 75 at touch, next bar closes back below VWAP.
- **Exit rule**:
  - Stop: 1.5 × ATR(14) from entry.
  - TP1: prior day's high (long) / prior day's low (short). If already broken intraday, TP1 = 2 × ATR(14).
  - TP2: none specified in source — recommend trailing remainder to VWAP re-cross as TP2 proxy (not backtested; flag as extrapolation).
  - Time exit: flatten at 15:00 ET if neither stop nor target hit.
- **Filters / session**: Trade only 09:45–15:00 ET (skip first 15 minutes). Max 1 signal per direction per session (2 total/day) per source's design.
- **Risk parameters**: Source used $0.02/share round-trip cost only — no explicit position sizing; use fixed fractional risk (e.g., 0.5–1% equity per trade) via stop distance.
- **Expected metrics (source, unverified independently)**: WR 52.6%, PF 1.54, 312 trades over ~18 months, cost-adjusted.
- **Known failure modes**:
  - The best-performing sub-window (09:45–11:30, WR 62.4%, PF 2.08) was discovered on the same sample used for full-period stats — near-certain in-sample cherry-pick; do not expect the higher figure live.
  - No out-of-sample test, no published trade log or code — cannot independently verify the 312-trade result.
  - $0.02/share may understate real slippage on MNQ/NQ tick-size instruments; re-cost before trusting PF 1.54.
  - VWAP-touch + RSI(2) mean-reversion logic is structurally similar to several other candidates in this sweep that failed after cost (BTC/ETH RSI+BB variants, PF 0.82–0.91) — treat this as an unconfirmed outlier until independently replicated.

### Candidate 2: EMA-Cross Micro-Pullback with ATR Stop/Target (Sunrise-Ogle style)

- **Evidence grade**: B (code + 5-year CSV published, but single market, no OOS, internal doc/code mismatch)
- **Source**: pullback_034, citing https://github.com/ilahuerta-IA/backtrader-pullback-window-xauusd — XAU/USD, 5-minute, Jul 2020–Jul 2025, 175 trades, WR 55.43%, PF 1.64, Sharpe 0.892, max DD 5.81%, net +44.75%.
- **Markets**: XAU/USD (gold CFD/futures) only — this is the only market tested; do not assume transfer to equity index futures without re-validation.
- **Timeframe**: 5-minute.
- **Entry rule (long)**:
  1. EMA(1) crosses above the EMA cluster (EMA14/EMA24) confirming a fresh up-move, with price and EMA100 slope/angle and ATR filters satisfied (exact angle/ATR thresholds not published — must be calibrated during Pine implementation; treat defaults as placeholders, not validated values).
  2. Wait for 1–3 consecutive down-candles (the pullback) without breaking the swing low that defines the up-move's channel.
  3. Enter on a break of the "saved channel high" (the high of the pullback candles) — stop order or next-bar confirmation.
  - Short is the mirror: EMA(1) crosses below cluster, wait for 1–2 up-candles, enter on break of channel low.
- **Exit rule**:
  - Stop: entry-bar low − 2.5 × ATR (source's README figure; the linked code reportedly uses a different ATR multiplier — **resolve this discrepancy before trusting either number**, treat as unverified).
  - TP1: partial at entry price + 1× the initial risk (1R) — not explicitly specified by source; this is a DT-contract-compatible extrapolation, not a backtested figure.
  - TP2 (source's full target): entry-bar high + 12 × ATR — very wide target relative to a 2.5×ATR stop; verify this ratio makes sense for your risk model before use.
  - Risk: 1% of equity per trade (as reported by source).
- **Filters / session**: Source allows an optional time filter but does not mandate one; for a DT setup, restrict to London/NY overlap (08:00–17:00 ET) to align with XAU/USD's typical liquidity window (not directly tested in source — extrapolation).
- **Risk parameters**: 1% equity risk per trade (source-stated), single position at a time, no explicit max-trades/day in source — recommend capping at 3–4 signals/day for a DT max-signals gate.
- **Expected metrics (source, unverified independently)**: 175 trades over 5 years, WR 55.43%, PF 1.64, Sharpe 0.892, DD 5.81%, +44.75% cumulative.
- **Known failure modes**:
  - No out-of-sample period — the entire 5-year window is (implicitly) in-sample for parameter selection; overfitting risk is unaddressed.
  - README and repo code reportedly disagree on the ATR stop multiplier — do not deploy until this is reconciled against the actual code, not the README.
  - No confirmed commission/slippage implementation found in the code by the researcher — "coded but unverified" cost modeling; treat the reported PF/Sharpe as an upper bound.
  - Single instrument (XAU/USD) — no cross-market validation exists in this sweep.

---

## 3. Rejected Ideas (summary reasons)

See ranking table rows 1–3, 5–26 for the full list. Grouped reasons:

- **Cost destroys the edge**: CSI300 Bollinger (all 72 variants), 83 candlestick rules (0/83 beat B&H after 5bp), SPY 1m RSI reversal (2% profitable after $1 fee), USA500 BB pullback (1.3bp avg trade).
- **Net negative after cost**: BTC/ETH RSI+BB (PF 0.82–0.91), EMA100+VWAP pullback (PF 0.22–0.37), MNQ ORB pullback (WR 19.3%), DAX ORB retest (PF 0.51), 5min ORB retest large-caps (PF 0.71–1.01, all losing), Asia Expansion Continuation (all thresholds negative), MNQ volume-spike momentum (net losses).
- **PF too close to 1 / no cost disclosed**: Session-VWAP Pullback Continuation (PF 1.01–1.11), 15m ORB+5m breakout MTF (PF 0.91–1.07), 0.5×ATR Session-Open Breakout (metrics incomplete).
- **Not reproducible in Pine v6**: RTH Confluence ATR Pullback (undisclosed GMM/Markov regime model), Dynamic EMA Filter Flag (4,224-rule template search + quarterly re-optimization), Triple-confirmed divergence (missing pivot/exit parameters), Keltner centreline pullback (no code/data at all — marketing claims).
- **Not actually a pullback entry** (excluded from this family despite good evidence): Market Intraday Momentum (SPY, Grade A, Sharpe 1.08–1.00) is a single time-of-day directional bet, not a discrete pullback trigger; Time-of-day Volatility-Band Momentum and KOSPI last-30-min momentum are similarly time-of-day/breakout constructs, not pullbacks.
- **Overfitting / tiny sample flagged explicitly by researcher**: ATB+15m FVG filter (PF 3.08 but n=78, same-sample filter selection, 3-commit repo), MTF ETH signal agreement (n=9, PF 0.722, p=0.687 — not significant).

---

## 4. Source List

- arXiv:1710.07470 — CSI300 Bollinger negative control (Grade A)
- SSRN 2125889 — 83 Japanese candlestick rules, DJIA-30 (Grade A)
- ResearchGate 339897193 — SPY 1-min RSI reversal (Grade A)
- JFE S0304405X18301351 — Market Intraday Momentum, SPY 30-min (Grade A)
- GitHub prashanthaitha24/nq-atb-bot-archived — ATB+15m FVG, NQ/MNQ (Grade A, code+data)
- arXiv:2605.04004 — RTH Confluence ATR Pullback, MNQ ORB Pullback, Asia Expansion Continuation, MNQ volume-spike momentum (Grade B, MNQ 5m walk-forward suite)
- pinegen.ai — QQQ VWAP+RSI(2) Pullback (Grade B) — **Candidate 1 source**
- GitHub ilahuerta-IA/backtrader-pullback-window-xauusd — Sunrise Ogle XAU/USD pullback (Grade B, code+CSV) — **Candidate 2 source**
- gist.github.com/kumrzz — USA500 BB extreme pullback (Grade B)
- coinquant.ai — BTC/ETH RSI(14), RSI+BB, 1-min Bollinger snap-back strategies (Grade B)
- fractiz.com — Session-VWAP Pullback Continuation, 15m ORB+5m breakout MTF (Grade B)
- strategyverdict.com — EMA100+daily VWAP pullback, BTC (Grade B, negative)
- Tandfonline 10.1080/14697688.2013.814922 + arXiv:1409.5321 — Automatic 1-2-3 trend activation (Grade B)
- warchhold.com — DAX ORB Retest (Grade B, negative)
- whatdoesntwork.com — 5min ORB Retest large-cap US (Grade B, negative)
- riunet.upv.es — Dynamic EMA Filter Flag, DJIA futures (Grade A, peer-reviewed)
- SSRN 6683818 — 5m+15m MTF agreement, ETH/USDT (Grade B, negative)
- concretumgroup.com (2 PDFs) — Time-of-day Volatility-Band Momentum, 0.5×ATR Session-Open Breakout, SPY (Grade B)
- MDPI 1911-8074/15/11/523 — KOSPI last-30-min momentum (Grade A, not tradable directly)
- quantmarketlab.com — Triple-confirmed divergence, NASDAQ-100 (Grade C)
- tradealgo.com — Keltner centreline pullback (Grade C, marketing)
- babypips.com — Short-Term Bollinger Reversion 2.0, USD/CAD (Grade B)
- pinescriptforge.com — 9-EMA Micro Pullback Scalp (NQ, Grade C), Heikin-Ashi color-change+EMA50 (Grade C)
- SSRN 6977700 — walk-forward cost-adjusted S&P intraday mean-reversion (near-zero deflated Sharpe)
- mql5.com/en/articles/17636 — US500 CFD RSI(2) 30m (Grade C, insufficient)
- reddit.com/r/algotradingcrypto — ORB-Fib 61.8% pullback, BTC/ETH/SOL (Grade C, execution-sensitive)
- SSRN 4729284 + quantconnect.com research/18444 — 5min ORB+Relative Volume, US equities (Grade B)
- wiley.com 10.1002/fut.22375 — Market Intraday Momentum out-of-sample decay replication
