# DT Intraday Momentum v1

Candidate setup. **Not adopted.** Do not treat as a live signal source; route to `/setup-verify` or replay practice only.

## Logic

Session momentum-to-close: the sign of the return from session open to the first 30 minutes of the session, combined with the sign of the return from session open to a decision time 30 minutes before the session close, is used as a single daily directional bet. If both signs agree (and are non-zero), enter in that direction at the decision bar and hold to the session close (hard time exit). Built from 1m/5m/15m bars; markets are index futures / SPY-class liquid ETFs.

Timing semantics (v1 hardened):

- The **opening-window return** is measured from the session open (first in-session bar's `open`) to the **confirmed close of the last bar inside the opening window** — the bar whose close time reaches the window end (e.g. the 09:55–10:00 bar on a 5m RTH chart, closing exactly at 10:00). The measured window therefore matches its definition exactly — it is no longer a 35-min/45-min return taken from the close of the first bar after the window.
- The **decision bar T** is the bar whose **close time reaches the decision time** (session close − 30 min). The decision is evaluated on that bar's confirmed close — not on the close of the bar that merely *starts* at the decision time (which would have decided at 15:35/15:45 on 5m/15m charts). Boundary detection compares the bar's `time_close` minute-of-day in the session timezone, the same mechanism as the DT Noise Area Breakout v1 checkpoint gate.
- For the Tokyo/London/NY/RTH presets, the opening window and decision time are **auto-derived from the resolved session string** (open → open+30min, close−30min → close). The `openWindow`/`decisionWindow` inputs act as overrides only when the preset is Custom. This removes the silent failure where the fixed 15:30 ET defaults never fire on non-NY presets (e.g. Tokyo closes at 15:00).
- All state changes, signals, and alerts are gated on `barstate.isconfirmed`, so nothing evaluates or repaints off a still-forming intrabar close.
- The **session-open anchor** re-arms on the first in-session bar after either a session gap (`inSession` was false on the prior bar) **or** a new day (`timeframe.change("D")`). On an RTH-only feed with no after-hours bars, the prior day's last bar and the next day's first bar are both in-session back-to-back, so a plain "was out of session" transition only ever fires once, on the first day of the chart — the new-day clause is what re-arms `sessionOpenPrice` (and therefore every downstream return/signal) every subsequent day.

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
| Opening return window override | 0930-1000 | **Custom preset only.** For the four built-in presets the opening window is auto-derived as [session open, session open + 30min]. |
| Decision window override | 1530-1600 | **Custom preset only.** For the four built-in presets the decision time is auto-derived as session close − 30min. T = the bar whose confirmed close reaches that time. |
| SL (ATR mult) | 1.5 | Protective stop distance from entry, in ATR(14) units (DT adaptation, not source-validated). |
| TP1 (ATR mult, 50% off) | 1.0 | Favorable-move distance for the 50% partial exit (DT adaptation, not source-validated). |
| TP2 display level (ATR mult) | 2.0 | Informational-only label projection; the real TP2 exit is the session-close time exit, not this price. |

**Custom preset responsibility:** when `Session preset` is Custom, the two window inputs are used verbatim and must be set by hand to match the custom session's open and close-minus-30-minutes times. Misconfiguring them will silently produce no signals or signals at the wrong time. For the built-in presets this hand-tuning is no longer needed — the windows are derived from the session string, and if the derivation is incoherent (pathologically short session) the setup **fails closed**: no signals, and a single managed red warning label explains why.

## SL/TP Model

Entry = confirmed close of the decision bar (the bar whose close time reaches decision time). SL = `entry ∓ 1.5×ATR(14)`. TP1 = `entry ± 1.0×ATR(14)` for 50% of size — both placed in the same bar as the entry order, so the entry bar is never unprotected. Remaining 50% rides the SL to a hard EOD close (`strategy.close_all("EOD")` on the final session bar, detected via its close time reaching the session end) — there is no TP2 limit order in the strategy.

## Market And Session Fit

Intended for index futures (ES-class) or SPY-class liquid ETFs only — do not extend to illiquid symbols; the source evidence explicitly does not cover thin names. `RTH`/`NY` are the closest presets for US regular-hours equity/futures workflows. Do not use on markets or sessions the source studies did not cover (the evidence is US-centric; non-US replication was mixed even in the base study).

## Design Review Findings And Hardening (Codex + adversarial pass)

A Codex design review plus a follow-up adversarial review drove the following changes. Items marked **fixed** were code changes in this version; the rest remain documented limitations:

- **Repaint gating (fixed)**: all state changes, decision evaluation, signal events, and alerts are gated on `barstate.isconfirmed`. Previously the decision and alerts could fire off an intrabar close and repaint when the bar settled.
- **Opening-window return timing (fixed)**: the first-30-minute return is now locked on the confirmed close of the **last bar inside** the opening window (the bar whose close time reaches the window end). Previously it used the close of the first bar *after* the window, silently measuring a 35-min (5m) or 45-min (15m) return.
- **Decision-bar timing (fixed)**: T is now the bar whose close time (`time_close` minute-of-day) reaches the decision time, evaluated on that bar's confirmed close. Previously T was the first bar *starting* inside the decision window, deciding one bar late (15:35/15:45 on 5m/15m).
- **EOD exit timing (fixed)**: the strategy detects the final session bar via its close time reaching the session end and flattens on that bar (with `process_orders_on_close=true` the fill is that bar's close, i.e. the session-close price). Previously it required a subsequent out-of-session bar (`inSession[1] and not inSession`), which never exists on an RTH-only feed — positions would carry overnight. The defensive `strategy.close_all` on `isNewDay` is retained as a backstop for data gaps.
- **Entry-bar protection (fixed)**: `strategy.exit` orders (SL + TP1) are now placed inside the entry signal block with the freshly computed prices, so the entry bar is never open without protective orders. The per-bar re-issue block remains for subsequent bars.
- **Preset-derived windows (fixed)**: opening-window end and decision time are derived from the resolved session string for the four built-in presets (open+30min / close−30min); fixed wall-clock inputs remain only as Custom-preset overrides (only the opening window's END and the decision window's START are consumed). The coherence check applies to Custom too, and failure (including midnight-wrapping sessions, which the minute-of-day comparison cannot handle) fails closed with a single managed warning label.
- **Timeframe allowlist (fixed)**: the guard is now an explicit allowlist of `1`, `5`, `15` chart resolutions (previously any intraday timeframe ≤15 — e.g. 2m/3m/10m — passed through unvalidated), and the warning label is a single `var` label that is moved/retextured rather than recreated every bar.
- **TP2 contract conflict**: the DT label contract requires a numeric `tp2=` price, but this setup's actual second leg is a time-based EOD exit with no known future close price at decision time. Resolved by treating `tp2=` as an explicit **informational-only 2×ATR projection level** (not a real order); the strategy places no TP2 limit order at all — only a stop and the hard session-close exit.
- **ATR contamination**: `ta.atr(14)` is computed continuously (matching the DT ORB v1 reference), so the first true-range reading of the RTH session can include the overnight/pre-market gap. A session-scoped ATR (reset each RTH, SMA-seeded) would be more theoretically correct but adds significant implementation complexity; flagged here for local backtest validation before live sizing.
- **Session/holiday edge cases**: half-day/early-close sessions are not auto-detected — the derived windows assume the preset's normal full session length. On a half day, the derived decision time and EOD-close logic will not align with the actual (earlier) close; do not trade or backtest across known half-days without switching to the Custom preset with adjusted windows for that date, or expect the setup to misfire.
- **Same-bar SL/TP1 ambiguity**: if both SL and TP1 are touched within the same bar, OHLC-only backtesting cannot determine which was hit first; enable Bar Magnifier / a lower-timeframe replay when validating fill order locally.
- **Position carryover**: a defensive `strategy.close_all` on `isNewDay` guards against a position surviving into a new session (e.g. after a data gap suppressed the prior day's final session bar) so a stale position cannot mix with the new day's signal state.
- **Session-open anchor on RTH-only feeds (fixed, round 2)**: `sessionOpenTrigger` was `inSession and not inSession[1]` — a plain out-of-session→in-session transition. On a feed with no after-hours bars (e.g. RTH-only data), the previous day's last bar is still `inSession = true`, so that transition only fires once, on the very first session of the chart; from day 2 onward `sessionOpenPrice` stayed `na` forever and the setup produced no opening return, no decision, and no signals. Fixed to `inSession and (not inSession[1] or isNewDay)`, i.e. the first in-session bar after either a session gap or a new-day reset, in both the indicator and the strategy. The `isNewDay` state-reset block (which clears `sessionOpenPrice` to `na`) still runs before this trigger is consumed, so the anchor clears and re-anchors cleanly each day.

## Known Failure Modes

- SPY-specific edge has a **realized negative OOS replication** (2010–2018, Sharpe −2.70) — this is not hypothetical.
- Low OOS explanatory power (R² 1.2–2.8%) means most individual days will look like noise even if the edge is real in aggregate.
- Sample-size discipline from the research sweep's meta-analysis family (`family_meta.md`) notes that detecting a true 55% win rate against a 50% null requires ~617 independent trades at 80% power; at 1 signal/day this setup needs roughly 2.5 years of daily signals to reach that bar per instrument.
- The SL/TP1 overlay is untested by any source and may materially change the realized Sharpe/PF in either direction versus the "let it run" backtest figures quoted above.
- Full retail cost stress (spread + slippage, not just commission/tick) has not been disclosed by any source for the complete sample; validate locally before trusting the headline metrics.
