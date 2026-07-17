# Squeeze Family Synthesis — Volatility Compression / Breakout

**Family:** squeeze (volatility compression)
**Date:** 2026-07-17
**Topics reviewed:** squeeze_041, squeeze_043, squeeze_044, squeeze_047, squeeze_048, squeeze_049, squeeze_050
**Topics unusable (Codex timeout, no analysis body):** squeeze_042, squeeze_045, squeeze_046

---

## 1. Overall Assessment

The "squeeze" label covers a mix of genuinely distinct ideas across the seven usable raw files: NR7/inside-bar compression breakouts, VIX/ATR volatility-regime filters, ATR-based dynamic sizing, opening-range breakouts (ORB), and intraday seasonality/momentum clustering. **The core compression-breakout hypothesis — "a narrow-range or inside bar predicts a tradable directional move" — is not supported.** The most direct test (squeeze_041, EMA-direction inside-bar breakout on ES, 4,107 trades) shows a 37.33% win rate with an implied profit factor of 0.60, a clear loser; even the best post-hoc subset (widest 25% of inside bars, n=167) only reaches PF≈1.11, too thin to survive commissions and breakout slippage. ATR-percentile breakout on ES (squeeze_043 #2) is Grade C with no OOS. ATR-based dynamic position sizing (squeeze_048) has no evidence of adding expectancy independent of entry-selection quality — the one "Grade A" TQQQ result confounds a stop-loss change with a target change and is fully in-sample.

Two adjacent ideas surface much stronger evidence, but neither is really a compression signal:

- **Intraday momentum continuation into the close ("close ramp")** is Grade A, peer-reviewed (Journal of Financial and Economic literature-tier: JFE), and replicates across 46 years and 17 global index futures plus a separate SPY sample (1993–2013). This is the single best-evidenced logic surfaced anywhere in the squeeze_04x batch.
- **Percentile noise-band breakout** (price exits a rolling historical-move envelope) is the one candidate that is conceptually closest to "compression → breakout," has an actual walk-forward OOS split (Sharpe 0.94 OOS vs 1.18 in-sample), and is Grade B.

ORB (opening-range breakout) also appears repeatedly in this batch (squeeze_043, _044, _048, _049), but ORB already has its own dedicated family synthesis (`family_orb.md`) with a full ranking table and explicit negative walk-forward falsification (MNQ, 2021–2025, all 14 tested variants fail after realistic 2-point round-trip cost). To avoid duplicating that work, ORB variants are **not** re-selected as candidates here — see §4 for the cross-reference and the squeeze-batch evidence that reinforces `family_orb.md`'s skepticism (squeeze_044 and squeeze_049 both cite the same MNQ falsification paper).

**Net verdict for this family: mostly weak-to-negative.** Genuine compression/NR7/inside-bar logic should not be traded as scanned. Two candidates are selected below, both flagged for what they really are (momentum/noise-breakout, not squeeze) and both carry real caveats (thin OOS R², overfitting risk, parameter fragility).

---

## 2. Ranking Table

| # | Logic | Source topic(s) | Grade | Market/TF | Key metric | Cost-adjusted? | OOS? | Verdict |
|---|-------|------------------|-------|-----------|------------|-----------------|------|---------|
| 1 | Market Intraday Momentum (close-ramp continuation) | squeeze_047, squeeze_050 | A | SPY 30m / 17 global index futures 30m | SPY: 54.37% win, 6.67%/yr, Sharpe 1.08 (6.52%/yr post-cost). Futures: Sharpe 1.73, 6.86%/yr, 55% win | Partial (spread-based, not full retail) | Yes, recursive/expanding-window; SPY OOS R²=1.2%, futures OOS R²≈2.8% | Strongest evidence in batch; thin explanatory power (R²<3%) means edge is real but small |
| 2 | Percentile Noise-Area Momentum (ES/NQ) | squeeze_043 #3 | B | ES/NQ 5m | 3,847 trades, 54.3% win, PF 1.64, Sharpe 0.94 OOS (1.18 IS), MDD 16.4% | Yes ($4.20 RT + 1 tick) | Yes, 365d train/90d OOS rolling | Best OOS discipline of any squeeze-batch logic; degrades sharply to Sharpe 0.64 at 2-tick slippage — fragile |
| 3 | SPY Noise-Boundary Momentum (1-min noise band) | squeeze_044, squeeze_047, squeeze_050 (same underlying paper) | B | SPY 1m | 7,668 trades, 43% daily hit, CAGR 19.6%, Sharpe 1.33, MDD 25% | Yes ($0.0035/sh + $0.001/sh slippage) | No independent OOS; 2025 update shows return decayed to ~+1% | Same noise-band concept as #2 but no genuine holdout; researcher flags heavy iterative/leverage-selection overfitting |
| 4 | Timely ORB (TORB) | squeeze_049 | A (peer-reviewed) | Index futures 1m | 8.95–20.28%/yr across 5 markets, p<3% | Optimistic (0.01%/trade) | No — probe times chosen in-sample | See `family_orb.md`; not re-selected here |
| 5 | MNQ ORB walk-forward falsification | squeeze_044, squeeze_049 | B (negative finding) | MNQ 5m | All 14 OHLCV breakout/momentum variants fail after 2-pt RT cost; best long variant t=1.50, unstable by year | Yes | Yes, expanding-window | Important negative control against ORB and against "compression→breakout" generally |
| 6 | Stocks-in-Play 5-min ORB (RVOL top-20) | squeeze_044, squeeze_048, squeeze_049, squeeze_050 (same SSRN paper, cited 4x) | B | ~7,000 US equities 5m | 41.6%/yr, Sharpe 2.81, 48.4% win, MDD 12% | Commission only, no spread/slippage/borrow | No | Not Pine-implementable (needs live cross-sectional top-20 RVOL ranking across the whole market); negative control (no filter) drops to 3.2% CAGR / Sharpe 0.48 |
| 7 | VIX Futures EOD 30-min Momentum | squeeze_043 #4 | A (peer-reviewed, JBF) | VIX futures 30m | 21.78%/yr post-cost, Sharpe 1.16 (34.61% in high-VoV regime) | Yes | Implied by robustness tests | Rigorous but VIX-futures specific; not a win-rate/scalp result and not transferable to equity/FX scalping |
| 8 | ATR-managed MACD trend/reversal | squeeze_048 | A (peer-reviewed, low rigor) | FX/gold/oil/BTC 1h | 59–162 trades/asset, no WR/PF disclosed | Yes | No | 1h timeframe, not 1–15m scalp; heavy pre-selection over MACD variants |
| 9 | Nifty 30-min ORB | squeeze_049 | B | Nifty 50 15m | 2,122 trades, 48.7% win, PF 1.23, +91.6% | No | No | See `family_orb.md`; PF 1.23 with no costs is thin |
| 10 | VIX/ATR-filtered 15-min ORB (Volatility Box) | squeeze_043 #1 | B (vendor, unaudited) | ES/NQ 15m | 58–62% win, R:R 1.8 | Undisclosed | No | Numbers implausibly good for the disclosure level; treat as marketing, not evidence |
| 11 | TQQQ 5-min ORB + ATR risk-normalized sizing | squeeze_048 | A (code available, but fully in-sample) | TQQQ 5m | 93%/yr claimed, 9,350% total (2016–2023) | Minimal (no slippage) | No | Confounds SL and TP changes; author's own OOS not disclosed; implausible at stated tick economics |
| 12 | Directional Main-Bar Inside-Bar Continuation | squeeze_041 #3 | B | XAUUSD/EURUSD/SP500 M15/H1 | XAUUSD H1: PF 1.43, RF 1.51; other markets unstable | No | Weak (only EURUSD M15 claimed stable, undisclosed detail) | Multi-market/multi-param search survivor; reproducibility poor |
| 13 | NR7 + Inside Bar next-day breakout (NSE F&O) | squeeze_041 #2 | B | NSE F&O 1m | Buy 47.2%/PF 1.10, Sell 57.0%/PF 1.56 | No | No | Execution-order bias (target checked before stop on same bar) inflates results; survivorship risk on delisted F&O names |
| 14 | EMA-Direction Inside-Bar Breakout | squeeze_041 #1 | B | ES 5m | 37.33% win, implied PF 0.60 unfiltered; 52.69%/PF 1.11 on widest-25% subset (n=167) | No | No | Direct negative result for the core "squeeze" hypothesis |
| 15 | ATR-Percentile Breakout | squeeze_043 #2 | C | ES 1h | 228 trades, 46.9% win, PF 1.40, Sharpe 1.47 | Yes ($4.50 RT + 1 tick) | No | 1h timeframe (not scalp), tiny single-market sample, no code/data |
| 16 | Lunch Effect (SPY reversal) | squeeze_047 #1 | B | SPY 1h | Directional pattern described, no WR/PF/trade count disclosed | Not disclosed | Same-sample pattern discovery | Undisclosed metrics — cannot be evaluated quantitatively |
| 17 | Individual-Stock End-of-Day Reversal | squeeze_047 #3 | B | NYSE/Nasdaq/AMEX 1993–2019 | L–S 3.78bp/day (~9.5%/yr), t=10.69 | No | Rolling 3yr, not true OOS | Requires simultaneous multi-stock ranking/execution — not Pine-implementable; authors themselves doubt retail-cost survival |

---

## 3. Selected Candidates (max 3 — 2 selected)

### Candidate 1: SPY 30-Minute Close-Ramp Momentum Continuation

**Evidence grade:** A (peer-reviewed, JFE; replicated on SPY 1993–2013 and on 17 global index futures 1974–2020)
**Sources:** squeeze_050 (SPY variant), squeeze_047 (index-futures variant, "close ramp")

**What it actually is:** Not a compression/squeeze signal. It is intraday return continuation — the sign of the return from the prior close to a mid-morning checkpoint predicts the sign of the final 30 minutes of the session. Selected here because it is, by a wide margin, the best-evidenced logic surfaced anywhere in this batch of squeeze topics.

**Entry rule:**
- Market: SPY (or a liquid S&P 500 proxy/future with tight spreads).
- At 10:00 ET, compute `r = close(10:00) / close(prior day 16:00) - 1`.
- At 15:30 ET (30 minutes before the 16:00 ET close), enter **long** if `r > 0`, enter **short** if `r < 0`. No trade if `r == 0`.
- One entry per day, RTH only, no overnight holds.

**Exit rule (published):**
- Flatten unconditionally at 16:00 ET (market close). No stop, no target in the source paper.

**Exit rule (added for DT contract — not in source, flagged):**
- SL: 1.0× 14-day ATR(daily) from entry, since the source has no stop and a single adverse 30-minute move against a Sharpe-1.08 edge could produce an outsized loss without one.
- TP1: 0.5R at 50% of the expected 30-min move (partial), TP2/final exit: mandatory 16:00 ET time-stop (the real exit mechanism the evidence is based on — do not let TP2 override the time-stop).
- Because the underlying edge is time-based, not price-based, SL/TP are risk-management overlays, not sources of the documented expectancy.

**Filters/session:** RTH only, US equity session, weekdays only. No signal outside 15:30–16:00 ET window. Must handle DST correctly for the 10:00/15:30/16:00 ET timestamps.

**Risk parameters:** Max 1 signal/day (mechanically enforced by the single fixed-time entry). Suggest 0.25–0.5% account risk given the thin OOS R² (see failure modes).

**Expected metrics (source-cited):**
- SPY 1993–2013 (~5,200 days): 54.37% success rate, 6.67%/yr, Sharpe 1.08; post-cost (bid/ask, post-2005 subsample) 6.52%/yr, Sharpe 1.00. Recursive OOS R² = 1.2%. [squeeze_050, JFE paper]
- 17 global index futures, 1974–2020, 1-min data aggregated to 30-min: 6.86%/yr, vol 3.96%, Sharpe 1.73, 55% win rate. Extended-window OOS R² ≈ 2.8%. [squeeze_047]

**Known failure modes:**
- OOS R² of 1.2–2.8% means >97% of daily return variance is unexplained — the edge is statistically real but economically small; most days it will look like noise.
- Post-publication decay is plausible (samples end 2013/2020); no result in either source file post-dates 2020.
- Added SL/TP1 in this spec are not validated by the source studies — they change the risk profile from what was actually tested.
- A separate peer-reviewed replication of a related close-based reversal strategy (squeeze_044 #3, Rosa 2022) found the underlying predictive power **disappeared** in true forward OOS testing — a caution that momentum/reversal seasonality effects in this literature can decay fast; treat this candidate's numbers as an upper bound, not a guarantee.
- Equity-close auction mechanics (MOC/LOC order flow) can add slippage at the 16:00 ET exit that neither source fully models.

---

### Candidate 2: ES/NQ Percentile Noise-Area Breakout (5-Minute)

**Evidence grade:** B (detailed methodology, walk-forward OOS, but no public code/data)
**Source:** squeeze_043 (candidate #3, "Percentile Noise-Area Momentum")

**What it actually is:** The closest thing in this batch to a genuine compression-breakout / squeeze concept — price must break outside a historically-normal intraday move envelope (a volatility/noise band), rather than simply reacting to any inside bar.

**Entry rule:**
- Market: ES and/or NQ futures, 5-minute bars, RTH only (09:30–15:00 ET).
- Build a rolling 90-day distribution of intraday price ranges to derive 25th/75th percentile boundaries around the day's reference price.
- Long: price closes outside the upper boundary on 2 consecutive 5-min bars, with bar volume above the 20-bar median volume.
- Short: mirror condition at the lower boundary.
- Optional trend filter: only take the signal if it agrees with 50-period MA direction.
- Volatility regime sizing: half size when CBOE VIX is 30–40; no new entries when VIX > 40.

**Exit rule:**
- Hold minimum 3 bars, then exit if price re-enters the noise band.
- Hard time-stop: max 78 bars held, or flatten at 16:00 ET regardless.
- Optional (used in source): 0.5% trailing stop, or 2× the noise-band width as a profit target.

**DT contract mapping:** SL = re-entry into noise band OR hard ATR/percent stop (needs explicit numeric stop for DT contract — source does not give a fixed-distance stop, only "re-entry into band"; recommend adding a hard catastrophic stop at 1.5× the band width as a backstop). TP1 = 1× band width, TP2 = 2× band width (matches source's optional 2× target). Session filter = RTH 09:30–15:00 ET. Max signals/day: cap at 3–4 given source reports 3,847 trades over ~15 years (~1 trade per 1.4 trading days per instrument), so a hard daily cap of 2–3 is a reasonable safety rail, not a backtested parameter.

**Expected metrics (source-cited):**
- 2011–2026, 3,847 trades, 54.3% win rate, PF 1.64, max DD 16.4%.
- Costs: 1 tick/side + $4.20 round-trip.
- Walk-forward: 365-day training / 90-day OOS window, Sharpe 0.94 OOS (vs 1.18 full-sample). At 2-tick slippage (double the assumed cost), Sharpe drops to 0.64. [squeeze_043]

**Known failure modes:**
- Sharpe roughly halves (1.18 → 0.64) when slippage assumption doubles from 1 to 2 ticks — the edge is cost-fragile and any live execution worse than the paper's 1-tick assumption materially threatens profitability.
- Multiple optional/discretionary elements (trend filter, VIX sizing bands, trailing-stop vs. fixed-target choice) are not fully specified as a single fixed ruleset — implementers must fix these choices before backtesting, and the choice itself is a source of overfitting risk not captured in the reported Sharpe.
- 90-day rolling percentile computation across a multi-year lookback is nontrivial in Pine v6 (requires persistent arrays/matrices and correct handling of session boundaries) — budget real implementation effort; this is "partial" Pine-implementable per the source, not "yes."
- No public code or data; cannot be independently re-verified from the source alone.

---

## 4. Rejected Ideas and Reasons

| Idea | Reason for rejection |
|------|----------------------|
| NR7 + Inside-bar breakout (all 3 variants in squeeze_041) | Core hypothesis test (ES, EMA-direction) shows PF 0.60 unfiltered; best filtered subset (n=167) only reaches PF 1.11, too thin post-cost. NSE variant has execution-order bias inflating results. XAUUSD/EURUSD variant lacks disclosed win rate/trade count and shows a multi-market parameter search. |
| ATR-Percentile Breakout (ES, 1h) | Grade C, 1-hour timeframe not scalp-relevant, single market, no code/data, no OOS. |
| ATR dynamic sizing / TQQQ ORB+ATR | The one Grade A result confounds a simultaneous SL and TP change (not an isolated ATR-sizing effect), is fully in-sample, and the author acknowledges the headline 9,350% return is implausible at real spread/slippage. Sizing itself is a risk-management tool, not a demonstrated expectancy multiplier. |
| SPY Noise-Boundary Momentum (1-min) | Same underlying concept as Candidate 2 but with no genuine holdout OOS (unlike Candidate 2's walk-forward test), heavy researcher-flagged overfitting from iterative rule construction, and 2025 returns reportedly decayed to ~+1%. Superseded by Candidate 2, which has the OOS discipline this one lacks. |
| Opening Range Breakout — all variants (TORB, Nifty ORB, Stocks-in-Play ORB, VIX/ATR-filtered ORB, MNQ falsification) | ORB has its own dedicated family synthesis (`family_orb.md`) with a full ranking table, candidate selection, and explicit negative walk-forward evidence (MNQ 2021–2025: all 14 tested variants fail after realistic cost). Re-selecting ORB here would duplicate that work. The squeeze-batch evidence (squeeze_044, squeeze_049) reinforces rather than contradicts that family's skeptical conclusion — see the MNQ falsification row in the ranking table above. |
| Stocks-in-Play 5-min ORB (RVOL top-20) | Requires live cross-sectional ranking of the entire US equity market by relative volume every session open — not implementable in Pine v6, which operates on a single symbol/chart. The negative control (same rule, no RVOL filter) collapses to Sharpe 0.48, showing the edge is really "which stocks are in play today," not a squeeze/ORB effect. |
| VIX Futures EOD 30-min Momentum | Rigorous (Grade A, JBF) but requires VIX futures data access, is not a win-rate/scalp-style result, and does not transfer to equity or FX intraday scalping. |
| VIX/ATR-filtered 15-min ORB (Volatility Box) | Vendor-published, no independent audit, no OOS, and the researcher explicitly flags the reported numbers (58–62% win rate at 1.8 R:R) as implausibly good for the level of disclosure. |
| Individual-Stock End-of-Day Reversal | Requires simultaneous ranking and execution across the entire market cross-section daily — not Pine-implementable on a single chart. Authors themselves are skeptical of retail-cost survivability. |
| Lunch Effect (SPY reversal) | No win rate, profit factor, trade count, or cost-adjusted return disclosed anywhere in the source — cannot be evaluated as a quantitative candidate. |
| MACD + Variable ATR Trailing | 1-hour timeframe (outside the 1–15m scalp mandate), heavy pre-selection over MACD variants, no win rate/PF disclosed for the final configuration. |

---

## 5. Source List

- squeeze_041 raw: https://www.tradingsetupsreview.com/inside-inside-bar/ · https://unofficed.com/courses/backtesting-buddha/lessons/backtesting-narrow-range-inside-bar-strategy-using-python/ · https://www.mql5.com/en/blogs/post/771362 · https://arxiv.org/pdf/2605.04004
- squeeze_043 raw: https://volatilitybox.com/research/opening-range-volatility-breakout/ · https://pinescriptforge.com/es/atr-percentile-breakout/backtest · https://misango.me/static/Papers/Intraday_Momentum_Paper/Intraday_Momentum_Research_Report.pdf · https://ideas.repec.org/a/eee/jbfina/v148y2023ics0378426622003260.html
- squeeze_044 raw: https://www.sciencedirect.com/science/article/pii/S0304405X18301351 · https://www.nber.org/system/files/working_papers/w12413/w12413.pdf · https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284 · https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172 · https://ideas.repec.org/a/wly/jfutmk/v42y2022i12p2218-2234.html · https://arxiv.org/pdf/2605.04004
- squeeze_047 raw: https://quantpedia.com/lunch-effect-in-the-u-s-stock-market-indices/ · https://www3.nd.edu/~zda/intramom.pdf · https://academicweb.nd.edu/~zda/EOD.pdf · https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf
- squeeze_048 raw: https://concretumgroup.com/wp-content/uploads/2026/02/Can-Day-Trading-Really-Be-Profitable.pdf · https://concretumgroup.com/orb-strategy-backtest-in-python-using-alpaca-10-years-of-free-data/ · https://concretumgroup.com/wp-content/uploads/2026/02/A-Profitable-Day-Trading-Strategy-For-The-U-S-Equity-Market.pdf · https://www.mdpi.com/1911-8074/11/3/56 · https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6432558
- squeeze_049 raw: https://www.researchgate.net/publication/331076454 (TORB) · https://doi.org/10.1109/ACCESS.2019.2899177 · https://www.alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content · https://intradaylab.com/blog/nifty-orb-breakout-strategy-backtest · https://arxiv.org/pdf/2605.04004
- squeeze_050 raw: https://jplinvest.dk/wp-content/uploads/2020/12/Intraday-momentum-The-first-half-hour-return-predicts-the-last-half-hour-return.pdf · https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf · https://concretumgroup.com/backtesting-riding-intraday-trends-in-us-markets-using-matlab/ · https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284
- squeeze_042, squeeze_045, squeeze_046: no usable content — Codex research companion timed out (exit 143) before producing an analysis body.
