# Academic Research: Intraday Periodicity & Scalping Logic

**topic_id**: academic_074  
**family**: academic  
**date**: 2026-07-17  
**question**: Intraday periodicity papers (volume/volatility U-shape) and exploitable implications

---

U字型の出来高・ボラティリティは頑健な記述的事実だが、期待収益の方向を示さない。しかも2008年以降の構造変化や、時間集計による見かけのU字も報告されている。したがって「寄り・引けは動く」だけではエッジではない。

1. **First-half-hour → last-half-hour momentum**  
市場・足：SPY、30分（基礎データ1分）。エントリー：15:30 ETに、前日16:00→当日10:00のリターンが正なら買い、負なら売り。決済：16:00、ストップなし。高ボラ・高出来高日ほど強い。1993–2013、約5,270日、勝率54.37%、年率6.67%、Sharpe 1.08、累積109.39%、再帰OOS (R²=1.69%)。PFなし。想定コスト年3.78%以下、推定ネット約3.07%。[論文PDF](https://smallake.kr/wp-content/uploads/2015/01/SSRN-id2440866.pdf)  
**Grade A**（Journal of Financial Economics）。Pine v6：**Yes**。ただし後続の査読研究では追加OOS期間で予測力が消失しており、現在の証拠は混合。[Rosa 2022](https://ideas.repec.org/a/wly/jfutmk/v42y2022i12p2218-2234.html) 銘柄survivorshipは小さいが、発見後のedge decay・publication biasが大きい。現在の低いSPYコストには耐え得る幅だが、現行データでの再検証なしに採用不可。

2. **SPY Noise-Area momentum + VWAP stop**  
市場・足：SPY、1分、10:00以降30分刻み。過去14日について同時刻までの始値からの絶対変動率を平均し、上限＝max(当日始値,前日終値)×(1+平均変動)、下限＝min(...)×(1−平均変動)。上抜け買い／下抜け売り。買いは価格がmax(上限,VWAP)を下抜け、売りはmin(下限,VWAP)を上抜けたら決済。16:00全決済。2%ボラ目標、最大4倍。2007–2024、7,964取引、勝率43%、年率19.6%、Sharpe 1.33、MDD 25%、累積1,985%；PFなし。$0.0035/株＋$0.001/株スリッページ込み。[原論文](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172)  
**Grade B**。Pine v6：**Yes**（同時刻別14日履歴の管理が必要）。SPY小口ならコスト生存は plausible。ただし独立OOSなし、ストップ・VWAP・ボラサイジングを逐次追加しており過剰適合リスクが高い。銘柄survivorshipは低いが研究者選択・仕様探索バイアスは高い。

3. **5分ORB（実際は第一足方向追随）**  
市場：QQQ/TQQQ、5分。9:30–9:35足が陽線なら9:35始値で買い、陰線なら売り、同値なら見送り。ストップ＝第一足安値／高値、利確＝10Rまたは16:00。1取引リスク1%、最大4倍。2016–2023、1,795取引、勝率24%、平均0.13R、QQQ年率31%、Sharpe 1.12、累積675%；TQQQ年率46%、Sharpe 1.18、累積1,485%。PF・OOSなし。$0.0005/株、**スリッページなし**。[論文PDF](https://static1.squarespace.com/static/5983d931579fb366729580d8/t/643ed6765176b45506e41a01/1681839734183/SSRN-id4416622.pdf)  
**Grade B**。Pine v6：**Yes**。しかし第一足終値を見て同値の9:35始値で約定するため実質的な同時刻／楽観約定バイアスがある。TQQQ選択、単一期間、同一標本でのパラメータ探索も重大。報告リターンは大きいが、現状の証拠ではコスト後存続を信用できない。

4. **MNQ 25分ORB反証**  
9:30–9:55高安を抜けた完成足の次足始値で追随し、15本後決済。5分足、2ポイント往復コスト、2021–2025の947日、walk-forward。買い447件：平均ネット+2.82pt、勝率55.5%、t=1.50；年別−1.42/+2.43/+7.04pt。売り428件：−2.16pt、勝率47.7%。[研究PDF](https://arxiv.org/pdf/2605.04004)  
**Grade B**（未査読・コード／データ未公開）。Pine v6：**Yes**。年次不安定で統計基準未達。選択的成功報告は抑えているが、単一銘柄・短期間。現実コスト後の安定したedgeは確認できず、結論は否定的。
