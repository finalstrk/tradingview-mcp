# Family Synthesis — Meta (Verification & Meta-Evidence)

Date: 2026-07-17
Sources reviewed: meta_091, meta_092, meta_093, meta_094, meta_095, meta_096, meta_097, meta_099, meta_100 (meta_098 timed out during search — no content, excluded)

## 1. Overall Assessment

This family is fundamentally different from the others in this sweep: its research questions are about **methodology and evidence quality itself** — walk-forward standards, sample-size requirements, audited track records, prop-firm survival stats, GitHub reproducibility, regime survival, confluence-filter value, multi-symbol robustness, and "which family has the strongest independently replicated evidence overall." It is a cross-check layer, not a source of novel trade logic. Its verdict on the rest of the sweep is largely **negative**: no topic in this family found a strict Grade-A candidate that is (a) a genuine sub-hour scalp, (b) cost-adjusted, and (c) independently out-of-sample verified. The recurring findings across all nine files:

- **No audited, public track record exists that pairs a verified profitable individual account with a fully disclosed rule set** (meta_093). The closest thing — Taiwan exchange full-population data (1992–2006) — shows only ~20% of active day traders are profitable after costs, and the profitable minority trades on fast reaction to information events in concentrated small-cap/high-vol names, not spread-scalping. No entry/exit rules are recoverable from this data.
- **Prop firms (FTMO, Topstep) do not publish which strategy styles pass or stay funded.** Topstep's 2025 official stats (16.8% reach Funded, 0.71% of Express-Funded reach Live) are account-level survival stats, not strategy-attribution data. The only "scalper passed" cases are Grade-C anecdotal blog posts with obvious survivorship/PR selection bias (meta_094).
- **Sample-size math is unforgiving.** Detecting a true 55% win rate against a 50% null requires ~617 independent trades at 80% power; PF 1.2 (≈54.55% WR at 1:1 payoff) requires ~746. Most of the positive results cited *elsewhere in this sweep* do not disclose trade counts, and several that do (MNQ ORB, N=447–538) fail this bar (t=1.50–3.11 depending on variant) (meta_092).
- **The two logics with genuine Grade-A, peer-reviewed, cost-aware, multi-decade evidence are both end-of-day / close-approach momentum strategies, not scalps**: (1) first-half-hour → last-half-hour sign continuation in SPY/liquid ETFs and, in independent extension, 62 global futures 1974–2020 (meta_091, meta_092, meta_093, meta_094, meta_097, meta_100); (2) component-to-index 5-minute lead-lag ML (meta_100) — but this second one requires simultaneous multi-symbol regression input and NBBO spread data, which is **not implementable in Pine v6 on OHLCV alone**, so it is excluded from candidates despite Grade A.
- Even the surviving Grade-A candidate (#1) has a documented **negative independent replication**: an independent 2010–2018 SPY retest (n=1,165, $0.01/share cost) found WR 49.7%, annual return **−1.37%**, Sharpe **−2.70** (meta_097). The original 1993–2013 result and the 1974–2020 futures extension remain positive, but the SPY-specific edge shows clear decay/regime sensitivity post-publication. This must be disclosed, not hidden, per the family's own evidentiary standard.
- **Every Grade-B "high Sharpe" candidate examined by this family** (Stocks-in-Play 5-min ORB + Relative Volume, Sharpe 2.81; SPY Noise-Area/VWAP momentum, Sharpe 1.24–1.39; MNQ RTH GMM/Markov regime confluence, t=3.11 OOS) **shares the same three defects**: same-sample filter discovery (the filter that "improves" the strategy was found and tested on the identical dataset used to report performance), no independent OOS window from a different author/data source, and incomplete cost modeling (commission only, no spread/slippage/market-impact/borrow, except SPY Noise-Area which does include a modeled $0.001/share slippage). The MNQ GMM/Markov regime confluence is additionally **not implementable in Pine v6** because the trained model coefficients/specification were never published (meta_096, meta_099).
- **Adding confluence filters does not reliably help** (meta_099's direct question). Economically-grounded filters (Relative Volume, which proxies information flow) show a measurable, monotonic improvement (RV<1: −0.02R/trade → RV≥1: +0.08R → RV>30: +0.38R) — but this filter was discovered and evaluated on the same sample it's reported on. Generic technical confluence (RSI/MACD/multi-timeframe agreement) has no OOS+cost support in any file reviewed. The clearest controlled negative example: adding a 5-point pullback + 20-point stop confirmation filter to the MNQ 25-min ORB **worsened** it (447 trades/+2.82pt/t=1.50 → 83 trades/−4.44pt/80.7% stop-out rate) (meta_099).
- **Multi-symbol robustness standards** (meta_097) recommend leave-one-symbol-out + year-by-year breakdown + 1×/2× realistic cost stress + Deflated Sharpe/CSCV with t>3 (not the conventional t>2) given the number of specifications typically tried. None of the positive candidates surveyed in this sweep meet this full bar; the close-to-close momentum family comes closest (peer-reviewed, multi-decade, multi-asset-class replication) but still lacks disclosed PF/exact trade counts.

**Net conclusion for this family: mostly negative.** It does not surface new implementable scalp logic — it cross-validates (and mostly invalidates) claims made in the ORB, VWAP, session, and momentum families elsewhere in this sweep. Exactly **one** candidate survives all three selection criteria (evidence strength, Pine v6/OHLCV implementability, DT-contract compatibility), and even that one carries a disclosed negative replication that must travel with it into any backtest decision.

## 2. Ranking Table (all logics surfaced across meta_091–meta_100)

| # | Logic | Source topics | Grade | Market | Key metric | Cost-adjusted? | OOS? | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | First-half-hour → last-half-hour momentum (SPY/ETFs) | meta_091, meta_092, meta_094, meta_097 | A | SPY + 10 ETFs, 30-min | Sharpe 1.08, 6.67%/yr (1993–2013), OOS R² 1.4% | Reported "after reasonable costs," exact schedule undisclosed | Recursive OOS in-paper; **independent 2010–2018 retest is negative** (WR 49.7%, −1.37%/yr, Sharpe −2.70) | Positive base result, but decays/fails independent replication |
| 2 | Close-30-min momentum, global futures | meta_093, meta_100 | A | 62 futures (indices/bonds/commodities/FX), 1974–2020 | Indices: Sharpe 1.73, WR 55%, 6.86%/yr; positive after 1-tick cost (ES) | Partial (1-tick cost only for ES; not shown for all 62) | Sub-sample split + directional-agreement variant (Sharpe 1.60, WR 61%) | Strongest evidence in family; broader asset coverage than #1, same underlying phenomenon |
| 3 | Component-to-index 5-min lead-lag ML | meta_100 | A | US index constituents → index, 5-min | Sharpe 0.98 post-spread, ~900M obs OOS 1993–2016 | Yes (NBBO spread) | Yes, 23-year OOS | **Not implementable** — needs simultaneous multi-symbol regression + NBBO, no Pine equivalent |
| 4 | MNQ RTH regime confluence (GMM + Markov) | meta_096, meta_099 | B | MNQ, 5-min | WF OOS +11.82pt/trade, t=3.11, 196 trades | 2-pt round-trip | Yes (196-trade WF + 2025 holdout) | Best OOS t-stat in family, but model spec never published — **not implementable**; same-author "positive control" selection bias flagged |
| 5 | 5-min ORB + Relative Volume (Stocks-in-Play) | meta_091, meta_092, meta_093, meta_095, meta_096, meta_097, meta_099, meta_100 | B | ~7,000 US equities, 2016–2023 | Sharpe 2.81, WR 48.4%, 41.6%/yr | Commission only ($0.0035/shr), no spread/slippage | None disclosed | Repeatedly cited, repeatedly flagged: same-sample filter discovery, no independent OOS, avg edge only 0.08R/trade above RV≥1 threshold |
| 6 | SPY Noise-Area + VWAP-trailing momentum | meta_093, meta_094, meta_095, meta_096, meta_099 | B | SPY, 1-min | Sharpe 1.24–1.39, 19.6–19.9%/yr, WR 37% | Yes (comm. + $0.001/shr slippage from 1,000 live orders) | None (post-hoc period tracking only) | 25% MDD in the leveraged variant exceeds typical prop-firm DD caps; parameter/exit refinement done in-sample |
| 7 | 20-min ORB + volume confirmation (20-stock GitHub repo) | meta_095 | B | 20 US equities, 5-min, 2016–2026 | Sharpe 2.47, WR 50.3%, PF 1.31, 4,292 trades | Yes ($0.01/shr slippage + $0.005/shr comm, 3x slippage stress-tested) | 6mo train / 6mo WF then 10-yr fixed-param holdout | Best cost discipline in family, but the 20-stock universe was likely pre-selected from a larger pool — stock-selection survivorship risk undisclosed |
| 8 | QQQ/TQQQ first-5-min-bar direction | meta_094 | B | QQQ/TQQQ, 5-min | Sharpe 1.12, WR 24%, 0.13R avg | Comm. only, no slippage | None | Single-sample stop/target optimization; TQQQ leverage compounding overstates realism; low WR = fragile to fill quality |
| 9 | MNQ 25-min ORB (generic, no confluence) | meta_091, meta_092, meta_094, meta_096, meta_099, meta_100 | B (negative result) | MNQ, 5-min | 447 trades, WR 55.5%, +2.82pt/trade, **t=1.50 (not significant)** | 2-pt round trip | Expanding-window WF, 2021–2025 | **Negative** — fails significance; year-by-year sign is unstable (−1.42, +2.43, +7.04) |
| 10 | NQ ORB + Volume Profile retracement | meta_095 | B | NQ, 1-min, 2021–2026 | Long: WR 42.9%, +0.417R/trade; Short: WR 42.5%, +0.558R/trade | Not disclosed | Not disclosed | Data/code not bundled, VP levels and OOS undefined — cannot verify |
| 11 | Cameron ICT scalp (5m/30s entry) | meta_091, meta_093 | A (sourcing) / negative result | NQ, 5m context + 30-second entry | Base: 11,391 trades, WR 48.7%, PF 0.81, −3,768.5pt OOS | 0.25pt round trip | 2022–2025 OOS, public code | **Negative** — fails outright even at optimistic cost; also 30-second/tick-order-dependent, not reproducible on 1–15m Pine bars |
| 12 | QQQ VWAP always-reversing | meta_096 | B | QQQ, 1-min, 2018–2023 | 21,967 trades, WR 17%, win/loss ratio 5.67, Sharpe 2.1 | Comm. only ($0.0005/shr), zero slippage | None | ~22,000 reversals with zero slippage assumption is not credible; PF/OOS both absent |
| 13 | High-frequency pairs reversal (FTSE100) | meta_097 | A (sourcing) | FTSE100, ~60-min | 2σ: 5.44%/yr after 15bp cost; 3σ: 7.01%/yr | Yes (15bp) | 30 overlapping OOS windows, single year (2007) | Single-year sample, crisis-period dependent; requires simultaneous two-leg execution across a ranked universe — not a single-symbol Pine setup |
| 14 | Taiwan exchange full-population day-trader record | meta_093 | Reference data, not a strategy | Taiwan equities, 1992–2006 | ~20% of traders profitable after cost; top-500 outperform by >60bp/day next year | N/A (real trading, embedded) | N/A (realized, not backtest) | Confirms skill exists concentrated in a small trader minority reacting fast to information events; **no recoverable entry/exit rule** |

## 3. Selected Candidates (max 3 requested — only 1 selected)

Only one logic in this family clears all three bars: strongest-available evidence, Pine v6/OHLCV implementability on 1–15m bars, and adaptability to the DT setup contract (discrete entry/SL/TP1/TP2, session filter, max signals/day). It is presented below with its known negative replication carried forward, as required by the family's own evidentiary standard.

Rejected from candidacy despite Grade A sourcing: **component-to-index lead-lag ML** (needs simultaneous multi-symbol regression + NBBO spread data, no Pine equivalent) and **FTSE100 pairs reversal** (needs synchronized two-leg execution across a ranked universe, single-year sample). Rejected despite frequent citation across the sweep: **5-min ORB + Relative Volume** and **MNQ RTH regime confluence** — both Grade B only, both carry same-sample filter-discovery bias, and the regime-confluence model spec is unpublished (not implementable). The generic **MNQ 25-min ORB** and **Cameron ICT scalp** are explicit negative results and are listed only as cautionary reference, not candidates.

---

### Candidate 1: Session Momentum-to-Close (index futures / liquid ETF, single daily signal)

**Evidence grade:** A (peer-reviewed, multiple independent sources) — **with a disclosed negative independent replication that weakens confidence specifically for the SPY/ETF variant.**

**Sources / key metrics:**
- Gao, Han, Li, Zhou 1993–2013, SPY + 10 liquid ETFs, 30-min signal/hold: 6.67%/yr, 6.19% vol, Sharpe 1.08 vs buy-and-hold 0.29, recursive OOS R² 1.4%, ~5,200 daily opportunities, "significant after transaction costs" (exact schedule not disclosed). [JFE paper](https://www.sciencedirect.com/science/article/pii/S0304405X18301351) — meta_091, meta_092, meta_094, meta_097, meta_100.
- Baltussen et al., independent extension, 1974–2020, 62 global futures (17 index, 16 bond, 21 commodity, 8 currency): index futures 6.86%/yr, Sharpe 1.73, WR 55%; bonds 2.16%/1.62/55%; commodities 4.34%/1.42/56%; currencies 0.85%/0.87/53%. Positive after 1-tick cost (ES tested specifically). PF and exact trade counts not reported. [Paper](https://www3.nd.edu/~zda/intramom.pdf) — meta_093, meta_100.
- **Negative independent replication:** SPY-only 2010–2018 retest, n=1,165, $0.01/share cost: WR 49.7%, annual return **−1.37%**, Sharpe **−2.70**. Of 5 ETFs retested, only TLT was marginally positive. [Retest](https://stocksoftresearch.com/the-truth-about-intraday-momentum/) — meta_097.

**Entry rule:**
- Fix a signal window: from session open (or a configurable N minutes after open, default 30 min matching the source) through T-30-minutes-before-close.
- Compute `signal_return = close(T-30min) - close(session_open)` (or prior-session close, per the source's exact convention — use prior close to avoid overnight-gap ambiguity, matching the JFE paper's methodology).
- At T-30-minutes-before-close: if `signal_return > 0`, enter long (market or stop order at the T-30 close); if `signal_return < 0`, enter short. Flat/zero signal = no trade.
- One entry per session per instrument (matches source methodology — this is inherently a max-1-signal/day setup).

**Exit rule (adapted for DT contract — deviates from source, flagged):**
- Source strategy has **no stop-loss** and exits only at session close. This "let it run to close" behavior is intrinsic to the tested edge; adding a stop was not evaluated by any source in this family.
- DT contract requires SL/TP1/TP2. Adaptation: SL = session-open-to-signal-window ATR × 1.5 (protective only, not backtested by any source — must be validated locally before live use). TP1 = none recommended (splitting the position was not tested and risks cutting the very "run to close" behavior that produces the edge) — treat TP1 as optional partial-profit-take at 0.5R with the remainder held to TP2. TP2 = forced exit at session close (replicates the tested behavior).
- This SL overlay is a risk-control adaptation, not a replication of the source studies, and must be flagged as such in any DT registry entry.

**Filters/session:**
- Regular trading hours only, one signal window per session, one trade per session (max signals/day = 1, matches source).
- Recommended instrument selection: prefer the **futures variant** (ES, or other liquid index futures) over the SPY-ETF variant, given that the SPY-specific retest (2010–2018) was negative while the multi-asset futures extension (1974–2020, including a positive ES 1-tick-cost check) has not been shown to fail independently in these files. This is a source-quality judgment, not a guarantee — the futures variant simply has broader, more recent positive replication and the SPY-specific negative result does not directly implicate it.

**Risk parameters:** Size off the SL distance (session-window ATR-based), not a fixed dollar/point amount. Single trade per instrument per day caps daily risk exposure by construction.

**Expected metrics (source, unadapted strategy):** SPY/ETF variant 6.67%/yr, Sharpe 1.08 (1993–2013) — **known to fail 2010–2018 independent retest (Sharpe −2.70)**. Futures variant (index futures specifically) 6.86%/yr, Sharpe 1.73, WR 55% (1974–2020, positive after ES tick cost). **The DT SL/TP1/TP2 overlay is untested and may change these numbers in either direction.**

**Known failure modes:**
- The SPY/ETF-specific version of this exact logic has a **documented negative out-of-sample failure** (2010–2018, Sharpe −2.70) — this is not a hypothetical risk, it is realized evidence of decay/regime-sensitivity, most plausibly linked to the post-2013 rise of intraday momentum awareness and changed market microstructure.
- Neither source discloses a full cost schedule (spread + slippage, not just commission/tick) for the complete sample — "significant after reasonable costs" and "positive after 1-tick cost" are narrower claims than a full retail cost stress test.
- No PF or exact trade count disclosed in any source, meaning the sample-size bar from meta_092 (~617 trades minimum to distinguish 55% WR from 50% at 80% power) cannot be independently confirmed as met.
- The added SL/TP1/TP2 structure required by the DT contract has never been backtested by any source — this candidate must be locally backtested with the overlay before being promoted past `candidate` status in `journal/registry.json`.
- This is a single-trade-per-day, 30-minute-hold momentum strategy, not a true multi-signal intraday scalp — it will produce very low signal frequency (1/instrument/day) relative to other DT setup families in this sweep.

---

## 4. Rejected Ideas (with reasons)

| Logic | Grade | Reason rejected |
|---|---|---|
| Component-to-index 5-min lead-lag ML | A | Requires simultaneous multi-symbol regression input + NBBO spread data; no Pine v6/OHLCV equivalent (meta_100) |
| High-frequency pairs reversal (FTSE100) | A (sourcing) | Requires synchronized two-leg execution across a ranked universe; single-year (2007) sample, crisis-dependent; not a single-symbol Pine setup (meta_097) |
| 5-min ORB + Relative Volume (Stocks-in-Play) | B | Cited in 8 of 9 files but consistently flagged for same-sample filter discovery, no independent OOS, and cross-sectional top-20 ranking that Pine cannot reproduce for the full-market version; average edge above threshold only 0.08R/trade (meta_091, 092, 093, 095, 096, 097, 099, 100) |
| MNQ RTH regime confluence (GMM + Markov) | B | Best OOS t-stat in the family (t=3.11) but the trained model specification (GMM regime boundaries, Markov transition thresholds) was never published — not independently implementable in Pine v6 (meta_096, meta_099) |
| SPY Noise-Area + VWAP-trailing momentum | B | Leveraged variant's 25% max drawdown exceeds typical prop-firm DD caps; stop/exit refinement (VWAP trailing) was discovered and evaluated on the same sample it's reported on; no true OOS (meta_093, 094, 095, 096, 099) |
| MNQ 25-min ORB (generic) | B — negative result | Explicit negative result: t=1.50, not statistically significant; year-by-year sign unstable; adding a confirmation filter made it worse (447 trades/+2.82pt → 83 trades/−4.44pt) (meta_091, 092, 094, 096, 099, 100) |
| Cameron ICT scalp (NQ, 30-second entry) | A (sourcing) — negative result | Fails outright even at an optimistic 0.25pt round-trip cost (PF 0.81, −3,768.5pt OOS over 11,391 trades); also structurally not reproducible on 1–15m Pine bars since it depends on 30-second/tick-level fair-value-gap timing (meta_091, 093) |
| QQQ VWAP always-reversing | B | ~22,000 reversals modeled with zero slippage is not a credible cost assumption; no PF or OOS reported (meta_096) |
| NQ ORB + Volume Profile retracement | B | Data and code not bundled; breakout thresholds, VP levels, target definition, and cost/OOS all undisclosed — cannot verify the reported +0.417R/+0.558R figures (meta_095) |
| 20-min ORB + volume confirmation (20-stock repo) | B | Best cost discipline in the family (3x slippage stress test survived) but the 20-stock universe appears pre-selected from a larger pool with no disclosure of the selection process — stock-selection survivorship bias cannot be ruled out (meta_095) |
| QQQ/TQQQ first-5-min-bar direction | B | Single-sample stop/target optimization on one instrument; TQQQ's 3x leverage compounding materially overstates realized returns; 24% win rate makes it fragile to any fill-quality degradation (meta_094) |
| Taiwan full-population day-trader record | Reference only | Confirms that a profitable minority of day traders exists and reacts fast to information events, but publishes no recoverable entry/exit rule — not a candidate logic, only supporting evidence that skill-based scalping is real but rare (meta_093) |
| FTMO/Topstep "scalper passed" case studies | C | Grade-C anecdotal blog posts (single trader each) with obvious survivorship and PR selection bias; prop firms do not publish strategy-style pass-rate statistics (meta_094) |

## 5. Source List

- meta_091 — Walk-forward and OOS standards for intraday strategy development
- meta_092 — Sample sizes needed for statistically meaningful win-rate/PF claims
- meta_093 — Audited/verified track records of profitable scalpers
- meta_094 — Prop-firm strategy style evaluation (FTMO, Topstep)
- meta_095 — GitHub repositories with reproducible intraday/scalping backtests
- meta_096 — Which intraday strategy families survived regime changes 2020–2026
- meta_097 — Multi-symbol robustness testing standards for intraday strategies
- meta_099 — Do confluence filters measurably improve intraday strategies
- meta_100 — Survey: scalping logic families with strongest independently replicated evidence
- meta_098 — excluded (Codex research task timed out, no analysis body produced)

All metrics above are quoted directly from the raw research files listed; no figures were estimated or extrapolated beyond what each source reports.
