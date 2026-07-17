# Pine Conventions

この文書は `pine/` 配下に追加する DT 系 Pine Script の正式規約です。MCP 側の読み取りと自動化が依存するため、ここに記載したインターフェイスは互換性維持の対象です。

## ラベル書式規約（indicator 版）

最新シグナルを `label.new` で 1 個出力します。label のテキストは正確に次の形式にします。

```text
DT|<setup_id>|<dir>|<state>|entry=<price>|sl=<price>|tp1=<price>|tp2=<price>
```

- `setup_id`: `orb` / `vwap_reversion` / `pdh_pdl_break` / `ema_pullback` / `nr_squeeze` / `torb` / `intraday_momo` / `intraday_momo_pure` / `noise_break` / `vwap_rsi_pullback` のいずれか。
- `dir`: `long` / `short`。
- `state`: `forming` / `triggered` / `expired`。
- `price`: `str.tostring(x, format.mintick)` で整形する。
- 最新ラベルのみ保持する。`var label sigLabel = na` を使い、更新時に `label.delete(sigLabel)` してから新規作成する。
- シグナル履歴は `plotshape` で残す。label は最新 1 件のみ保持する。
- `indicator()` / `strategy()` のタイトルは必ず `"DT <Name> v1"` 形式にする。先頭の `DT ` プレフィックスは MCP 側の `study_filter="DT "` 検索キーなので必須。

## strategy 宣言（strategy 版共通）

strategy 版は次の形式をそのまま使います。

```pine
//@version=6
strategy("DT <Name> v1", overlay=true, initial_capital=1000000,
     default_qty_type=strategy.percent_of_equity, default_qty_value=10,
     commission_type=strategy.commission.percent, commission_value=0.005,
     slippage=2, process_orders_on_close=true, calc_on_every_tick=false)
```

この共通宣言は primary backtest の既定値であり、執行現実性の証明ではありません。paper candidate の検証では、`strategy_spec_check` に次を記録して別シナリオを比較します。

- primary fill model と、翌バー始値または1バー遅延の保守的 stress fill model
- 対象商品・セッションに合わせた commission / spread / slippage と悪化ケース
- fill model やコスト前提を変更した場合の PF、DD、trade count、benchmark gap

既存 evidence と比較不能になるため、共通宣言を黙って変更してはいけません。変更は新しい検証runとして記録します。

## セッション処理（両版共通）

- `input.string` でプリセットを選択する。選択肢は `"Tokyo"` / `"London"` / `"NY"` / `"RTH"` / `"Custom"`。
- default は各セットアップの主用途に合わせる。
- `"Custom"` 時のみ `input.session` と `input.string` のタイムゾーンを使用する。
- プリセットの実セッション文字列とタイムゾーンは `switch` で解決する。
- 例: `Tokyo="0900-1500", tz="Asia/Tokyo"` / `London="0800-1630", tz="Europe/London"` / `NY="0930-1600", tz="America/New_York"` / `RTH="0930-1600", tz="America/New_York"`。
- セッション判定は `inSession = not na(time(timeframe.period, sessStr, tzStr))` を使う。
- strategy 版はセッション離脱バー `inSession[1] and not inSession` で `strategy.close_all("EOD")` を実行する。
- strategy 版はセッション外の新規エントリーを禁止する。

### セッション判定・EOD クローズのスニペット

```pine
string groupSession = "Session"

sessionPreset = input.string("RTH", "Session preset", options=["Tokyo", "London", "NY", "RTH", "Custom"], group=groupSession)
customSession = input.session("0930-1600", "Custom session", group=groupSession)
customTimezone = input.string("America/New_York", "Custom timezone", group=groupSession)

sessStr = switch sessionPreset
    "Tokyo" => "0900-1500"
    "London" => "0800-1630"
    "NY" => "0930-1600"
    "RTH" => "0930-1600"
    => customSession

tzStr = switch sessionPreset
    "Tokyo" => "Asia/Tokyo"
    "London" => "Europe/London"
    "NY" => "America/New_York"
    "RTH" => "America/New_York"
    => customTimezone

inSession = not na(time(timeframe.period, sessStr, tzStr))

if inSession[1] and not inSession
    strategy.close_all("EOD")
```

## Pine v6 記述規則

- 1 行目は `//@version=6`。
- `ta.*` 関数はグローバルスコープで毎バー評価する。`if` / `for` 内で呼ばず、値を変数に取り条件で参照する。
- インデントは 4 スペース。ローカルブロックの継続行は 5 スペース以上にする。
- `request.security` は、該当セットアップのみ `lookahead=barmerge.lookahead_on` + `[1]` オフセットで非リペイントにする。
- 「1 日 1 シグナル」系フラグは `var bool tradedToday` + `timeframe.change("D")` でリセットする。
- すべての `input` に `group=` を付け、論理単位でグループ化する。
- 各論理セクションに簡潔なコメントを置く。

### 最新ラベル更新のスニペット

```pine
var label sigLabel = na

signalText = "DT|nr_squeeze|" + dir + "|" + state + "|entry=" + str.tostring(entry, format.mintick) + "|sl=" + str.tostring(sl, format.mintick) + "|tp1=" + str.tostring(tp1, format.mintick) + "|tp2=" + str.tostring(tp2, format.mintick)

if showSignalLabel
    label.delete(sigLabel)
    sigLabel := label.new(bar_index, close, signalText, style=label.style_label_left, textcolor=color.white, color=color.new(color.blue, 0))
```

## indicator 版に必ず含める要素

- strategy 版と同一の検出ロジック。
- `plotshape` によるシグナル表示。
- 規約ラベル出力。
- `alertcondition(longSignal, "DT <Name> Long", "...")` と short 側の `alertcondition(shortSignal, "DT <Name> Short", "...")`。
- OR レンジや母線など重要レベルの `plot` / `line` / `box` 描画。

## README.md（各セットアップ）に必ず含める要素

- セットアップの狙いを 1 段落で説明する。
- 検出条件の要約を箇条書きで書く。
- 全 input パラメータ表を「名前 / default / 意味」で書く。
- SL/TP モデルを書く。
- 想定市場・セッションプリセットの推奨を書く。

## 新セットアップ追加チェックリスト

- ファイル配置は `pine/setups/<id>/` にする。
- indicator は `pine/setups/<id>/<id>_indicator.pine`、strategy は `pine/setups/<id>/<id>_strategy.pine` にする。
- README は `pine/setups/<id>/README.md` にする。
- `setup_id` はラベル書式の許可リストに追加済みであることを確認する。
- `indicator()` / `strategy()` のタイトルは `"DT <Name> v1"` にする。
- strategy 宣言は本書の共通宣言をそのまま使う。
- session preset、EOD close、セッション外エントリー禁止を実装する。
- indicator は最新ラベル 1 件、plotshape 履歴、alertcondition、重要レベル描画を持つ。
- MCP や周辺ツールが setup registry を持つ場合は、registry 登録も同じ変更単位で行う。
