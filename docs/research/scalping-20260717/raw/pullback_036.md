# Research: Trend-Day Pullback Recognition & Trailing Entry Performance

**Topic ID**: pullback_036  
**Family**: pullback  
**Date**: 2026-07-17  
**Question**: Trend-day recognition then trailing pullback entries: measured performance.

---

結論：**「トレンド日を認識し、その後の押し目で入る」手法に直接対応するA級証拠は見つからない。** 公開されている好成績は、再現仕様・独立OOS・約定モデルのいずれかが弱い。最も堅い直接検証はむしろ否定的だった。

1. **Market Intraday Momentum（近縁の学術基準）**  
市場：SPY、30分（1993–2013、日次1判定、正確なNは未報告）。前日終値→10:00のリターンが正なら15:30に買い、負なら売り、16:00決済。ストップなし。高出来高・高ボラ日は効果増大。勝率相当54.37%、年率6.67%、Sharpe 1.08、再帰OOS \(R^2=1.4\%\)。2005年以降、実測スプレッド控除後も年率6.52%、Sharpe 1.00。**Grade A**（JFE査読済み）。Pine v6：**Yes**、5分足から30分区間を集計可能。ただし押し目エントリーではなく、「早朝方向→引け成行」のみ。SPY単体の上場廃止バイアスは小さいが、期間が2013年までで効果減衰リスクあり。流動性の高いSPYなら当時はコスト耐性ありと判断できるが、現在の独立再検証が必要。[論文](https://www.sciencedirect.com/science/article/pii/S0304405X18301351)

2. **RTH Confluence ATR Pullback**  
市場：MNQ、5分、RTH。完成足でGMM＝Active Flow、200本Markov遷移確率>0.15、50本出来高z-score>0.5を満たし、シグナル終値から「ATR調整25ポイント」の押し目で入る。13本後決済、ストップは未記載。2ポイント往復コスト込みで開発標本538件：勝率61.0%、平均+15.77pt、t=5.83；walk-forward OOS 196件：平均+11.82pt、t=3.11；2025 OOS +13.14pt、置換検定p<0.001。**Grade B**。Pine：**Partial**—GMM係数、方向対応、ATR式が非公開。数値上は小売コストを十分超えるが、別研究から選ばれた「positive control」であり、選択・出版バイアスと単一市場依存が大きい。[論文PDF](https://arxiv.org/pdf/2605.04004)

3. **QQQ VWAP＋RSI(2) Pullback**  
5分。9:45以降VWAP上/下で3本連続終値→VWAP接触＋RSI(2)<25/>75→次の陽線/陰線がVWAPを維持して終値エントリー。ストップ1.5×ATR(14)、目標は前日高安、既に突破済みなら2×ATR。9:45–15:00、各方向1回。2024-01～2025-06、312件：勝率52.6%、PF1.54、+$11,230。片道$0.02/株込み。事後選択した9:45–11:30だけでは186件、勝率62.4%、PF2.08。**Grade B**。Pine：**Yes**。ただしコード・取引一覧なし、OOSなし、時間帯フィルターは同一標本から発見されており強い過適合疑い。スプレッド・スリッページ追加後も名目上は残り得るが、信頼度は低い。[詳細](https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest)

4. **MNQ 25分ORB Pullback（否定結果）**  
9:30–9:55高安を突破後、突破線5pt以内への戻りを待ち次足始値で入る。20ptストップ；利確/時間決済仕様は論文で不完全。5分、83件、2ptコスト込み平均−4.44pt、勝率19.3%、t=−1.27、ストップ率80.7%。walk-forward、2021–25。**Grade B**。Pine：**Partial**（出口不足）。既にコスト後大幅負なので小売では生存不能。単一MNQという限界はあるが、過適合を抑えた有力な反証。[同論文](https://arxiv.org/pdf/2605.04004)

5. **ORB-Fib 61.8% Pullback（約定反証）**  
BTC/ETH/SOL、5分。9:30最初の足をORBとし、突破インパルスの61.8%へ指値、起点ストップ、1R利確。始値足・プレ市場・夜間レンジ・出来高の60百分位条件4つ中3つ以上。探索/holdout計105件：楽観的同足順序では勝率73.3%、PF1.86、+28.2R；ストップ優先でPF0.93、わずか0.03%の不利約定でPF0.53、−94R。**Grade C**。Pine：**Partial**—ロジックは可能だが、信頼できる検証には1分/ティックのBar Magnifierが必要。暗号資産三銘柄の事後選択・小標本リスクも大きく、実コストには耐えない。[検証記録](https://www.reddit.com/r/algotradingcrypto/comments/1ukstn0/orbfib_the_strategy_that_looked_like_a_73_win/)

総合判断：実装候補はQQQ VWAP型だが、現状は研究仮説に留まる。独立期間・未使用市場・ティック約定・全費用込みで再検証するまでは、測定済みの優位性とは呼べない。
