# 増田式 日足ウォッチリスト監視

## 目的

TradingViewの現在のウォッチリスト全体を、増田式の日足条件で一括走査する。

- 日足バー確定時だけ評価する
- 売買推奨・発注は行わない
- スキャルピング支援とは分離する
- 通知先はFlamme investment profileの既存Telegram

## Pine Screener

ソース：

```text
pine/screeners/masuda_daily_watchlist.pine
```

TradingView Pine Screenerの制約に合わせている。

- `request.*()`なし
- `input.timeframe()`なし
- Screenerで時間足を`1 day`に設定
- 最初の10 plotsだけで状態とdedupe鍵を出力
- alertconditionはlong/shortの2つだけ
- mixed asset watchlistに対応

現在の10列：

```text
Long Trigger / Short Trigger / Composite State
Buy Conditions / Sell Conditions / ADX / RSI
Stoch %K / Stoch %D / Bar Day UTC
```

`Composite State`はlong=1、short=-1、該当なし=0。`Bar Day UTC`は`time_close / 86400000`の整数値で、`symbol + direction + bar day`を通知重複排除鍵にする。

## 増田式条件

### Composite long

```text
close < BB lower
AND
RSI / ADX / MACD long条件のうち minConditions 以上
```

### Composite short

```text
close > BB upper
AND
RSI / ADX / MACD short条件のうち minConditions 以上
```

### Stoch + ADX

```text
ADX >= threshold AND Stoch GC/DC
```

Compositeの新規成立またはStoch+ADXイベントを、日足確定時だけlong/short triggerにする。

## Pine Screener設定

1. TradingViewでスクリプトを新規保存する
2. お気に入りへ追加する
3. Products → Screeners → Pineを開く
4. 対象watchlistを選択する
5. indicatorに`増田式 Daily Watchlist v1`を選択する
6. timeframeを`1 day`にする
7. 手動確認時はfilterを`Long Trigger = 1`または`Short Trigger = 1`にする
8. 自動watcherはfilterを使わず全行を取得し、long/short両方を同じscanから抽出する

元の増田式スクリプトは上書きしない。

## Telegram自動通知adapter

TradingViewのWatchlist Alertはリストの追加・削除へ自動追随し、各銘柄を独立判定する。一方、現在のMCP `list_alerts`応答ではwatchlist alertの`symbol`が`WATCHLIST:<id>`となり、発火した個別銘柄を識別できない。

個別銘柄identityがない旧pollerは再開せず、Pine Screener結果を直接読む。

```text
scripts/masuda_daily_screener_watch.js
scripts/masuda_daily_screener_watch.sh
```

契約：

- 専用layout URL `wu1kDZvT`のtargetだけを使う
- Pine Screenerで`watchlist_formatted`と`増田式 Daily Watchlist v1`を照合する
- `Scan → Stop → Scan completed`を実行成功条件にする
- `table > tbody > tr`を全行取得する
- symbol page URL、`exchange` query、またはrow `data-rowkey`からexchange-qualified symbolを得る
- trigger行で完全symbolまたは`Bar Day UTC`が取れなければfail-closedする
- stateは`$HERMES_HOME/state/masuda-daily-screener-watch.json`へatomic保存する
- stdoutが空ならTelegram無通知。新規trigger時だけcompact shadow通知を出す
- 発注・売買推奨・registry GO判定は行わない

### live verification — 2026-07-17

- cloud script IDは既存日足版のままversion 2.0へ更新
- cloud read-backは改行正規化後にrepo sourceと完全一致
- Pine compile: 0 errors
- `watchlist_formatted`: 302行をscan
- exchange-qualified symbol: 302/302
- 当該scanのtrigger: 0
- `Bar Day UTC`: 実値取得
- scan前後で`USDJPY / D・60・5・15 / 2x2 / active pane 0`が完全一致
- Hermes cron manual run: `ok`、signal 0のため無送信

### chart副作用と停止条件

Linux版TradingView Electronはbackground page target作成を`Not supported`で拒否する。そのため各runは専用chart tabを短時間Pine Screenerへ遷移し、`finally`で元URLへ戻す制御fallbackを使う。

次の場合はstate更新・通知前に失敗させる：

- layout、symbol、D/60/5/15のpane復元不一致
- Screener列順やindicator/watchlistの変化
- trigger行のsymbol identityまたはbar day欠落
- scan開始／完了oracleのtimeout

これは低頻度のsession-close scan専用であり、1分pollや対話中のスキャルピング支援には使わない。

個別銘柄を識別できないまま旧`last_fired` pollerを再開してはいけない。

## cron schedule

すべてHermes `no_agent`、`deliver=telegram`、同じstateを共有する。

| job | schedule (JST) | 対象close窓 |
|---|---:|---|
| `masuda-daily-screener-jp-close` | 平日 16:10 | 日本株 |
| `masuda-daily-screener-us-fx-close` | 火〜土 07:20 | 米国株・FX |
| `masuda-daily-screener-crypto-close` | 毎日 09:10 | 暗号資産UTC日足 |

同じ確定barが複数窓に現れても、`symbol + direction + Bar Day UTC`で1回だけ通知する。

## 現在の運用状態

新しい3 jobはenabled。旧job `masuda-scalp-shadow-telegram`はpausedを維持する。旧jobは5分・15分向けの旧仕様であり、日足watchlist通知としては使用しない。

## スキャルピング支援との境界

日足watchlist scanはテーマ発見・監視通知。スキャルピング支援は増田式2x2プリセットの日足・1時間・15分・5分を対話中だけ読み、別の検証済みルールで状況整理する。
