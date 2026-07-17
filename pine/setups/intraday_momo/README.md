# DT Intraday Momentum v1

Candidate setup. **Not adopted.** Do not treat as a live signal source; route to `/setup-verify` or replay practice only.

## Logic

Session momentum-to-close: the sign of the return from session open to the first 30 minutes of the session, combined with the sign of the return from session open to a fixed decision time 30 minutes before the session close, is used as a single daily directional bet. If both signs agree (and are non-zero), enter in that direction at the decision bar and hold to the session close (hard time exit). Built from 5m/15m bars; markets are index futures / SPY-class liquid ETFs.

This is the Gao–Han–Li–Zhou (JFE) intraday momentum effect (SPY 1993–2013, Sharpe 1.08) with its independent 46-year, 17-global-index-futures extension (Baltussen et al., 1974–2020, Sharpe 1.73 for index futures). It is the single strongest-evidenced logic surfaced in the 2026-07-17 scalping research sweep (`docs/research/scalping-20260717/family_meta.md` Candidate 1, `family_academic.md` Candidate A, `family_squeeze.md` Candidate 1 — three independent synthesis passes converged on the same underlying paper).

## Evidence Grade And Honest Caveats

**Grade: A** (peer-reviewed, multi-decade, multi-asset-class replication), **but carries a disclosed negative independent replication for the SPY/ETF variant that must travel with any use of this setup:**

- An independent 2010–2018 SPY retest (n=1,165, $0.01/share cost) found win rate 49.7%, annual return **−1.37%**, Sharpe **−2.70** (`family_meta.md`, citing stocksoftresearch.com). Of 5 ETFs retested in that source, only TLT was marginally positive.
- The original 1993–2013 SPY result (Sharpe 1.08) and the 1974–2020 global futures extension (Sharpe 1.73, positive after 1-tick ES cost) remain positive, but the SPY-specific edge shows clear decay/regime sensitivity post-publication.
- International replication of the base effect was mixed: 12/16 developed markets replicated in the original study; Australia/Hong Kong/Singapore did not (`family_academic.md`).
- Neither source discloses a full retail cost schedule (spread + slippage, not just commission/tick) for the complete sample; "significant after reasonable costs" and "positive after 1-tick cost" are narrower claims than a full retail cost stress test.
- Recursive/expanding-window OOS R² is only 1.2–2.8% — the edge is statistically real but economically small; most days it will look like noise.
- **Recommendation from the source research:** prefer the liquid index-futures variant (ES or similar) over the SPY-ETF variant, since the SPY-specific negative retest does not directly implicate the futures extension — but this is a source-quality judgment, not a guarantee, and the futures variant has not itself been independently re-verified post-2020.
- **Treat this candidate as forward-test/paper-trade only, gated behind a fresh post-2021 out-of-sample check before any live sizing.**

## DT Adaptations That Deviate From The Source Evidence

The source studies test a single "let it run to close" position with **no stop-loss and no partial profit-taking**. The DT setup contract requires SL/TP1/TP2, so the following overlays are added and are **not source-validated**:

- **SL** = `k × ATR(14)` beyond entry (k default 1.5) — a protective disaster stop only; adding this changes the risk profile from what was actually tested. The already-decayed SPY-specific edge (Sharpe −2.70 OOS) will not be rescued by a stop-loss overlay.
- **TP1** = 50% of the position closed at `1.0 × ATR(14)` favorable move from entry — an untested partial-profit overlay. Splitting the position was never evaluated by any source and risks cutting the very "run to close" behavior that produces the tested edge.
- **TP2** = the remaining 50% is held to the hard session-close time exit (matches the source's tested exit behavior). The indicator label's `tp2=` field shows an informational **2.0 × ATR(14) projection level only** — it is not a real target price; the actual TP2 exit is time-based (session close), coded in the strategy as `strategy.close_all("EOD")`, not as a limit order.
- ATR(14) is computed continuously (not session-window-scoped) for implementation simplicity, matching the DT ORB v1 reference convention. This may include overnight-gap volatility in the ATR figure, which is a minor deviation from a strictly "session-window ATR" definition and should be revisited if local backtests show SL distances are unstable around session opens.

## State Machine

- **forming**: before the decision bar has resolved for the day. The label shows a live candidate projection (direction implied by the current sign of the opening-window return, current close as a placeholder entry) — informational only, not a live signal.
- **triggered**: the decision bar has fired and both signs agreed — today's single trade has been taken.
- **expired**: the decision bar has resolved and no trade fired (opening-window return not yet locked, signs disagreed, either return was exactly zero, or a trade was already taken).

State resets on `timeframe.change("D")`. Exactly one signal per day, matching the source's "5,200 daily opportunities" single-decision methodology.

## Inputs

| Name | Default | Meaning |
| --- | --- | --- |
| Session preset | RTH | Selects Tokyo, London, NY, RTH, or Custom session handling. |
| Custom session | 0930-1600 | Session string used only when `Session preset` is Custom. |
| Custom timezone | America/New_York | Timezone used only when `Session preset` is Custom. |
| Opening return window | 0930-1000 | Window whose close-to-close move (vs. session open) defines the first-30-minute return. Must start at the session open. |
| Decision window | 1530-1600 | Window whose *start* is decision time T. Default is 30 minutes before a 16:00 RTH close; adjust to match your session preset's actual close time. |
| SL (ATR mult) | 1.5 | Protective stop distance from entry, in ATR(14) units (DT adaptation, not source-validated). |
| TP1 (ATR mult, 50% off) | 1.0 | Favorable-move distance for the 50% partial exit (DT adaptation, not source-validated). |
| TP2 display level (ATR mult) | 2.0 | Informational-only label projection; the real TP2 exit is the session-close time exit, not this price. |

**Important:** the `Opening return window` and `Decision window` inputs are not derived automatically from the session preset — they must be set by hand to match the chosen session's open and close-minus-30-minutes times (this mirrors the DT ORB v1 convention of a separate, explicit `OR window` input). Misconfiguring these relative to the session preset will silently produce no signals or signals at the wrong time.

## SL/TP Model

Entry = close of the decision bar. SL = `entry ∓ 1.5×ATR(14)`. TP1 = `entry ± 1.0×ATR(14)` for 50% of size. Remaining 50% rides the SL to a hard EOD close (`strategy.close_all("EOD")` on the session→non-session transition) — there is no TP2 limit order in the strategy.

## Market And Session Fit

Intended for index futures (ES-class) or SPY-class liquid ETFs only — do not extend to illiquid symbols; the source evidence explicitly does not cover thin names. `RTH`/`NY` are the closest presets for US regular-hours equity/futures workflows. Do not use on markets or sessions the source studies did not cover (the evidence is US-centric; non-US replication was mixed even in the base study).

## Design Review Findings (Codex, read-only pass)

A Codex design review of the state machine surfaced the following implementation-level caveats, which are addressed as documented limitations rather than a full rewrite (to stay consistent with the existing DT setup family's window-based, continuous-ATR conventions):

- **TP2 contract conflict**: the DT label contract requires a numeric `tp2=` price, but this setup's actual second leg is a time-based EOD exit with no known future close price at decision time. Resolved by treating `tp2=` as an explicit **informational-only 2×ATR projection level** (not a real order); the strategy places no TP2 limit order at all — only a stop and the hard session-close exit.
- **Decision-bar timing**: T is implemented as "the open of the first bar inside `decisionWindow`" (matching the existing DT ORB v1 `OR window` convention), which uses that bar's *close* as the decision price — one bar late relative to a strict "bar closing at exactly T" definition (e.g. 15:35 close instead of an exact 15:30 mark on a 5m chart). A precise `request.security_lower_tf()`-based exact-timestamp implementation was considered but not built, to keep this candidate consistent with the rest of the DT setup library's implementation style.
- **Timeframe scope**: the decision-window/session-window alignment logic is only meaningful on standard, real-time 5m/15m intraday charts. The indicator now fails closed (no signals, a visible warning label) on 60m+ charts and non-time-based chart types (Renko, Range, Heikin Ashi, etc.), where the decision minute would fall mid-bar or have no wall-clock meaning.
- **ATR contamination**: `ta.atr(14)` is computed continuously (matching the DT ORB v1 reference), so the first true-range reading of the RTH session can include the overnight/pre-market gap. A session-scoped ATR (reset each RTH, SMA-seeded) would be more theoretically correct but adds significant implementation complexity; flagged here for local backtest validation before live sizing.
- **EOD exit timing**: the strategy's EOD flatten reuses the ORB reference's `inSession[1] and not inSession` transition, which fires on the first bar *after* the session rather than guaranteeing a fill at the exact session-close price. On thin symbols or the last session of the week this could delay the flatten to the next available bar.
- **Session/holiday edge cases**: half-day/early-close sessions are not auto-detected — the fixed `sessStr`/`decisionWindow` inputs assume a normal full session length. On a half day, the default 15:30 decision window and EOD-close logic will not align with the actual (earlier) close; do not trade or backtest across known half-days without manually adjusting the session inputs for that date, or expect the setup to misfire.
- **Same-bar SL/TP1 ambiguity**: if both SL and TP1 are touched within the same 5m/15m bar, OHLC-only backtesting cannot determine which was hit first; enable Bar Magnifier / a lower-timeframe replay when validating fill order locally.
- **Position carryover**: a defensive `strategy.close_all` on `isNewDay` guards against a position surviving into a new session (e.g. after a data gap suppressed the prior day's EOD-close bar) so a stale position cannot mix with the new day's signal state.

## Known Failure Modes

- SPY-specific edge has a **realized negative OOS replication** (2010–2018, Sharpe −2.70) — this is not hypothetical.
- Low OOS explanatory power (R² 1.2–2.8%) means most individual days will look like noise even if the edge is real in aggregate.
- Sample-size discipline from the research sweep's meta-analysis family (`family_meta.md`) notes that detecting a true 55% win rate against a 50% null requires ~617 independent trades at 80% power; at 1 signal/day this setup needs roughly 2.5 years of daily signals to reach that bar per instrument.
- The SL/TP1 overlay is untested by any source and may materially change the realized Sharpe/PF in either direction versus the "let it run" backtest figures quoted above.
- Full retail cost stress (spread + slippage, not just commission/tick) has not been disclosed by any source for the complete sample; validate locally before trusting the headline metrics.
