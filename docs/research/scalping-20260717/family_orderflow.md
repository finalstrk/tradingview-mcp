# Family Synthesis: Order-Flow Proxy (orderflow)

**Date:** 2026-07-17
**Sweep:** scalping-20260717
**Sources reviewed:** orderflow_051, 052, 053, 054, 055, 056, 057, 058, 060 (orderflow_059 errored out — Codex timeout, no content, excluded)

## Overall Assessment (read this first)

The evidence for this family is **mostly weak-to-negative**. Every raw file that reaches a genuine order-flow measurement (CVD/delta, order-flow imbalance, footprint/absorption, bid-ask microstructure, TICK/ADD breadth, funding-rate/OI) either (a) requires L2 order-book, tick-by-tick trade classification, or premium/Ultimate-only Pine features (`request.footprint()`) that fall outside the "OHLCV only, Pine v6, 1-15m" constraint, or (b) survives peer review but the authors themselves report the edge dies after realistic retail costs (spread, commission, slippage). Two files (051, 052) explicitly conclude no cost-inclusive, out-of-sample, retail-viable order-flow edge exists in the public literature. Two more (056, 057) show quantitatively negative Sharpe/PF across every tested config once costs are applied.

The only strategies in this family that are **actually implementable with OHLCV alone** are not order-flow strategies in a meaningful sense — they are generic time-of-day / volume-tercile momentum patterns that happened to surface while researchers were investigating order-flow questions. Even these are marginal: the single Grade-A OHLCV-implementable result (SPY end-of-day momentum) has a documented **post-2021 sign reversal** in independent re-testing, and the Grade-B result (Dynamic Noise-Area breakout) has no independent OOS and a 37% win rate that depends on unverified tail-skew to stay profitable.

**Conclusion: 2 candidates are returned below, both with heavy caveats and explicit "reject if" conditions — not clean recommendations.** Zero candidates from the genuine order-flow literature (CVD, OFI, footprint, bid-ask, TICK, funding rate) qualify; they are documented in the rejection table for completeness.

---

## Ranking Table (all logics found, ranked by evidence quality × retail viability × Pine v6 OHLCV implementability)

| Rank | Logic | Source | Grade | Retail cost-survival | Pine v6 OHLCV-only feasible? | Verdict |
|---|---|---|---|---|---|---|
| 1 | SPY first-half-hour → last-half-hour momentum | 055/058/060 (Gao et al., JFE) | A (peer-reviewed) | Plausible 1993-2013; **reversed since 2021** in independent re-test | Yes | Candidate (caveated) |
| 2 | Dynamic Noise-Area breakout (SPY, VWAP) | 058 (Zarattini et al.) | B | Plausible (17yr, costed) but no independent OOS | Yes | Candidate (caveated) |
| 3 | High-OFI short-term ASX contrarian | 052/054 | A (negative result) | **No** — unprofitable even for institutions after costs | No (needs cross-sectional order-flow) | Rejected |
| 4 | Order-Book-Imbalance market making (crypto, NASDAQ LOB) | 054/056 | A | Only with maker rebates / sub-ms latency | No (needs L2/queue) | Rejected |
| 5 | Constant best bid/ask quoting | 056 | A (negative result) | No — Sharpe -5 to -28 across all stocks | No (needs L1/L2) | Rejected |
| 6 | TICK extreme ES reversal | 053 | B | Marginal (PF 1.1-1.3, no OOS, multi-hour holds) | Partial (TICK is a tick-derived index, excluded by task constraint) | Rejected |
| 7 | Pre-registered funding carry / cross-venue funding arb | 057 | A (falsification study) | No — all OOS results negative | No (crypto funding data, multi-venue) | Rejected |
| 8 | 15-min CVD/delta reversal (Taiwan NTD/USD) | 051 | A | No — author states costs erase profit; market inaccessible to retail | Partial (delta proxy possible, market not tradable) | Rejected |
| 9 | 1-min cross-sectional delta momentum (BIST30) | 051 | A | No — 3.25bp/min edge consumed by costs; needs 28-symbol simultaneous footprint | No | Rejected |
| 10 | CSI300 futures VOI (500ms) | 051 | B | Unknown, needs L1 board, zero-latency assumption unrealistic | No | Rejected |
| 11 | VWAP absorption reversal (effort-vs-result) | 052/054 | C/B | Unverified — self-reported only, no independent stats | Partial (footprint delta, premium-only) | Rejected |
| 12 | Volume-spike momentum (MNQ) | 055 | B | No — -1.94 to -2.50 pts/trade after 2-pt friction, large N (2,119-2,409) | Yes | Rejected (clean negative result) |
| 13 | 5-min ORB on Stocks-in-Play (RVOL-filtered) | 055 | B | Unproven — cross-sectional universe reconstruction needed | Partial | Rejected |
| 14 | 1-min NASDAQ-100 crash reversal | 060 | A | Unknown — no win rate/PF; shock-time slippage likely erases 31% reversion | Yes (mechanically) | Rejected (execution risk too high) |
| 15 | Millisecond OFI predictor (QQQ) | 058 | B (negative result) | No — p=0.1957, no significant edge | No | Rejected |
| 16 | 5-min signed-trade imbalance (LSE) | 058 | B | No — VOD -0.018%/trade average, AZN barely positive pre-cost | No (needs aggressor-side tagging) | Rejected |

---

## Candidates (implementable specs)

### Candidate 1: SPY End-of-Day Momentum Continuation — CAVEATED, WEAK RECOMMENDATION

**Evidence grade:** A (peer-reviewed, Gao, Han, Li, Zhou — *Journal of Financial Economics*, cited in orderflow_055/058/060), but with a documented **negative** independent re-test post-2021.

**Why it surfaces in an order-flow sweep:** researchers repeatedly encountered it while searching for volume/momentum-based order-flow proxies; it is a first-half-hour-volume-conditioned momentum effect, not a true order-flow signal, but it is the only Grade-A, OHLCV-only-implementable result in the whole family.

**Market:** SPY (US equity index ETF). Not validated on futures/CME contracts (ES/NQ) or other symbols — extending it there is unverified extrapolation.

**Timeframe:** Daily signal computed from intraday bars; usable on 5m/15m charts for the two decision points (10:00 ET, 15:30 ET, 16:00 ET).

**Entry rule:**
- Compute `r = close(10:00 ET) / close(prior session 16:00 ET) - 1`.
- At 15:30 ET: if `r > 0`, enter long at the 15:30 close; if `r < 0`, enter short.
- Optional filter (improves signal per source): only take the trade if first-half-hour (09:30-10:00) volume is in the top tercile of a trailing same-year distribution — raised predictive R² from 1.1% to 3.1% in-sample.

**Exit rule (as published):** flat at 16:00 close (30-minute hold), no stop.

**DT-contract adaptation (not in the source, added for this spec — flag as deviation):**
- SL: original strategy has no stop, which is not acceptable for a DT setup. Add a hard stop at 1.0x the 09:30-10:00 ATR(5m) from entry, since the source paper does not size risk.
- TP1: 50% of position at 16:00 close (the published, evidence-backed exit).
- TP2: n/a — this is a single time-boxed exit, not a scaling structure. If a TP2 is required by contract, treat TP1 = TP2 = 16:00 close and treat the added stop purely as a risk backstop, not a profit-taking mechanism.

**Session filter:** 15:30-16:00 ET only. Max 1 signal/day (one trade, matches sample: ~1 trade/eligible day; sample excludes days with <500 trades total volume, not directly Pine-checkable — approximate with a minimum daily volume filter).

**Expected metrics (source):** 1993-2013, 54.37% success rate, 6.67% annualized return, Sharpe 1.08, out-of-sample R²=1.4%; post-decimalization (post-2001) bid/ask-spread-adjusted still 6.52% annualized, Sharpe ~1.00. [Gao et al., JFE, via sciencedirect.com/science/article/pii/S0304405X18301351]

**Known failure modes / reasons this is weak:**
1. **Documented decay/reversal:** an independent, non-academic re-test on 2021-2026 data (1,370 days) found SPY's version of this effect **reversed sign**, t=-2.3, gross return -0.55bp/day. [vortexcapitalgroup.com/insights/the-1pm-echo-treasury-auctions-are-the-last-living-signal-on-the-half-hour-clock, cited in orderflow_060] This is the single most damaging fact against this candidate and must be disclosed to any user of this setup.
2. Original sample (1993-2013) excludes 2021-2026 entirely; commissions were excluded from the base result (only the spread-adjusted post-2005 subsample includes transaction costs).
3. Single-symbol (SPY) post-hoc selection — the paper studied many ETFs/indices; SPY survivorship is not itself a risk (SPY didn't disappear), but the choice of SPY as the flagship result among many tested assets raises garden-of-forking-paths concern.
4. No stop-loss in the original design; the DT-mandated stop above is an unvalidated addition that changes the risk profile from the tested one.

**Recommendation:** Do not deploy live without independently re-validating on recent (2023-2026) SPY 5m/15m data first. If the recent-period Sharpe is negative or near-zero, discard.

---

### Candidate 2: Dynamic Noise-Area VWAP Breakout (SPY) — CAVEATED, WEAK RECOMMENDATION

**Evidence grade:** B (Zarattini et al., SSRN working paper — not journal-peer-reviewed at time of citation).

**Market:** SPY only. Validated nowhere else in the raw files.

**Timeframe:** 1-minute data, decision points at each half-hour mark (00/30 minutes past the hour).

**Entry rule:**
- For each of the day's half-hour checkpoints, compute the prior 14 trading days' average absolute percentage move from that day's open to the same time-of-day.
- Build an upper boundary = today's open (or prior close) + that average move; lower boundary = today's open (or prior close) − that average move.
- If price crosses above the upper boundary at a checkpoint: enter long.
- If price crosses below the lower boundary at a checkpoint: enter short.

**Exit rule:**
- Long: exit when price crosses back below `max(upper_boundary, VWAP)`, or at 16:00 ET, whichever first.
- Short: exit when price crosses back above `min(lower_boundary, VWAP)`, or at 16:00 ET, whichever first.

**DT-contract adaptation (deviation from source):**
- SL: source has no independent stop beyond the VWAP/boundary re-cross exit. For DT compatibility, define SL = boundary crossed at entry (i.e., if long entry was upper-boundary breakout, SL = upper boundary re-crossed to the downside by an added buffer, e.g., 0.1× ATR(1m)). This is an approximation, not validated in the source.
- TP1: VWAP re-cross (as published exit) — take partial profit here.
- TP2: 16:00 ET close (end-of-day exit), consistent with the source's hard EOD flat.

**Session filter:** Checkpoints only at :00/:30 ET during regular trading hours; effectively intraday-only, flat by 16:00. Max signals/day bounded by number of half-hour checkpoints (~13 for a 6.5h session), but source reports only 7,668 trades over 17 years / ~4,284 trading days ≈ 1.8 trades/day realized, so a practical cap of 2 signals/day is reasonable and roughly matches the empirical trade frequency.

**Expected metrics (source):** 2007-2024, 7,668 trades, 37% win rate, average $0.09/share profit, 9.7% annualized return, Sharpe 1.24, max drawdown 12%, cumulative return 380%. Cost model: $0.0035/share commission + $0.001/share slippage included. Profit Factor not reported. [Zarattini et al., papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172, cited in orderflow_058]

**Known failure modes / reasons this is weak:**
1. **No independent out-of-sample test disclosed** — stop rules, VWAP-vs-boundary exit logic, and the 14-day lookback window appear to have been selected on the same 2007-2024 sample used to report performance. This is the single largest risk: the reported Sharpe 1.24 may not replicate forward.
2. **37% win rate** means the strategy depends on a small number of large winners to stay profitable (positive skew) — this is psychologically hard to trade live and vulnerable to a single bad regime (e.g., a low-volatility grind period) eroding months of edge.
3. Profit Factor was not reported by the source, so the win/loss asymmetry cannot be independently verified from the given numbers.
4. VWAP-based exits require intrabar VWAP tracking in Pine — implementable via `ta.vwap()` reset daily, but note Pine's realtime VWAP recalculates on each new bar and can repaint intrabar before the bar closes; use confirmed-bar logic only.
5. Single-symbol (SPY), single-study result; no replication found in the other 8 raw files.

**Recommendation:** Treat as a research starting point only. Before any live use, backtest independently in Pine v6 Strategy Tester on 2015-2026 SPY 1m/5m data with realistic commission+slippage, and require a Profit Factor ≥1.3 and a positive-Sharpe out-of-sample split before adoption consideration.

---

## Rejected Candidates (with reasons)

| Logic | Grade | Source | Rejection reason |
|---|---|---|---|
| High-OFI short-term ASX contrarian | A | 052, 054 | Explicit negative result — even institutional investors lose money after costs |
| Order-book-imbalance market making (crypto/NASDAQ) | A | 054, 056 | Requires L2 order book, queue position, sub-second cancel/replace — impossible in Pine v6 OHLCV |
| Constant best bid/ask quoting | A (negative) | 056 | Sharpe -5 to -28 across all 11 stocks and all inventory limits tested — clean negative result |
| Directional order-book imbalance (nanosecond) | B | 056 | Simulation only; "only the fastest participant profits," explicitly disqualifying for retail |
| GLFT adaptive grid market making (crypto) | B | 056 | Author states profit is mostly maker-rebate-derived, not spread capture; 100ms L2 required |
| TICK extreme ES reversal | B | 053 | PF 1.1-1.3 only, no OOS, 4-27 bar (up to 6.75h) holding period not true scalping; TICK is tick-derived breadth data, excluded by "no tick data" constraint |
| TICK/RSI/VIX/EMA 1-min scalp | B | 053 | Tested on SPY options (not futures), in-sample-optimized on a single 6-week window, options spreads unmodeled |
| 15-min ORB + TICK confirmation | B (numbers ~C) | 053 | Trade count, PF, cost, and OOS all undisclosed; cannot audit the claimed 58-62% win rate |
| CVD/delta reversal (Taiwan NTD/USD interbank) | A | 051 | Author explicitly warns profit disappears after costs; market not accessible to retail traders |
| Cross-sectional 1-min delta momentum (BIST30) | A | 051 | Requires 28 simultaneous footprint feeds — architecturally impossible in single-script Pine v6; edge (3.25bp/min) certainly consumed by costs |
| CSI300 futures VOI (500ms) | B | 051 | Needs 500ms L1 board snapshots; zero-latency execution assumption unrealistic |
| VWAP absorption reversal ("effort vs result") | C/B | 052, 054 | Self-reported/anecdotal only; no independent win rate, PF, or cost data; requires footprint delta (Premium/Ultimate-only Pine feature) |
| Volume-spike momentum (MNQ 5m) | B | 055 | Clean negative result: -1.94 to -2.50 points/trade after costs, N>2,000, near-zero t-stats |
| 5-min ORB on Stocks-in-Play | B | 055 | Requires daily cross-sectional top-20 RVOL ranking across a >7,000-stock delisted-inclusive universe — not reproducible in Pine v6 |
| 1-min NASDAQ-100 crash reversal | A | 060 | 31% mean-reversion figure is not a win rate; no PF/cost data; shock-time spread widening and slippage make execution highly uncertain |
| Constituent-return ensemble for 5-min SPY prediction | B | 060 | Needs simultaneous multi-stock NBBO history and ML re-training; not implementable in Pine v6; result is pre-decimalization-heavy |
| Millisecond OFI predictor (QQQ) | B (negative) | 058 | p=0.1957, statistically indistinguishable from no edge |
| 5-min signed-trade imbalance (LSE) | B | 058 | Requires aggressor-side (buyer/seller-initiated) tagging unavailable from OHLCV; results weak/negative pre-cost |
| Funding-rate carry / cross-venue funding arbitrage / basis arb (crypto) | A/B | 057 | All configurations show negative or near-zero OOS results after realistic costs; requires multi-venue/multi-leg execution not representable as a single-symbol Pine setup |
| Queue imbalance at best quote (NASDAQ) | A | 060 | Predictive AUC is real (0.75-0.80) but this predicts next-tick direction, not a profit opportunity across the spread; requires historical order-book/queue data |

---

## Source List

- orderflow_051.md — CVD/delta approximations: Taiwan NTD/USD 15-min delta reversal; BIST30 cross-sectional delta momentum; CSI300 futures VOI
- orderflow_052.md — Volume imbalance / effort-vs-result: Coinbase OFI; ASX high-OFI contrarian; ES 3:1 buy imbalance; VWAP absorption
- orderflow_053.md — NYSE TICK/ADD breadth: ES TICK extremes; SPY options TICK/RSI/VIX scalp; 15-min ORB+TICK
- orderflow_054.md — Footprint/absorption: crypto OBI market making; NASDAQ LOB state-dependent MM; ASX OFI contrarian; VAH absorption breakout
- orderflow_055.md — Volume spikes as institutional-activity proxy: MNQ volume-spike momentum; 5-min ORB Stocks-in-Play; SPY EOD momentum
- orderflow_056.md — Bid-ask spread exploitation: constant quoting; OBI-controlled MM; directional OBI; GLFT grid MM
- orderflow_057.md — Crypto funding rate/OI: extreme-funding fade; pre-registered funding carry; basis arbitrage; cross-venue funding arb
- orderflow_058.md — Tape/momentum bursts: SPY first/last half-hour momentum; Dynamic Noise-Area breakout; millisecond OFI (QQQ); LSE signed-trade imbalance
- orderflow_060.md — Market-microstructure academic papers: SPY EOD momentum (re-cited); constituent-return SPY prediction; NASDAQ-100 1-min crash reversal; queue imbalance
- orderflow_059.md — **excluded**: Codex research execution timed out (exit 143, 900s limit); no analytical content produced
