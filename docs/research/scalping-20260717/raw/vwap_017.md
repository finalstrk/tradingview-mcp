# VWAP Breakout-Then-Retest Continuation Research

**topic_id**: vwap_017  
**family**: vwap  
**date**: 2026-07-17  
**question**: VWAP breakout-then-retest continuation: objective definitions and results

---

調査結果は厳しい。厳密な「VWAPブレイク→リテスト→継続」を、独立OOS・実コスト込みで検証したGrade A資料は見つからなかった。以下はいずれも仮説候補であり、確立したエッジではない。

1. QQQ VWAP Pullback + RSI(2)  
市場/足: QQQ、5分足。  
ルール: 9:45以降、VWAP上（下）で3本連続終値→VWAPへ接触しRSI(2)<25（ショートは>75）→次の陽線がVWAP上で確定時にロング（逆条件でショート）。ストップは1.5×ATR(14)かつVWAP外側。利確は前日高安、既に突破済みなら2×ATR。15:00終了、1日各方向1回、100株固定。  
結果: 2024-01～2025-06、312取引、勝率52.6%、PF 1.54、純益$11,230。9:45–11:30だけでは186取引、勝率62.4%、PF 2.08、純益$17,190。11:30以降は126取引、PF 0.69/0.53、計−$5,960。手数料$0.02/株/片道、スリッページなし。OOSなし。[方法・結果](https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest)  
評価: B。Pine v6: Yes。最大の問題は、好成績の午前窓が結果閲覧後に抽出された可能性が高いこと。RSI・ATR・時刻も多重最適化候補。QQQのスプレッドなら小口で残存し得るが、独立OOS前は信用できない。

2. Session-VWAP Pullback Continuation  
市場/足: NQ/ES/YM/RTY、5分足、RTH 9:30–16:00 ET。  
ルール: セッションVWAPの10本傾きが正なら、終値がVWAP±0.15%帯へ入った時にロング（負ならショート）。TP 0.50%、SL 0.30%、最大30本、引け決済。判定・損切りはバー終値。  
結果（2024年、手数料・スリッページモデル込み）: NQ 565取引、勝率49.20%、PF 1.11、DD 13.56%；ES 605、49.09%、1.08；YM 583、45.80%、1.01；RTY 525、50.10%、1.29。[ルール](https://www.fractiz.com/strategies/vwap-pullback/)／[NQ詳細](https://www.fractiz.com/backtest-samples/vwap-pullback-strategy-nq-5m-2024/)  
評価: B。Pine v6: Yes。ただし同じ2024年でlookback/bandを探索しておりOOSなし。NQ/ES/YMのPFは薄すぎ、少し悪い約定・データ差で消える公算が大きい。先物ユニバース選択、連続限月処理も未開示。

3. VWAP Trend Trading（リテストなしの比較基準）  
市場/足: QQQ/TQQQ、1分足、2018–2023 RTH。  
ルール: 9:31に終値がVWAP上なら全資金ロング、下ならショート。その後VWAP反対側で1分足が確定するたび反転し、16:00決済。固定SL/TPなし。  
結果: QQQ 21,967取引、勝率17.0%、平均利益/損失5.67、総収益671%、Sharpe 2.1、DD 9.4%。$0.0005/株手数料込み、スリッページなし、OOSなし。[SSRN原稿](https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf)  
評価: B（未査読・コード/データ非公開）。Pine v6: Yes。超低手数料、全資金投入、約22,000取引、銘柄選択後の単一期間という重大な懸念があり、通常の小売コストでの生存は未証明。

4. Volume Surge Retest  
ルール: VWAP突破時出来高が20本平均の2倍、5–15分以内にリテスト、リテスト出来高が突破時の50%未満、最初の方向一致足で参入。SLは0.3%または次のVWAP偏差帯、1Rで一部利確し残りをEMA20追随。報告は500取引・勝率67%のみで、市場、期間、PF、費用、OOS非開示。[出典](https://fibalgo.com/education/vwap-trading-strategy-institutional-benchmark)  
評価: C。Pine v6: Partial（「接触」「最初の足」「偏差帯」を追加定義すれば可能）。コスト耐性は判断不能で、67%という数字を実用根拠にはできない。

結論: 最も検証価値があるのは候補1の午前限定ルールだが、現状は探索結果である。期間を固定したまま2025-07以降、SPY・NQ・ESでも一切再調整せず、スプレッド・最低1tickスリッページ・実手数料込みでPF>1.3を維持できなければ棄却すべきである。
