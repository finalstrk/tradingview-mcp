# Read-only Daily Trading Review

Status: draft
Date: 2026-07-07
Source prompt: pasted X post about an AI trading bot, adopted only as a workflow reference.

## Purpose

Create a **read-only daily reviewer** for this TradingView MCP repo before any paper/live automation.

The reviewer is not an auto-trader. Its job is to make the current TradingView state and the local DT evidence layer legible each morning, then route each item to `watch`, `research`, or `no-action`.

## Hard boundaries

Allowed:

- Read the active TradingView chart via CDP.
- Read quote, OHLCV summary, visible study values, DT Pine labels/tables/lines, and watchlist snapshot.
- Read local evidence files such as `journal/registry.json` and generated stats.
- Produce a markdown/JSON report for human review.
- Say that a setup is gated, unverified, rejected, or needs research.

Forbidden:

- Place orders or operate broker/bank/payment UIs.
- Read or write API keys, secrets, credentials, or live broker config.
- Toggle live mode, change production strategy config, or change TradingView chart state.
- Decide buy/sell direction, position size, order timing, stop loss, take profit, or kill switches.
- Treat LLM commentary, social posts, or TradingView output as proof of an investment thesis.

## Daily review pipeline

```text
local evidence gate
  journal/registry.json
  journal/stats/setup_stats.json, if present
        |
        v
TradingView read-only snapshot
  status -> state -> quote -> ohlcv summary -> study values -> DT labels/tables/lines -> watchlist snapshot
        |
        v
human-readable report
  current chart, detected labels, evidence gate, blockers, next verification actions
        |
        v
human decision only
  watch / research / no-action; no execution
```

## Report shape

```markdown
# Daily TradingView Read-only Review — YYYY-MM-DD

## Read-only boundary
- This report does not place or recommend orders.
- LLM/automation is a research and review layer, not the alpha final layer.

## Current chart
- Symbol:
- Timeframe:
- Quote:
- OHLCV summary:

## Visible DT signals / labels
- Raw label:
- Setup:
- Direction/state if parseable:
- Interpretation: watch / research / no-action
- Missing evidence:

## Indicator context
- Visible studies:
- Values:

## Local evidence gate
- Adopted setup x markets:
- Candidate setup x markets:
- Rejected setup x markets:
- Gate result:

## Watchlist snapshot
- Count:
- Symbols:

## Blockers / uncertainty
-

## Next verification actions
-
```

## Default gate logic

- If `journal/registry.json` has no adopted setup x market, live judgement remains gated.
- DT labels on the chart are `watch` inputs, not trade signals, unless the relevant setup x market is `adopted`.
- `candidate` means verify or replay first.
- `rejected` means do not revive without new evidence and a documented review.
- Missing CDP/TradingView connection is a report blocker, not a reason to infer chart state.
- Any new strategy idea must pass `strategy_spec_check` before it can be treated as a paper/review candidate.
- Missing entry, take-profit, stop-loss, position sizing, or human confirmation routes the idea to `no-action`.
- Missing validation/risk cadence routes the idea to `research`, not `act`.

## Strategy minimum spec gate

The strategy gate lives at:

```bash
npm run strategy-spec-check -- path/to/spec.json
```

Print a starter template:

```bash
npm run strategy-spec-check -- --template
```

See `docs/strategy-spec-check.md` for the required JSON shape and routing rules.

## First implementation

The first implementation lives at:

```bash
node scripts/daily_review.js
```

It prints markdown by default and can write to a file:

```bash
node scripts/daily_review.js --out journal/reviews/daily-YYYY-MM-DD.md
node scripts/daily_review.js --json
```

## Review cadence

- Start with manual runs for at least two weeks.
- Only after reports are useful and low-noise should this become cron/Slack/Discord delivery.
- Paper-only strategy proposals are a later phase.
- Live brokerage integration is a separate decision and remains out of scope for this repo phase.
