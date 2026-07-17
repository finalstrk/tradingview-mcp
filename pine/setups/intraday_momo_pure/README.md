# DT Intraday Momentum Pure v1

Candidate setup. **Not adopted.** Do not treat as a live signal source; route to `/setup-verify` or replay practice only.

## Why This Setup Exists

`intraday_momo` (DT Intraday Momentum v1) was just rejected on futures and FX at 15m (`journal/backtests/intraday_momo__*__15__20260717.json`): n=145-180 trades, win rate 26-38%, PF 0.19-0.65, all below the `wr>=45&pf>=1.3 | wr>=35&pf>=1.6` adoption bar.

`intraday_momo` adds a DT-contract risk overlay that the source studies never tested: SL at 1.5x ATR(14), and TP1 taking 50% off at 1.0x ATR(14), with only the remaining 50% held to the session close. The source studies (Gao-Han-Li-Zhou, JFE, SPY 1993-2013; Baltussen et al., 62 global futures, 1974-2020 — see `docs/research/scalping-20260717/family_meta.md` Candidate 1) describe **no stop-loss and no partial profit-taking** as intrinsic to the tested edge: the full position is held to the session close, full stop. Neither source ever evaluated the effect of adding a stop or splitting the position.

**Working hypothesis:** the SL/TP1 overlay is cutting the "run to close" tail behavior that produces the source studies' published edge — i.e. `intraday_momo`'s rejection may be a rejection of the overlay, not of the underlying signal.

`intraday_momo_pure` tests this hypothesis cleanly: identical entry signal and identical session/timing idioms, but the overlay is removed entirely and the exit is exactly the source studies' tested behavior (no stop, hold to session close), with an optional catastrophic-only disaster stop that defaults OFF.

## Logic (identical to intraday_momo)

Session momentum-to-close: the sign of the return from session open to the first 30 minutes of the session, combined with the sign of the return from session open to a decision time 30 minutes before the session close, is used as a single daily directional bet. If both signs agree (and are non-zero), enter in that direction at the decision bar. Built from 1m/5m/15m bars; markets are index futures / SPY-class liquid ETFs per the source evidence.

All timing idioms — opening-window return locked on the confirmed close of the last bar inside the window, decision bar T detected by `time_close` minute-of-day, preset-derived opening/decision windows for Tokyo/London/NY/RTH, `barstate.isconfirmed` gating on every state change, and the `inSession and (not inSession[1] or isNewDay)` session-open anchor (needed for RTH-only feeds with no after-hours bars) — are inherited verbatim from `intraday_momo_indicator.pine` / `intraday_momo_strategy.pine`, which survived 3 Codex review rounds. See `pine/setups/intraday_momo/README.md` for the full rationale behind each idiom; this document only covers what is different.

## What Changed From intraday_momo

| Aspect | intraday_momo | intraday_momo_pure |
| --- | --- | --- |
| Stop-loss | 1.5x ATR(14), always on | Off by default. Optional catastrophic-only "disaster stop" (ATR mult, default 0 = off). |
| Take-profit / partial exit | TP1 closes 50% at 1.0x ATR(14) | None. Full position held to the EOD exit — no partial-exit order exists. |
| Normal exit | Remaining 50% rides to session close | Entire position exits at session close (single exit event, not two legs) |
| Position sizing | `strategy.percent_of_equity`, 10% (static header) | Configurable: "Fixed quantity" (default, 1 unit) or "Percent of equity" (10%, delegated to the unchanged header default via `qty=na`), selected at runtime |
| Entry signal | Identical | Identical |
| Session/timing idioms | — | Identical (verbatim reuse) |

## Honest DT Label Encoding (no stop, no take-profit order)

The DT label contract is `DT|<setup_id>|<dir>|<state>|entry=<price>|sl=<price>|tp1=<price>|tp2=<price>`. This setup has no stop-loss order and no take-profit order by default, so the `sl=`/`tp1=`/`tp2=` fields cannot honestly report real order prices. A Codex design-review pass (read-only, gpt-5.6-sol) was run before implementation specifically on this question; its recommendation is the encoding adopted here:

- **`sl=`**: when the "Disaster stop" input is `0` (default, off), the field reads the literal text `none` — there is no stop order at all, and fabricating a numeric price here would misrepresent the position as protected when it is not. When the disaster stop is enabled (`>0`), `sl=` reports that catastrophic-only backstop level. This is **not** a replication of the removed DT-contract SL; it exists purely as tail-risk insurance and is expected to be sized wide enough that it essentially never fires under the tested "run to close" behavior.
- **`tp1=`/`tp2=`**: always the literal text `none`. No take-profit order and no partial-exit order exist in the strategy at all, at any ATR multiple. An earlier draft of this setup used numeric ATR-multiple "informational projection" values here (mirroring `intraday_momo`'s `tp2=` display-only convention); the Codex design review flagged this as the more dangerous encoding, not the more honest one: `0` is itself a valid price and cannot serve as a null sentinel, and a downstream parser has no reliable way to distinguish an "informational projection" price from a real order price in the same field — the risk of a numeric value being misread as an actual target outweighs its value as a chart reference. `none` was chosen instead as an explicit, unambiguous null token.

Downstream parsers of the DT label format must treat a non-numeric `sl=none`/`tp1=none`/`tp2=none` as "no order exists for this field" rather than attempting `str.tonumber` on it unconditionally. `PINE_CONVENTIONS.md`'s label grammar documents every field as `<price>`; this setup is the first to require a `<price-or-none>` reading, which is noted here as a residual documentation gap rather than silently worked around.

## State Machine (identical to intraday_momo)

- **forming**: before the decision bar has resolved for the day. Live candidate projection, informational only.
- **triggered**: the decision bar has fired and both signs agreed — today's single trade has been taken.
- **expired**: the decision bar has resolved and no trade fired.

State resets on `timeframe.change("D")`. Exactly one signal per day.

## Inputs

| Name | Default | Meaning |
| --- | --- | --- |
| Session preset | RTH | Selects Tokyo, London, NY, RTH, or Custom session handling. |
| Custom session | 0930-1600 | Session string used only when `Session preset` is Custom. |
| Custom timezone | America/New_York | Timezone used only when `Session preset` is Custom. |
| Opening return window override | 0930-1000 | Custom preset only; see intraday_momo README for the auto-derivation rule. |
| Decision window override | 1530-1600 | Custom preset only; see intraday_momo README for the auto-derivation rule. |
| Disaster stop (ATR mult, 0 = off) | 0.0 | Off by default. Catastrophic-only tail-risk backstop, not a replication of the removed DT-contract SL. Should be sized far wider than a normal stop if enabled; any run with this on must be recorded as a separate variant from the pure (off) baseline. |
| Position sizing (strategy only) | Fixed quantity | "Fixed quantity" or "Percent of equity". See Sizing section below. |
| Fixed quantity (strategy only) | 1.0 | Used when sizing = Fixed quantity, passed via `qty=` on every entry. |

## SL/TP Model

Entry = confirmed close of the decision bar. **No stop-loss order and no take-profit order by default** — the full position is held to a hard session-close time exit (`strategy.close_all("EOD")` on the final session bar, detected via its close time reaching the session end), replicating the source studies' actual tested exit exactly. The optional disaster stop, when enabled (`disasterStopAtrMult > 0`), places a single stop order at that ATR distance from entry and is re-issued on subsequent bars while the position is open; it is a tail-risk backstop only and does not partial the position (full size, one exit leg). The `isNewDay` carryover flatten remains as a backstop for days whose final session bar is missing from the feed.

## Sizing

`intraday_momo`'s futures backtests (`journal/backtests/intraday_momo__CME_MINI_DL_*__*__20260717.json`) hit a silent zero-trade sizing trap: `strategy.percent_of_equity` at 10% of a $1,000,000 default account allocates $100k per trade, which is smaller than one ES/NQ/YM contract's notional, so every entry sized to 0 and the tester reported 0 trades before the sizing was manually overridden to a fixed 1 contract for that run. `intraday_momo_pure` exposes this as a runtime input instead of a silent failure mode: **default is "Fixed quantity" at 1 unit**, matching the override that was actually needed to get real futures trade counts. Switch to "Percent of equity" only for instruments where per-unit notional is small relative to account size (e.g. FX, single-share equities), where `intraday_momo`'s FX backtests used percent-of-equity sizing without issue.

Implementation note (per Codex design review): rather than reimplementing TradingView's contract-value/`syminfo.pointvalue`-aware percent-of-equity formula in Pine, "Fixed quantity" mode overrides sizing per-order via an explicit `qty=` argument on `strategy.entry()`, while "Percent of equity" mode passes `qty=na`, which falls back to the strategy declaration's own unchanged `default_qty_type=strategy.percent_of_equity, default_qty_value=10` header — i.e. the exact same built-in sizing calculation `intraday_momo` uses, not an independent approximation of it. This keeps any "Percent of equity" run directly comparable to `intraday_momo`'s existing FX evidence.

## Evidence Grade And Honest Caveats (inherited from intraday_momo)

**Grade: A** (peer-reviewed, multi-decade, multi-asset-class replication), **but carries a disclosed negative independent replication for the SPY/ETF variant that must travel with any use of this setup:**

- An independent 2010-2018 SPY retest (n=1,165, $0.01/share cost) found win rate 49.7%, annual return **-1.37%**, Sharpe **-2.70**. Of 5 ETFs retested in that source, only TLT was marginally positive.
- The original 1993-2013 SPY result (Sharpe 1.08) and the 1974-2020 global futures extension (Sharpe 1.73, positive after 1-tick ES cost) remain positive, but the SPY-specific edge shows clear decay/regime sensitivity post-publication.
- Recursive/expanding-window OOS R² is only 1.2-2.8% — the edge is statistically real but economically small; most days it will look like noise.
- Neither source discloses a full retail cost schedule (spread + slippage, not just commission/tick) for the complete sample.
- **This negative SPY replication is not addressed by removing the SL/TP1 overlay** — it is a property of the underlying signal on that specific instrument/period, not an artifact of the DT risk overlay. Prefer the liquid index-futures variant (ES-class) over the SPY-ETF variant per the source research's own recommendation.

## Candidate-Only Status

This setup is **not adopted** and must not be treated as a live signal source. It exists to run a single-variable ablation test against `intraday_momo`'s rejection (per `journal/specs/intraday_momo_spec.json`'s `validation.diagnostic_test` requirement: record a counter-thesis before refining a failing variant, then run one one-variable test and record the observed difference). Its own promotion past `candidate` status requires:

1. A full backtest run on the same instruments/timeframes that rejected `intraday_momo` (ES/NQ/YM futures and EURUSD/GBPUSD/USDJPY/AUDUSD FX at 15m minimum), recorded in `journal/backtests/` following the `intraday_momo_pure__<symbol>__<tf>__<date>.json` naming convention.
2. Evidence that removing the overlay materially changes the PF/WR outcome (the diagnostic test this setup exists to run) — if PF/WR are still below the adoption bar with the overlay removed, the overlay was not the cause of the rejection and the underlying signal itself should be treated as not viable on these instruments/timeframes.
3. The same holdout/OOS discipline as `intraday_momo_spec.json` (in-sample/out-of-sample/holdout periods, parameter freeze before holdout) before any registry status change.
4. Independent review before any live or paper-trading promotion.

## No-Stop / EOD-Only Pitfalls (design-review findings, via Codex)

- **Same-bar entry + EOD flatten**: with `process_orders_on_close=true`, an order placed via `strategy.entry()` earlier in a bar's script execution has not yet updated `strategy.position_size` within that same execution (it fills at the bar's close, after the script has already run). A naive "flatten if there's a position" check on the same bar as the entry would therefore see `position_size == 0` and do nothing, silently letting a same-bar entry carry an unmanaged position past the intended exit. `windowsOk` already guarantees `decisionTimeMin < sessEndMin` strictly, so the decision bar and the final session bar can never coincide for a coherent config — but the strategy still defensively excludes `isFinalSessionBar` from the entry condition (`longSignal`/`shortSignal`) rather than relying on that invariant alone.
- **Carryover + new-day entry mixing**: the `isNewDay` carryover flatten runs before the entry logic each day, but as additional defense the entry guard also requires `strategy.position_size == 0`, so a still-open position (e.g. from a data gap that suppressed the carryover flatten's own trigger bar) cannot mix with a new day's signal.
- **`isNewDay` is a backstop, not overnight-gap protection**: it recovers a stuck position at the next available bar's close, in whatever regime that bar happens to trade in — it does not prevent the position from having been held overnight in the first place. Any local backtest/paper run of this setup must report carryover-flatten trigger count, open-trades-at-dataset-end count, and confirm every normal exit's reason is `"EOD"` (not `"Carryover flatten"`) as a QA gate; non-zero carryover/margin-call counts indicate the final-session-bar detection missed a day and should be investigated before trusting that run's metrics.
- **Half-day / early-close sessions**: not auto-detected (same limitation as `intraday_momo`). On a half day the derived decision time and EOD-close logic will not align with the actual (earlier) close; do not trade or backtest across known half-days without switching to the Custom preset with adjusted windows for that date.
- **Fill-model honesty**: `process_orders_on_close=true` is necessary to replicate the source studies' "enter at T's close, exit at session close" methodology, but it is a research fill model, not proof of live executability — a real-time alert fired off the same bar's close cannot necessarily be filled at that exact price once the market has moved on. Any promotion past `candidate` status must also record a stress fill model (next-bar-open or equivalent) alongside the primary one, per `journal/specs/intraday_momo_pure_spec.json`'s `execution.stress_fill_model`.
- **Unbounded per-trade risk (by design, when the disaster stop is off)**: this is the entire point of the ablation test, but it means intraday drawdown on any single held position is not bounded the way `intraday_momo`'s SL bounded it. Treat any local evaluation run as carrying materially higher per-trade tail risk than `intraday_momo`, and size accordingly even in paper trading.

## Known Failure Modes (inherited from intraday_momo, still applicable)

- SPY-specific edge has a **realized negative OOS replication** (2010-2018, Sharpe -2.70) — this is not hypothetical and is not fixed by removing the SL/TP1 overlay.
- Low OOS explanatory power (R² 1.2-2.8%) means most individual days will look like noise even if the edge is real in aggregate.
- Sample-size discipline (`family_meta.md`) notes ~617 independent trades are needed to distinguish a true 55% win rate from 50% at 80% power; at 1 signal/day this needs roughly 2.5 years of daily signals per instrument.
- Removing the SL/TP1 overlay increases per-trade tail risk versus `intraday_momo` (no bounded loss per trade unless the disaster stop is enabled) — this is the entire point of the test, but it means any local paper/live evaluation of this setup carries materially higher per-trade risk than `intraday_momo` did, and position sizing must account for that unbounded-until-EOD downside.
- Full retail cost stress (spread + slippage, not just commission/tick) has not been disclosed by any source for the complete sample; validate locally before trusting the source studies' headline metrics.
