# Strategy Spec Check

Status: draft
Date: 2026-07-07

## Purpose

`strategy_spec_check` is a deterministic gate for trading strategy ideas. It answers one narrow question:

> Is this idea specified enough to continue research or paper review?

It does **not** answer whether to buy, sell, size, route, or execute an order.

## Boundary

Allowed:

- Read a local JSON strategy spec.
- Check whether required logic, risk, validation, and human-confirmation fields exist.
- Route the idea to `no-action`, `research`, or `watch`.
- Output markdown/JSON for a decision log or review note.

Forbidden:

- Place orders.
- Connect to broker APIs.
- Change TradingView chart state.
- Decide live direction, size, order timing, stop-loss, take-profit, or kill switch.
- Treat LLM/SNS/TradingView labels as alpha proof.

## Minimum spec

A strategy candidate needs all of the following before it can even be a paper/review candidate:

1. `id`
2. `market` / universe
3. `timeframe`
4. `data_source`
5. `entry`
6. `exit_take_profit`
7. `exit_stop_loss`
8. `position_size`
9. `risk.max_risk_per_trade`
10. `risk.daily_loss_limit`
11. `risk.max_concurrent_positions`
12. `backtest_period`
13. pre-declared `benchmark`
14. `validation.candidate_count`
15. explicit IS / OOS / untouched final holdout periods
16. a parameter-freeze rule before opening the holdout
17. primary and conservative stress fill models
18. commission / spread / slippage assumptions
19. top-trade removal, regime splits, and long/short decomposition
20. `paper_trade_period`
21. `risk.kill_switch`
22. `review_cadence`
23. `edge_death_condition`
24. `human_confirmation`

Critical missing fields route to `no-action`. Non-critical validation gaps route to `research`. A complete spec routes to `watch` / paper-candidate only — never live execution.

## Usage

Print a starter JSON template:

```bash
npm run strategy-spec-check -- --template
```

Check a spec:

```bash
npm run strategy-spec-check -- path/to/spec.json
```

Output JSON:

```bash
npm run strategy-spec-check -- path/to/spec.json --json
```

Write markdown to a review file:

```bash
npm run strategy-spec-check -- path/to/spec.json --out journal/reviews/spec-check-YYYY-MM-DD.md
```

Fail CI/local checks when incomplete:

```bash
npm run strategy-spec-check -- path/to/spec.json --strict
```

## Example JSON shape

```json
{
  "id": "example_setup",
  "market": "stocks_jp",
  "timeframe": "D",
  "data_source": "TradingView OHLCV + official IR/news verification",
  "entry": ["Define exact indicator/price/volume conditions."],
  "exit_take_profit": ["Define target or R multiple."],
  "exit_stop_loss": ["Define stop level and trigger semantics."],
  "position_size": "Risk at most 0.5% of equity per trade.",
  "risk": {
    "max_risk_per_trade": "0.5% equity",
    "daily_loss_limit": "1.0% equity",
    "max_concurrent_positions": 3,
    "kill_switch": ["API/data failure", "rule drift", "manual override"]
  },
  "backtest_period": "YYYY-MM-DD..YYYY-MM-DD, OOS and final holdout included",
  "benchmark": ["buy-and-hold or cash", "simple MA or breakout"],
  "validation": {
    "candidate_count": 1,
    "in_sample_period": "YYYY-MM-DD..YYYY-MM-DD",
    "out_of_sample_period": "YYYY-MM-DD..YYYY-MM-DD",
    "holdout_period": "YYYY-MM-DD..YYYY-MM-DD; untouched by refinement",
    "parameter_freeze": "Freeze rules and parameters before opening holdout."
  },
  "execution": {
    "primary_fill_model": "Declared production-like fill assumption",
    "stress_fill_model": "Next-bar-open or one-bar-delayed fill",
    "commission": "Per-side instrument-specific cost plus stress case",
    "spread": "Instrument/session assumption plus stress multiple",
    "slippage": "Ticks/bps assumption plus adverse stress case"
  },
  "robustness": {
    "top_trade_removal": "Remove largest win and top 1% / 5% winners",
    "regime_splits": ["trend/range", "high/low volatility", "risk-on/risk-off"],
    "long_short_decomposition": "Report separately or n/a with reason"
  },
  "paper_trade_period": "At least 1-3 months",
  "review_cadence": "weekly paper review; monthly parameter review",
  "edge_death_condition": ["PF < 1.0 OOS", "live/paper gap persists"],
  "human_confirmation": {
    "required": true,
    "live_orders": "manual only"
  }
}
```

## AI-assisted refinement rule

- LLMs may translate rules, scaffold Pine code, explain failed trades, and propose one-variable research hypotheses.
- Every strategy, timeframe, market, filter, and parameter variant inspected counts toward `candidate_count`.
- Once OOS or holdout output has influenced a rule change, that period is consumed and cannot be called untouched OOS/holdout again.
- Exporting a TradingView CSV and repeatedly asking an LLM to improve the same history is optimization, not independent validation.
- A dollar P&L headline is never promotion evidence by itself. Preserve return, drawdown, trade count, benchmark gap, cost assumptions, and top-trade dependence.

## Relationship to daily review

`daily_review` tells us what is visible now: chart state, DT labels, registry status, and blockers.

`strategy_spec_check` tells us whether a candidate idea is specified enough to deserve research/paper tracking.

Together they form a stop-first workflow:

1. Chart/review output creates a hypothesis.
2. Strategy spec check rejects underspecified ideas.
3. Only complete specs become paper candidates.
4. Live execution remains outside this toolchain.
