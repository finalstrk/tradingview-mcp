# Risk Research 085: Daily Loss Limits and Max-Trades-Per-Day Effect

**Topic ID:** risk_085  
**Family:** risk  
**Date:** 2026-07-17  
**Question:** Daily loss limits and max-trades-per-day: measured effect on trader outcomes (incl. prop-firm data)

---

結論：日次損失上限や「1日N回」の取引上限が、トレーダーの純利益・生存率を改善するという公開された因果的証拠は弱い。プロップ企業が採用している事実と、有効性の実証は別である。

**リスク上限の測定結果**

Chicago Fedが高頻度プロップ9社を調査したところ、8社が何らかのP&L上限で取引を停止し、多くが発注頻度制限も使用していた。ただし目的は主に暴走アルゴ・帯域管理で、導入前後の収益や破綻率は測定していない。[Chicago Fed](https://www.chicagofed.org/-/media/publications/policy-discussion-papers/2012/pdp2012-1-pdf.pdf)

CBOT国債先物の426人・236営業日では、午前に損失を出したトレーダーは午後に平均以上のリスクを取る確率が31.2%。追加ポジションの価格影響は5分後に27%大きく反転した。これは「損失後の取引停止」を支持する観察証拠だが、実際に上限をランダム導入した研究ではない。[Coval–Shumway](https://www.tylergshumway.org/Coval-BehavioralBiasesAffect-2005.pdf)

一方、別の専門商品先物トレーダー研究は、午前の損失後に取引数・リスクは増えるものの、リスク調整後成績や執行品質は悪化しないと報告する。結論は明確に混在している。[Locke–Mann](https://www.sciencedirect.com/science/article/pii/S1386418109000421)

したがって、普遍的な「最大3回」等に実証的根拠はない。上限は各戦略のtrade-by-trade系列から、取引番号別期待値、日次損失分布、手数料込みMonte Carloで決めるべきである。

**候補ロジック**

1. **5分足方向性ORB（QQQ/TQQQ）**  
市場・足：QQQ/TQQQ、5分。9:30–9:35 ET足が陽線なら9:35始値で買い、陰線なら売り、同値なら見送り。停止は第1足安値／高値。10R到達または引けで決済。1日1回、資金の1%リスク、最大4倍。2016–2023、1,795取引、勝率24%、平均0.13R、QQQ版総収益675%、Sharpe 1.12、PF未報告。片道ではなく株数当たり$0.0005の手数料込みだがスリッページ0、正式OOSなし。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Can-Day-Trading-Really-Be-Profitable.pdf)  
評価B。Pine v6：可。銘柄・期間の事後選択、出版バイアス、TQQQ選択による過適合が大きい。狭い第1足ではストップ滑りが重大で、報告値ほどの小売実現性は期待しにくい。

2. **始値―終値イントラデイ・モメンタム**  
市場・足：SPYおよび流動性上位10 ETF、15分以下。前日終値から10:00 ETまでのリターンが正なら15:30に買い、負なら売り、16:00決済。ストップなし。高ボラ・高出来高・景気後退・主要指標日に強い。1993–2013の約21年、年率6.67%、年率標準偏差6.19%、取引費用後も有意。勝率・PF・正確なNは未報告、正式な時系列OOSなし。[SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2440866)、[Journal of Financial Economics](https://www.sciencedirect.com/science/article/pii/S0304405X18301351)  
評価A。Pine v6：可。ただし引けオークション効果を通常バー約定で再現できず、現在のスプレッド・引け滑りでエッジが縮小する可能性が高い。

3. **MNQ 25分ORB―否定結果**  
市場・足：MNQ、5分。9:30–9:55の高値突破を次バー始値で買い、15本後に決済。2021–2025、947日中447取引、勝率55.5%、2ポイント往復費用後平均+2.82点、t=1.50、年別成績不安定。短期決済・ショート・押し目型も失敗し、14シグナル群すべてがwalk-forward基準を不通過。[arXiv](https://arxiv.org/abs/2605.04004)  
評価B。Pine v6：可。選択・過適合を抑えた有用な否定結果であり、現実的費用後に安定して残るエッジとは判断できない。
