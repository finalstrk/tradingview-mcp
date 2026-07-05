# DT NR Squeeze v1

NR/インサイドバー・スクイーズブレイクは、直近の値幅収縮を母線レンジとして固定し、指定 window 内の終値ブレイクだけをシグナル化する短期順張りセットアップです。インサイドバーと NR7 のどちらかで圧縮を検出し、20EMA/50EMA の方向がブレイク方向と一致する場合だけ有効にします。

## 検出条件

- セッション内のバーだけを対象にする。
- 圧縮バーは、`high < high[1] and low > low[1]` のインサイドバー、または `(high - low) == ta.lowest(high - low, NR lookback)` の NR7。
- インサイドバーでは 1 本前の high/low、NR7 では当該バーの high/low を母線レンジとして記録する。
- 圧縮成立の次バー以降、`Breakout window (bars)` 以内に `close > motherHigh` で Long、`close < motherLow` で Short。
- Long は `ta.ema(close, 20) > ta.ema(close, 50)`、Short は `ta.ema(close, 20) < ta.ema(close, 50)` を必須にする。
- 1 日あたりの最大シグナル数は `Max signals per day` で制限する。

## Input パラメータ

| 名前 | Default | 意味 |
| --- | --- | --- |
| Session preset | RTH | Tokyo / London / NY / RTH / Custom からセッションを選択する。 |
| Custom session | 0930-1600 | `Session preset = Custom` の時だけ使うセッション文字列。 |
| Custom timezone | America/New_York | `Session preset = Custom` の時だけ使うタイムゾーン。 |
| NR lookback | 7 | NR 判定で参照する最小値幅の lookback。 |
| Breakout window (bars) | 3 | 圧縮成立後、ブレイクを有効とするバー数。次バーを 1 本目として数える。 |
| Max signals per day | 2 | 1 日あたりに許可する最大 triggered シグナル数。 |

## SL/TP モデル

- Long: entry はブレイク成立バーの close、SL は `motherLow`。
- Long TP1: `entry + (motherHigh - motherLow) * 1.5`。
- Long TP2: `entry + (motherHigh - motherLow) * 2.5`。
- Short: entry はブレイク成立バーの close、SL は `motherHigh`。
- Short TP1/TP2 は Long と対称に、entry から母線レンジの 1.5 倍 / 2.5 倍を下方向へ置く。
- strategy 版は TP1/TP2 を各 50% の分割 exit とし、セッション離脱バーで `strategy.close_all("EOD")` を実行する。

## 想定市場・セッション

default は `RTH` です。米株指数先物、米株、主要先物の通常取引時間での値幅収縮ブレイクを主用途にします。東京市場では `Tokyo`、欧州市場では `London`、米国時間の現物・指数系では `RTH` または `NY` を使い、銘柄固有の取引時間がある場合だけ `Custom` に切り替えます。

## MCP ラベル

indicator 版は最新状態だけを次の形式の label として出力します。

```text
DT|nr_squeeze|<dir>|<state>|entry=<price>|sl=<price>|tp1=<price>|tp2=<price>
```

`state` はブレイク待ちが `forming`、ブレイク成立が `triggered`、window 超過が `expired` です。履歴シグナルは `plotshape`、母線レンジは line で可視化します。
