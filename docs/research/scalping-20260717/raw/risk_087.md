# TradingView Strategy-Tester Realism Pitfalls for Scalp Strategies

**Topic ID:** risk_087  
**Family:** risk  
**Date:** 2026-07-17  
**Question:** TradingView strategy-tester realism pitfalls for scalp strategies (intrabar fills, bar magnifier): best practices

---

調査結論：TradingViewのBar Magnifierは約定順序の誤差を減らしますが、板・実スプレッド・注文待ち・部分約定・遅延を再現しません。スキャルピングの高成績は、現実的コストと未見データで消える例が多く、確認できた強い証拠は限定的です。

## TradingView Strategy Testerの注意点

- 通常の履歴バーでは、ブローカーエミュレータがOHLCから価格経路を推定します。同一バー内でエントリー、損切り、利確の両方に触れる戦略は特に不安定です。
- Bar Magnifierの下位足は、1分→10秒、5分→30秒、10分→1分、15分→2分です。下位足上限は20万本で、古い期間には適用されないことがあります。依然として下位足OHLCでありtick/BBOではありません。[TradingView公式](https://www.tradingview.com/support/solutions/43000669285-what-is-bar-magnifier-backtesting-mode/)
- `calc_on_every_tick=true`は履歴では完全なtickを持たず、再読込後にrepaintします。`calc_on_order_fills=true`は履歴バーの高値・安値で再計算し、現実に得られない価格を使う場合があります。[Pine公式](https://www.tradingview.com/pine-script-docs/concepts/strategies/)
- 推奨設定は標準ローソク、`use_bar_magnifier=true`、`calc_on_every_tick=false`、原則`calc_on_order_fills=false`、`process_orders_on_close=false`。指値には`backtest_fill_limits_assumption`で1tick以上の通過を要求し、実ブローカーの往復手数料に加えて1、2、3tick以上のスリッページ感応度を示すべきです。最終判定はtick/BBOデータとウォークフォワード、ペーパーフォワードで行います。

## 候補ロジック

### 1. Stocks-in-Play 5分ORB

**市場:** 米国株  
**タイムフレーム:** 5分  
**エントリールール:** 9:30–9:35が陽線なら高値への買いストップ、陰線なら安値への売いストップ  
**クローズ/ストップ:** 損切りはエントリーから14日ATRの10%、未決済は引け成行  
**セッション/フィルター:** 価格>$5、14日平均出来高>100万株、ATR>$0.50、最初の5分の相対出来高≥100%かつ上位20銘柄  
**報告メトリクス（サンプルサイズ付き）:** 2016–2023、7,000超銘柄、$0.0035/株込み：勝率48.4%、総収益1,637%、年率41.6%、Sharpe 2.81、MDD 12%  
**ソースURL:** [https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284)  
**証拠等級:** B  
**Pine v6での実装可能性:** 単一銘柄なら可。全市場上位20ランキングはrequest上限等により部分可。銘柄消滅を含むか不明でsurvivorship懸念、5分・上位20の同一標本選択による過適合が大きい。寄付きスプレッド、マーケットインパクト、空売り借株・取引停止が未反映なので、個人約定での存続は未証明。

### 2. TORB

**市場:** DJIA、S&P 500、NASDAQ、HSI、TAIEX先物  
**タイムフレーム:** 1分  
**エントリールール:** 出来高・1分リターン分散が高い現物市場のactive-hours開始から市場別probe時刻までの高値／安値を作り、その後最初の上抜けで買い、下抜けで売り  
**クローズ/ストップ:** active-hours終了で決済。ストップなし。  
**セッション/フィルター:** 市場別probe時刻、active-hoursフィルター  
**報告メトリクス（サンプルサイズ付き）:** 2003–2013、約10年前後の日次標本、コスト込みで全5市場年率>8%、TAIEX 20.28%、p値3.1×10⁻⁵。2003–07／2007–13でも検証したが、完全な未見OOSではない。勝率・PF非報告。  
**ソースURL:** [https://doi.org/10.1109/ACCESS.2019.2899177](https://doi.org/10.1109/ACCESS.2019.2899177)  
**証拠等級:** A  
**Pine v6での実装可能性:** 実装可。株式survivorshipはないが、先物ロール処理と市場別probe最適化に過適合懸念。流動性の高い指数先物ではコスト後存続の可能性はあるものの、2014年以降の再検証が必須。

### 3. Cameron ICT Scalp・高RR版

**市場:** NQ（ナスダック先物）  
**タイムフレーム:** 1H/15分→5分→30秒  
**エントリールール:** 1H（なければ15分）の旧高値・安値を目標にし、反対方向の5分swing sweep後、30秒FVGへの戻りで入る  
**クローズ/ストップ:** 損切りはdisplacement swing、利確は最寄り5分構造レベル、最大5R、最低1.5R  
**セッション/フィルター:** 明確な時刻フィルターは公開仕様にない  
**報告メトリクス（サンプルサイズ付き）:** 0.25ポイント往復コスト込み：短いISでは618件、勝率31.9%、PF1.68、+3,319.8pt。2022–2025の順序修正OOSでは7,138件、勝率22.9%、PF0.95、−3,271pt。  
**ソースURL:** [https://github.com/hindsight-finance/ict-cameron-scalp-model](https://github.com/hindsight-finance/ict-cameron-scalp-model)  
**証拠等級:** B  
**Pine v6での実装可能性:** 部分可。30秒ロジックは1–15分足のBar Magnifierだけでは再現できません。Survivorshipは小さい一方、短期ISへの過適合が明白で、最低限のコストでも利益は残りません。

## 補強的な否定証拠

MNQの5分足947日・14シグナル群を2ポイント往復コストとウォークフォワードで検証した研究では、全条件を通過した戦略はゼロでした。[https://arxiv.org/abs/2605.04004](https://arxiv.org/abs/2605.04004)
