# DT Pair-Trader Layer

The DT Pair-Trader layer is a realtime operations layer on top of the existing
DT trading system: the 68 TradingView MCP tools, the journal evidence layer,
and the `journal/registry.json` adoption gate. It helps the human trader
evaluate a live setup while it is forming.

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

The design uses three tiers so the main session stays small while expensive
reasoning is reserved for the few moments that need it.

| Tier | Runtime | Role | Data boundary |
| --- | --- | --- | --- |
| Orchestration tier | Main session, Fable/Opus model | Plans, delegates, integrates, and presents the final `GO`, `WAIT`, or `NO-GO` decision support output. | Never pulls raw MCP data directly. It receives compact worker outputs and decides what to ask next. |
| Worker tier | 4 subagents, Sonnet | Performs MCP reads, compact market summarization, journal reads/writes, registry checks, and Codex handoff. | Reads only the data needed for the current step. Emits compact structured output. |
| Heavy reasoning tier | Codex CLI delegation, `gpt-5.6-sol`, reasoning effort `high` | Performs setup analysis, scenario building, and adversarial risk critique. | Analysis-only contract: prompt-enforced no-file-write rule plus before/after triple-hash comparison (status, diff HEAD, untracked contents; the outer Claude Code sandbox is the boundary). |

The orchestration tier owns the session state and final presentation. The worker
tier owns narrow tasks. The heavy reasoning tier is used only when a setup is
eligible and the session needs deeper analysis than a compact worker response.

## Agents

Agent definitions live under `.claude/agents/`. Each agent has a narrow contract.

### `market-watcher`

`market-watcher` is MCP read-only.

Responsibilities:

- Run TradingView read tools needed for the current symbol and timeframe.
- Read DT Pine labels with `study_filter: "DT "` and parse the standard label
  payload: `DT|<setup_id>|<dir>|<state>|entry=...|sl=...|tp1=...|tp2=...`.
- Use compact OHLCV summaries, not raw bar dumps, unless explicitly requested.
- Emit a compact market snapshot of about 1 KB.

Output rules:

- Facts only.
- No trade opinion.
- No `GO`, `WAIT`, or `NO-GO`.
- No registry adoption judgement.

### `setup-analyst`

`setup-analyst` takes the `market-watcher` snapshot and builds the setup case.

Responsibilities:

- Identify the active DT setup signal from the snapshot.
- Call Codex with reasoning effort `high` for scenario building when the setup
  is eligible for analysis.
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

### `risk-officer`

`risk-officer` performs an independent adversarial review.

Responsibilities:

- Check `journal/registry.json` before live judgement.
- Confirm that the setup x market combination has `status: "adopted"`.
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
`risk-officer` does not execute the trade and does not write journal lines.

### `journal-scribe`

`journal-scribe` owns append-only journal writes.

Responsibilities:

- Append one judgement line to `journal/judgements/YYYY-MM.jsonl`.
- Append one trade line to `journal/trades/YYYY-MM.jsonl` after the human reports
  the execution result.
- Link trade records to judgement records with `judgement_id` when available.

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

Flow:

1. Run `tv_health_check`.
2. If TradingView is not reachable, stop and tell the user that `tv_launch` can
   start it (do not auto-launch); re-run `tv_health_check` after the user
   confirms, and only proceed once it passes.
3. Run `market-watcher` to collect a compact snapshot for the symbol and
   timeframe.
4. If no DT setup signal is present, report the market state and continue the
   loop.
5. If a DT setup signal is present, check whether the setup x market combination
   is adopted in `journal/registry.json`.
6. If the setup is not adopted, route to `/setup-verify` or `/replay-drill`.
   Do not produce a live trade judgement.
7. If the setup is adopted, run `setup-analyst` and `risk-officer` in parallel.
8. The main session integrates the setup case, adversarial review, registry
   status, RR, session fit, and track record into one decision support output:
   `GO`, `WAIT`, or `NO-GO`.
9. The human trader decides whether to execute manually.
10. `journal-scribe` records the judgement in
    `journal/judgements/YYYY-MM.jsonl`.
11. After the human reports the result, `journal-scribe` records the trade in
    `journal/trades/YYYY-MM.jsonl` and links it with `judgement_id`.
12. Repeat the loop until the session ends.

The pair session is not a signal firehose. It should wait for an adopted DT setup
signal, produce one clear judgement, record the evidence, and then return to
watching.

## Codex Delegation

`setup-analyst` and risk review workflows may delegate heavy analysis to Codex
when deeper scenario work is needed.

Invocation contract:

```bash
CODEX_BIN=/Users/yukio/bin/codex bash ~/.claude/scripts/codex-from-claude.sh exec --skip-git-repo-check --cd "<repo>" --model gpt-5.6-sol -c 'mcp_servers={}' -c 'model_reasoning_effort="high"' -- "<request>"
```

The model is `gpt-5.6-sol` at reasoning effort `high` (replaced `gpt-5.5` `xhigh`
on 2026-07-15). `CODEX_BIN` must point at the newer Codex binary; the wrapper
otherwise prefers an older nvm-installed Codex that rejects gpt-5.6-sol.

Delegation rules:

- Codex receives the compact market snapshot and the specific analysis request.
- The wrapper bypasses Codex's internal sandbox; the outer Claude Code sandbox is
  the effective boundary.
- MCP servers are disabled with `mcp_servers={}`.
- Codex drafts and analyzes only. Every prompt must end with: "Output analysis
  text only. Do not create, modify, or delete any files."
- Before and after each call, capture three hashes: `git status --porcelain=v1
  -uall | shasum`, `git diff HEAD | shasum`, and `git ls-files --others
  --exclude-standard -z | xargs -0 shasum 2>/dev/null | shasum` (untracked
  contents); any difference means contamination — discard the Codex output,
  report it, and stop.
- Codex output must be treated as analysis, not as execution authority.

Expected setup analysis fields (matching the `setup-analyst` fixed template):

```json
{
  "thesis": "string",
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

- **Tool-name enforcement is deferred to first live run.** `market-watcher`
  restricts mutations via `disallowedTools`, but if the TradingView MCP server
  registers tools with an `mcp__<server>__` prefix, the bare-name entries will
  not match. Verify the effective tool names on the first live `/pair-session`
  run and mirror the denylist entries with the real prefix.
- **Bash access is not command-restricted.** `setup-analyst`, `risk-officer`,
  and `journal-scribe` need Bash (Codex wrapper, git verification, JSONL
  append), and Claude Code agent frontmatter cannot express per-command
  allowlists. The no-order / append-only boundaries are enforced by
  instructions, the contamination checks, and the outer Claude Code sandbox —
  not by tooling. Hook-based enforcement (PreToolUse command validation) is a
  planned hardening step.
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
- Use Codex delegation only after an adopted setup signal is present or when an
  explicit adversarial review is requested.
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

### Codex CLI delegation fails

Symptoms:

- The Codex wrapper command fails.
- The command times out.
- The output is empty or malformed.

Handling:

1. Continue the session without Codex if the market snapshot and registry check
   are available.
2. `setup-analyst` degrades to Sonnet-only analysis.
3. The output must explicitly state degraded mode.

Required wording in the judgement output:

```text
Degraded mode: Codex delegation failed; setup analysis was completed by the Sonnet worker only.
```

Do not hide the failure. Do not present degraded analysis as equivalent to the
normal heavy reasoning path.

### Journal write fails

Symptoms:

- `journal-scribe` cannot append to `journal/judgements/YYYY-MM.jsonl`.
- `journal-scribe` cannot append to `journal/trades/YYYY-MM.jsonl`.
- The target directory or file is unavailable.
- JSON serialization fails.

Handling:

1. Stop further journal writes.
2. Report the target path and operation that failed.
3. Show the record that was intended to be appended.
4. Ask the human to resolve the file or permission issue before continuing live
   judgement.

Do not silently keep an in-memory judgement as if it were recorded. If the
judgement cannot be written, the session must treat the evidence layer as
incomplete.
