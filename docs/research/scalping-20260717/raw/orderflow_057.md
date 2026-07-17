# Orderflow 057 Research Report

**Topic ID:** orderflow_057  
**Family:** orderflow  
**Date:** 2026-07-17  
**Research Question:** Crypto funding rates and open interest as intraday signals: quantified studies

---

## Analysis

結論：1–15分の方向性スキャルプについて、funding＋OIが現実的コスト控除後も有効だと示す十分なOOS証拠は見つからない。公開結果は弱い、混合、または明確に否定的である。

1. Extreme-funding fade — BTC/ETH/SOL/BNB/XRP/DOGE、1時間観測  
Entry：取引所横断・8時間換算fundingが過去履歴のp90以上なら逆張りショート、p10以下ならロング。Exit：4/24/72時間後。stop・session filterなし。789日、2,367 funding標本を非重複episode化。p90後72時間はBTC中央値−1.18%、上昇率40.5%、n=37、SOL−0.98%、39.4%、n=33だが、他4銘柄は+0.72～+1.73%、上昇率53～57%。p10買いは計622件でほぼコイントス。特に4時間リターン中央値は全銘柄−0.06～+0.31%で、コスト前でもスキャルプedgeはほぼない。WR/PF、コスト、OOSなし。Grade B。Pine v6：partial—単一取引所proxyは可能だが3取引所集約系列が必要。現行主要銘柄だけのsurvivorship、単一ETF-era、複数検定リスクがある。[研究・方法](https://markettrace.ai/blog/funding-rate-extremes)

2. Pre-registered funding carry — Binance BTC/ETH/SOL  
Entry：各8時間決済時、|funding|が直近90日のp90超（別仕様はz-score>1.5）。正ならspot long/perp short、負なら逆。Exit：3決済＝24時間後。stopなし、basis drift>1%で再調整、24/7。perp/spot taker fee、各脚5bp slippageを含む往復コスト48bp。OOS（2023-02-06以降）は全て負：BTC −0.428%/trade、n=119；ETH −0.425%、n=131；SOL −0.417%、n=189。別仕様も−0.396～−0.433%。WR/PFなし。Grade A（コード・生データ・事前登録）。Pine：partial—シグナルのみ。二脚、funding cashflow、rebalanceはStrategy Testerで再現不能。事前登録でoverfitは低めだが、3現存銘柄・単一venueのsurvivorshipあり。小売コスト後のedgeは明確に不成立。[結果](https://github.com/Mykola-Quant/funding-rate-carry-falsification)／[厳密ルール](https://github.com/Mykola-Quant/funding-rate-carry-falsification/blob/main/PREREGISTRATION.md)

3. Random-maturity spot–perp basis arbitrage — BTC/ETH/BNB/DOGE/ADA、1時間  
Entry：年率換算perp–spot乖離が理論上の取引費用bound外なら、割高側short・割安側long。Exit：乖離が無摩擦benchmarkへ復帰。stop・session filterなし。高コストmaker仮定でBTC年率8.15%、Sharpe 1.92、MaxDD −4.43%、平均保有113時間、24,912 hourly observations。ただし2022年は年率0.26%、active 1.01%へ崩壊。WR/PF/trade数・OOSなし。Grade B。Pine：partial—basis計算は可能、両市場執行は不可。終点時点の上位5銘柄選択、maker fill・slippage不足、同一標本評価によるoverfitが大きく、現在の小売edge存続は疑わしい。[論文](https://ar5iv.labs.arxiv.org/html/2212.06888v6)

4. Cross-venue funding-spread arbitrage＋OI liquidity filter — 749銘柄、1分  
Entry：26取引所間の8時間換算funding差≥20bpで最低rate venueを$10k long、最高rate venueをshort。Exit：spread<0、再entryなし。OI rank<50ならslippage 0.1%、それ以外0.5%；taker 0.05%。8日・35.7m rowsだが、上位20件中利益は8件、平均net P&L $22、平均Sharpe −7.40、95%でspread reversal。Grade A（査読誌）。Pine：no—多venue二脚が必要。同じ8日から上位機会を選ぶ極端なselection/overfitに加え、離散fundingを毎分発生として計上する重大な実装上の楽観がある。小売で残る可能性は低い。[論文](https://www.mdpi.com/2227-7390/14/2/346)

なお、OIは上記4で流動性filterに使われるだけで、利益予測信号として検証されていない。主要7取引所のtick研究もOIの系統的な誤表示を報告しており、OI系Pine signalには測定リスクがある。[OI品質研究](https://arxiv.org/abs/2310.14973)
