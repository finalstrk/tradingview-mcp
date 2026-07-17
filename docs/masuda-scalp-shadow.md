# 増田式 Scalp Alerts — Flamme Telegram shadow運用

## 目的

既存の増田式ロジックを変更せず、TradingViewのPine条件アラートをFlamme investment profileの既存Telegramへshadow通知する。

- 自動発注しない
- 売買推奨を出さない
- `masuda_scalp`はregistry未採用として扱う
- 新規発火がないtickは完全無通知
- watcherはTradingViewの`last_fired`差分だけを処理する

## 構成

```text
TradingView Pine alert
  -> pricealerts/list_alerts (1分poll)
  -> scripts/masuda_telegram_watch.js
  -> Hermes no-agent cron
  -> Flamme Gateway configured Telegram home
```

Pineソース：

```text
pine/setups/masuda_scalp/masuda_scalp_indicator.pine
```

watcher：

```text
scripts/masuda_telegram_watch.js
scripts/masuda_telegram_watch.sh
```

状態ファイル（repo外）：

```text
$HERMES_HOME/state/masuda-telegram-watch.json
```

## イベント契約

すべてのアラートmessageは次のprefixを使う。

```text
MASUDA|v=1|setup=masuda_scalp|kind=<kind>|dir=<long|short>|state=<state>|ticker={{ticker}}|tf={{interval}}|close={{close}}
```

state：

- `forming`: BB必須かつ補助条件があと1つ。Pine inputではデフォルト無効
- `triggered`: バー確定時に複合条件またはADX+Stochが成立
- `invalidated`: 複合条件が成立状態から消失

Pine input `アラートはバー確定時のみ`はデフォルト有効。形成中バー通知はリペイント可能性があるため、shadow初期運用では変更しない。

## TradingView activation

元の`増田式 BB+RSI+ADX+MACD 複合売買システム`を上書きしないこと。

1. TradingView Pine Editorで**新規Indicator**を作る
2. `masuda_scalp_indicator.pine`を貼る
3. `増田式 Scalp Alerts v1`として新規保存し、5分足へ追加する
4. 必要なら15分足にも追加する
5. 5分・15分それぞれで次の条件アラートを作る
   - `MASUDA composite long`
   - `MASUDA composite short`
   - `MASUDA stoch+ADX long`
   - `MASUDA stoch+ADX short`
   - `MASUDA invalidated long`（任意）
   - `MASUDA invalidated short`（任意）
6. 頻度は`Once Per Bar Close`にする
7. `forming`はshadow記録を見てから必要性を再評価する

アラートmessageはPine側の既定値を変更しない。watcherは`MASUDA|`prefixで対象を識別する。

## watcher操作

現在値を記録して過去発火を送らない：

```bash
npm run masuda-watch -- --prime
```

手動1回poll：

```bash
npm run masuda-watch
```

新規イベントがなければstdoutは空。エラー時のみ非zero終了する。

## Hermes cron

investment profileで次のjobを使用する。

```text
name: masuda-scalp-shadow-telegram
schedule: every 1m
script: masuda_scalp_shadow_watch.sh
no_agent: true
deliver: telegram
```

cron scheduler自体が60秒tickのため、通知遅延は最大およそ1分。秒単位が必要になった場合だけ常駐daemonまたはTradingView webhookを別途評価する。

## 通知内容

発火時、watcherは同じ銘柄の2x2レイアウトから日足・1時間・15分・5分を読み、直近20本のOHLCV summaryと主要indicator valuesを添える。処理後は元のactive paneへ戻す。

通知には必ず次を含める。

- イベント種別、方向、状態
- TradingView発火時刻と確認時刻
- 日足・1時間・15分・5分の要約
- registry未採用
- 売買推奨・発注ではないという境界

## 停止条件

次の場合はcronをpauseし、Pineまたはwatcherを再確認する。

- 同一`last_fired`が重複通知される
- 5分足バー確定より前の通知が混入する
- TradingView Desktop/CDP停止によるエラー通知が反復する
- 元のactive paneへ戻らない
- Telegramに`MASUDA|`以外のアラートが送られる
