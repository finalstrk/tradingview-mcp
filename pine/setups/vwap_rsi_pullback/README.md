# DT VWAP RSI Pullback v1 (candidate)

Morning VWAP + RSI(2) pullback continuation. Price qualifies a trend by closing on
one side of the session VWAP for 3 consecutive bars inside the entry window, then
touches VWAP with RSI(2) at an extreme (< 25 for longs, > 75 for shorts). Entry
fires on the next bar closing back on the trend side of VWAP. This is a **paper
research candidate**, not an adopted live setup — see Evidence grade below.

## Evidence grade: B (single-lineage, unreplicated)

- Recurs across 5 independent research passes (`vwap_012`, `vwap_014`, `vwap_017`,
  `vwap_019`, `vwap_020` in `docs/research/scalping-20260717/`), but **all five
  trace to the same single QQQ study** (2024-01 to 2025-06, pinegen.ai/fractiz.com
  sourcing) — this is repeated citation of one dataset, not independent
  replication.
- No out-of-sample split disclosed by the source. The reported PF (1.54 all-day,
  312 trades, 52.6% WR) is entirely in-sample for the tested window.
- The morning-only sub-window (09:45–11:30, PF 2.08, 186 trades) that this setup's
  entry window defaults to was **extracted post-hoc from the same sample** used
  for the all-day number — every one of the 5 research passes independently
  flags this as a multiple-testing / data-snooping risk, not a pre-registered
  filter. Expect live performance to regress toward the weaker all-day figure or
  worse.
- Source cost model is a flat $0.02/share commission only — no slippage or spread
  modeled. QQQ spread plus any adverse 5m-close fill could erode a meaningful
  fraction of the ~$0.34 average trade P&L implied by the reported PF.
- Markets: **QQQ only** in the source. Index futures (ES/NQ) are an untested
  extrapolation for this specific VWAP+RSI(2) logic — the adjacent
  "Opening-Drive Anchored VWAP Retest" family member is documented on ES/NQ/RTY,
  but that is a *different* rule set, not this one.
- RSI(2) length, the 3-bar confirmation count, and the 1.5x ATR stop multiplier
  are three simultaneously-tunable parameters with no disclosed sensitivity or
  robustness check in the source — joint overfitting risk is unaddressed.
- A structurally adjacent family member (Session-VWAP Pullback Continuation,
  NQ/ES/YM 5m) independently tested at PF 1.01–1.11 (near-breakeven pre-cost),
  and a separate VWAP+RSI/BB mean-reversion variant on BTC/ETH tested at PF
  0.22–0.91 (net losing) — both are cautionary evidence that "VWAP touch +
  oscillator extreme" logic frequently fails to survive realistic costs even
  when a nearby variant looks attractive.

**Do not treat this as a validated live edge.** Before any live-sizing
promotion: re-run unmodified parameters on 2025-07 onward data, on QQQ plus at
least one other instrument, with realistic spread + slippage, and require
PF > 1.3 to clear the source study's own recommended rejection threshold.

## Detection logic

1. **Session VWAP**: accumulated `hlc3 * volume` / `volume` over the overall
   session, reset at session start (`isNewDay` or the first in-session bar after
   an out-of-session bar).
2. **Trend qualification**: within the entry window only, 3 consecutive bar
   closes on one side of session VWAP latch `trendDir` to `"long"` or `"short"`
   (a later 3-bar run in the opposite direction re-latches it).
3. **Touch + RSI trigger**: a bar whose `[low, high]` range crosses session VWAP
   while RSI(2) is `< rsiOversold` (long) or `> rsiOverbought` (short), in the
   direction of the latched trend, arms a one-bar-ahead confirmation.
4. **Confirmation**: the very next bar must close back on the trend side of VWAP
   to fire the signal — if it doesn't, the setup disarms and can re-arm on a
   fresh touch (no forced skip for the rest of the day).
5. **SL/TP** (locked at the confirmation bar's close):
   - SL = confirmation-bar session VWAP ± `slAtrMult` x ATR(14) (beyond VWAP,
     against the trade direction).
   - TP1 = prior-day high/low if it is in the favorable direction from entry and
     closer than `tp1MaxAtrMult` x ATR(14); otherwise `tp1MaxAtrMult` x ATR(14)
     from entry.
   - TP2 = entry + 2 x (TP1 - entry), i.e. twice the TP1 distance.
6. **Max 1 trade per direction per day** — `longTradedToday` / `shortTradedToday`
   are tracked independently so a long and a short can each fire once on the
   same day (never simultaneously in the strategy twin, which is flat-only
   between signals).
7. **Hard flatten** at the derived flatten time (default 15:00 local for the
   RTH/NY preset — see "Session-derived windows" below), plus a session-end
   safety net matching the ORB reference convention.

## Session-derived windows

The entry window and flatten time are no longer fixed clock times
(`0945-1130` / `1500`). They are derived at runtime from the resolved
session's own open/close (`sessStr`, e.g. `"0930-1600"` for RTH) plus three
offset inputs, so switching `sessionPreset` away from NY/RTH does not
silently reuse NY-open-relative times that fall outside — or mean something
different inside — a different session:

- `entryStartMin = sessionOpenMin + entryStartOffsetMin`
- `entryEndMin = entryStartMin + entryWindowDurationMin`
- `flattenStartMin = sessionCloseMin - flattenBeforeCloseMin`
- `flattenEndMin = sessionCloseMin`

Defaults (`entryStartOffsetMin=15`, `entryWindowDurationMin=105`,
`flattenBeforeCloseMin=60`) reproduce the original `0945-1130` entry window
and `1500` flatten exactly for the RTH/NY preset (session `0930-1600`), and
also produce a valid, in-session window for the Tokyo (`0900-1500`) and
London (`0800-1630`) presets.

**Fail closed**: if the derived windows do not fit inside the resolved
session — entry starting before session open, the entry window collapsing to
zero or negative width, flatten starting before the entry window ends, or the
flatten window extending past session close — `configValid` is `false`.
`inEntryWindow` and `inFlattenWindow` are then permanently `false` for the
whole session: no trend qualification, arming, confirmation, or flatten ever
fires. The indicator shows a single, once-created managed warning label
(`"entry/flatten window does not fit inside session - no signals"`) instead
of the DT signal label; the strategy simply never enters or exits (no visible
label, since strategies do not draw the DT label contract). This can only
happen with a `Custom` session/offset combination the defaults do not
already cover; the four presets are pre-verified to always produce a valid
configuration with the default offsets.

Flatten timing is keyed on each bar's **close** time
(`hour(time_close, tzStr)` / `minute(time_close, tzStr)`), not its open time.
A 5-minute bar spanning 14:55-15:00 has its close land exactly on the
default 15:00 flatten target and triggers the flatten then; the previous
implementation used the bar's open time, so the 15:00-15:05 bar (whose OPEN
is 15:00) was the first one flagged and the flatten fired a full bar late, at
its 15:05 close.

## DT adaptations that deviate from the source evidence

- The source study's confirmation bar also requires the bar to be bullish/
  bearish (an up/down candle); this implementation only requires the close to
  land back on the trend side of VWAP, per this task's explicit contract. This
  is a **deliberate simplification**, not a replication of the source rule —
  flag it in any validation run.
- TP1's "favorable direction and nearer than 2xATR else 2xATR" dual condition is
  a stricter DT-contract overlay than the source's "if prior-day level already
  broken intraday, use 2xATR" — the source only falls back once the level is
  breached; this implementation also falls back when the level is simply too
  far away. Document this as a parameter change if re-validating against the
  source numbers.
- TP2 (2x the TP1 distance) and the 50/50 TP1/TP2 split are DT-contract overlays
  with **no source backing** — the cited research reports only a single TP
  (prior-day level or 2xATR), not a two-target split.
- Position sizing uses the shared DT convention
  (`strategy.percent_of_equity`, 10%) rather than the source's fixed 100-share
  size; this is untested by any source.
- Index futures (ES/NQ) as a target market is an untested extrapolation from a
  QQQ-only source study.
- `setup_id = "vwap_rsi_pullback"` is not yet present in the `setup_id`
  allow-list documented in `pine/PINE_CONVENTIONS.md` — updating that
  convention doc and any MCP-side setup registry is out of scope for this
  change (see the task's file-scope restriction) and must be done as a
  follow-up before this label is trusted by downstream tooling.

## Inputs

| Name | Default | Meaning |
|---|---|---|
| `sessionPreset` | `RTH` | Overall session preset (Tokyo/London/NY/RTH/Custom) controlling VWAP accumulation window and timezone. |
| `customSession` | `0930-1600` | Custom overall session string, used when `sessionPreset = Custom`. |
| `customTimezone` | `America/New_York` | Custom timezone, used when `sessionPreset = Custom`. |
| `entryWindow` | `0945-1130` | Window for 3-bar trend qualification, touch, and trigger (matches the source's strongest sub-window). |
| `flattenWindow` | `1500-1600` | Hard flatten window; the strategy closes all positions on the first bar inside it. |
| `rsiLength` | `2` | RSI period for the touch trigger. |
| `rsiOversold` | `25.0` | RSI threshold below which a VWAP touch arms a long. |
| `rsiOverbought` | `75.0` | RSI threshold above which a VWAP touch arms a short. |
| `atrLength` | `14` | ATR period used for SL and TP1/TP2 distance. |
| `slAtrMult` | `1.5` | SL distance beyond session VWAP, in ATR multiples. |
| `tp1MaxAtrMult` | `2.0` | TP1 fallback distance and max-distance gate for using prior-day H/L, in ATR multiples; TP2 is 2x this distance from entry. |

## SL/TP model

- SL: session VWAP at confirmation ± `slAtrMult` x ATR(14), against trade
  direction (i.e. below VWAP for longs, above for shorts).
- TP1 (50% of position): prior-day high (long) / low (short) if favorable and
  within `tp1MaxAtrMult` x ATR(14) of entry, else `tp1MaxAtrMult` x ATR(14) from
  entry.
- TP2 (remaining 50%): entry + 2 x (TP1 distance), same direction.
- Hard time exit: `flattenWindow` (default 15:00 local) or overall session end,
  whichever comes first.

## Recommended markets / sessions

- Primary: QQQ or a QQQ-tracking future/CFD on 5-minute bars, `RTH` session
  preset, default `0945-1130` entry window — this matches the only market the
  underlying evidence actually covers.
- Index futures (ES/NQ) on 5-minute bars are a plausible extension given the
  adjacent Opening-Drive AVWAP family's success there, but this exact
  VWAP+RSI(2) rule set has **not** been tested on futures by any cited source —
  treat as untested until independently validated.
- Do not use on YM-class instruments without independent validation; the
  adjacent VWAP-family candidate that was tested cross-market failed on YM
  specifically (PF 0.98).
