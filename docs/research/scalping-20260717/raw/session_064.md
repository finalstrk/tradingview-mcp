# London/NY Overlap Volatility Research

**topic_id:** session_064  
**family:** session  
**date:** 2026-07-17  
**question:** London/NY overlap: volatility patterns and measured strategy edges

---

結論：ロンドン／NY重複時間は「高ボラティリティかつ低コスト」ですが、それ自体は方向性エッジではありません。実取引データでは、欧米同時稼働時に価格インパクトが日中最低となり、最も薄い時間との差は5倍超です。一方、EUR/USD・USD/JPYの価格発見が重複時間に支配されるのは主に米国指標発表日でした。[Ito–Hashimoto](https://www.nber.org/papers/w12413)、[Journal of Financial Economics](https://www.sciencedirect.com/science/article/pii/S0304405X22001891)、[Journal of International Money and Finance](https://www.sciencedirect.com/science/article/abs/pii/S0261560617301687)

## 1. EUR/USD地域別ドリフト

市場・足：EUR/USD、1時間。  
ルール：NY時間約02:00の欧州開始でEURをショート、08:00の米国開始で決済・ロング反転、16:00決済。ストップなし。DST調整、平日のみ。ロングの最初約2時間がロンドン／NY重複。  
成績：1997年1月～2007年6月。ショート年率6%、勝率44%、Sharpe 1.3。ロング年率7%、勝率53%、Sharpe 0.9。EBSの実売買可能bid/ask込み。PF・正確な取引数・独立OOSなし。[Journal of Money, Credit and Banking論文／SNB版](https://c.mql5.com/forextsd/forum/205/working_paper_2011_04.n.pdf)  
評価：A。Pine v6：可。  
疑念：インターディーラー価格による古い結果で、重複時間だけを分離していない。発見後の減衰、金利・ロール、現代の小売スプレッドを考えると、生存性は不明～低い。通貨選択のサバイバーシップもある。

## 2. 欧州フィックス前後のUSD反転

市場・足：G9 FX、5分。  
ルール：02:00 ETから08:15 ECB fixまでUSDロング、08:15～11:00はフラット、11:00 London fixでUSDショートへ反転し16:00～17:00に決済。ストップなし。後半は重複時間内。  
成績：1999～2019、5,264日。コスト前の欧州反転勝率はEUR・GBP・等ウェイトで約55～56%、EUR年率15.6%、GBP12.4%。しかし2006～2019の実bid/askによる小売型liquidity demanderはAUD −7.34bp、GBP −0.98bp（t=−7.72、−1.19）。ディーラー型liquidity providerだけが+2.45bp、+3.95bp。[Journal of Finance](https://onlinelibrary.wiley.com/doi/10.1111/jofi.13306)、[著者最終稿](https://wrap.warwick.ac.uk/id/eprint/177333/1/WRAP-foreign-exchange-fixings-returns-around-clock-Mueller-2023.pdf)  
評価：A。Pine v6：部分可。時刻売買は可能だが、正確なfix、bid/ask、D2D/D2C執行は再現不能。  
判断：構造的パターンは強いが、小売ではスプレッド負けするという、よく支持された否定結果。OOS未設定と仮説発見後バイアスは残る。

## 3. NYオープニングレンジ・ブレイク

市場・足：MNQ、5分。  
ルール：09:30～09:55 ETの6本高安を確定。終値ブレイク後の次足始値で同方向へ入り、1本後または15本後に時間決済。プルバック型はブレイク水準5ポイント以内で入り、20ポイントストップ。  
成績：2021～2025、947日、walk-forward OOS、往復2ポイント控除。ロング15本保有は447件、勝率55.5%、平均+2.82pt、t=1.50。ショート428件、勝率47.7%、−2.16pt。プルバック83件、勝率19.3%、−4.44pt。PFなし。[研究全文](https://www.researchgate.net/publication/404476167_Structural_Limits_of_OHLCV-Based_Intraday_Signals_in_MNQ_Futures_A_Systematic_Falsification_Study)  
評価：B。Pine v6：可。  
判断：年別不安定で有意性不足。14シグナル群を試した多重検定リスクもあり、現実コスト後のエッジとは認定できない。

## 4. FX重複時間15分ORB

市場：EUR/USD等6ペア、15分、13:00～16:00 UTC。  
ルール：最初の4本をレンジ化。終値が0.10～0.80 ATRだけ外側、かつ足レンジ上位／下位40%なら次足始値で進入。反対側レンジ±0.10 ATRをストップ、1.2Rまたはセッション終了で決済。  
成績：187件、勝率36.36%、PF 0.4238、期待値−0.2055R、総損益−38.43R。1.5pipスプレッド＋片道0.5pipスリッページ込み。OOSなし。[詳細テスト](https://fxglory.com/learn/forex-strategies/best-time-to-trade-forex/)  
評価：B。Pine v6：可。  
判断：明確に不採用。公開yfinanceデータ、短い標本、商業サイトという弱点はあるが、最良コスト想定でも負けており、過学習で救済すべきではありません。
