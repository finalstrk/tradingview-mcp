# DT トレード判断支援システム運用ガイド

このシステムは、TradingView 上の DT 系 Pine セットアップ、バックテスト検証、裁量判断、売買記録、週次改善をつなぐための判断支援レイヤーです。自動売買ではなく、セットアップの候補検出と判断材料の整理、実行後の記録・改善を一貫した形式で扱います。

## システム全体図

```text
Pine 層
  pine/setups/
    orb
    vwap_reversion
    pdh_pdl_break
    ema_pullback
    nr_squeeze
      |
      |  DT ラベル / plotshape / alertcondition
      v
検証層
  /setup-verify
    TradingView strategy backtest
    journal/backtests/*.json
    journal/registry.json の status 更新
      |
      |  adopted の setup x market のみ通す
      v
判断層
  /trade-judge <symbol>
    MTF 確認
    重要レベル確認
    セッション確認
    RR / track record 採点
    GO / WAIT / NO-GO
      |
      |  判断ログ
      v
記録層
  journal/judgements/YYYY-MM.jsonl
  journal/trades/YYYY-MM.jsonl
      |
      |  集計
      v
改善層
  /trade-log
  /replay-drill
  scripts/journal_stats.js
  journal/stats/setup_stats.json
```

Pine 層は TradingView チャート上でセットアップ候補を表示します。検証層は strategy 版のバックテスト結果を registry に反映し、判断層は adopted になったセットアップだけを評価対象にします。記録層は判断と実トレードを JSONL で残し、改善層は統計レビュー、再検証、リプレイ練習につなげます。

## 初期セットアップ手順

1. TradingView Desktop を CDP 付きで起動します。接続確認には `tv_health_check` を使い、未起動なら `tv_launch` で起動します。
2. `pine/setups/` の各セットアップを TradingView に表示できる状態にします。indicator 版はチャート上の候補検出用、strategy 版は検証用です。
3. `/setup-verify <setup> <symbol> <timeframe>` でバックテストを実行します。結果は `journal/backtests/` に保存し、採否判断を `journal/registry.json` に反映します。
4. registry で対象 market の `status` が `adopted` になったセットアップだけが、日々の `/trade-judge` の対象になります。
5. `candidate` や `insufficient_data` のセットアップは観察・追加検証の対象です。実運用の判断ゲートとしては使いません。

## 日々の運用フロー

### 朝

- 対象銘柄の TradingView チャートを準備し、必要な DT indicator を表示します。
- `chart_get_state` で symbol、timeframe、表示中 indicator を確認します。
- indicator タイトルは `"DT <Name> v1"` 形式なので、MCP 側では `study_filter: "DT "` を使って DT 系だけを対象にできます。
- 当日の主セッションを確認します。日本株・東京時間は Tokyo、欧州は London、米国株・米国先物は NY または RTH を基本にします。

### 場中

- チャート上で DT ラベルや plotshape によるセットアップ形成を確認します。
- 候補が出たら `/trade-judge <symbol>` を実行します。
- `/trade-judge` は registry で adopted のセットアップだけを評価し、MTF、重要レベル、セッション、RR、過去成績を採点して `GO` / `WAIT` / `NO-GO` を返します。
- `GO` の場合も、entry、SL、TP、無効化条件、許容リスクを確認してから計画通りにエントリーします。
- 決済後は `/trade-log` で実行結果を `journal/trades/YYYY-MM.jsonl` に記録します。判断時の `judgement_id` がある場合は紐付けます。

### 週次

- `node scripts/journal_stats.js` を実行し、`journal/stats/setup_stats.json` を更新します。
- `win_rate`、`avg_r`、`expectancy`、`plan_adherence` をセットアップ別に確認します。
- バックテスト上の期待値と実運用の結果に大きな乖離がある場合は、次のどちらかを行います。
  - `/setup-verify` で対象 setup x market を再検証する。
  - `/replay-drill` で同じセットアップのリプレイ練習を行い、判断や実行のズレを確認する。

## 4 コマンドの説明

### `/trade-judge`

入力例:

```text
/trade-judge FX:USDJPY
/trade-judge NASDAQ:AAPL
```

出力:

- `GO` / `WAIT` / `NO-GO` の verdict
- setup、direction、entry、SL、TP1、TP2
- MTF 状況、重要レベル、セッション適合、RR、track record の採点内訳
- 無効化条件
- 必要に応じた screenshot path

使い所:

- セットアップが形成または発火した時に、入るべきかを判断するために使います。
- registry で `adopted` ではない setup x market は原則として判断対象にしません。
- 判断結果は `journal/judgements/YYYY-MM.jsonl` に 1 行 1 判断で記録します。

### `/trade-log`

入力例:

```text
/trade-log judgement_id=jd_20260705T0930_orb_usdjpy exit=157.44 reason=tp1 r=1.15 followed_plan=true
```

出力:

- `journal/trades/YYYY-MM.jsonl` に追加された trade record
- setup、market、symbol、direction、entry_actual、exit、exit_reason、r_multiple、followed_plan の確認

使い所:

- live または replay の決済後に、実行結果を記録するために使います。
- 可能な限り `/trade-judge` の `judgement_id` と紐付けます。
- 計画逸脱があった場合は `followed_plan=false` とし、`mistakes` と `notes` に具体的に残します。

### `/setup-verify`

入力例:

```text
/setup-verify orb FX:USDJPY 5
/setup-verify ema_pullback CME_MINI:ES1! 15
```

出力:

- TradingView strategy tester の検証結果
- `journal/backtests/<setup>__<symbol>__<tf>__<YYYYMMDD>.json`
- `journal/registry.json` の status 更新案または更新結果

使い所:

- 新しい setup x market を採用する前に使います。
- 既存 adopted セットアップの成績が崩れた時の再検証にも使います。
- `pass` でも即採用ではなく、取引数、PF、最大 DD、対象期間、実運用ログとの整合を確認します。

### `/replay-drill`

入力例:

```text
/replay-drill orb FX:USDJPY 5 2026-06-01
```

出力:

- TradingView replay の開始状態、練習中の判断、終了時の結果
- 必要に応じた screenshot path
- replay trade を記録する場合は `journal/trades/YYYY-MM.jsonl` の `mode: "replay"` record

使い所:

- セットアップの認識、待つ判断、エントリー後の管理を練習するために使います。
- 実運用で `plan_adherence` が低いセットアップを重点的に練習します。
- バックテストでは見えにくい裁量ミスや、場中の判断速度の問題を洗い出します。

## データの見方

### `journal/registry.json`

registry は、どの setup x market を判断対象にするかを決めるゲートです。

| status | 意味 |
| --- | --- |
| `candidate` | 検証候補。まだ実運用の判断対象ではない。 |
| `adopted` | 証拠が揃い、active playbook に入っている。`/trade-judge` の対象。 |
| `rejected` | 検証基準を満たさず不採用。 |
| `insufficient_data` | 判断、実トレード、バックテストの証拠が不足している。 |
| `retired` | 過去の status に関係なく、現在は運用停止。 |

`/trade-judge` は `adopted` を判断の前提にします。`candidate` や `insufficient_data` を裁量で試す場合は、検証または replay として扱い、live の標準フローとは分けます。

### `journal/stats/setup_stats.json`

`node scripts/journal_stats.js` は `journal/trades/*.jsonl` を読み、setup x market x mode ごとに統計を出します。

| 指標 | 意味 |
| --- | --- |
| `n` | 集計対象の trade 数。少ない場合は結論を急がない。 |
| `wins` | `r_multiple > 0` の trade 数。 |
| `win_rate` | 勝率。`wins / n`。 |
| `avg_r` | 平均 R。1 回あたりの平均損益をリスク単位で見た値。 |
| `expectancy` | 期待値。現行 CLI では `avg_r` と同じ値を、取引指標名として保持する。 |
| `plan_adherence` | `followed_plan === true` の割合。戦略の問題と実行ミスを分けるために見る。 |

`win_rate` だけで採否を決めないでください。低勝率でも `avg_r` が高ければ機能している場合があります。逆に勝率が高くても `avg_r` や `expectancy` が低い場合は、利確・損切りモデルを見直します。`plan_adherence` が低い場合は、setup 自体よりも運用ルール、待機条件、サイズ、決済手順を優先して確認します。

## 免責と原則

本システムはトレード判断支援であり、自動売買システムではありません。`GO` が出ても、最終判断、発注、ポジションサイズ、損失許容、決済はユーザーの責任です。

1 トレードの許容リスクは、原則として口座残高の 1-2% 以内に抑えることを推奨します。SL を置けない取引、損失額を事前に計算できない取引、registry で `adopted` ではないセットアップの live 取引は、標準運用から外れます。

判断ログと実行ログは、後から自分の判断を検証するための材料です。負けトレードを隠さず、計画逸脱を具体的に残すことを優先します。統計は十分な件数が揃うまでは仮説として扱い、採用・停止・改善の判断にはバックテスト、live/replay ログ、スクリーンショットの複数証拠を使います。
