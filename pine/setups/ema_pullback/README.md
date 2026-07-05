# DT EMA Pullback v1

DT EMA Pullback v1 detects continuation entries in a directional EMA20/EMA50 regime. It waits for price to pull back into EMA20 while preserving the close on the trend side, then requires a nearby breakout within a short trigger window so the signal avoids late, extended entries.

## Detection Summary

- Long regime: EMA20 is above EMA50, and EMA50 is above its value `Slope lookback` bars ago.
- Long pullback: `low <= ema20` and `close > ema20`.
- Long trigger: after the pullback, within `Trigger window (bars)`, `close > high[1]`.
- Long chase filter: trigger close must be below `ema20 + ATR(14) * Max distance from EMA (ATR)`.
- Short logic is symmetric: EMA20 below EMA50, EMA50 sloping down, EMA20 touch from above, then `close < low[1]`.
- Signals are capped by `Max signals per day` and reset on `timeframe.change("D")`.
- Indicator state labels use `forming`, `triggered`, and `expired`; only the latest label is retained.

## Inputs

| Name | Default | Meaning |
| --- | --- | --- |
| Session preset | NY | Selects Tokyo, London, NY, RTH, or Custom session handling. |
| Custom session | 0930-1600 | Session string used only when `Session preset` is Custom. |
| Custom timezone | America/New_York | Timezone used only when `Session preset` is Custom. |
| EMA 20 length | 20 | Fast EMA length used as the pullback mean. |
| EMA 50 length | 50 | Slow EMA length used for trend regime filtering. |
| Slope lookback | 5 | Bars used to confirm EMA50 slope direction. |
| Trigger window (bars) | 3 | Maximum bars allowed between pullback and breakout trigger. |
| Max distance from EMA (ATR) | 1.0 | Maximum trigger distance from EMA20, measured in ATR(14). |
| Max signals per day | 2 | Maximum triggered signals allowed per trading day. |

## SL/TP Model

For long signals, entry is the trigger close, SL is `ta.lowest(low, 5) - ta.atr(14) * 0.25`, TP1 is RR1.0, and TP2 is RR2.0. For short signals, entry is the trigger close, SL is `ta.highest(high, 5) + ta.atr(14) * 0.25`, TP1 is RR1.0, and TP2 is RR2.0. The strategy exits at TP2 or SL, and also closes early on a long close below EMA20 or a short close above EMA20.

## Market And Session Fit

The default `NY` preset is intended for liquid intraday index, futures, FX, and large-cap equity markets during active US hours. `RTH` is the closest preset for US regular-hours equity and index-futures workflows, while `London` can fit European index and FX sessions. Use `Custom` only when the instrument's primary venue or personal trading window differs from the built-in presets.
