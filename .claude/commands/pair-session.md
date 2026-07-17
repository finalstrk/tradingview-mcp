---
description: Run a real-time DT pair-trading session loop (orchestrator + 4 subagents, human makes the final call)
argument-hint: <symbol> [timeframe]
---

# /pair-session

You are the MAIN Claude Code session and must act only as the orchestrator for a real-time pair-trading session loop.

Operational path on Ubuntu:

`Hermes/Fern orchestrator -> Hermes pair_trader_cycle -> Claude Code execution hub -> project subagents -> official codex@openai-codex companion (gpt-5.6-sol/high) for setup and risk analysis`

Hermes/Fern owns orchestration and cycle entry. This Claude Code command remains the execution hub for the project subagents and the human-facing judgement workflow.

## Session State Initialization

Before `tv_health_check`, any chart operation, or any registry read, initialize the
in-memory session summary exactly as this JSON object:

`{"judgement_count":0,"verdict_counts":{"GO":0,"WAIT":0,"NO-GO":0},"judgement_ids":[]}`

For a resumed `next` or `end`, validate and hydrate the supplied accumulated summary
only after creating this zero-value object and without calling a tool. A bounded
`end` after a health failure or zero completed cycles returns this zero summary
without calling health, chart, registry, tools, or workers.

## Invocation Modes

- **Bounded Hermes mode:** When the invocation states that it comes from `pair_trader_cycle` and supplies one action, execute exactly that action and return without interactive Loop Control. `start` runs Startup plus exactly one Watch Cycle. `next` runs a fresh health gate plus exactly one Watch Cycle. `end` returns the Bounded Final Object from resumed in-memory context without any Read, health check, chart call, registry read, worker, screenshot, journal write, or extra cycle. Never ask a follow-up question in bounded mode; missing or ambiguous input is a fail-closed Bounded Final Object.
- **Interactive direct mode:** A human invoking `/pair-session` directly may use Loop Control and explicitly request later cycles or a chart-context change.

An invocation contains exactly one mode. Bounded `start|next|end` never falls through into the interactive loop.

## Bounded Start/Next Gate

For bounded `start` and `next`, use this exact pre-gate order:

1. Read this command contract, `.claude/commands/pair-session.md`. This is the only pre-gate Read.
2. Initialize the exact zero `summary` above. For resumed `next`, validate and hydrate the supplied accumulated summary in memory without a tool.
3. The very next tool call MUST be `mcp__tradingview__tv_health_check`.

Bounded `next` always performs this fresh health check before any Watch Cycle read.
Until that call succeeds, MAIN MUST NOT read `.claude/agents/*.md`,
`journal/registry.json`, chart state, or any other file, and MUST NOT call Agent or
any other MCP tool. If health is unavailable or fails, return `health_failed`
immediately. MAIN never pre-reads agent markdown: project agent definitions are
already loaded, and MAIN delegates by exact Agent subtype only after the gate and
only at the stage named by this contract.

Bounded `end` is a separate zero-tool path. Determine it from the invocation, use
only resumed in-memory context, and perform no Read and no tool call.

## Bounded Final Object

Every bounded `start`, `next`, or `end` final response MUST be one raw JSON object
only. Emit no prose, heading, markdown fence, alias, or extra field. The object has
exactly these keys in this canonical order:

```json
{"action":"start","cycle_id":"<value copied from required_cycle_id>","cycle_seq":1,"status":"health_failed","cycle_completed":false,"health":"failed","snapshot_status":"not_applicable","registry_status":"not_checked","journal_status":"not_applicable","judgement_id":null,"analysis_mode":"not_applicable","ended":false,"summary":{"judgement_count":0,"verdict_counts":{"GO":0,"WAIT":0,"NO-GO":0},"judgement_ids":[]}}
```

`required_cycle_id` and `required_cycle_seq` are input names only. Copy their
values exactly to output `cycle_id` and `cycle_seq`; never emit the input names as
output keys. `session_summary` and `note` are forbidden output keys.
Every tell/display/print/report instruction elsewhere in this command is
interactive-only when it would add text to a bounded final response; bounded mode
encodes the outcome only in this object.

The nested `summary` has exactly `judgement_count`, `verdict_counts`, and
`judgement_ids`; `verdict_counts` has exactly `GO`, `WAIT`, and `NO-GO`. Every count
is a nonnegative integer. The three verdict counts sum to `judgement_count`, the
length of `judgement_ids` equals `judgement_count`, and every judgement id is a
unique nonempty string. A fresh failed `start` uses the exact zero object shown
above. A resumed `next` or `end` may carry only accumulated values that satisfy all
of these invariants.

Use the status tuple required by the caller: `no_signal` is
`true/ok/complete/not_checked/not_required/null/not_applicable/false`;
`live_ineligible` is
`true/ok/complete/non_adopted/not_required/null/live_ineligible/false`;
`completed` is `true/ok/complete/adopted/appended/<nonempty>/codex|degraded/false`.
In that tuple order the fields are `cycle_completed`, `health`, `snapshot_status`,
`registry_status`, `journal_status`, `judgement_id`, `analysis_mode`, and `ended`.
Failures are exact: `health_failed` is
`false/failed/not_applicable/not_checked/not_applicable/null/not_applicable/false`;
`snapshot_failed` is
`false/ok/incomplete/not_checked/not_applicable/null/not_applicable/false`;
`registry_failed` is
`false/ok/complete/failed/not_applicable/null/not_applicable/false`;
`journal_failed` is `true/ok/complete/adopted/failed/<nonempty>/codex|degraded/false`;
and `ended` is
`false/not_checked/not_applicable/not_checked/not_applicable/null/not_applicable/true`.

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
- Heavy work must be delegated through the Agent tool to these project agents from `.claude/agents/`:
  - `market-watcher`
  - `setup-analyst`
  - `risk-officer`
  - `journal-scribe`
- MAIN must not Read those agent markdown files. Their definitions are already loaded; invoke only the exact Agent subtype when its post-health gate is reached.
- `market-watcher` is the only agent that reads live chart data during watch cycles.
- `market-watcher` must use `data_get_pine_labels` with `study_filter: "DT "` when checking DT signals.
- `setup-analyst` and `risk-officer` must use the enabled official `codex@openai-codex` companion in `task --fresh` mode with `gpt-5.6-sol`, effort `high`, and no `--write`.
- Never judge non-adopted setup x market combinations as live signals.
- Treat non-adopted combinations as `live判定対象外` / `NOT-ELIGIBLE`: no live verdict, screenshot, judgement record, setup companion, or risk companion.
- A watcher snapshot with `snapshot_status: incomplete` cannot reach registry gating, setup/risk analysis, synthesis, screenshot, or judgement recording.
- A signal state outside `forming|triggered` is `no_signal`, never `NOT-ELIGIBLE`. Only a `forming` or `triggered` signal with a non-adopted setup x market is `live_ineligible` / `NOT-ELIGIBLE`.
- Never place orders. The final execution decision is always made by the human user.
- Capture a screenshot with `capture_screenshot` only at judgement time, after analyst/risk review and before recording the judgement.
- Do not append journal records directly from MAIN. Delegate all journal appends to `journal-scribe`.
- If the user takes the trade, tell them to use `/trade-log` and include the `judgement_id`.

## Startup

Startup applies only to interactive direct mode and bounded `start`; bounded `next` resumes the stored chart context and bounded `end` skips this section entirely.

1. Call `mcp__tradingview__tv_health_check`. In bounded `start`, the Bounded Start/Next Gate makes this the first tool call after the required command-contract Read and zero-summary initialization.

2. If the health check fails:
   - Stop the session startup.
   - In interactive direct mode, tell the user TradingView is not reachable and that `tv_launch` can start it with CDP enabled.
   - Do not enter the watch loop until a health check passes.
   - In bounded mode, add no prose; return `status: health_failed` in the exact Bounded Final Object with the initialized zero summary. Do not call chart tools, read the registry, or call workers.

3. If `symbol` was provided in `$ARGUMENTS`, call `chart_set_symbol` with that symbol.

4. If `timeframe` was provided in `$ARGUMENTS`, call `chart_set_timeframe` with that timeframe.

5. Call `chart_get_state` exactly once for this chart context. Store:
   - current symbol
   - current timeframe
   - visible studies and entity IDs

   MAIN does not call `chart_get_state` again inside watch cycles. The watcher still
   calls it once per cycle to observe and verify the current context against this
   stored expected context. If the user later changes symbol/timeframe, treat that
   as a new chart context and run MAIN chart initialization once for that context.

6. Read `journal/registry.json`.

7. Display adopted setup x market combinations at session start:
   - Use `setup.markets[market].status === "adopted"`.
   - Ignore retired setups.
   - If none are adopted, say that no live judgement can be made this session and that eligible DT signals will be routed to `/replay-drill` or `/setup-verify` instead.

8. Preserve the in-memory session summary initialized before Startup. Do not add health, tool, or worker fields to it.

## Market Detection

Infer market from symbol only when obvious:

- `FX:` prefix or common FX pairs -> `fx`
- continuous futures symbols (`ES1!`, `NQ1!`, `CL1!`, ...) or futures venue prefixes -> `futures`
- US exchange prefixes or common US equities -> `stocks_us`
- Japanese exchange prefixes or common JP equities -> `stocks_jp`

If market is ambiguous, ask the user to choose one of `fx`, `futures`, `stocks_us`, `stocks_jp` before any live judgement in interactive direct mode. In bounded Hermes mode, return a compact blocker without asking a follow-up.

## Watch Cycle

Run exactly one watch cycle for bounded `start` or `next`. In interactive direct mode, run a cycle when the user asks for the next check, or periodically only when the user explicitly requests an interval.

For each watch cycle:

1. Launch `market-watcher` with the Agent tool (`market-watcher`).

   Task requirements for `market-watcher`:
   - Pass the expected chart context (symbol, timeframe, studies) captured at startup.
   - Require the watcher to observe current symbol/timeframe with `chart_get_state` and compare both against that expected context.
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
     - `snapshot_status: complete | incomplete`
   - `complete` requires matching expected/observed symbol and timeframe, a usable current quote, a successful DT-label read with `study_filter: "DT "` (zero matches allowed), a successful OHLCV `summary: true` / `count: 20` read, and a fresh ISO-8601 timestamp observed in a current-cycle tool response.
   - Missing, stale, mismatched, or unusable required data is `incomplete`; never fabricate a timestamp.
   - Keep output compact and structured.
   - Do not make a trade judgement.

2. MAIN examines the snapshot (the snapshot is the only market data MAIN consumes).

   If `snapshot_status: incomplete`, map it to structured status: `snapshot_failed` before registry, analysis, screenshot, or journal. Stop this cycle immediately and report the listed required-read failure, stale value, or context mismatch. Do not inspect it for a trade signal. In bounded mode return; in interactive mode go to Loop Control.

3. If there is no DT label in `forming` or `triggered` state:
   - This includes a successful label read with zero matching DT labels and every observed signal state outside `forming|triggered`.
   - Return structured `status: no_signal` and display a compact no-signal summary. This is not `NOT-ELIGIBLE`.
   - Do not call setup/risk agents.
   - Do not capture a screenshot.
   - Do not record a judgement.
   - In bounded mode return. In interactive mode go to Loop Control.

4. If there is one or more DT labels in `forming` or `triggered` state:
   - Parse `setup_id`, `direction`, `state`, `entry`, `sl`, `tp1`, and `tp2`.
   - Confirm the setup is one of the allowed setup IDs.
   - Confirm the market is one of the allowed market IDs.
   - Check the registry data loaded at startup (re-read `journal/registry.json` if stale).

5. Registry gate:
   - A signal is live-judgeable only when `setup.markets[market].status === "adopted"`.
   - If the setup x market is not adopted:
     - Only this actual `forming` or `triggered` non-adopted signal maps to structured `status: live_ineligible` and `live判定対象外` / `NOT-ELIGIBLE`; this is not a `NO-GO` verdict.
     - Do not call `setup-analyst` or `risk-officer`.
     - Do not capture a screenshot.
     - Do not record a judgement.
     - Tell the user it is not adopted and route it to `/replay-drill` practice or `/setup-verify`.
     - In bounded mode return. In interactive mode go to Loop Control.

6. If the setup x market is adopted, launch `setup-analyst` and `risk-officer` in parallel with the same snapshot.
   - Send both Agent calls in the same assistant turn.
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

Use `Agent(setup-analyst)`.

Ask it to analyze setup quality using its configured workflow (sonnet + Codex gpt-5.6-sol high).

It must return (per its fixed output template):

- `thesis`
- `analysis_mode`: `codex` or `degraded`
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

Use `Agent(risk-officer)`.

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
- `analysis_mode`: `codex` or `degraded`
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

Both worker outputs must be from the eligible live template. A `NOT-ELIGIBLE` sentinel is orchestration drift: stop without a live verdict, screenshot, or judgement record. Propagate both `analysis_mode` values into the human-facing output and judgement rationale. If either mode is `degraded`, visibly include the exact degraded notice returned by that worker.

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
- `NO-GO`: for an adopted eligible signal only, RR fails, invalidation is poor, the signal is stale/ambiguous, the session is wrong, MTF conflicts are material, or risk-officer identifies a blocker. Registry failure is `NOT-ELIGIBLE`, not `NO-GO`.

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
- analysis mode: `setup=<codex|degraded>, risk=<codex|degraded>`, plus each required degraded notice when applicable
- reminder: the final execution decision belongs to the human; no agent places orders

## Screenshot

Only after synthesis for an adopted setup x market judgement:

1. Call `capture_screenshot`.
2. Store the returned screenshot path.
3. Include that path in the judgement record.

Do not capture screenshots for no-signal cycles, non-adopted signals, practice/replay routing, or startup.

## Record Judgement

After screenshot capture, delegate to `journal-scribe` with the Agent tool (`journal-scribe`). Record every eligible adopted-signal verdict (`GO`, `WAIT`, and `NO-GO`). Never record a `NOT-ELIGIBLE` routing result as a judgement.

Construct and freeze the planned judgement id and exact record object before calling
the scribe. A presented verdict is not `completed` until the final-line verification
gate below succeeds.

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
- Return the planned `judgement_id`, file path, and exact verdict.
- Return `final_line_verification` containing all four literal success flags:
  `verified=true`, `expected_id=true`, `shape_valid=true`, and
  `exact_object_match=true`.

After the scribe returns, treat the append as successful only if all four
`final_line_verification` flags are present and true. Only that response permits
`journal_status=appended`, `status=completed`, and then the in-memory summary
increment:

- increment `judgement_count`
- increment the corresponding verdict count
- append the `judgement_id`

Any write failure, missing flag, false flag, wrong id, invalid shape, or exact-object
mismatch returns `status: journal_failed` and the planned judgement id. It does not
increment the summary. Do not delete, rewrite, or retry the appended line, and stop
further live judgements until repaired. This stop applies even if a line may have
been appended but its final-line verification was not successful.

If the user takes the trade, tell them:

`Use /trade-log with judgement_id=<judgement_id>`

## Loop Control

This section is interactive direct mode only. Bounded Hermes mode always returns immediately after its one `start` or `next` cycle, including no-signal, incomplete, and `NOT-ELIGIBLE` outcomes.

After every interactive watch cycle, ask the user to choose:

- next check
- change symbol
- end

If the user chooses next check:
- Call `mcp__tradingview__tv_health_check` as the next tool call before any chart,
  registry, or worker operation.
- If health fails, stop and do not run another watch cycle.
- Run another watch cycle.

If the user chooses change symbol:
- Ask for the new symbol and optional timeframe.
- Call `mcp__tradingview__tv_health_check` as the next tool call before any chart,
  registry, or worker operation.
- If health fails, stop and do not change the chart context.
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
