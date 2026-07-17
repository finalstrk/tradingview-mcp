# Day-of-Week Effects in Intraday FX and Futures: Documented Statistics

**Topic ID:** session_065  
**Family:** session  
**Date:** 2026-07-17  
**Research Question:** Day-of-week effects in intraday FX and futures: documented statistics.

---

結論：曜日・時間帯の統計的偏りは存在するが、現代の小口取引で再現できる「スキャルピング優位性」の証拠は弱い。利益係数、十分なOOS、現実的約定を同時に示す研究は見つからなかった。

1. 曜日限定・セッション反転（Ranaldo）

- 市場：EUR/USD、CHF/USD、JPY/USD、JPY/EUR。4時間保有。
- 規則例：月曜EUR/USDで08:00 GMTにUSD買い→12:00決済、16:00にUSD売り→20:00決済。CHF/USDは月曜08–12時USD買い、12–16時USD売り。JPY/USDは金曜00–04時USD買い、12–16時USD売り。固定ストップなし、時刻決済。休日・週末除外。
- 結果：EUR/USD月曜19.48%/年、Sharpe 2.92、損益分岐コスト18.7 pips、観測スプレッド2.9 pips。金曜JPY/USDは14.61%、Sharpe 2.06、損益分岐14.0 pips。1993–2005（EURは1999–2005）；曜日別約347–660観測と推定。勝率・PF・OOSなし。[論文PDF](https://www.snb.ch/public/asset/de/www-snb-ch/publications/research/working-papers/2007/working_paper_2007_03/publications0/working_paper_2007_03.n.pdf)
- 評価：A。Pine v6：yes。UTC時刻・曜日だけで実装可能。ただし曜日選択も同一標本内であり、典型的な多重検定／過適合。指標的Reuters midquoteで、実売買価格ではない。報告上はコスト余裕があるが、20年以上前の市場構造なので現在も残るとは判断できない。

2. 週末ギャップ反転

- 市場：主要7＋新興9通貨。日次～週次で、スキャルピングではない。
- 規則：過去5年間の金曜22:00→月曜22:00 GMTギャップが上下5%分位を超えた月曜始値で、ギャップと逆方向に建て、金曜終値で決済。ストップなし。閾値はrollingまたはrecursive更新。
- 結果：2002–2014、完全OOSは2007–2014年5月（約386週、理論上約38信号/通貨）。コスト・金利控除後、最大NZD/USDが週0.2%＝年10.4%；最大DD 2.3–24.1%。勝率・PFなし。[論文PDF](https://irep.ntu.ac.uk/35555/1/13113_Dao.pdf)
- 評価：A。Pine：partial（1–15分足で時刻検出可能だが週跨ぎ）。最大の問題は、流動性が最低でスプレッドと滑りが最大になる週明け始値を利用すること。Bloombergベースの費用控除より小口約定は悪く、特に新興通貨では生存性が疑わしい。

3. 全曜日セッション効果――重要な否定結果

- 規則：毎営業日EUR/USDを07–13時GMTショート、13–21時ロング。固定時刻決済、ストップなし。
- 結果：EBSのfirm bid/askを使った1997–2007年、約2,700取引/脚。コスト後年率6%、7%、Sharpe 1.3、0.9。方向勝率はコスト前約56%、53%。一方、他の5通貨・10ルールは年率−2%～−51%；PF・OOSなし。[詳細PDF](https://www.aeaweb.org/conference/2009/retrieve.php?pdfid=301)
- 評価：B。Pine：yes。インターディーラー価格ですらEUR/USD以外はコスト負けなので、曜日フィルターを後付けする強い根拠にはならない。小口スプレッドならEUR/USDも余裕は小さい。

補足：2020年の査読研究は12通貨・2004–2018年の時間×曜日効果と最大年率13%（先進国）、17%（新興国）を報告するが、公開情報では正確な売買表、費用、勝率、PF、独立OOSが確認できないため、実装候補としては不合格。[研究概要](https://www.sciencedirect.com/science/article/pii/S1566014119302031)

先物については、5通貨先物で1977–1991年の始値付近・終盤効果、別研究で7 CME通貨先物中5つの反転を報告するが、後者はGlobex導入後に誤価格が縮小し、取引費用・PF・OOS戦略成績もない。[Cornettほか](https://www.sciencedirect.com/science/article/pii/037842669500084T)、[Rentzlerほか](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=885686)。したがって、先物の曜日スキャルプについては「統計はあるが、採用できる実証戦略なし」が妥当である。通貨選択、廃止通貨、連続先物のロール方法による生存者・選択バイアスも大きい。
