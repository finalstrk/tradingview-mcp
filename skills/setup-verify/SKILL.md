---
name: setup-verify
description: Pine strategy のバックテスト統計検証と採用判定。Use when validating a trading setup's statistical edge before adoption.
---

# Setup Verify

Pine strategy のバックテスト統計を市場別に検証し、採用可否を `journal/registry.json` と `journal/backtests/` に記録する。無根拠な `adopted` は作らず、データ不足は失敗と分けて `insufficient_data` として扱う。

## 採用基準

- 銘柄毎トレード数は期間内で **n >= 100**。n < 100 は `insufficient_data` とし、`fail` と区別する。
- 成績基準は **(勝率 >= 45% かつ PF >= 1.3) または (勝率 >= 35% かつ PF >= 1.6)**。
- 最大 DD は初期資金比で **<= 15%**。
- コミッションとスリッページは strategy 宣言の設定込みで判定する。
- **市場セットの過半数銘柄で基準達成した場合、その市場を `adopted`** とする。採否は市場別に分ける。
- パラメータ再調整は **1 回まで**。過剰最適化を避け、再調整した場合は `journal/registry.json` の該当 setup / market の `notes` に記録する。

## 市場別検証銘柄セット

| 市場 | 銘柄 | TF |
|---|---|---|
| fx | FX:USDJPY, FX:EURUSD, FX:GBPUSD, FX:AUDUSD | 5, 15 |
| futures | CME_MINI:ES1!, CME_MINI:NQ1!, CBOT_MINI:YM1! | 5, 15 |
| stocks_us | NASDAQ:AAPL, NASDAQ:NVDA, NASDAQ:TSLA | 5, 15 |
| stocks_jp | TSE:7203, TSE:9984, TSE:8306 | 5, 15 |

## 手順

1. **対象決定**: `$ARGUMENTS` から setup id と市場を決める。市場省略時は `fx` と `futures` を優先する。`journal/registry.json` から `pine_strategy` のパスと `tv_script_name` を取得する。
2. **コンパイル & 保存**: 対象 `.pine` ファイルを Read し、`pine_set_source`、`pine_smart_compile` の順で実行する。0 エラーまで修正し、エラー時は `skills/pine-develop/SKILL.md` の修正ループに従う。`pine_list_scripts` で名前衝突を確認し、`pine_save` で保存ダイアログを開く。保存ダイアログが出た場合は `ui_click({ by: "text", value: "保存" })` で確定し、再度 `pine_list_scripts` で登録名が存在することを確認してから次へ進む。
3. **strategy ロード確認**: `chart_get_state` で対象 strategy がチャートに追加されていることを確認してから次へ進む。未ロードのまま `batch_run` すると空結果になるため、必ずこの確認を挟む。
4. **セッションプリセット**: 市場に応じて `indicator_set_inputs` でプリセットを切り替える。`fx` は `London` または `NY`、`futures` と `stocks_us` は `RTH`、`stocks_jp` は `Tokyo` を使う。
5. **バックテスト実行**: `batch_run(symbols=<市場セット>, timeframes=["5","15"], action="get_strategy_results")` を実行する。
6. **詳細確認**: 代表 1 銘柄について `data_get_trades` と `data_get_equity` で歪みを確認する。分析観点は `skills/strategy-report/SKILL.md` の Step 3 を再利用し、ここでは手順を再記述しない。
7. **記録**: 銘柄 x TF ごとに `journal/backtests/<setup>__<symbol_sanitized>__<tf>__<YYYYMMDD>.json` を書く。スキーマは `journal/README.md` に従い、実際に取得できた期間とトレード数を必ず記録する。
8. **registry 更新**: `markets.<market>` の `status` を `adopted`、`rejected`、`insufficient_data` のいずれかに更新する。`bt_winrate` と `bt_pf` は採用 TF・銘柄の中央値を入れ、`evidence` には backtests ファイルパス配列を記入し、`updated` 日付も更新する。
9. **報告**: 市場 x 銘柄 x TF の結果表、採否判定、根拠を報告する。棄却時は勝率、PF、最大 DD、トレード数のうち、どの基準を満たさないかを明示する。

## 判定メモ

- 銘柄単位で n < 100 の結果は `insufficient_data` とし、市場の過半数判定では pass として数えない。
- 市場内で `insufficient_data` が多く、過半数判定に必要な銘柄数を満たせない場合、その市場は `insufficient_data` とする。
- TradingView プランにより日中足の遡及期間が異なる。取得期間は必ず backtests JSON の `period.from` / `period.to` に記録する。
- Backtests JSON の `verdict` は `journal/README.md` の定義に従い、`pass`、`fail`、`insufficient_data` のいずれかにする。
- `npm run test` は E2E 内で `pine_set_source` / `pine_save` を実行し、現在の Pine Editor 内容を書き換える。実運用中に実行する場合は先に `pine_get_source` 相当で退避し、終了後に元ソースへ戻す。
