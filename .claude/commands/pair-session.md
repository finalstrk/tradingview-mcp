---
description: Run a real-time DT pair-trading session loop (orchestrator + 4 subagents, human makes the final call)
argument-hint: <symbol> [timeframe]
---

# /pair-session

You are the MAIN Claude Code session and must act only as the orchestrator for a real-time pair-trading session loop.

Parse `$ARGUMENTS` as:

- `symbol`: first argument. If omitted, use the current chart symbol discovered at startup.
- `timeframe`: second argument, optional.

Allowed setups: `orb`, `vwap_reversion`, `pdh_pdl_break`, `ema_pullback`, `nr_squeeze`.

Allowed markets: `fx`, `futures`, `stocks_us`, `stocks_jp`.

Allowed verdicts: `GO`, `WAIT`, `NO-GO`.

DT label format:

`DT|<setup_id>|<dir>|<state>|entry=...|sl=...|tp1=...|tp2=...`

Signal states eligible for live judgement are only `forming` and `triggered`.

## Hard Rules

- The MAIN session must not call market data tools directly during watch cycles (cost discipline: no `data_get_*`, no `quote_get` from MAIN).
- The MAIN session may call startup/control tools: `tv_health_check`, `chart_set_symbol`, `chart_set_timeframe`, `chart_get_state`, and judgement-time `capture_screenshot`.
- Heavy work must be delegated through the Task tool to these subagents from `.claude/agents/`:
  - `market-watcher`
  - `setup-analyst`
  - `risk-officer`
  - `journal-scribe`
- `market-watcher` is the only agent that reads live chart data during watch cycles.
- `market-watcher` must use `data_get_pine_labels` with `study_filter: "DT "` when checking DT signals.
- Never judge non-adopted setup x market combinations as live signals.
- Never place orders. The final execution decision is always made by the human user.
- Capture a screenshot with `capture_screenshot` only at judgement time, after analyst/risk review and before recording the judgement.
- Do not append journal records directly from MAIN. Delegate all journal appends to `journal-scribe`.
- If the user takes the trade, tell them to use `/trade-log` and include the `judgement_id`.

## Startup

1. Call `tv_health_check`.

2. If the health check fails:
   - Stop the session startup.
   - Tell the user TradingView is not reachable and that `tv_launch` can start it with CDP enabled.
   - Do not enter the watch loop until a health check passes.

3. If `symbol` was provided in `$ARGUMENTS`, call `chart_set_symbol` with that symbol.

4. If `timeframe` was provided in `$ARGUMENTS`, call `chart_set_timeframe` with that timeframe.

5. Call `chart_get_state` exactly once for this chart context. Store:
   - current symbol
   - current timeframe
   - visible studies and entity IDs

   Do not call `chart_get_state` again inside watch cycles. If the user later changes symbol/timeframe, treat that as a new chart context and run the chart initialization once for that context.

6. Read `journal/registry.json`.

7. Display adopted setup x market combinations at session start:
   - Use `setup.markets[market].status === "adopted"`.
   - Ignore retired setups.
   - If none are adopted, say that no live judgement can be made this session and that eligible DT signals will be routed to `/replay-drill` or `/setup-verify` instead.

8. Keep an in-memory session summary:
   - `judgement_count`
   - verdict counts for `GO`, `WAIT`, `NO-GO`
   - recorded `judgement_ids`

## Market Detection

Infer market from symbol only when obvious:

- `FX:` prefix or common FX pairs -> `fx`
- continuous futures symbols (`ES1!`, `NQ1!`, `CL1!`, ...) or futures venue prefixes -> `futures`
- US exchange prefixes or common US equities -> `stocks_us`
- Japanese exchange prefixes or common JP equities -> `stocks_jp`

If market is ambiguous, ask the user to choose one of `fx`, `futures`, `stocks_us`, `stocks_jp` before any live judgement.

## Watch Cycle

Run one watch cycle when the user asks for the next check, or periodically if the user explicitly requests an interval.

For each watch cycle:

1. Launch `market-watcher` with the Task tool (`subagent_type: market-watcher`).

   Task requirements for `market-watcher`:
   - Pass the chart context (symbol, timeframe, studies) captured at startup so the watcher does not need to call `chart_get_state` again.
   - Use MCP read-only chart/data tools only.
   - Do not mutate the chart.
   - Use `data_get_pine_labels` with `study_filter: "DT "`.
   - Return a compact market snapshot only. Include:
     - `symbol`
     - `tf`
     - `price`
     - parsed DT signals from labels
     - raw DT label text
     - important levels
     - indicator values
     - active session if available
     - MTF facts per `D`/`60`/`15`/`5` when DT tables/labels provide them (`unknown` otherwise)
     - timestamp
   - Keep output compact and structured.
   - Do not make a trade judgement.

2. MAIN examines the snapshot (the snapshot is the only market data MAIN consumes).

3. If there is no DT label in `forming` or `triggered` state:
   - Display a compact no-signal summary.
   - Do not call setup/risk agents.
   - Do not capture a screenshot.
   - Do not record a judgement.
   - Go to Loop Control.

4. If there is one or more DT labels in `forming` or `triggered` state:
   - Parse `setup_id`, `direction`, `state`, `entry`, `sl`, `tp1`, and `tp2`.
   - Confirm the setup is one of the allowed setup IDs.
   - Confirm the market is one of the allowed market IDs.
   - Check the registry data loaded at startup (re-read `journal/registry.json` if stale).

5. Registry gate:
   - A signal is live-judgeable only when `setup.markets[market].status === "adopted"`.
   - If the setup x market is not adopted:
     - Do not judge it live.
     - Do not call `setup-analyst` or `risk-officer`.
     - Do not capture a screenshot.
     - Tell the user it is not adopted and route it to `/replay-drill` practice or `/setup-verify`.
     - Go to Loop Control.

6. If the setup x market is adopted, launch `setup-analyst` and `risk-officer` in parallel with the same snapshot.
   - Send both Task calls in the same assistant turn.
   - Do not share either agent's conclusions with the other.
   - Both agents receive:
     - the exact same market snapshot
     - the parsed DT signal
     - current symbol/timeframe
     - market
     - the relevant registry entry
     - the judgement schema requirement
   - Neither agent may place orders.

## Setup Analyst Task

Use `subagent_type: setup-analyst`.

Ask it to analyze setup quality using its configured workflow (sonnet + Codex gpt-5.6-sol high).

It must return (per its fixed output template):

- `thesis`
- `invalidation`
- `mtf_alignment` (`D`, `60`, `15`, `5`)
- `level_quality`
- `scenario_if_go`
- `confidence` (0-100)
- `breakdown_proposal`: `setup`, `mtf`, `level`, `session`, `track`, `rr`
- `proposed_verdict`: `GO`, `WAIT`, or `NO-GO`

RR math (`rr_tp1`, `rr_tp2`) is owned by `risk-officer`; do not require it from `setup-analyst`.

It must not read or depend on the risk-officer output.

## Risk Officer Task

Use `subagent_type: risk-officer`.

Ask it to perform an independent adversarial risk review using its configured workflow (sonnet + Codex gpt-5.6-sol high).

It must independently check:

- registry gate: only adopted setup x market may be judged live
- RR to `tp1` and `tp2`
- stop distance and invalidation quality
- session fit
- proximity to key levels
- MTF conflicts
- recent track record from journal files when available
- whether the signal is stale, ambiguous, late, or overextended

It must return (per its fixed output template):

- `registry_gate`
- `rr_tp1`, `rr_tp2`, `rr_geometry`
- `session_fit`
- `track_record`
- `breakdown_draft`: `setup`, `mtf`, `level`, `session`, `track`, `rr`
- `draft_verdict`: `GO`, `WAIT`, or `NO-GO`
- `blocking_risks`
- `risk_notes`

It must not read or depend on the setup-analyst output.

## Synthesis

MAIN merges the `setup-analyst` and `risk-officer` outputs into one compact human-facing judgement.

Use these breakdown dimensions with a 100-point total score:

- `setup`: 0-30
- `mtf`: 0-20
- `level`: 0-15
- `session`: 0-10
- `track`: 0-10
- `rr`: 0-15

When analyst and risk scores differ materially, prefer the more conservative score unless the evidence clearly supports the higher score.

Verdict rules:

- `GO`: adopted setup x market, clean thesis, acceptable RR, no blocking risk, session fit, and no material MTF conflict.
- `WAIT`: setup is plausible but needs confirmation, price improvement, session timing, or risk cleanup.
- `NO-GO`: registry gate fails, RR fails, invalidation is poor, signal is stale/ambiguous, session is wrong, MTF conflicts are material, or risk-officer identifies a blocker.

MTF fail-closed rule: timeframes whose facts are `unknown` in the snapshot earn zero `mtf` points, and the verdict may be at best `WAIT` unless the human explicitly supplies the missing MTF context during the session.

Display compactly:

- symbol / timeframe / market
- setup / direction / DT state
- verdict and total score
- breakdown scores
- entry / SL / TP1 / TP2
- RR to TP1 and TP2
- thesis and invalidation
- MTF alignment
- risk notes
- reminder: the final execution decision belongs to the human; no agent places orders

## Screenshot

Only after synthesis for an adopted setup x market judgement:

1. Call `capture_screenshot`.
2. Store the returned screenshot path.
3. Include that path in the judgement record.

Do not capture screenshots for no-signal cycles, non-adopted signals, practice/replay routing, or startup.

## Record Judgement

After screenshot capture, delegate to `journal-scribe` with the Task tool (`subagent_type: journal-scribe`). Record every verdict (`GO`, `WAIT`, and `NO-GO`).

The scribe must append exactly one JSON object as one JSONL line to:

`journal/judgements/YYYY-MM.jsonl`

The record must follow the judgement schema in `journal/README.md`:

- `id`: `jd_<YYYYMMDD>T<HHMM>_<setup>_<symbol_lowercase>` (e.g. `jd_20260705T0930_orb_usdjpy`)
- `ts`: ISO-8601 timestamp
- `symbol`, `tf`, `setup`, `market`, `direction`
- `verdict`, `score`
- `breakdown`: `{setup, mtf, level, session, track, rr}`
- `entry`, `sl`, `tp1`, `tp2`
- `mtf`: `{D, 60, 15, 5}`
- `invalidation`
- `screenshot`

Scribe constraints:

- Append only. Never edit historical lines.
- Do not edit `journal/registry.json`.
- Do not create a trade record from this command.
- Return the appended `judgement_id`, file path, and the exact verdict.

After the scribe returns, update the in-memory session summary:

- increment `judgement_count`
- increment the corresponding verdict count
- append the `judgement_id`

If the user takes the trade, tell them:

`Use /trade-log with judgement_id=<judgement_id>`

## Loop Control

After every watch cycle, ask the user to choose:

- next check
- change symbol
- end

If the user chooses next check:
- Run another watch cycle.

If the user chooses change symbol:
- Ask for the new symbol and optional timeframe.
- Call `chart_set_symbol`.
- Call `chart_set_timeframe` only if a timeframe is supplied.
- Call `chart_get_state` exactly once for the new chart context.
- Re-read `journal/registry.json` and display the adopted setup x market combinations again.
- Continue the watch loop.

If the user chooses end:
- Print the session summary:
  - judgement count
  - `GO` / `WAIT` / `NO-GO` breakdown
  - list of recorded `judgement_ids`
- End the command.
