# DT ORB v1

DT ORB v1 detects an opening range breakout after the initial market window is locked. It is designed for intraday products where the first 30 minutes define a useful auction range, then looks for the first valid break above or below that range while enforcing a maximum range width, a time limit, and one signal per day.

## Detection Conditions

- Build the opening range from the `OR window` high and low using persistent `orHigh` and `orLow` values.
- Lock the opening range on the first bar after the `OR window` ends.
- Long signal: `orLocked and ta.crossover(close, orHigh)`.
- Short signal: `orLocked and ta.crossunder(close, orLow)`.
- Range filter: `(orHigh - orLow) < ta.atr(14) * Max OR width (ATR mult)`.
- Validity filter: the signal must occur within `Signal validity (bars)` after the range locks.
- Frequency filter: only the first valid signal is accepted each trading day.

## Inputs

| Name | Default | Meaning |
| --- | --- | --- |
| Session preset | RTH | Selects Tokyo, London, NY, RTH, or Custom session handling. |
| Custom session | 0930-1600 | Session used only when `Session preset` is `Custom`. |
| Custom timezone | America/New_York | Timezone used only when `Session preset` is `Custom`. |
| OR window | 0930-1000 | Time window used to build the opening range. |
| Max OR width (ATR mult) | 2.5 | Rejects days where the opening range is too wide versus ATR(14). |
| Signal validity (bars) | 24 | Maximum number of bars after range lock where a breakout can trigger. |

## SL/TP Model

For long signals, entry is the signal close, SL is `orLow`, TP1 is `entry + (orHigh - orLow)`, and TP2 is `entry + (orHigh - orLow) * 2`. For short signals, entry is the signal close, SL is `orHigh`, TP1 is `entry - (orHigh - orLow)`, and TP2 is `entry - (orHigh - orLow) * 2`. The strategy version submits two exits: TP1 for 50% quantity and TP2 for the remaining 50%, both protected by the same SL.

## Recommended Markets and Sessions

Use `RTH` for US index futures, US equities, and ETFs that center around the New York cash open. Use `NY` for similar US intraday markets when the RTH label is not preferred. Use `London` for European index and FX workflows around the London open. Use `Tokyo` for Japan cash-session instruments. Use `Custom` when the product has an exchange-specific open or when the OR window should be measured in a different timezone.
