# Orderflow Research: orderflow_051

**topic_id:** orderflow_051  
**family:** orderflow  
**date:** 2026-07-17  
**question:** Cumulative delta approximations feasible in TradingView Pine: methods and predictive evidence

---

Pine v6でCVDは実装可能です。最良は `request.footprint()` の `delta()` をセッション内累積する方法ですが、Premium/Ultimate限定です。これは板の真の約定方向ではなく、下位足の価格変動で買い・売り出来高を分類します。代替は `request.security_lower_tf()` で下位足出来高を、上昇足なら正、下降足なら負、同値なら直前方向として集計する方法です。TradingView標準CVDも同系統で、下位足を細かくすると精度と引き換えに履歴が短くなります。[TradingView CVD計算法](https://jp.tradingview.com/support/solutions/43000725058/)、[Pine v6 footprint](https://www.tradingview.com/pine-script-docs/release-notes/)

## 候補1：15分デルタ反転

- 市場・足：台湾銀行間NTD/USD、15分。
- エントリー：価格上昇取引の出来高－下降取引の出来高をデルタとし、最初の正デルタでUSD売り、負デルタでUSD買い。50%/90%の小さい絶対デルタを除外する版も検証。
- エグジット：正デルタ後、最初の負デルタで買い戻す。逆方向も同様。ストップなし、日中完結。全時間または午後開始フィルター。
- 証拠：251営業日。90%除外版は74取引、平均日次リターン2.079（論文の「100倍表示」尺度）。勝率・PF・最大DDなし。スプレッド、手数料なし。閾値は全標本から算出し、OOSなし。[論文とTable 4](https://www.scienpress.com/download.asp?ID=980063)
- 評価：**A**（査読論文。ただし経済的検証は弱い）。Pine：**部分的に可**。15分足または下位足デルタで近似可能だが、同じ銀行間取引データは得られない。
- リスク：全標本閾値による先読み、台湾中銀介入期への過適合。著者自身が費用控除後に利益が消える可能性を明記しており、リテールでの生存可能性は低い。

## 候補2：1分クロスセクション・デルタモメンタム

- 市場・足：BIST30の28銘柄、1分。
- エントリー：各分の正規化デルタ `(buyer-initiated volume−seller-initiated volume)/(合計)` を順位付けし、上位5銘柄ロング・下位5銘柄ショート。
- エグジット：1分後に全ポジションを決済・再順位付け。連続取引時間のみ。ストップなし。
- 証拠：105日、平均超過収益0.0325%/分、Newey–West調整t値29.23。勝率・PF・取引数・費用・OOSなし。収益は執行不能なbid/ask中値で測定。[査読論文](https://yoksis.bilkent.edu.tr/pdf/files/15559.pdf)
- 評価：**A**。Pine：**部分的／実質困難**。単一銘柄デルタは作れるが、`request.footprint()`は1スクリプト1要求で、28銘柄の真の約定方向ランキングは再現不能。
- リスク：BIST30選択による流動性・生存者偏り。10銘柄を毎分回転するため3.25bpはスプレッド、手数料、ショート費用でほぼ確実に消える。

## 候補3：CSI300先物VOI予測

- 市場・足：CFFEX CSI300先物、500ms板スナップショット。
- エントリー：前営業日のOLSで、現在＋5ラグの最良bid/ask数量変化から次10秒平均価格変化を予測。予測が±0.2 tick超なら±1枚。
- エグジット：反対シグナルで反転。11:20/15:00以降は手仕舞いのみ、11:28/15:13までに終了。固定ストップなし。
- 証拠：2014年243評価日、日次勝率75.8%、平均19,528 CNY/日、年率Sharpe 5.94、平均634約定/日。手数料0.0025%とbid/ask約定込み。PFなし。前日学習は準OOSだが、独立最終OOSなし。[詳細論文](https://studylib.net/doc/27699780/order-imbalance-strategy)
- 評価：**B**。Pine：**不可**。必要なのは500msのL1板数量であり、CVDでは代替できない。ゼロ遅延・常時最良価格約定の仮定も非現実的。

## 結論

公開された「CVDダイバージェンス＋価格構造」の厳密な勝率・PF・費用込みOOS証拠は見つからず、主にGrade Cの自己申告です。査読証拠は短期予測関係を支持しますが、売買可能なリテール・エッジについては弱いか否定的です。
