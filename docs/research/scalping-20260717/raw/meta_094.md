# Research: Prop-Firm Strategy Style Evaluation (FTMO, Topstep)

**Topic ID**: meta_094  
**Family**: meta  
**Date**: 2026-07-17  
**Question**: What strategy styles pass and stay funded at prop firms? Published stats on scalping/intraday logic with quantified evidence.

---

公開データの結論は厳しい。プロップ会社は「どの戦略スタイルが合格し、長期維持したか」を集計公表していない。Topstepの2025年公式統計では、評価口座の16.8%がFunded Levelへ進み、Funded参加者の33.3%が一度以上出金、Express Funded参加者の0.71%だけがLiveへ移行した。ただし口座単位と人物単位が混在し、「生存率」ではない。[Topstep](https://www.topstep.com/our-program)

FTMOについて確認できたのは、約70%勝率の金スキャルパーと、勝率27.23%・PF 1.29・RRR 3.44の低勝率型という選抜事例だけで、いずれも証拠等級C、強い生存者・広報選択バイアスがある。[FTMO scalper](https://ftmo.com/en/blog/top-ftmo-trader-choon-chiat-scalping-strategy-with-very-high-win-rate/) [FTMO low-WR case](https://ftmo.com/en/blog/strong-profits-despite-a-low-win-rate-how-patience-and-risk-management-paid-off/) よって「スキャルピング型が有利」という公開統計上の根拠はない。

1. **終盤30分SPYモメンタム**  
市場：SPYほか10 ETF。足：1–15分から集計。9:30–10:00のリターンを前日終値基準で計算し、正なら15:30ロング、負ならショート、16:00決済。ストップ・追加フィルターなし。1993–2013、約5,200日、年率6.67%、年率標準偏差6.19%、Sharpe 1.08、PF・勝率未報告。合理的コスト控除後も統計的・経済的に有意で、正式なアウト・オブ・サンプル検定と他ETF確認あり。等級A（JFE査読済み）。Pine v6：可。SPYの終盤一往復なのでコスト耐性は比較的 plausible。ただし年率リターンが小さく、短期間の評価利益目標には遅すぎる可能性が高い。[論文](https://www.sciencedirect.com/science/article/pii/S0304405X18301351)

2. **SPY Noise-Areaモメンタム**  
足：1分、判断はHH:00/HH:30。過去14日について各時刻の「始値からの絶対騰落率」を平均し、当日始値・前日終値を基準に上下バンドを作る。上抜けでロング、下抜けでショート。ロング停止は`max(上バンド,VWAP)`、ショートは`min(下バンド,VWAP)`を半時間ごとに判定し、反対シグナルで反転、16:00全決済。動的2%ボラ目標、最大4倍。2007–2024、7,668取引、取引勝率37%（日次43%）、年率19.6%、Sharpe 1.33、最大DD 25%、PF未報告。$0.0035/株手数料+$0.001スリッページ込みで、後者は1,000超の実注文実験に基づく。等級B：コード公開だが原IQFeedデータ非公開、同一標本上で停止・サイジングを改良しており過適合リスクが高い。Pine：可。ただし25% DDは通常のプロップ制限に不適合。[論文・コード案内](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172)

3. **QQQ/TQQQ 5分第1足方向戦略**  
9:30–9:35足が陽線なら9:35始値で買い、陰線なら売り、同値なら見送り。ロング停止は第1足安値、ショート停止は高値。10Rまたは引け決済。1取引1%リスク、最大4倍。2016–2023、1,795取引、勝率24%、平均0.13R、QQQ年率31%、Sharpe 1.12、PF未報告。手数料$0.0005/株込みだがスリッページなし。等級B。Pine：可。単一ETF・10R・停止幅の同一標本最適化、TQQQの極端な複利結果、正式OOSなしが重大。狭い停止ではスプレッド後に崩れる可能性が高く、連敗型なので評価口座にも不向き。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Can-Day-Trading-Really-Be-Profitable.pdf)

4. **MNQ 25分ORB――有力な否定結果**  
9:30–9:55高安を定義し、最初の上抜け／下抜け後の次5分足始値で同方向、別ストップなし、1または15本後に決済。2021–2025の947日。15本ロングは447取引、コスト後+2.82点、勝率55.5%、t=1.50で不合格；1本ロングは−0.82点。2点往復コスト、walk-forward、年別安定性を要求すると14信号すべて不合格。等級B（詳細なプレプリント）。Pine：可。単純なMNQ短期ORBが小口コストを超えるとの主張には、現状否定的である。[論文](https://arxiv.org/abs/2605.04004)
