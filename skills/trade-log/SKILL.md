---
name: trade-log
description: トレード結果の記録と統計更新。Use when the user wants to log a completed trade or review trading statistics.
---

# Trade Log

完了したトレードを `journal/trades/YYYY-MM.jsonl` に記録し、統計を更新する。

## 手順

1. **対象 judgement の特定**
   - `$ARGUMENTS` に judgement id があれば、その id を `journal/judgements/*.jsonl` から検索して使う。
   - judgement id がなければ、`journal/judgements/` の最新月ファイルを `tail` し、直近の `GO` / `WAIT` を候補提示して選択してもらう。
   - judgement に紐づかない飛び込みトレードは、`judgement_id: null` で記録してよい。

2. **実結果ヒアリング**
   - AskUserQuestion または対話で、実際の `entry_actual` / `exit` / `exit_reason` / `followed_plan` / `mistakes` / `notes` を確認する。
   - `exit_reason` は `tp1` / `tp2` / `sl` / `eod` / `manual` のいずれかにする。
   - `followed_plan` は `true` / `false`、`mistakes` は配列で記録する。例: `["chased entry", "moved stop"]`
   - judgement から `setup` / `market` / `symbol` / `direction` / `ts_open` の候補を引き継ぐ。不足する項目は確認する。
   - `ts_close` は実際の決済時刻を確認し、不明なら現在時刻を使う前に明示する。

3. **R 倍数計算**
   - judgement の `sl` を基準にする。judgement がない、または `sl` が不明な場合は必ず確認する。
   - long: `r_multiple = (exit - entry_actual) / (entry_actual - sl)`
   - short: `r_multiple = (exit - entry_actual) / (entry_actual - sl)` を符号反転する。
   - short の等価式: `r_multiple = (entry_actual - exit) / (sl - entry_actual)`
   - 分母が 0 になる値は記録前に修正確認する。

4. **記録**
   - `journal/README.md` の Trades JSONL スキーマに従い、`journal/trades/YYYY-MM.jsonl` に 1 行 append する。
   - `mode` は必ず `"live"` にする。
   - `id` は `tr_YYYYMMDDTHHMM` 形式を基本にし、重複する場合は短い suffix を付ける。

5. **統計更新**
   - 記録後に次を実行し、出力テーブルを表示する。

```bash
node scripts/journal_stats.js
```

6. **乖離アラート**
   - 必ず `journal/stats/setup_stats.json` と、利用可能な BT 勝率（`journal/registry.json` の `bt_winrate` または `journal/backtests/*.json` の `winrate`）を確認する。
   - セットアップ別の live 実勝率と BT 勝率を比較し、`実勝率 - BT 勝率 < -0.15` かつ live 実績 `n >= 20` の場合は「/setup-verify で再検証を推奨」と提案する。
   - `followed_plan false` 率が `> 30%` かつ `n >= 10` の場合は「規律の問題。/replay-drill での練習を推奨」と提案する。
