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
- **5-minute or slower charts do not reproduce a 1-minute OR.** Setting
  `orWindow` to `0930-0931` on a 5-minute chart pulls in the full 09:30–09:35
  bar's high/low (a de facto 5-minute OR), not a true 1-minute OR. If a
  1-minute probe window is required on a slower chart, this would need
  `request.security_lower_tf()`, which this implementation does not use.
  Treat the 1-minute chart as the setup's primary, source-faithful mode.

## Inputs

| Name | Default | Meaning |
|---|---|---|
| Session preset | `RTH` | Selects the trading session (Tokyo/London/NY/RTH/Custom). |
| Custom session | `0930-1600` | Session string used when preset = Custom. |
| Custom timezone | `America/New_York` | Timezone used when preset = Custom. |
| OR window (probe time) | `0930-0931` | Opening-range probe window; locks OR high/low at window close. |
| Max OR width (ATR mult) | `2.5` | Rejects the day if `orWidth > ATR(14) * this`, evaluated once at OR lock and frozen for the session. |
| Signal validity (bars) | `24` | Number of confirmed bars after OR lock during which a breakout may still trigger; after this the state becomes `expired` if untraded. |

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

The strategy flattens at session end on `sessionEndBar`, defined as `inSession
and na(time_close(timeframe.period, sessStr, tzStr))` — the last bar whose
*open* is still inside the session but whose *close* reaches or passes the
session end boundary. This intentionally diverges from the
`inSession[1] and not inSession` idiom documented in `pine/PINE_CONVENTIONS.md`
and still used by the DT ORB v1 reference (`pine/setups/orb`): that idiom
only fires on the first bar *outside* the session, which never exists on an
RTH-only chart (no after-hours data), so the flatten never triggered and a
position could carry overnight unintentionally. This divergence is local to
`torb` and has not been back-ported to the `orb` reference or to
`pine/PINE_CONVENTIONS.md`.

`torb_indicator.pine` uses the same `sessionEndBar` detection for its
session-end state transition: an eligible-but-unfired range flips to
`expired` on the last in-session bar. With the old idiom this transition
never fired on an RTH-only chart and the label stayed `forming` until the
next day's reset.

## Known limitations

- **Daily reset does not support overnight Custom sessions.** `isNewDay =
  timeframe.change("D")` resets the opening-range/trade-of-day state at the
  exchange's calendar-day boundary, not at the configured session's own
  start/end. This is correct for Tokyo/London/NY/RTH and any same-day Custom
  session, but an overnight Custom session (starting before midnight,
  ending after it) would have its state reset mid-session instead of at the
  session boundary. This is an accepted limitation shared by every setup in
  this library (see `pine/PINE_CONVENTIONS.md`'s session-handling
  convention), not something fixed locally in `torb`.
- **On-chart warning for the 1-minute-OR / chart-timeframe mismatch.** Both
  `torb_indicator.pine` and `torb_strategy.pine` now detect, at input-parse
  time, whether the configured `orWindow` is exactly 1 minute long while the
  chart timeframe is not 1 minute, and draw a single managed warning label
  (`"TORB: OR window=1m but chart TF=... — OR degrades to chart-bar range
  (unvalidated variant)"`) anchored to the latest bar. This does not change
  the underlying limitation described above ("5-minute or slower charts do
  not reproduce a 1-minute OR") — it only makes the degraded-mode condition
  visible on the chart instead of silent.

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
