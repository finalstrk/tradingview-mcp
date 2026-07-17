# DT Noise Area Breakout v1 (`noise_break`)

**Status: candidate — NOT adopted.** Do not treat any signal from this setup as
a live trade decision. It has not been through `journal/registry.json`
adoption review and has no independent out-of-sample backtest of its own.

## What it is

An intraday breakout that fades the "the market rarely moves more than X% by
this point in the day" prior: it defines a noise band around today's session
open, sized by how far price has historically moved on an average day over
the trailing N sessions, and treats a confirmed-bar close outside that band
— evaluated only at fixed half-hour checkpoints (`HH:00`/`HH:30` session
time) by default, matching the source — as the start of a directional move
(after the first 30 minutes of the session). The stop is
`max(upperBoundary, sessionVWAP)` for longs / `min(lowerBoundary,
sessionVWAP)` for shorts, trailed every bar, so the trade is invalidated the
moment price gives the move back through the band or fair value, whichever
is further.

## Evidence grade and honest caveats

**Grade B.** This is a synthesis of the "Percentile/Dynamic Noise-Area
breakout" concept that recurs independently across three research families in
this sweep (`docs/research/scalping-20260717/family_squeeze.md` Candidate 2,
`family_orderflow.md` Candidate 2, `family_academic.md` Candidate B), all
citing the same underlying SSRN working paper (Zarattini et al., SPY 1-minute
data, 2007-2024, 7,668 trades). It is **not** peer-reviewed (SSRN working
paper status), and none of the three independent write-ups report a genuine
out-of-sample or walk-forward split for the exact rule set below — the band
width, VWAP-exit logic, and lookback window all appear to have been selected
on the same 2007-2024 sample used to report performance. Concretely:

- **No independent OOS.** The one adjacent candidate in this sweep that *does*
  have a walk-forward split (`family_squeeze.md` Candidate 2, ES/NQ 5-minute
  variant of the same noise-band idea) shows Sharpe dropping from 1.18
  in-sample to 0.94 OOS, and to 0.64 if slippage merely doubles from 1 to 2
  ticks — i.e. the family's own best-documented cousin is cost-fragile.
- **Low win rate.** Source reports 37-43% (two write-ups of the same paper
  disagree on the exact number) — the edge, if real, depends on a small
  number of large winners; a live trader can plausibly abandon the system
  during a losing streak before the tail wins arrive.
- **"Exceptionally optimistic" slippage.** `family_orderflow.md` Candidate 2
  flags the source's $0.001/share slippage assumption as unrealistic for
  retail execution.
- **Negative-replication context in adjacent literature.** The single
  best-evidenced *peer-reviewed* pattern in the same research sweep (GHLZ
  first-half-hour → last-half-hour momentum) has a documented **negative**
  out-of-sample replication (Sharpe -0.628, SPY/IWM/IYR 2015-2020, per
  `family_academic.md`). That is a different logic, but it is a caution
  against assuming any of this literature's headline Sharpe/PF numbers persist
  out of sample.
- **TP1/TP2 are a DT overlay, not source-validated.** The source paper's real
  exit is "price re-crosses the VWAP/band level, or flatten at session
  close" — a rule-based exit, not a fixed profit target. The 1x/2x
  band-width TP1/TP2 levels in this implementation are added for DT-contract
  compliance (`entry=`/`sl=`/`tp1=`/`tp2=` label format) and are flagged as
  **untested** — they change the realized payoff distribution from what the
  source study actually measured.

**Recommendation:** paper-trade / forward-test only. Do not promote to
`adopted` in `journal/registry.json` without an independent 2023+ OOS check
and a documented review of the holdout period in
`journal/specs/noise_break_spec.json`.

## Detection logic

- **Noise band, per session:** `upperBoundary = sessionOpen * (1 + mult * avgAbsMove)`,
  `lowerBoundary = sessionOpen * (1 - mult * avgAbsMove)`.
- **`avgAbsMove` — design deviation from the literal source logic (flagged):**
  the source describes a per-time-of-day rolling average (the average
  absolute deviation from session open *at this same minute of the session*,
  over the last N days), which requires tracking a value per
  bar-index-of-day across days. That is fragile in Pine v6: session bar
  counts shift with DST transitions, holiday half-days, and per-symbol
  session tables, and a matrix keyed by (bar-of-day x lookback-day) adds
  real implementation risk for a still-unvalidated candidate. This
  implementation instead uses the simpler ATR/percentage-band fallback the
  task spec explicitly allows: `avgAbsMove` is a single scalar per day —
  the average of `|sessionClose / sessionOpen - 1|` over the last
  `lookbackDays` **completed** sessions. The practical effect: the band is
  flat across the session (same width at 09:35 as at 15:55) rather than
  narrower early and wider late in the day, which is a real behavioral
  difference from the literal source rule and should be treated as a
  simplification, not a faithful reproduction.
- **Warmup gate:** no signals fire during the warmup window at the start of
  the session — for every preset except `Custom` this is derived as
  `[sessionOpen, sessionOpen + warmupMinutes]` (`warmupMinutes` input,
  default `30`) from the resolved session string; `Custom` uses its own
  `customWarmupWindow` input (`input.session`, default `0930-1000`)
  verbatim instead. The boundary is evaluated by each candidate checkpoint
  bar's own confirmed **close** minute-of-day, in the session timezone —
  not the bar's open time — so a bar whose close lands exactly on the
  boundary is eligible. See "Adversarial-review disposition, round 3"
  below for why this replaced an earlier `input.session`/`time()`-based
  check. No signals fire until at least
  `effectiveWarmupDays = min(minWarmupDays, lookbackDays)` completed
  sessions are in `moveHistory` either (source uses a 14-day lookback; this
  implementation allows a shorter warmup so the indicator produces something
  before 14 full days of history accumulate — document this as looser than
  the source's 14-day requirement). The `min(...)` clamp is required because
  `moveHistory` itself is capped at `lookbackDays` entries (older entries are
  shifted out); without it, setting `minWarmupDays` above `lookbackDays` in
  the inputs would make `hasHistory` permanently false and the setup would
  silently never signal. See "Adversarial-review disposition, round 2"
  below.
- **Entry, `checkpointOnly=false` (unvalidated continuous-evaluation
  variant):** confirmed-bar `close` crossing outside the band
  (`ta.crossover`/`ta.crossunder`, no `request.security`, no lookahead) —
  long on an upside break, short on a downside break, evaluated on every
  confirmed bar close. Max 1 signal per direction per day
  (`tradedLongToday` / `tradedShortToday` flags), so at most 2 signals/day
  total, though in practice usually only one side fires.
- **Entry, `checkpointOnly=true` (default, per source):** the source logic
  (`family_orderflow.md` Candidate 2, citing the Zarattini et al. SSRN
  working paper) evaluates breakouts only at fixed half-hour decision
  checkpoints — `HH:00` and `HH:30` in the session timezone — not
  continuously on every bar close. At each checkpoint the rule is a
  **level test**, not a same-bar cross test: enter long if the checkpoint
  bar's confirmed `close > upperBoundary`, enter short if
  `close < lowerBoundary`, regardless of which earlier (non-checkpoint) bar
  price actually crossed the boundary on. A confirmed bar qualifies as a
  checkpoint bar when its close time lands on one of those checkpoints
  (`minute(time_close, tzStr) % 30 == 0`). This holds for 1m and 5m charts
  whose bars are aligned to the session open on standard round-number
  boundaries — e.g. on a 5m chart the bar spanning `09:25:00`-`09:30:00`
  closes exactly at `09:30:00`, so every 5m bar close in RTH lands on a
  checkpoint. It is **not** verified for non-standard bar alignment or
  timeframes that do not evenly divide 30 minutes; `checkpointOnly` should
  be disabled for those charts, since the checkpoint condition may never be
  true (no signals ever fire) or may fire on the wrong bar. Setting
  `checkpointOnly` to `false` switches to the continuous-evaluation variant
  above — this is an **explicitly unvalidated variant** with no source
  study backing it; treat it as a separate, untested hypothesis from the
  checkpoint-gated default.
  - **Adversarial-review fix (this revision):** the checkpoint-mode
    condition previously reused `ta.crossover`/`ta.crossunder`, which only
    fire on the exact bar the price crosses the boundary. Combined with
    checkpoint gating, that meant a breakout that happened *between*
    checkpoints and simply stayed beyond the boundary at the next
    checkpoint was never traded — the crossover event and the checkpoint
    bar rarely coincide. The source describes "is price beyond the
    boundary?" evaluated *at* each checkpoint, which is a level test, not a
    same-bar cross test; the implementation now matches that (see
    "Adversarial-review disposition" below).
- **Stop:** `max(upperBoundary, sessionVWAP)` for longs / `min(lowerBoundary,
  sessionVWAP)` for shorts — the source's actual exit rule
  (`family_orderflow.md` Candidate 2: "exit when price crosses back below
  `max(upper_boundary, VWAP)`" for longs, mirrored for shorts), not a bare
  VWAP cross. `upperBoundary`/`lowerBoundary` are constant for the session
  once `hasBoundaryData` is true, so this combines the static band level
  with the live VWAP every bar. The combined level is trailed every bar
  after entry with a ratchet — long stops only move up (`math.max`), short
  stops only move down (`math.min`). This keeps the stop from loosening if
  the band-combined level itself drifts back against the position intrabar
  (the ratchet direction is not specified either way by the source paper;
  it is a DT-contract judgment call, same as before this fix). If the
  entry-bar band-combined level is already on the wrong side of entry (e.g.
  a long entry where `max(upperBoundary, VWAP) >= entry`), the stop is
  immediately marketable and the position can exit on the very next tick —
  a real, possible outcome of the rule as specified, not a bug.
- **TP1 / TP2 (DT overlay, untested):** `bandWidth = upperBoundary -
  sessionOpen`. TP1 = entry ± `tp1Mult` (default 1.0) × bandWidth at 50% size.
  TP2 = entry ± `tp2Mult` (default 2.0) × bandWidth for the remainder — in
  the strategy version this is a real limit order; combined with the
  trailing VWAP stop and the hard EOD flat, it covers the source's stated
  three exit paths (band/VWAP re-cross, EOD, and — as an added DT
  overlay — a fixed profit target that the source itself does not specify).
  The `strategy.exit` orders for TP1/TP2/stop are registered in the *same*
  script block as `strategy.entry`, using the entry bar's own known prices,
  not only in the later per-bar trailing-stop block (see "Adversarial-review
  disposition" below — this closes an entry-bar unprotected-order gap).
- **Session VWAP anchoring:** the VWAP used in the stop calculation above is
  anchored to session start (`sessionStart = inSession and (not
  inSession[1] or isNewDay)`) and accumulates `hlc3 * volume` only over
  in-session bars, via a manual running sum rather than `ta.vwap`.
  `ta.vwap`'s anchor argument only controls *when the running sum resets*,
  not *which bars are included* — it still adds every bar's contribution
  regardless of session membership. On a chart that includes pre/post-session
  bars, that let the "session" VWAP silently include out-of-session
  price/volume once it stopped resetting on `isNewDay`, and the reset point
  (`isNewDay`, the exchange calendar-day boundary) is not the same instant
  as session start anyway. See "Adversarial-review disposition, round 2"
  below. The `or isNewDay` term in `sessionStart` was added in round 3: on
  an RTH-only data feed the previous day's last bar is still `inSession`,
  so `not inSession[1]` alone only fires on the chart's *first* session and
  never again from day 2 onward, leaving `sumPV`/`sumVol` accumulate across
  every subsequent day instead of resetting — see "Adversarial-review
  disposition, round 3" below.
- **Session close:** the strategy version force-flattens on the last
  confirmed in-session bar, detected by comparing that bar's confirmed
  close minute-of-day (in the session timezone) against the session's
  configured end time parsed from `sessStr`, rather than waiting for a
  subsequent out-of-session bar to appear on the chart. The indicator's
  `sessionEndedToday` label latch uses the identical minute-of-day
  comparison (round 3; see below) to detect the same final in-session bar.
  See "Adversarial-review disposition, round 2" below for why the prior
  `inSession[1] and not inSession` transition check was replaced for the
  strategy's EOD flat specifically.

## Inputs

| Name | Default | Meaning |
|---|---|---|
| `sessionPreset` | `RTH` | Session preset: Tokyo / London / NY / RTH / Custom |
| `customSession` | `0930-1600` | Session string used only when preset = Custom |
| `customTimezone` | `America/New_York` | Timezone used only when preset = Custom |
| `warmupMinutes` | `30` | No-entry window length after session open, for every preset except Custom (derived as `[sessionOpen, sessionOpen + warmupMinutes]`, evaluated by bar close minute-of-day) |
| `customWarmupWindow` | `0930-1000` | No-entry window used verbatim only when `sessionPreset = Custom` |
| `lookbackDays` | `14` | Number of completed sessions averaged into `avgAbsMove` |
| `minWarmupDays` | `5` | Minimum completed sessions in history before signals are valid |
| `noiseMult` | `1.0` | Multiplier applied to `avgAbsMove` to build the noise band |
| `checkpointOnly` | `true` | Gate entries to confirmed bars closing on a half-hour checkpoint (`HH:00`/`HH:30`), per source. `false` = unvalidated continuous-evaluation variant |
| `tp1Mult` | `1.0` | TP1 distance as a multiple of band width (DT overlay, untested) |
| `tp2Mult` | `2.0` | TP2 distance as a multiple of band width (DT overlay, untested) |
| `showBands` / `showVwap` | `true` | Display-only toggles (indicator version) |

## SL/TP model

- SL: `max(upperBoundary, sessionVWAP)` for longs / `min(lowerBoundary,
  sessionVWAP)` for shorts, trailed every bar, ratcheted in the position's
  favor (long: only rises; short: only falls).
- TP1: 50% at 1.0x band width from entry (untested DT overlay).
- TP2: 50% at 2.0x band width from entry (untested DT overlay), with the
  trailing VWAP stop and hard EOD flat both serving as the source's actual
  documented exit paths.

## Market / session recommendation

Source evidence is SPY (1-minute, 2007-2024) and ES/NQ 5-minute variants of
the same concept. Recommended markets: ES/NQ futures, SPY. Recommended
timeframes: 1m-5m. Recommended session preset: RTH (`NY`, 0930-1600
America/New_York) — the source's session decision points are all RTH-anchored
and there is no evidence for this logic on Tokyo/London sessions or other
instruments.

## Known deviations from source (summary)

1. `avgAbsMove` uses a per-day scalar fallback instead of the source's
   per-time-of-day rolling average (fragility tradeoff, see above).
2. TP1/TP2 fixed price targets are a DT-contract addition; the source's real
   exit is band/VWAP re-cross or EOD flat, not a fixed profit target.
3. `minWarmupDays` (5) is looser than the source's implicit 14-day lookback,
   so early signals in a fresh backtest use less history than the source
   paper's methodology. `minWarmupDays` is also internally clamped to
   `min(minWarmupDays, lookbackDays)` (see "Adversarial-review disposition,
   round 2" below) so an input above `lookbackDays` cannot silently disable
   the setup.
4. **Session-end detection no longer depends on out-of-session bars, in
   either file.** Both files detect the final in-session bar the same way:
   parse the session end hour/minute out of `sessStr` into a
   minutes-of-day value (`sessionEndMinOfDay`), and compare each confirmed
   in-session bar's own close time (`closeMinOfDay`, in the session
   timezone) against it — a bar qualifies once its close reaches or passes
   the boundary. The strategy's EOD flat (`isLastSessionBar`) and the
   indicator's "expired" label state (`sessionEndBar`, latched into a
   persistent per-day `sessionEndedToday` flag reset on `isNewDay`) both
   use this comparison. Neither requires a subsequent out-of-session bar to
   exist on the chart, so both work on RTH-only data feeds (see
   "Adversarial-review disposition, round 2" and "round 3" below). This is
   a deliberate departure from the `inSession[1] and not inSession`
   convention still used by some older setups in this repo (DT ORB v1 / DT
   VWAP Reversion v1). Round 3 replaced the indicator's original
   `sessionEndBar = inSession and na(time_close(timeframe.period, sessStr,
   tzStr))` expression, which never evaluated true: `time_close()` keys
   session membership off the bar's *open* time exactly like `inSession`
   does, so any bar satisfying `inSession` also has a non-`na`
   `time_close()` result — the indicator's "expired" state could never be
   reached through that condition. See "Adversarial-review disposition,
   round 3" below.
5. Exchange holiday/early-close calendars are not modeled. `input.session`
   defines the intended session string but cannot recover a specific
   symbol's half-day schedule; a half day is treated the same as a normal
   session and may leave `avgAbsMove` history and the EOD-flat timing
   slightly off on those dates. Validate ES/NQ/SPY half-days separately
   before trusting backtest results that span one.
6. `checkpointOnly=false` (default is `true`) is an **explicitly
   unvalidated variant**: it switches entry evaluation from the source's
   fixed half-hour checkpoints (`HH:00`/`HH:30` in the session timezone) to
   continuous evaluation on every confirmed bar close. No source study in
   this sweep backs continuous evaluation — it is a DT-contract convenience
   option, not a faithful reproduction, and should not be used for anything
   beyond exploratory comparison against the checkpoint-gated default.
7. Checkpoint detection (`minute(time_close, tzStr) % 30 == 0`) is verified
   only for 1m/5m charts whose bars align to the session open on standard
   round-number boundaries. It is not verified for non-standard bar
   alignment or timeframes that do not evenly divide 30 minutes; on such
   charts the checkpoint condition may never be true (no signals fire at
   all with `checkpointOnly=true`) or may line up with the wrong bar.

## Adversarial-review disposition, round 1 (blocking fix applied)

A later adversarial review flagged that entries were evaluated on every
confirmed bar close rather than only at the source's fixed half-hour
decision checkpoints (`family_orderflow.md` Candidate 2 / `family_academic.md`
Candidate B: "For each of the day's half-hour checkpoints..."), and that the
trailing exit used a bare VWAP cross instead of the source's band-combined
level (`max(upper_boundary, VWAP)` for longs / `min(lower_boundary, VWAP)`
for shorts). Both are fixed in this revision: checkpoint gating is now
default-on via `checkpointOnly` (continuous evaluation remains available as
an explicitly unvalidated opt-out, see deviation 6 above), and the trailing
stop uses the band-combined level in both files (see SL/TP model above).

## Adversarial-review disposition, round 2 (blocking fixes applied)

A second adversarial review, run after round 1 landed, flagged six further
issues, all fixed in this revision:

1. **Checkpoint-mode entry condition (both files, HIGH).** With
   `checkpointOnly=true`, entries required `ta.crossover`/`ta.crossunder`
   *on the checkpoint bar itself*, so a breakout that happened between
   checkpoints and simply stayed beyond the boundary through the next
   checkpoint was never traded — a deviation from the source, which
   evaluates "is price beyond the boundary?" as a level test at each
   checkpoint, not "did price cross the boundary on this exact bar?". Fixed
   by replacing the checkpoint-mode condition with a level test
   (`close > upperBoundary` / `close < lowerBoundary`) sampled only on
   checkpoint bars, gated by the existing per-direction `tradedToday` flags
   to prevent re-entry. The `checkpointOnly=false` variant keeps the
   original crossover semantics, since it remains an explicitly
   unvalidated, separately-scoped hypothesis with no checkpoint concept to
   begin with.
2. **Indicator label state pulse (HIGH).** `sessionEnded` was computed as
   `inSession[1] and not inSession`, true for exactly one bar. An
   untriggered label would show `"expired"` on that one bar, then flip back
   to `"forming"` on every subsequent out-of-session bar (since the
   one-bar-pulse condition is false again). Fixed by latching session end
   into a persistent `sessionEndedToday` var that only resets on the next
   `isNewDay`, so `"expired"` sticks once reached. In a follow-up to the
   same review round, the detection condition itself was also switched from
   the `inSession[1]`-based transition to the
   `sessionEndBar = inSession and na(time_close(timeframe.period, sessStr,
   tzStr))` idiom used by `pine/setups/torb/torb_indicator.pine` (gated on
   `barstate.isconfirmed`), so the "expired" state also fires on RTH-only
   charts where no out-of-session bar ever exists — the same failure mode
   as item 4 below, on the indicator side.
3. **VWAP anchor and accumulation scope (both files, HIGH).** The VWAP was
   computed via `ta.vwap(hlc3, isNewDay, 1.0)`, which resets on the
   exchange calendar-day boundary (not session start) and unconditionally
   accumulates every bar's `price*volume` into the running sum regardless
   of session membership — `ta.vwap`'s anchor argument only controls when
   the sum resets, not which bars contribute to it. On a chart carrying
   pre/post-session bars this let "session" VWAP include out-of-session
   price action. Fixed by replacing `ta.vwap` with a manual running
   `sumPV`/`sumVol` accumulator, reset on `inSession and not inSession[1]`
   (session start) and only incremented while `inSession` is true.
4. **Strategy EOD close on RTH-only feeds (HIGH).** `strategy.close_all`
   fired on `inSession[1] and not inSession`, which requires a bar *after*
   the session ends to exist on the chart. On an RTH-only data feed (no
   bars outside the configured session), that transition never fires and
   the EOD flat silently never runs, leaving a position open indefinitely.
   Fixed by detecting the final in-session bar directly: parse the session
   end hour/minute out of `sessStr` (same split-on-`-`/split-on-`:` idiom
   used in `pine/setups/torb/torb_strategy.pine`'s `f_sessionMinutes`, so a
   day-of-week suffix on `input.session` is handled the same way as
   elsewhere in this repo) and compare each confirmed in-session bar's
   `time_close` (in the session timezone) against it; flatten on the bar
   whose close time reaches or passes session end. The indicator's
   `sessionEndedToday` label latch got the equivalent RTH-only-safe fix in
   a follow-up (see item 2 above), so neither file depends on
   out-of-session bars anymore (see "Known deviations" item 4).
5. **Unprotected entry bar (both files, exit-order gap).** The
   `strategy.exit` calls for the stop/TP1/TP2 were only issued from blocks
   gated on `strategy.position_size > 0` / `< 0`. Pine does not reflect a
   same-bar `strategy.entry()` call in `strategy.position_size` until the
   *next* script execution, so on the entry bar itself those gated blocks
   saw the pre-entry (flat) position size and skipped placing any
   stop/TP order — the position was unprotected for one bar. Fixed by also
   calling `strategy.exit(...)` directly inside the `if longSignal` /
   `if shortSignal` blocks, using the same-bar `activeStop`/`activeTp1`/
   `activeTp2` values already being computed there. The later
   `position_size`-gated blocks are unchanged and continue to re-register
   the trailed stop/TP on every subsequent bar.
6. **`minWarmupDays` > `lookbackDays` (both files, MEDIUM).**
   `moveHistory` is capped at `lookbackDays` entries (older entries
   `array.shift`ed out), but `hasHistory` compared its size directly
   against `minWarmupDays`. If a user set `minWarmupDays` above
   `lookbackDays` in the inputs, `hasHistory` could never become true and
   the setup would silently never signal. Fixed by clamping to
   `effectiveWarmupDays = math.min(minWarmupDays, lookbackDays)` before the
   comparison, in both files.

`journal/specs/noise_break_spec.json` was updated to match: the `entry`
array now documents the level-test checkpoint condition and the
`minWarmupDays` clamp; `exit_take_profit` documents the same-bar exit-order
registration; `exit_stop_loss` documents the session-anchored VWAP and the
`time_close`-based EOD detection.

## Adversarial-review disposition, round 3 (blocking fixes applied)

A third adversarial review, run after round 2 landed, flagged three further
HIGH-severity issues, all fixed in this revision:

1. **Session VWAP reset never re-fires from day 2 on RTH-only charts (both
   files, HIGH).** `sessionStart = inSession and not inSession[1]` only
   fires on the chart's *first* session on an RTH-only data feed: from day
   2 onward, the previous day's last bar is still `inSession` (there is no
   intervening out-of-session bar), so `not inSession[1]` is false on every
   subsequent day's first bar and `sumPV`/`sumVol` never reset — the
   "session" VWAP silently accumulates price\*volume across every day in
   the backtest instead of resetting daily. Fixed by adding an
   `isNewDay`-based fallback: `sessionStart = inSession and (not
   inSession[1] or isNewDay)`. `isNewDay` (`timeframe.change("D")`) is true
   on the first bar of every new day regardless of feed type, so it
   catches the RTH-only case without breaking the original
   `not inSession[1]` transition on charts that do carry pre/post-session
   bars.
2. **Indicator `sessionEndedToday` latch never fires (indicator only,
   HIGH).** The round 2 fix for the "expired" label state
   (`sessionEndBar = inSession and na(time_close(timeframe.period, sessStr,
   tzStr))`) looked like a working RTH-only-safe idiom but was not: unlike
   `time()`, which returns the bar's *open* time when in-session,
   `time_close()` performs the identical session-membership test against
   the *same* session window — it keys off the bar's open time as well, not
   its close. Any bar for which `inSession` (built from `time()`) is true
   therefore also has a non-`na` `time_close()` result, so
   `inSession and na(time_close(...))` was always false and the "expired"
   state could never be reached; untriggered signals stayed labeled
   `"forming"` forever, even after the session closed. Fixed by replacing
   the condition with the same minute-of-day comparison the strategy file
   already used correctly for its EOD flat:
   `sessionEndBar = inSession and closeMinOfDay >= sessionEndMinOfDay`,
   where `closeMinOfDay` is the confirmed bar's own close time
   (hour\*60+minute, in the session timezone) and `sessionEndMinOfDay` is
   parsed from `sessStr`. Both values are now computed once, near the top
   of the indicator, and reused by this check.
3. **Warmup window preset-agnostic and misaligned with the first eligible
   checkpoint (both files, HIGH).** The old `warmupWindow` input
   (`input.session`, default `"0930-1000"`) was a single literal string
   applied to every session preset, including Tokyo and London, even
   though `"0930-1000"` has no relationship to those sessions' actual open
   times. Independently, `input.session`/`time()` key off each bar's
   **open** time, so on a 5m RTH chart the bar spanning `09:55:00`-`10:00:00`
   has its open (`09:55`) still inside the `0930-1000` warmup window and was
   classified as still-in-warmup even though its *close* — the instant the
   checkpoint decision is actually made — lands exactly on the intended
   `10:00` boundary. That pushed the first tradable checkpoint out to
   `10:30` instead of the source-intended `10:00`. Fixed by replacing
   `warmupWindow` with two inputs: `warmupMinutes` (default `30`), used to
   derive the warmup boundary as `[sessionOpen, sessionOpen +
   warmupMinutes]` from the resolved session string for every preset
   except `Custom`; and `customWarmupWindow` (`input.session`, default
   `"0930-1000"`), used verbatim only when `sessionPreset = Custom`. The
   boundary itself is now evaluated by bar **close** minute-of-day
   (`closeMinOfDay < warmupEndMinOfDay`) rather than `input.session`'s
   open-time semantics, so the `09:55`-`10:00` bar's close (`600` minutes
   = `10:00`) is no longer strictly less than the boundary (also `600`)
   and the bar is correctly treated as warmup-eligible.

Items 1 and 3 required adding a shared `f_sessionParts` helper (parses
both the start and end hour/minute out of a session string, extending the
narrower `f_sessionEndParts` the strategy previously had only for its EOD
check) to both files, so `sessionOpenMinOfDay`/`sessionEndMinOfDay`/
`closeMinOfDay` are computed once near the top of each file and reused by
the warmup boundary, the VWAP reset commentary above, and (in the
strategy) the existing EOD flat. `journal/specs/noise_break_spec.json`'s
`entry` array was updated to describe the new warmup derivation and the
close-time-vs-open-time correction; no other spec sections changed.

## Codex design-review disposition

Per the task's mandatory read-only Codex design pass (`gpt-5.6-sol`, high
effort), the reviewer's strongest recommendation was to replace the
per-day scalar `avgAbsMove` fallback with a per-time-of-day minute-slot
rolling average (keyed by `hour*60+minute` in the selected session
timezone, backed by per-slot sum/count arrays), arguing it is actually
*more* robust to missing bars, half-days, and DST than a naive
bar-index-of-day matrix, and that silently falling back to an
ATR/percentage band would mix two different hypotheses under one
`setup_id`. That is a legitimate, more faithful design — deliberately
**not implemented in this v1** given the added implementation and testing
surface for a still-unvalidated (Grade B, no independent OOS) candidate;
the task spec explicitly sanctions the simpler per-day fallback used here.
Two other Codex recommendations, which are pure correctness/robustness
improvements with no behavioral tradeoff, **were** adopted in both files:

- `barstate.isconfirmed` required on entry evaluation, so a still-forming
  bar cannot fire and then "un-fire" a signal as intrabar price moves.
- The VWAP trailing stop is ratcheted (only tightens toward price), rather
  than unconditionally re-set to the current VWAP value every bar.

Two further review points were **not** applied and are noted here instead:

- The reviewer also flagged that `pine/PINE_CONVENTIONS.md`'s `setup_id`
  allow-list does not yet include `noise_break`. This implementation task's
  hard rules restrict edits to `pine/setups/noise_break/` and
  `journal/specs/noise_break_spec.json` only, so `PINE_CONVENTIONS.md` was
  deliberately left untouched — flagged here as a required follow-up before
  any tooling that enforces that allow-list is pointed at this setup.
- The reviewer's exact-time-of-day EOD-detection improvement
  (date-key-based `isNewDay` in the selected session timezone, instead of
  chart-timezone `timeframe.change("D")`) was not applied, to stay
  consistent with the identical pattern used by every other setup in this
  repo (`orb`, `vwap_reversion`, `pdh_pdl_break`, `ema_pullback`,
  `nr_squeeze`) — fixing it only here would make this setup inconsistent
  with its siblings rather than more correct in isolation.
