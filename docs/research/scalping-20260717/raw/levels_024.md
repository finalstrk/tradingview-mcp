# levels_024 — Initial Balance and Overnight High/Low: Statistics on Breaks vs Reversals

**Topic ID**: levels_024  
**Family**: levels  
**Date**: 2026-07-17  
**Research Question**: Initial balance and overnight high/low: statistics on breaks vs reversals

---

結論：IB/オーバーナイト高安は有力な「状態変数」だが、単独の売買エッジを示す証拠は弱い。到達率を勝率と読むのは誤りである。

1. Timely Opening Range Breakout（TORB）

市場：DJIA、ES、NQ、HSI、TAIEX先物。1分足。現物市場開始後1–151分の高安を固定し、以後の最初の1分価格が高値超えなら買い、安値割れなら売り。現物市場引けで決済、ストップ・利確なし。米国市場の最適観測時間はDJIA 4分、ES/NQ 1分。2003–2013年、取引コスト0.01%込みで、DJIA 2,677取引・年率12.89%、ES 3,096・8.95%、NQ 3,099・17.51%；PF、勝率は未報告。前後半サブ期間でも概ねプラスだが、完全なOOSではない。[IEEE Access論文](https://www.researchgate.net/publication/331076454_Assessing_the_Profitability_of_Timely_Opening_Range_Breakout_on_Index_Futures_Markets)

評価：A。Pine v6：可。時刻、高安、終値ブレイク、引け決済を実装可能。ただし全観測時間から最良値を選ぶ多重検定・市場選択バイアスが強い。1分ブレイク時の実スリッページが0.01%想定を超える可能性があり、現在も残るエッジとは確認できない。

2. 無加工15分ORB

市場：NQ、ES、YM。5分足。09:30–09:45 ETの高安を固定し、その後最初にレンジ外で終値確定した方向へ成行、1日1回、16:00決済。ストップ・利確なし。2023–2024年、現実的スリッページ・手数料込み：NQ 516取引、勝率50.97%、PF 1.07、DD 35.26%；ES 515、50.49%、PF 1.02；YM 513、48.93%、PF 0.91。[ルールと結果](https://www.fractiz.com/strategies/opening-range-breakout/)／[ES詳細](https://www.fractiz.com/backtest-samples/opening-range-breakout-strategy-es-5m-2023-2024/)

評価：B。Pine v6：可。OOSなし、期間が短く、PFは費用誤差・追加1ティックで消え得る。小売執行後に残るとは考えにくい。これは明確な否定的ベースラインである。

3. IBブレイク後リテスト：継続対反転

市場：NQ/ES、1分足、2014–2026年、各約3,000ブレイク日。IB＝09:30–10:30。最初の高安ブレイクがIB幅Rの+20%（1.2）まで伸び、その後破ったIB境界へ初回リテストした場合、NQは「継続52%・反転22%・リテストなし26%」。深さ1.4では継続26%、反転27%となり反転優位へ交差；ESは約1.5で交差。失敗した1.1リテストの44%（ES 56%）は反対側IBまで到達。[研究](https://tradingstats.net/initial-balance-retest-statistics/)

評価：B。Pine v6：部分可。条件検出は可能だが、原研究はエントリー、ストップ、利確、PF、コスト、OOSを定義しておらず、勝率ではない。売買可能性は未証明。

4. オーバーナイト中央値方向の先行ブレイク

NQ、5分足、2015–2025年、2,827日。ONレンジ＝前日18:00–09:30 ET。09:30始値が中央値より上ならON高、下ならON安が先に破れる方向を予測。上側1,605日で高値先行76.2%、下側1,211日で安値先行75.6%。ただし両側スイープ22.9%（初回ブレイク後の反転約24%）。エントリー候補は該当ON高/安のブレイクだが、出口・ストップ・PF・費用・OOSは未定義。[研究](https://tradingstats.net/overnight-high-low-breakout-strategy/)

評価：B。Pine v6：部分可。始値が近い側へ先に到達しやすいという距離の機械的効果を多く含み、収益性とは別物。コスト耐性は不明。

総合すると、現時点で小売コスト込み・真のOOSまで満たすA級のIB/ONH-L戦略は見当たらない。先行候補はTORBだが再検証必須であり、IB/ON水準は単独シグナルよりフィルターとして使うのが妥当である。
