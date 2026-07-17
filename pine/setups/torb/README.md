# DT TORB v1 — Time-based Opening Range Breakout

## Logic

Fix a short "probe window" at session open (default `0930-0931`, i.e. a
1-minute opening range on the 1-minute chart). Once the probe window closes,
the opening-range (OR) high/low are locked. The **first confirmed bar whose
close lands outside the locked range** — within a configurable validity
window measured in bars — triggers an entry in that direction (long above OR
high, short below OR low). Max 1 signal per instrument per session. An ATR
filter rejects days where the OR is unusually wide relative to volatility.

Direct-comparison entry logic (`close > orHigh` / `close < orLow`) is used
instead of `ta.crossover()`/`ta.crossunder()`, because TORB's rule is "first
eligible confirmed bar that closes outside," not "a value that crossed a
threshold between bars" — a same-bar gap that opens and closes outside the
range must still qualify, and `crossover` can miss that case.

## Evidence grade and honest caveats

**Grade: A (peer-reviewed) / B in practice.** Source: Chan, T., et al.,
"Timely Opening Range Breakout" (TORB), IEEE Access,
[10.1109/ACCESS.2019.2899177](https://doi.org/10.1109/ACCESS.2019.2899177).
Reported on DJIA (4-min OR), S&P 500 and Nasdaq (1-min OR), HSI and TAIEX
index futures, 2001/03–2013, N=1,381–3,099 trades per market, annual net
return 8.95%–20.28% with an assumed 0.01%/trade cost, full-sample
p=3.1×10⁻⁵.

This setup is **not** an out-of-the-box replication. Deviations from the
source, all of which are untested and must be re-verified before any live
use:

- **Probe-time (OR window length) was chosen in-sample per instrument** in
  the source paper (DJIA 4 min, S&P/NASDAQ 1 min, HSI 151 min, TAIEX 37 min)
  with no multiple-testing correction. The `orWindow` default here
  (`0930-0931`, 1 min) matches the S&P/NASDAQ best-N but is not re-derived
  for whatever instrument this is actually run on — treat it as a starting
  point requiring its own calibration/holdout, not a validated parameter.
- **No OOS beyond 2013.** There is a 13+ year gap between the source data
  and today; market microstructure, HFT activity, and OR-breakout crowding
  have all changed materially since 2003–2013.
- **S&P 2007–2013 sub-period was not statistically significant** (p=14.6%)
  in the source paper — the pooled full-sample significance masks a
  materially weaker recent-history result.
- **Source has no stop-loss and no take-profit — it exits only at session
  close (EOD).** This is documented as part of the source's edge (letting
  winners run uncapped). The DT contract requires discrete SL/TP1/TP2, so
  this implementation adds:
  - SL = opposite side of the OR range (a protective risk-control stop, not
    part of the tested edge).
  - TP1 = 50% at 1× OR-range extension from entry (an explicit, untested DT
    adaptation).
  - TP2 = the remaining 50% held to session close, approximating the
    source's EOD-only exit — **the strategy script does not place a limit
    order at the label's `tp2` price.** The `tp2` field in the DT label is a
    **display-only 2×-range reference level**, not an executable order
    price; the real exit for the runner leg is "flat at session close,"
    whose price is unknown ahead of time and cannot be encoded as a fixed
    `tp2=` value in the label contract. Any downstream consumer that treats
    `tp2` as a live limit-order target for this setup will be wrong.
  - Family-level research (`docs/research/scalping-20260717/family_risk.md`)
    found that adding a TP1/TP2 partial-exit layer to a comparable
    stop-only opening-range breakout system (GAORB, Taiwan futures, Grade A)
    raised win rate but roughly **halved** Sharpe and annual return
    (2.495→1.320, 9.3%→4.1%). There is no Grade A/B evidence in this family
    that partial exits improve risk-adjusted return for this style of
    setup — this SL/TP1/TP2 overlay should be expected to underperform the
    unadapted, EOD-only source strategy, not merely approximate it.
- **0.01%/trade assumed cost in the source is thin** for anything but the
  most liquid contracts, and includes no spread/slippage beyond that flat
  figure. Real index-futures stop-market fills at an OR-break — typically
  one of the highest-slippage moments of the session — could be materially
  worse.
- **5-minute or slower charts do not reproduce a 1-minute OR, and are no
  longer reachable.** A true 1-minute probe window pulled onto a 5-minute
  chart would silently degrade to the full 09:30–09:35 bar's high/low (a de
  facto 5-minute OR), not a true 1-minute OR. Reproducing a genuine
  1-minute probe on a slower chart would need `request.security_lower_tf()`,
  which this implementation does not use. Both scripts now detect this
  configuration (OR probe = 1 minute, chart timeframe != 1 minute) and
  **fail closed**: no long/short signal, no DT label, and no strategy entry
  is produced while the mismatch holds — only the on-chart warning label and
  the plotted OR range still update. `journal/registry.json` lists only
  timeframe `"1"` as validated for every market, matching this: the
  degraded >1m variant referenced in earlier revisions of this README is no
  longer a live code path, only a documented historical caveat. Treat the
  1-minute chart as the setup's only supported mode.

## Inputs

| Name | Default | Meaning |
|---|---|---|
| Session preset | `RTH` | Selects the trading session (Tokyo/London/NY/RTH/Custom). |
| Custom session | `0930-1600` | Session string used when preset = Custom. |
| Custom timezone | `America/New_York` | Timezone used when preset = Custom. |
| OR window (probe time, Custom preset only) | `0930-0931` | Explicit OR probe window, used **only** when Session preset = Custom. Ignored for Tokyo/London/NY/RTH — see "OR window derivation" below. |
| OR probe minutes (Tokyo/London/NY/RTH presets) | `1` | Length in minutes of the auto-derived OR probe window for the four presets, measured from the resolved session open. Ignored when Session preset = Custom. |
| Max OR width (ATR mult) | `2.5` | Rejects the day if `orWidth > ATR(14) * this`, evaluated once at OR lock and frozen for the session. |
| Signal validity (bars) | `24` | Number of confirmed bars after OR lock during which a breakout may still trigger; after this the state becomes `expired` if untraded. |

### OR window derivation (preset-agnostic fix)

An earlier revision hard-coded the `orWindow` default to `0930-0931` for
**every** session preset, including Tokyo (opens 09:00 local) and London
(opens 08:00 local). Since the probe window never overlapped those presets'
actual session open, the opening range was built from an empty probe (`na`
OR high/low) for Tokyo and London — the setup silently never traded on
those presets regardless of `orWindowMismatch`/timeframe.

Both scripts now derive the OR probe window from the **resolved session
open** for the four presets: `[session open, session open + OR probe
minutes]` (`orProbeMinutes` input, default 1). The `OR window (probe time,
Custom preset only)` input is consumed **only** when Session preset =
Custom; it is ignored for Tokyo/London/NY/RTH. This makes the OR
window correct for all four presets without requiring per-preset input
retuning.

## SL/TP model

- **SL**: opposite side of the locked OR range (long stops at OR low, short
  stops at OR high).
- **TP1**: 50% of the position exits at entry ± 1× OR range width.
- **TP2**: remaining 50% held with only the protective stop attached; the
  strategy closes the whole position at session end. The `tp2` value in the
  DT label is a display-only 2×-range reference, not a working order.
- `strategy.exit()` for TP1 and the runner stop is placed inside the same
  `if longSignal ...` / `if shortSignal ...` block as `strategy.entry()`,
  using the SL/TP prices already computed on that bar. An earlier revision
  placed the exits in a separate block guarded only by
  `strategy.position_size`, which (with `process_orders_on_close=true`)
  left a same-bar entry with no working exit order for one full bar, since
  `strategy.position_size` does not reflect the new position until the
  following bar. This has been fixed; see the code comment above the entry
  blocks in `torb_strategy.pine`.

### Session-end (EOD) flatten

**Corrected in this revision.** An earlier revision detected session end via
`sessionEndBar = inSession and na(time_close(timeframe.period, sessStr,
tzStr))`. This was wrong and never fired: `time_close(timeframe, session,
tz)` determines session membership from the bar's **open** time, exactly
like `time()` — despite the name, it is not evaluated against the bar's
close time. So `na(time_close(...))` is `na` under exactly the same
condition as `na(time(...))`, meaning the last in-session bar (whose open is
still inside the session) always returned a non-`na` `time_close`, and
`sessionEndBar` was permanently `false`. The strategy's EOD flatten and the
indicator's `forming`→`expired` state transition both silently never fired
on any chart, and a position could carry overnight indefinitely.

Both scripts now compute the current bar's close-time minute-of-day
independently — `barCloseMin = hour(time_close, tzStr) * 60 +
minute(time_close, tzStr)` — and detect the final session bar as
`isFinalSessionBar = sessionWindowOk and inSession and barstate.isconfirmed
and barCloseMin >= sessEndMin`, where `sessEndMin` is the session's end time
in minutes-of-day (parsed from `sessStr`). This is the same idiom already
used by `intraday_momo_strategy.pine` / `intraday_momo_indicator.pine` and
`noise_break_strategy.pine` / `noise_break_indicator.pine`. It intentionally
diverges from the `inSession[1] and not inSession` idiom documented in
`pine/PINE_CONVENTIONS.md` and still used by the DT ORB v1 reference
(`pine/setups/orb`): that idiom only fires on the first bar *outside* the
session, which never exists on an RTH-only chart (no after-hours data), so
it would have the same silent-carryover problem the old `time_close` idiom
had. This divergence is local to `torb` (and the other setups listed above)
and has not been back-ported to the `orb` reference or to
`pine/PINE_CONVENTIONS.md`.

`sessionWindowOk = sessStartMin < sessEndMin` guards the midnight-wrap case:
minute-of-day comparison cannot represent an overnight session, so
`isFinalSessionBar` (and OR-window derivation) fail closed — never fire — if
the resolved session's end time is not numerically after its start time.
The strategy additionally keeps an `isNewDay`-triggered carryover flatten as
a backstop for a session whose final bar is entirely missing from the feed
(same pattern as `intraday_momo_strategy.pine`).

`torb_indicator.pine` uses the same `isFinalSessionBar` detection for its
session-end state transition: an eligible-but-unfired range flips to
`expired` on the last in-session bar. With the old idiom this transition
never fired and the label stayed `forming` until the next day's reset.

## Known limitations

- **Daily reset does not support overnight Custom sessions.** `isNewDay =
  timeframe.change("D")` resets the opening-range/trade-of-day state at the
  exchange's calendar-day boundary, not at the configured session's own
  start/end. This is correct for Tokyo/London/NY/RTH and any same-day Custom
  session, but an overnight Custom session (starting before midnight,
  ending after it) would have its state reset mid-session instead of at the
  session boundary. This is an accepted limitation shared by every setup in
  this library (see `pine/PINE_CONVENTIONS.md`'s session-handling
  convention), not something fixed locally in `torb`. As of this revision,
  the same overnight/midnight-wrap case is additionally caught and
  fail-closed by `sessionWindowOk` (see "Session-end (EOD) flatten" above)
  for the specific minute-of-day comparisons this setup now uses — signals
  are disabled rather than misbehaving, but the daily-reset timing itself is
  still the accepted, unfixed limitation described here.
- **On-chart warning for the 1-minute-OR / chart-timeframe mismatch — now
  fail-closed, not just a warning.** Both `torb_indicator.pine` and
  `torb_strategy.pine` detect, at input-parse time, whether the *effective*
  OR probe window (after preset-based derivation — see "OR window
  derivation" above) is exactly 1 minute long while the chart timeframe is
  not 1 minute, and draw a single managed warning label (`"TORB: OR
  window=Nm but chart TF=... — signals disabled (unvalidated variant)"`)
  anchored to the latest bar. Unlike the prior revision, this condition now
  also **disables all long/short signals and DT labels** (`tradingAllowed`
  gate) — it no longer just warns while silently trading the degraded
  chart-bar-range OR. This matches `journal/registry.json`, which lists only
  timeframe `"1"` as validated for every market: the previously-described
  ">1m degraded variant" is no longer a reachable code path, only a
  documented historical caveat (see "5-minute or slower charts do not
  reproduce a 1-minute OR..." above). The underlying limitation itself
  (`request.security_lower_tf()` is not used) is unchanged — this only
  changes what the setup does when the mismatch is detected, from "trade
  anyway with a visible warning" to "refuse to trade."

## Markets / session

Designed for liquid index futures (ES/NQ/YM-class), 1-minute chart, RTH
session preset. 5-minute charts are supported by the session/preset
machinery but do not reproduce a true 1-minute probe window (see caveats
above) — treat 5-minute results as a distinct, unvalidated variant; a chart
warning label now flags this condition on-chart (see "Known limitations").

## Status

Candidate only. Not registered in `journal/registry.json` and not eligible
for `/trade-judge` until backtested and reviewed per
`journal/specs/torb_spec.json`.
