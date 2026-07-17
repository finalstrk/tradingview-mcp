# Research: ATR-normalized momentum entries

**topic_id:** pullback_040  
**family:** pullback  
**date:** 2026-07-17  
**question:** ATR-normalized momentum entries: research on volatility-adjusted intraday signals

---

調査上、「ATRで正規化した1～15分モメンタム」そのものの高品質な証拠は少なく、最も有望なのは単純なスキャルピングではなく、ボラティリティ帯を使った日中トレンド追随だった。

- **Time-of-day Volatility-Band Momentum（SPY）**  
  市場・足：SPY、1分データ、30分ごとに判断。  
  エントリー：過去14日について、各時刻までの始値からの絶対変化率を平均して時刻別σを作る。`UB=max(当日始値,前日終値)×(1+σ)`、`LB=min(...)×(1−σ)`。10:00以降のHH:00/HH:30で価格がUB超なら買い、LB割れなら売り。  
  決済：買いは`max(UB,VWAP)`、売りは`min(LB,VWAP)`を30分判定時に逆行突破、または引け。14日実現ボラで日次2%を目標、最大4倍。  
  成績：2007–2024、7,668取引、勝率37%、年率19.6%、Sharpe 1.33、MDD 25%。通常コミッション込み。市場インパクトモデル追加後Sharpe 1.17。独立実装の2022–2024再現は+71.7%、Sharpe 1.39、MDD 9.9%。ただし公表後2025年1～9月は約+1%に失速。PF未報告。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf)／[再現コード](https://github.com/esherma/algo_trading)  
  **Grade B**：コードはあるが原データ非公開、厳密な未使用期間OOSではない。Pine v6：**Yes**。時刻別配列、VWAP、日足ボラを実装可能。SPYの低スプレッドなら存続可能性はあるが、4倍レバレッジ、空売り費用、約定遅延を含めると報告値より低いはず。パラメータ選択・発表バイアスも残る。

- **0.5×ATR Session-Open Breakout（SPY）**  
  市場・足：SPY、15分判定。  
  エントリー：セッション始値±`0.5×ATR(14)`を固定帯とし、HH:00/15/30/45の終値が上帯超なら買い、下帯割れなら売り。  
  決済：セッション始値への回帰、または引け。日次2%ボラ目標でサイズ調整。ATRが日足由来かの記述はやや曖昧。  
  成績：2007–2026、コミッション後CAGR 13%超、Sharpe 0.87。取引数・勝率・PF・OOSは未報告、スリッページはゼロ。[研究ノート](https://concretumgroup.com/wp-content/uploads/2026/02/Improving-Performance-with-Fast-Alphas-A-Tactical-Overlay-for-Intraday-Trend-Trading.pdf)  
  **Grade B**。Pine v6：**Yes**。少数パラメータだが同一標本での開発・評価。SPYなら手数料には耐える可能性がある一方、スリッページ未計上なので証拠は不足。

- **ATR類似のAsia Expansion Continuation（MNQ）—明確な否定結果**  
  市場・足：MNQ、5分、20:00–02:00 ET。  
  エントリー：バー値幅が直近20本平均の1.5/2/2.5倍を超えたら、その方向へ次バー始値で入る。  
  決済：1本または6本後。ストップなし。  
  成績：2021–2025、947日・72,604本、2ポイント往復コスト、walk-forward。1.5倍・1本保有は平均−2.27ポイント、勝率35.5%、t=−10.96。2.5倍・6本でも−0.94ポイント、勝率48.5%。[論文](https://arxiv.org/pdf/2605.04004)  
  **Grade B**：詳細なプレプリントだがコード・データ非公開。Pine v6：**Yes**。複数閾値すべて失敗しており、リテールコストでは存続しない。動きはシグナル確定前の拡大バー内で消費される。

- **First-half-hour → Last-half-hour Momentum（SPY）**  
  市場・足：SPY、30分。  
  エントリー：15:30に、前日終値から10:00までのリターンが正なら買い、負なら売り。  
  決済：16:00。ストップなし。高ボラ日は予測力が強いが、基本ルールにATRフィルターはない。  
  成績：1993–2013、約21年の日次観測、年率6.67%、ボラ6.19%、Sharpe 1.08、OOS R² 1.4%、取引費用後も有意。勝率・PF未報告。[JFE論文](https://www.sciencedirect.com/science/article/abs/pii/S0304405X18301351)  
  **Grade A**。Pine v6：**Yes**。ただし2022年の追試では予測力がOOSで消失したと報告されており、現在のリテール執行での存続は疑わしい。[追試](https://onlinelibrary.wiley.com/doi/abs/10.1002/fut.22375)

総括すると、単純なATR正規化ブレイクアウト・スキャルプの証拠は弱いか否定的である。現時点で検証優先度が高いのはSPYの時刻別ボラティリティ帯だが、2025年の鈍化を考えると、固定期間OOS、実スプレッド、次バー約定、借株・資金調達費を入れた再検証なしに「実用的エッジ」とは判断できない。
