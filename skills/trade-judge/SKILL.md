---
name: trade-judge
description: エントリー判断支援 — 検証済みセットアップ + MTF 分析 + コンフルエンス採点で GO/WAIT/NO-GO を判定。Use when the user asks whether to enter a trade or wants a trade judgement.
---

# Trade Judge Workflow

You are judging whether a discretionary trade entry is acceptable now. Use only
verified DT setups, multi-timeframe chart evidence, and the confluence score
below. Do not add points without evidence.

## Step 1: Interpret Input

Read `$ARGUMENTS` and extract:

- `symbol` (required): TradingView symbol such as `FX:USDJPY`, `CME_MINI:ES1!`, or `NASDAQ:AAPL`.
- `setup id` (optional): one of `orb`, `vwap_reversion`, `pdh_pdl_break`, `ema_pullback`, `nr_squeeze`.
- `direction` hint (optional): `long` or `short`.

If `symbol` is missing, stop and ask for the symbol. If a setup id is supplied,
evaluate only that setup after registry filtering.

## Step 2: Read Registry And Select Setups

1. Read `journal/registry.json`.
2. Determine the target symbol market: `fx`, `futures`, `stocks_us`, or `stocks_jp`.
   Use `symbol_info` when available; otherwise infer from exchange/type and
   symbol prefix.
3. From `registry.setups`, keep only setups whose target market entry has
   `status: "adopted"`.
4. If a setup id was supplied, narrow the adopted list to that setup id.
5. If no adopted setup remains, return `NO-GO` and explicitly state
   `検証済みセットアップなし`. Tell the user to run `/setup-verify` for the
   symbol/market before considering entries.

Use the registry fields for `tv_script_name`, recommended sessions, risk model,
and `bt_winrate`.

## Step 3: Multi-Timeframe Analysis

Start with `chart_set_symbol` for the requested symbol. Then move through each
timeframe with `chart_set_timeframe`.

### D

- Run `data_get_ohlcv` with `summary: true`.
- Run `data_get_study_values`.
- Determine daily bias as `bull`, `bear`, or `range`.
- Identify current price location relative to PDH/PDL when available.

### 60

- Run `data_get_ohlcv` with `count: 50`.
- Classify swing structure:
  - `bull(HH-HL)` when recent swings show higher highs and higher lows.
  - `bear(LH-LL)` when recent swings show lower highs and lower lows.
  - `range` when structure is mixed.

### 15

1. Call `chart_get_state` once at the start of this timeframe check.
2. Confirm that the target setup indicator from `tv_script_name` is already on
   the chart.
3. If it is missing, either ask the user to add the exact `tv_script_name`, or
   add it with `chart_manage_indicator` using the full TradingView script name
   when that is available.
4. Read labels with `data_get_pine_labels` and `study_filter: "DT "`.
5. Parse the newest DT signal label:

```text
DT|<setup_id>|<dir>|<state>|entry=<price>|sl=<price>|tp1=<price>|tp2=<price>
```

Extract `setup_id`, `dir`, `state`, `entry`, `sl`, `tp1`, and `tp2`. Valid
states are `forming`, `triggered`, and `expired`. Valid directions are `long`
and `short`.

### 5

- Run `quote_get`.
- Check trigger freshness from the current price, latest quote time, and
  distance from `entry`.
- Mark 5m status as `fresh`, `extended`, or `stale`.

## Step 4: Read Track Record

Read `journal/stats/setup_stats.json` if it exists, and read the registry
`bt_winrate` for the target setup and market.

- Use real trade stats for the same `setup x market` when present.
- Use `bt_winrate` from `journal/registry.json` as the backtest reference.
- If real trade count `n < 10`, use BT win rate as the evidence source and cap
  the track-record score at 10.
- If both real stats and BT win rate are missing, score this item as 0.

## Step 5: Confluence Score

Score mechanically from 0 to 100.

| 項目 | 配点 | 基準 |
|---|---:|---|
| セットアップ成立度 | 30 | `triggered` = 30 / `forming` = 15 / なし・`expired` = 0 |
| 上位足整合 | 20 | D + 1H が同方向 = 20 / 1H のみ同方向 = 10 / D が逆行 = 0 |
| キーレベル位置 | 15 | PDH/PDL/VWAP に対し優位 = 15 / 中立 = 7 / 直前に障害レベル = 0 |
| セッション/ボラ適合 | 10 | 活発セッション中かつ ATR 正常域 = 10 / 一部のみ満たす = 5 / 不適 = 0 |
| 実績勝率補正 | 15 | 実勝率 >= BT 勝率 = 15 / 乖離 -10pt 以内 = 10 / それ以上 = 5。実トレード `n < 10` は BT 勝率代用で上限 10 |
| リスクリワード | 10 | TP1 基準 RR >= 1.5 = 10 / 1.0-1.5 = 5 / < 1.0 = 0 |

RR is:

```text
abs(tp1 - entry) / abs(entry - sl)
```

If `entry`, `sl`, or `tp1` is missing, RR score is 0.

## Step 6: Verdict

- `GO`: total score >= 75, setup score >= 15, RR >= 1.0, D timeframe is not
  against the trade direction, and the signal is not merely `forming`.
- `WAIT`: total score is 50-74, or the latest setup state is `forming`. Always
  include one line explaining exactly what should happen before re-evaluation.
- `NO-GO`: total score < 50, D timeframe is against the trade direction, no
  adopted setup exists, or the signal is missing/expired with no actionable
  trigger.

## Step 7: Output Format

Follow this structure:

```markdown
## Trade Judgement: USDJPY 5m — ORB Long
判定: **GO** (82/100)

| 項目 | 得点 | 根拠 |
|---|---:|---|
| セットアップ成立度 | 30/30 | 15m label is triggered |
| 上位足整合 | 20/20 | D=bull and 1H=bull(HH-HL) |
| キーレベル位置 | 7/15 | PDH is nearby but not blocking |
| セッション/ボラ適合 | 10/10 | NY active session, ATR normal |
| 実績勝率補正 | 10/15 | BT 48%, real 52%, n=23 |
| リスクリワード | 5/10 | TP1 RR=1.0 |

エントリー: 157.20 / SL: 157.00 (1.0R) / TP1: 157.40 (+1R 半分利確) / TP2: 157.60 (+2R)
MTF: D=bull / 1H=bull(HH-HL) / 15m=triggered / 5m=fresh
実績: BT勝率48% (n=142) / 実勝率52% (n=23)
無効化条件: 157.00 クローズ割れ / NY session close
```

For `WAIT`, add one required line:

```markdown
再評価条件: 15m label が triggered になり、現在価格と entry の乖離が許容範囲に戻ったら再評価。
```

## Step 8: Record Judgement

Record every completed judgement in `journal/judgements/YYYY-MM.jsonl` using the
schema in `journal/README.md`.

1. Run `capture_screenshot`.
2. Put the returned screenshot path into the JSON `screenshot` field.
3. Append exactly one JSON object line:

```bash
echo '<json>' >> journal/judgements/$(date +%Y-%m).jsonl
```

The JSON object must include:

- `id`
- `ts`
- `symbol`
- `tf`
- `setup`
- `market`
- `direction`
- `verdict`
- `score`
- `breakdown.setup`
- `breakdown.mtf`
- `breakdown.level`
- `breakdown.session`
- `breakdown.track`
- `breakdown.rr`
- `entry`
- `sl`
- `tp1`
- `tp2`
- `mtf.D`
- `mtf.60`
- `mtf.15`
- `mtf.5`
- `invalidation`
- `screenshot`

## Notes

- Follow `CLAUDE.md` context rules: use `summary: true` for OHLCV summaries,
  always use `study_filter` when reading Pine graphics, and call
  `chart_get_state` only once at the start of the indicator check.
- Use the DT label format from `pine/PINE_CONVENTIONS.md`; do not invent another
  parser.
- Use full indicator names for `chart_manage_indicator`.
- Score mechanically. Do not award points without observed chart, registry, or
  journal evidence.
- If the verdict is `WAIT`, always state exactly what event or price condition
  should trigger re-evaluation.
