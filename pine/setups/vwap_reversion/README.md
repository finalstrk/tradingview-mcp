# DT VWAP Reversion v1

VWAP 2σ リバージョンは、日次アンカー VWAP の 2σ バンド外へ一時的に行き過ぎた価格が、同じ足の終値でバンド内へ戻る局面を狙う逆張りセットアップです。強いトレンド日の逆張りを避けるため、EMA20 と EMA50 の乖離を ATR で正規化したフィルターを使い、セッション内で 1 日あたりのシグナル数を制限します。

## 検出条件

- 日次アンカー VWAP と 1σ / 2σ バンドを `ta.vwap(hlc3, timeframe.change("D"), mult)` で算出する。
- Long は `low < lower2 and close > lower2` で 2σ 下抜けからバンド内へ復帰し、RSI が oversold 未満の時に成立する。
- Short は `high > upper2 and close < upper2` で 2σ 上抜けからバンド内へ復帰し、RSI が overbought を上回る時に成立する。
- `abs(EMA20 - EMA50) / ATR14` が Trend day threshold を上回る強トレンド中は無効化する。
- 1 日あたりの triggered シグナル数は Max signals per day までに制限する。
- indicator 版は最新状態を `DT|vwap_reversion|<dir>|<state>|entry=<price>|sl=<price>|tp1=<price>|tp2=<price>` の `label.new` で 1 件だけ出力し、履歴は `plotshape` で残す。

## Input パラメータ

| 名前 | Default | 意味 |
| --- | --- | --- |
| Session preset | NY | Tokyo / London / NY / RTH / Custom からセッションを選択する。 |
| Custom session | 0930-1600 | Session preset が Custom の時だけ使うセッション文字列。 |
| Custom timezone | America/New_York | Session preset が Custom の時だけ使うタイムゾーン。 |
| RSI length | 14 | RSI の計算期間。 |
| RSI oversold | 35.0 | Long 条件で使う RSI 上限。 |
| RSI overbought | 65.0 | Short 条件で使う RSI 下限。 |
| Trend day threshold | 1.5 | `abs(EMA20 - EMA50) / ATR` がこの値を超える時はシグナルを無効化する。 |
| Max signals per day | 2 | 1 日あたりに許可する triggered シグナル数。 |
| Show signal markers | true | indicator 版で Long / Short の `plotshape` を表示する。 |
| Show VWAP bands | true | VWAP、±1σ、±2σ の plot を表示する。 |

## SL / TP モデル

- Long: SL はシグナル足の `low - ATR(14) * 0.5`、TP1 は VWAP、TP2 は反対側の +1σ バンド。
- Short: SL はシグナル足の `high + ATR(14) * 0.5`、TP1 は VWAP、TP2 は反対側の -1σ バンド。
- strategy 版は TP1 / TP2 をそれぞれ 50% 決済として発注し、セッション離脱バーでは `strategy.close_all("EOD")` で当日決済する。

## 想定市場・セッション

主用途は NY 時間の流動性が高い FX / index CFD / 先物の短期足です。初期値は NY プリセットですが、東京時間の JPY クロスや日本株指数には Tokyo、欧州時間の EUR / GBP 系には London、米株 RTH だけに限定する場合は RTH を推奨します。市場に合わせた取引時間を使う場合は Custom でセッション文字列とタイムゾーンを指定します。
