# Micro Higher-Low / 1-2-3 Pullback Structures: Objective Definitions and Stats

**Topic ID:** pullback_034  
**Family:** pullback  
**Date:** 2026-07-17  
**Question:** Micro higher-low / 1-2-3 pullback structures: objective definitions and stats

---

結論：客観化された「higher-low / 1-2-3」には、単体でコスト後の堅牢なスキャルピング優位性を示すGrade A証拠は見当たらない。最も厳密な研究でも成功確率は概ね50%である。

- **Automatic 1-2-3 trend activation** — EUR/USD、DAX先物、金、原油、10分足。ロングはMinMax/MACDでP1安値→P2高値→P3安値（P3>P1）を確定。論文が例示する取引はP3認識後エントリー、SL=P1、最小目標=P2。P2突破で初めて上昇トレンド成立。ショートは反転。セッション制限なし。2011-01-03～2013-01-25で、P2突破率はEUR/USD 52%（n=206）、DAX 49%（206）、金42%（198）、原油48%（453）。平均リスクは利益と同等以上、PF・コスト・OOSなし。全期間で波長を校正しており先読み／過適合懸念あり。銘柄生存バイアスは小さいが期間依存。小幅優位しかないため小売コスト後は疑わしい。**総合Grade B**（[定義は査読済み](https://www.tandfonline.com/doi/full/10.1080/14697688.2013.814922)、[統計研究はarXiv](https://ar5iv.labs.arxiv.org/html/1409.5321)）。Pine v6：**partial**—SAR/MinMax状態機械と確定遅延の忠実な移植が必要。

- **Sunrise Ogle 1–3 candle pullback** — XAU/USD、5分足。EMA(1)がEMA(14/14/24)を上抜け、価格・EMA100・角度・ATR条件を確認後、最大3本の陰線を待ち、保存チャネル高値突破で買い（売りは最大2本の陽線後の安値突破）。文書上SL=エントリー足安値−2.5ATR、TP=高値+12ATR、1%リスク、時間フィルタ任意。2020-07～2025-07、175件、勝率55.43%、PF1.64、Sharpe 0.892、DD5.81%、+44.75%。ただしOOSなし、単一市場に多数パラメータ、READMEと現行コードのATR倍率が不一致、コード内に実効的なcommission/slippage設定を確認できない。コスト後存続は未証明。**Grade B**（[コード＋5年CSV](https://github.com/ilahuerta-IA/backtrader-pullback-window-xauusd)）。Pine：**partial**—移植可能だが設定の正本が不明。

- **9-EMA Micro Pullback Scalp** — NQ、1/5分足。正の「急な」EMA9傾斜中、EMA9への押しでEMA下に終値を置かなければ買い。目標6–10 ticks、SL=押し深さの2倍、micro swing lowでtrail。2023-01～2026-03、n=608、勝率40.1%、PF1.24。$4.50往復手数料＋片道1 tick滑り、1-bar遅延込みと報告。ただし「急な傾斜」、セッション、データ、OOSが非公開で再現不能。単一銘柄選択も強い。モデル上はコスト後プラスだが余裕が薄い。**Grade C**（[報告](https://pinescriptforge.com/nq/micro-pullback-scalp/backtest/aggressive)）。Pine：**partial**—曖昧な傾斜・tick条件を固定する必要あり。

- **Session-VWAP Pullback Continuation** — NQ/ES/YM、5分足、9:30–16:00 ET。10-bar VWAP slope方向に、終値がVWAP±0.15%へ戻ればエントリー。TP 0.50%、SL 0.30%、最大30 bars、引け決済。2024年：NQ 49.20%/PF1.11/n565、ES 49.09%/1.08/605、YM 45.80%/1.01/583。コスト非明示、stopはintrabarでなく終値評価、10-barを同じ2024年sweepで選択、OOSなし。実質的に手数料・滑りで消える水準。**Grade B**（[詳細](https://www.fractiz.com/strategies/vwap-pullback/)）。Pine：**yes**。

- **EMA100＋daily-VWAP pullback（否定例）** — BTC等、5/15分足、24時間。EMA100上（下）でdaily VWAPに触れ、方向側へ終値復帰してentry。SL=2ATR、EMA100逆抜けまたはSLでexit。0.06%/side込み。BTCで5分n=9,124、勝率11.7%、PF0.22、−100%；15分n=3,097、15.1%、PF0.37、−100%。OOSは4時間足のみ3/5銘柄プラスで、intradayには救済なし。現存大型crypto選択によるsurvivorshipあり。**Grade B**（[方法・結果](https://strategyverdict.com/verdicts/)）。Pine：**yes**。これは強い否定結果であり、低時間足のVWAP押し目がコストとノイズに負ける典型例である。
