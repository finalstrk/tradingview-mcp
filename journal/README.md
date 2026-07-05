# Trading Journal Data Layer

This directory stores discretionary-trading evidence, backtest summaries, and
derived statistics for the DT setup library. Pine scripts emit standardized
signals; this journal records human judgement, actual trade execution, and
post-run aggregate performance.

## Directory Layout

```text
journal/
  README.md                 Canonical schema and operating notes.
  registry.json             Setup registry and market-level adoption status.
  backtests/                One JSON file per setup/symbol/timeframe/date run.
  judgements/               Monthly JSONL files, one judgement per line.
  trades/                   Monthly JSONL files, one executed trade per line.
  stats/                    Generated aggregate output from journal_stats.js.
scripts/
  journal_stats.js          Dependency-free Node CLI for trade aggregation.
```

## Registry

`journal/registry.json` is the canonical list of setups that can be evaluated by
the journal flow. It tracks the Pine source paths, TradingView script title,
candidate markets, risk model, and recommended session presets.

Market `status` values:

- `candidate`: setup is available for testing but not accepted.
- `adopted`: setup has enough evidence and is part of the active playbook.
- `rejected`: setup failed validation for the market.
- `insufficient_data`: setup needs more judgement, trade, or backtest evidence.
- `retired`: setup is no longer active, regardless of previous status.

Status transition:

```text
candidate
  |-- adopted
  |-- rejected
  `-- insufficient_data

adopted/rejected/insufficient_data
  `-- retired
```

## Judgements JSONL

Path: `journal/judgements/YYYY-MM.jsonl`

Each line is one trade judgement made before or around signal confirmation.

Schema:

```json
{
  "id": "string",
  "ts": "ISO-8601 timestamp",
  "symbol": "string",
  "tf": "string",
  "setup": "orb | vwap_reversion | pdh_pdl_break | ema_pullback | nr_squeeze",
  "market": "fx | futures | stocks_us | stocks_jp",
  "direction": "long | short",
  "verdict": "GO | WAIT | NO-GO",
  "score": 0,
  "breakdown": {
    "setup": 0,
    "mtf": 0,
    "level": 0,
    "session": 0,
    "track": 0,
    "rr": 0
  },
  "entry": 0,
  "sl": 0,
  "tp1": 0,
  "tp2": 0,
  "mtf": {
    "D": "string",
    "60": "string",
    "15": "string",
    "5": "string"
  },
  "invalidation": "string",
  "screenshot": "string"
}
```

Sample line:

```json
{"id":"jd_20260705T0930_orb_usdjpy","ts":"2026-07-05T09:30:00+09:00","symbol":"FX:USDJPY","tf":"5","setup":"orb","market":"fx","direction":"long","verdict":"GO","score":82,"breakdown":{"setup":30,"mtf":20,"level":7,"session":10,"track":10,"rr":5},"entry":157.20,"sl":157.00,"tp1":157.40,"tp2":157.60,"mtf":{"D":"bull","60":"bull","15":"triggered","5":"fresh"},"invalidation":"157.00 close below","screenshot":"screenshots/xxx.png"}
```

`verdict` must be one of:

- `GO`
- `WAIT`
- `NO-GO`

## Trades JSONL

Path: `journal/trades/YYYY-MM.jsonl`

Each line is one executed live or replay trade. Link it to a judgement with
`judgement_id` when possible.

Schema:

```json
{
  "id": "string",
  "judgement_id": "string",
  "mode": "live | replay",
  "setup": "orb | vwap_reversion | pdh_pdl_break | ema_pullback | nr_squeeze",
  "market": "fx | futures | stocks_us | stocks_jp",
  "symbol": "string",
  "direction": "long | short",
  "entry_actual": 0,
  "exit": 0,
  "exit_reason": "tp1 | tp2 | sl | eod | manual",
  "r_multiple": 0,
  "followed_plan": true,
  "mistakes": [],
  "ts_open": "ISO-8601 timestamp",
  "ts_close": "ISO-8601 timestamp",
  "notes": "string"
}
```

Sample line:

```json
{"id":"tr_20260705T1130","judgement_id":"jd_20260705T0930_orb_usdjpy","mode":"live","setup":"orb","market":"fx","symbol":"FX:USDJPY","direction":"long","entry_actual":157.21,"exit":157.44,"exit_reason":"tp1","r_multiple":1.15,"followed_plan":true,"mistakes":[],"ts_open":"2026-07-05T09:31:00+09:00","ts_close":"2026-07-05T11:30:00+09:00","notes":""}
```

`mode` must be one of:

- `live`
- `replay`

`exit_reason` must be one of:

- `tp1`
- `tp2`
- `sl`
- `eod`
- `manual`

## Backtests JSON

Path: `journal/backtests/<setup>__<symbol_sanitized>__<tf>__<YYYYMMDD>.json`

Example filename: `orb__FX_USDJPY__5__20260705.json`

Each file stores one TradingView strategy tester export summary, normalized into
the journal schema.

Schema:

```json
{
  "setup": "orb",
  "symbol": "FX:USDJPY",
  "market": "fx",
  "tf": "5",
  "date": "2026-07-05",
  "period": {
    "from": "...",
    "to": "..."
  },
  "inputs": {
    "sessionPreset": "London",
    "orWindow": "0800-0830",
    "maxOrWidthAtr": 2.5,
    "signalValidityBars": 24
  },
  "trades": 142,
  "winrate": 0.48,
  "winrate_pct": 48.0,
  "pf": 1.42,
  "max_dd_pct": 8.3,
  "net_profit_pct": 12.1,
  "avg_trade": null,
  "currency": "JPY",
  "verdict": "pass",
  "criteria": "wr>=45&pf>=1.3",
  "notes": ""
}
```

`verdict` must be one of:

- `pass`
- `fail`
- `insufficient_data`

`inputs` records the effective TradingView strategy inputs used for the run, not just source defaults. Use it when a market preset changes session or opening-window behaviour.

## Stats CLI

Run:

```bash
node scripts/journal_stats.js
```

The CLI reads every `journal/trades/*.jsonl` file, skips blank lines, warns and
skips invalid JSON lines with file and line number, then groups valid trades by:

```text
setup x market x mode
```

For each group it writes these fields to
`journal/stats/setup_stats.json`:

- `n`: trade count.
- `wins`: count of trades with `r_multiple > 0`.
- `win_rate`: `wins / n`.
- `avg_r`: average `r_multiple`.
- `expectancy`: same value as `avg_r`, kept as a named trading metric.
- `plan_adherence`: share of trades where `followed_plan === true`.

When there are no trade files or no valid trade records, the CLI prints
`No trades recorded yet.`, writes an empty stats structure, and exits with code
0.
