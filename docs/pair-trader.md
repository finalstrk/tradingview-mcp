# DT Pair-Trader Layer

The DT Pair-Trader layer is a realtime operations layer on top of the existing
DT trading system: the 78 currently registered TradingView MCP tools, the
journal evidence layer, and the `journal/registry.json` adoption gate. It helps
the human trader evaluate a live setup while it is forming.

It is decision support only. It does not place orders, execute trades, manage
positions, or move funds. The human remains the trader. Claude Code acts as the
pair-trader and navigator: it reads the current market state, organizes the
evidence, challenges the setup, and records the decision trail.

Related documents: `docs/trading-system.md` (the underlying DT judgement
system) and `journal/README.md` (canonical journal schemas).

## Overview

The layer coordinates realtime trade judgement around the existing DT system:

- TradingView MCP provides live chart state, quote, OHLCV, Pine labels, Pine
  levels, study values, screenshots, and TradingView health checks.
- `journal/registry.json` decides which setup x market combinations are eligible
  for live judgement.
- `journal/judgements/YYYY-MM.jsonl` records each pre-trade judgement.
- `journal/trades/YYYY-MM.jsonl` records the later execution result, linked by
  `judgement_id` when available.

The pair-trader does not replace the existing `/trade-judge`, `/trade-log`,
`/setup-verify`, or `/replay-drill` flows. It wraps them into a live session
loop with stricter cost control and clearer division of responsibility.

## Architecture

The Ubuntu operational path is:

```text
Hermes/Fern orchestrator
  -> Hermes pair_trader_cycle
  -> Claude Code pair-trader-orchestrator
  -> project subagents
  -> official codex@openai-codex companion for setup/risk analysis
```

The design uses three tiers inside the Claude Code execution hub so the main
session stays small while expensive reasoning is reserved for the few moments
that need it.

| Tier | Runtime | Role | Data boundary |
| --- | --- | --- | --- |
| Orchestration tier | Ubuntu Hermes/Fern and Hermes `pair_trader_cycle`, entering `claude --agent pair-trader-orchestrator` | Executes exactly one bounded `start`, `next`, or `end`; for an eligible adopted signal, Claude integrates and presents `GO`, `WAIT`, or `NO-GO`. | The invocation plugin's `--tools` limits built-in tools. Verified agent frontmatter defines the exact MCP and subagent capability boundary. The parent has no Bash or raw quote/data tools. |
| Worker tier | 4 subagents, Sonnet | Performs MCP reads, compact market summarization, journal reads/writes, registry checks, and Codex handoff. | Reads only the data needed for the current step. Emits compact structured output. |
| Heavy reasoning tier | Official `codex@openai-codex` Claude Code companion, `gpt-5.6-sol`, reasoning effort `high` | Performs setup analysis, scenario building, and adversarial risk critique. | `task --fresh` without `--write` selects a read-only Codex task sandbox. The prompt no-file-write sentence and before/after triple-hash comparison remain defense in depth. |

The orchestration tier owns the session state and final presentation. The worker
tier owns narrow tasks. The heavy reasoning tier is used only when a setup is
eligible and the session needs deeper analysis than a compact worker response.

## Agents

Agent definitions live under `.claude/agents/`. Each agent has a narrow contract.
The `tools` list in verified agent frontmatter determines which tools are available
to that agent. `allowedTools` preapproves permissions for listed calls; it does not
define tool availability and must not be described as the capability boundary.

### `pair-trader-orchestrator`

`pair-trader-orchestrator` is the main thread for bounded automation and is
intended for `claude --agent pair-trader-orchestrator`.

Its only tools are `Read`,
`Agent(market-watcher, setup-analyst, risk-officer, journal-scribe)`, and the five
startup/control/capture MCP tools `tv_health_check`, `chart_set_symbol`,
`chart_set_timeframe`, `chart_get_state`, and `capture_screenshot` (all with the
`mcp__tradingview__` prefix). It has no Bash, quote/data, edit/write, UI, replay,
alert, drawing, or Pine tool.

For bounded `start` or `next`, MAIN first Reads only the command contract,
initializes the zero summary in memory, and MUST make
`mcp__tradingview__tv_health_check` the very next tool call. `next` uses a fresh
health check before any Watch Cycle read. Until health succeeds, MAIN cannot Read
agent markdown, registry, chart state, or any other file, and cannot call Agent or
another MCP tool. Agent definitions are already runtime-loaded, so MAIN never
pre-reads them and delegates by exact Agent subtype only after the gate. Bounded
`end` uses resumed memory and performs no Read or tool call.

### `market-watcher`

`market-watcher` is MCP read-only.

Responsibilities:

- Run TradingView read tools needed for the current symbol and timeframe.
- Read DT Pine labels with `study_filter: "DT "` and parse the standard label
  payload: `DT|<setup_id>|<dir>|<state>|entry=...|sl=...|tp1=...|tp2=...`.
- Use compact OHLCV summaries, not raw bar dumps, unless explicitly requested.
- Emit a compact market snapshot of about 1 KB.
- Emit `snapshot_status: complete|incomplete`. Complete requires the observed
  symbol/timeframe to match the orchestrator's expected chart context, a usable
  current quote, a successful DT-label read with `study_filter: "DT "`, a
  successful OHLCV `summary: true` / `count: 20` read, and a fresh ISO-8601
  timestamp observed in a current-cycle tool response. Zero matching labels is
  allowed and yields `no_signal`.
- Treat any missing, stale, mismatched, or unusable required result as incomplete.
  Never fabricate the timestamp. Missing optional tables, lines, or study values
  may be reported without inventing facts.

Output rules:

- Facts only.
- No trade opinion.
- No `GO`, `WAIT`, or `NO-GO`.
- No registry adoption judgement.
- An incomplete snapshot cannot enter registry gating or judgement.

### `setup-analyst`

`setup-analyst` takes the `market-watcher` snapshot and builds the setup case.

Responsibilities:

- Identify the active DT setup signal from the snapshot.
- Call Codex with reasoning effort `high` for scenario building when the setup
  is adopted and its state is `forming|triggered`.
- Return structured analysis with:
  - `thesis`
  - `invalidation`
  - `mtf_alignment`
  - `level_quality`
  - `scenario_if_go`
  - `confidence`
  - `breakdown_proposal`
  - `proposed_verdict`

The agent does not decide whether the trade is allowed. It explains the setup
case and the conditions under which the case fails.

The orchestrator invokes this agent only for an adopted `forming` or `triggered`
signal. A defensive `NOT-ELIGIBLE` response from the worker means orchestration
drift and is not the main state mapping: a signal state outside
`forming|triggered` maps to `no_signal` before worker invocation.

### `risk-officer`

`risk-officer` performs an independent adversarial review.

Responsibilities:

- Check `journal/registry.json` before live judgement.
- Confirm that the setup x market combination has `status: "adopted"`.
- Confirm that the signal state is `forming` or `triggered` before any companion
  call.
- Review risk/reward, session fit, and recent track record.
- Challenge the setup case without relying on `setup-analyst` conclusions.
- Draft a judgement breakdown matching the schema in `journal/README.md`:

```json
{
  "setup": 0,
  "mtf": 0,
  "level": 0,
  "session": 0,
  "track": 0,
  "rr": 0
}
```

- Draft a verdict candidate: `GO`, `WAIT`, or `NO-GO`.

The main session integrates this draft with the setup analysis. The
`risk-officer` does not execute the trade and does not write journal lines. It is
invoked only for adopted `forming|triggered` signals; its defensive
`NOT-ELIGIBLE` sentinel is an orchestration-drift stop, not a no-signal state.

### `journal-scribe`

`journal-scribe` owns append-only journal writes.

Responsibilities:

- Append one judgement line to `journal/judgements/YYYY-MM.jsonl`.
- Append one trade line to `journal/trades/YYYY-MM.jsonl` after the human reports
  the execution result.
- Link trade records to judgement records with `judgement_id` when available.
- After a judgement append, re-read and parse the final line and verify the
  expected id, judgement shape, and equality with the exact object supplied.
  Report `verified=true` only when all checks pass. Run `journal_stats.js` only
  after trade appends; it does not validate judgement JSONL.

Write rules:

- Append only.
- Never edit existing JSONL lines.
- Never rewrite or normalize old files during a live session.
- On write failure, stop and report the target path, the failed operation, and
  the record that could not be appended.

## Session Flow

Entrypoint:

```text
/pair-session <symbol> [timeframe]
```

Before any health, chart, or registry operation, initialize the in-memory summary
to `{"judgement_count":0,"verdict_counts":{"GO":0,"WAIT":0,"NO-GO":0},"judgement_ids":[]}`.

Bounded Hermes invocation supplies exactly one action. `start` performs Startup
and one Watch Cycle, `next` performs a fresh health gate and one Watch Cycle, and
both return without interactive Loop Control. `end` returns the final object with
the accumulated summary from resumed memory, without a Read, health check,
chart/registry call, worker, screenshot, journal write, or extra cycle. A bounded
`end` after a health failure or zero completed cycles returns the exact zero
summary without health/tool/worker output. A direct human `/pair-session`
invocation may still offer interactive Loop Control.

Every bounded final response is one raw JSON object only, with no prose, heading,
markdown fence, alias, or extra field. Its exact keys are `action`, `cycle_id`,
`cycle_seq`, `status`, `cycle_completed`, `health`, `snapshot_status`,
`registry_status`, `journal_status`, `judgement_id`, `analysis_mode`, `ended`, and
`summary`. The input-only names `required_cycle_id` and `required_cycle_seq` map to
`cycle_id` and `cycle_seq`; `session_summary` and `note` are forbidden. Nested
`summary` has exactly `judgement_count`, exact verdict counts `GO`/`WAIT`/`NO-GO`,
and unique nonempty `judgement_ids`. All counts are nonnegative; verdict counts
and id length both equal `judgement_count`. Fresh failed `start` is exact zero;
resumed `next` or `end` may carry only valid accumulated values.

Flow:

1. For bounded `start` or `next`, after the sole command-contract Read and zero
   summary initialization, run a fresh `mcp__tradingview__tv_health_check` as the
   very next tool call. Do not pre-read agents, registry, or chart state.
2. If TradingView is not reachable, stop and tell the user that `tv_launch` can
   start it (do not auto-launch); re-run `tv_health_check` after the user
   confirms, and only proceed once it passes.
3. Run `market-watcher` to collect a compact snapshot for the expected symbol and
   timeframe. An incomplete snapshot maps to `snapshot_failed` and stops before
   registry, analysis, screenshot, and journal work.
4. If zero matching DT labels are returned, or every signal state is outside
   `forming|triggered`, return `no_signal` and continue the interactive loop or
   return in bounded mode. This is not `NOT-ELIGIBLE`.
5. Only for an actual `forming` or `triggered` signal, check whether the setup x
   market combination is adopted in `journal/registry.json`.
6. If that forming/triggered setup is non-adopted, map it to
   `live_ineligible` / `NOT-ELIGIBLE` and route to `/setup-verify` or
   `/replay-drill`. Do not produce a live verdict, screenshot, judgement record,
   or setup/risk companion call.
7. If the setup is adopted, run `setup-analyst` and `risk-officer` in parallel.
8. The main session integrates the setup case, adversarial review, registry
   status, RR, session fit, and track record into one decision support output:
   `GO`, `WAIT`, or `NO-GO`.
9. The human trader decides whether to execute manually.
10. `journal-scribe` records the judgement in
    `journal/judgements/YYYY-MM.jsonl`. Only final-line `verified=true` with the
    expected id, valid shape, and exact object match permits
    `journal_status=appended`, `status=completed`, and summary increment.
11. After the human reports the result, `journal-scribe` records the trade in
    `journal/trades/YYYY-MM.jsonl` and links it with `judgement_id`.
12. Repeat the loop until the session ends.

Step 12 applies only to a direct interactive session. A bounded Hermes call
always returns after its single action.

The pair session is not a signal firehose. It should wait for an adopted DT setup
signal, produce one clear judgement, record the evidence, and then return to
watching.

## Codex Delegation

`setup-analyst` and `risk-officer` delegate heavy analysis through the enabled
official `codex@openai-codex` Claude Code companion when deeper scenario work is
needed.

Invocation contract:

```bash
cd "$(git rev-parse --show-toplevel)" || exit 1
/usr/bin/node "$COMPANION" task --fresh --model gpt-5.6-sol --effort high -- "$prompt"
```

`$COMPANION` is not a version-pinned path. Both analysis agents resolve it from
`~/.claude/plugins/installed_plugins.json`, key `codex@openai-codex`, after
confirming that the plugin is enabled in `~/.claude/settings.json`. Resolution
fails closed if the enabled entry, its `installPath`, or
`scripts/codex-companion.mjs` is absent. The full copyable resolver is kept in
both agent definitions.

The model is `gpt-5.6-sol` at reasoning effort `high`. `task --fresh` prevents
reuse of an earlier analysis thread. Omitting `--write` makes the official
companion request a read-only Codex task sandbox.

Delegation rules:

- Orchestration gates run before delegation. An incomplete snapshot returns
  `snapshot_failed`; a signal state outside `forming|triggered` returns
  `no_signal`; only a forming/triggered non-adopted setup returns
  `live_ineligible` / `NOT-ELIGIBLE`. None resolves or invokes the companion.
- The workers' own eligibility checks remain defense in depth. A defensive
  `NOT-ELIGIBLE` worker response after delegation means orchestration drift and
  cannot become a live verdict.
- Each worker assigns the exact supplied snapshot, parsed signal, registry
  excerpt/status, and stats excerpt inside its Bash workflow. Risk also assigns
  its computed RR facts and relevant trade excerpt.
- `$prompt` is the exact string built from those assigned values and the focused
  task instruction; its final text is exactly: "Output analysis text only. Do
  not create, modify, or delete any files."
- The companion call runs from the repository root in analysis-only, read-only
  mode with the supported syntax `task --fresh --model gpt-5.6-sol --effort
  high`; no `--write` and no output-format flag.
- Before and after each call, capture three SHA-256 fingerprints: `git status
  --porcelain=v1 -uall`, `git diff --binary HEAD`, and the names plus contents of
  files returned by `git ls-files --others --exclude-standard -z`; any
  difference means contamination — discard the Codex output, report it, and
  stop. The exact `sha256sum` helper is copied into both analysis agents.
- Codex output must be treated as analysis, not as execution authority.
- Success prints the actual output with `printf '%s\n' "$output"` and sets
  `analysis_mode: codex`. Timeout, nonzero status, fingerprint failure or
  mismatch, and empty output are discarded; the Sonnet worker performs a
  best-effort analysis with `analysis_mode: degraded` and the required visible
  degraded wording.

Expected setup analysis fields (matching the `setup-analyst` fixed template):

```json
{
  "thesis": "string",
  "analysis_mode": "codex | degraded",
  "invalidation": "string",
  "mtf_alignment": "string (per-timeframe D/60/15/5; unknown allowed)",
  "level_quality": "string",
  "scenario_if_go": "string",
  "confidence": "0-100",
  "breakdown_proposal": {"setup": "0-30", "mtf": "0-20", "level": "0-15", "session": "0-10", "track": "0-10", "rr": "0-15"},
  "proposed_verdict": "GO | WAIT | NO-GO"
}
```

## Guardrails

Live judgement is allowed only for setup x market combinations in
`journal/registry.json` with `status: "adopted"`.

Non-adopted setup routes:

- `candidate`: route to `/setup-verify` or `/replay-drill`.
- `insufficient_data`: route to `/setup-verify` or `/replay-drill`.
- `rejected`: do not trade as a live DT setup.
- `retired`: do not trade as a live DT setup.

Every route above is `live判定対象外` / `NOT-ELIGIBLE`, not live `NO-GO`.
`GO`, `WAIT`, and `NO-GO` remain the complete live-verdict enum, used only for
adopted signals in `forming|triggered`.

Signal-state routing is separate: any state outside `forming|triggered` is
`no_signal`, not `NOT-ELIGIBLE`. Only an actual `forming` or `triggered` signal
whose setup x market is non-adopted is `live_ineligible` / `NOT-ELIGIBLE`.

Execution boundary:

- Agents never place orders.
- Agents never execute trades.
- Agents never move funds.
- The human always executes manually.
- `GO` means the evidence supports the plan under the current rules. It is not
  an order instruction.

Evidence boundary:

- Every judgement is recorded as one JSONL line in
  `journal/judgements/YYYY-MM.jsonl`.
- Every executed live or replay trade is recorded as one JSONL line in
  `journal/trades/YYYY-MM.jsonl`.
- Trade records should link to judgement records with `judgement_id` whenever
  possible.
- Missing execution data should be recorded as missing, not inferred.

MCP context rules:

- Follow `CLAUDE.md` Context Management Rules.
- Use `summary: true` for OHLCV reads unless individual bars are specifically
  needed.
- Use `study_filter` on Pine tools when the DT indicator is known.
- Use `study_filter: "DT "` for DT setup labels.
- Do not use `verbose: true` on Pine tools unless raw drawing data is explicitly
  requested.
- Cap OHLCV requests: `count: 20` for quick analysis, `count: 100` for deeper
  work, and `count: 500` only when specifically needed.

## Known Limitations

- **Live TradingView behavior is still unproven.** On Ubuntu the Claude MCP server
  name is `tradingview`, and `market-watcher` uses a strict allowlist of the
  required `mcp__tradingview__...` read tools. MCP registration and a connected
  listing do not prove live CDP/TradingView health or a successful
  `/pair-session` cycle.
- **Child Bash is a residual boundary.** `setup-analyst`, `risk-officer`,
  and `journal-scribe` need Bash (Codex companion, git verification, JSONL
  append), and Claude Code agent frontmatter cannot express per-command
  allowlists. The plugin `--tools` limits built-in tools; verified agent
  frontmatter supplies the exact MCP and subagent capability boundary, while
  `allowedTools` only preapproves permissions. None of these restricts individual
  commands inside a child worker's Bash call. The no-order / append-only
  boundaries there remain instructional plus contamination checks. This child
  worker's Bash access remains residual; it does not provide hard no-order
  enforcement. Hook-based command validation is a planned hardening step.
- **Contamination detection is best-effort.** The triple-hash check covers
  tracked diffs, status, and untracked contents, but a hostile process could
  still race it. The layer never grants Codex execution authority, so the blast
  radius is advisory text.

## Cost Discipline

The three-tier design exists to keep the live session responsive and auditable.

Rules:

- Keep the orchestrator context lean.
- Do not stream raw MCP payloads into the main session.
- Keep `market-watcher` snapshots around 1 KB.
- Prefer compact facts over prose.
- Use Codex delegation only for an adopted signal in `forming|triggered`.
- Do not call Pine graphics tools without `study_filter` when the target study is
  known.
- Do not pull full OHLCV bars when `summary: true` is enough.
- Do not include screenshots unless visual confirmation is needed; prefer storing
  screenshot paths over embedding image data.

Caps:

| Data type | Normal cap |
| --- | --- |
| Market snapshot | About 1 KB |
| Quick OHLCV context | `summary: true`, `count: 20` |
| Deeper OHLCV context | `summary: true`, `count: 100` |
| Pine labels | DT study only, default cap of 50 per study |
| Codex delegation | One focused request per eligible setup decision |

The goal is to spend context on judgement quality, not on repeated raw data.

## Failure Modes

### TradingView is not running

Symptoms:

- `tv_health_check` fails.
- MCP tools cannot connect to TradingView Desktop.
- CDP on port 9222 is unavailable.

Handling:

1. Tell the user TradingView is unreachable and that `tv_launch` can start it
   with CDP enabled. Do not auto-launch.
2. After the user confirms TradingView is up, run `tv_health_check` again.
3. If the health check still fails, stop the pair session and report that no
   live judgement can be made until TradingView is reachable.

Do not infer chart state from stale notes or previous screenshots.

### Codex companion delegation fails

Symptoms:

- The active companion cannot be resolved or its command fails.
- The command times out.
- The output is empty.

Handling:

1. Continue the session without Codex if the market snapshot and registry check
   are available.
2. The affected setup/risk worker degrades to Sonnet-only best-effort analysis.
3. Propagate that worker's `analysis_mode: degraded` and exact notice through
   synthesis.

Required wording in the judgement output:

```text
Degraded mode: Codex delegation failed; setup analysis was completed by the Sonnet worker only.
```

For risk delegation failure, use:

```text
Degraded mode: Codex delegation failed; risk analysis was completed by the Sonnet worker only.
```

Do not hide the failure. Do not present degraded analysis as equivalent to the
normal heavy reasoning path.

### Journal write or final-line verification fails

Symptoms:

- `journal-scribe` cannot append to `journal/judgements/YYYY-MM.jsonl`.
- `journal-scribe` cannot append to `journal/trades/YYYY-MM.jsonl`.
- The target directory or file is unavailable.
- JSON serialization fails.
- The final line has the wrong id or shape, differs from the exact supplied
  object, or is not reported with `verified=true`.

Handling:

1. Return `journal_failed` with the planned judgement id and do not increment the
   session summary.
2. Stop further live judgements until the journal is repaired.
3. Report the target path, operation/check that failed, and the record intended
   for append.
4. Preserve append-only behavior: do not delete, rewrite, or retry the final line.
5. Ask the human to resolve the journal issue before continuing live judgement.

Do not silently keep an in-memory judgement as if it were recorded. If the
judgement cannot be written, the session must treat the evidence layer as
incomplete.
