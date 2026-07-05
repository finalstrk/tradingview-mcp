---
name: replay-drill
description: 検証済みセットアップの replay モード練習。Use when the user wants to practice trading setups on historical data.
---

# Replay Drill

検証済み、または候補中の DT セットアップを TradingView replay mode で練習し、判断と実行結果を journal に残す。

## 手順

1. **セットアップ選択**
   - `journal/registry.json` を読み、`adopted` のセットアップを優先して提示する。
   - `adopted` がなければ `candidate` のセットアップを提示する。
   - 対象 `symbol` と練習開始日を決める。
   - `journal/backtests/` に対象 setup / symbol / timeframe の結果 JSON があれば、`trades` が多かった期間を練習候補として推奨する。

2. **チャート準備**
   - `chart_set_symbol` で対象 symbol に切り替える。
   - `chart_set_timeframe` で `15` または `5` に設定する。
   - `chart_get_state` で、選択セットアップの `tv_script_name` に一致する indicator が表示されていることを確認する。
   - indicator がない場合は、registry の `tv_script_name` を示して追加が必要なことを伝える。

3. **replay 実行**
   - ここからのバーの進め方、トレード実行、レビュー手順は `skills/replay-practice/SKILL.md` の Step 3-5 に委譲する。
   - replay 操作の詳細は再記述せず、同ファイルの Step 3-5 を参照して実行する。

4. **replay-drill 固有の追加ルール**
   - 各エントリー判断の前に、trade-judge と同じ 6 項目採点を口頭で実施させる。
   - 6 項目は `setup` / `mtf` / `level` / `session` / `track` / `rr` とする。
   - `data_get_pine_labels` を `study_filter: "DT "` で呼び、indicator ラベルを読んで `state` を確認する。
   - エントリーした各トレードは、`journal/README.md` の Trades JSONL スキーマに従って `journal/trades/YYYY-MM.jsonl` に記録する。
   - replay 練習で記録する trade の `mode` は必ず `"replay"` にする。

5. **終了時**
   - 次を実行し、replay mode の成績を live と分けて表示する。

```bash
node scripts/journal_stats.js
```

   - 採点と結果の乖離を振り返る。例: GO 相当で負けたトレード、WAIT 相当で入ったトレード、ラベル `state` と実行判断がずれたトレード。
