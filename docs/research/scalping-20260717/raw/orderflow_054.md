# Orderflow Research: Footprint/Absorption Concepts

**Topic ID:** orderflow_054  
**Family:** orderflow  
**Date:** 2026-07-17  
**Question:** Footprint/absorption concepts: any objective, replicable backtests?

---

結論：古典的なfootprint/absorption反転に、客観的で再現可能なA級証拠は見つからない。強い証拠は「約定吸収」ではなく、L2板不均衡を使う高速マーケットメイクに偏る。

1. **標準化Order-Book-Imbalanceマーケットメイク — Grade A**

市場・時間：BTCUSDT/ETHUSDT perpetual、L2 tick、1秒更新。  
ルール：midから±2.5%のbid数量−ask数量を1時間z-score化。`fair=mid+c1×z`、在庫調整後のreservation priceの上下に指値を継続提示。BTC設定は片側$50k、最大在庫$2.5m、half-spread=$80、毎秒cancel/replace。固定stop/targetなし；在庫skewと上限が出口。24/7。  
成績：BTC 2025年1–2月はSharpe 5.37、return 45.96%、MDD 9.79%、約4,534約定/日（約267k）；同年5–7月はSharpe 3.04、return 25.03%、MDD 11.57%、約3,096/日（約285k）。勝率/PFなし。maker rebate 0.005%、taker fee 0.07%、実測latency・queue model込み。[コード・データ仕様・結果](https://hftbacktest.readthedocs.io/en/latest/tutorials/Market%20Making%20with%20Alpha%20-%20Order%20Book%20Imbalance.html)  
評価：後期は時間的再検証だがqueue parameterを変更しており、厳密な凍結OOSではない。単一銘柄なのでsurvivorshipは小さい一方、短期間・パラメータ調整リスクは高い。最高tier rebate依存が明記され、通常retail手数料では生存困難。Pine：**No**—resting L2、queue、秒次cancel/replaceが必要。

2. **LOB状態依存マーケットメイク — Grade A**

市場・時間：NASDAQ 11銘柄、event-level LOB；30分窓。  
ルール：best bid/ask数量不均衡をsell/neutral/buy-heavy状態に分け、spread・在庫・予測market-order到着率に基づく最適制御でbest quoteへ指値または撤退。各30分末に成行清算。寄付後・引け前各30分を除外。  
成績：2014年1–6月較正、7–12月OOS、1,375窓。3 imbalance states、無在庫ペナルティでも年率Sharpeは11銘柄中10銘柄で正、範囲−0.66～11.75。勝率/PFなし。spreadとfillはモデル化したが、commission・通信競争は未算入。[査読済み論文](https://kclpure.kcl.ac.uk/ws/files/115267447/Enhancing_Trading_Strategies_CARTEA_Accepted_24_Jan_18_GREEN_AAM.pdf)  
評価：複数状態・ペナルティ選択による多重検定、large-tick銘柄選択のsurvivorship懸念。retailでの生存は疑わしい。Pine：**No**—resting LOBと約定順位が不可欠。

3. **高OFI短期contrarian — Grade A（否定的結果）**

市場・時間：ASX 200銘柄、1時間。  
ルール：前時間のloserを買いwinnerを売り、高いbuyer-minus-seller volume imbalanceを条件化；次時間で反対売買。公開本文ではOFI cutoffが完全開示されず、完全再現性は不足。  
成績：小さい統計的利益は出たが、機関投資家の執行費用さえ賄えず赤字。勝率・PF・trade count・OOSなし。[論文概要](https://www.sciencedirect.com/science/article/pii/S0927538X05000880)  
評価：流動性選別・銘柄survivorship、OOS欠如。コスト後edgeは明確に否定。Pine：**No**（200銘柄横断戦略）。

4. **VAH absorption breakout trap — Grade B**

市場・時間：NQ/ES、1分。  
ルール：day VAH上に2本連続、positive delta＋ask imbalance、2本の総range<3 ticksでshortを2本目安値−1 tickに置く。stopはfailed-breakout高値＋1 tick、targetはVAH→day POC。range session限定、強い一方向CVDを除外、重要指標前10分・後5分を除外。  
自己申告成績：2024–25年112例、勝率64%、平均勝1.8R、平均負−1R、期待値+0.79R。PF・費用・OOSなし。[方法と結果](https://cofiatrading.com/en/blog/absorption-atas-3-setups-chiffres)  
評価：手選別、曖昧な「absorbed」、独立コード/データなしでoverfitting・selection biasが重大。数tick stopではretail往復費用とslippageがedgeを大幅に削る。Pine：**Partial**—Pine v6の[`request.footprint()`](https://www.tradingview.com/pine-script-docs/release-notes/)でdelta/row imbalanceは取得可能だがPremium/Ultimate限定で、news・session分類と複合POCの厳密再現が難しい。
