# squeeze_048

**Topic ID:** squeeze_048  
**Family:** squeeze  
**Date:** 2026-07-17  
**Question:** ATR-based dynamic sizing and target scaling for scalps: measured expectancy impact

---

結論：1–15分スカルプで、ATR動的サイジング／目標幅の「増分期待値」を、現実的コスト込み・十分な標本・OOSで分離測定した強い証拠は見つからなかった。最良資料でも結果は混合しており、ATR自体よりエントリー選別の寄与が大きい。

- **TQQQ 5分ORB＋ATRリスク一定化**  
  市場・足：TQQQ、1分足で最初の5分を判定。最初の5分が上昇なら9:35始値で買い、下落なら売り、dojiは見送り。SL＝前日までの14日ATR×5%、サイズ＝SL到達時に資産の1%損失、最大4倍レバレッジ。TPなし、16:00 ET決済。  
  2016–2023で総収益9,350%、年率alpha 93%（片道$0.0005/株、スリッページなし）。比較元の「開始5分高安SL＋10R」は総収益1,484%、年率48%、Sharpe 1.19、MDD 28%、平均0.18R。ただしSLとTPを同時変更しておりATR単独効果ではない。取引数・WR・PF未開示、完全なインサンプル最適化。公開Colabは2016–2026データを再取得でき、2023年2月以降をOOS表示するが、OOS数値は記事に未掲載。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Can-Day-Trading-Really-Be-Profitable.pdf)／[再現コード・データ取得法](https://concretumgroup.com/orb-strategy-backtest-in-python-using-alpaca-10-years-of-free-data/)  
  **Grade A**（コード＋SIPデータ再取得可能）。Pine v6：**Yes**。ただし8セント程度のSL例では1–2セントのspread/slippageが1Rの12.5–25%を消費し、9,350%という結果は小口でも疑わしく、大口では著者自身が非現実的と認める。

- **Stocks-in-Play 5分ORB**  
  全米上場株。最初の5分が陽線なら高値ブレイク買い、陰線なら安値ブレイク売り。SL＝14日ATR×10%、1%リスク・最大4倍、EOD決済。価格>$5、14日平均出来高>100万株、ATR>$0.50、最初の5分RVOL≥100%かつ上位20銘柄。  
  2016–2023、7,000超銘柄、commission $0.0035/株。上位20版：総収益1,637%、WR 48.4%、Sharpe 2.81、MDD 12%。一方、同じATR管理で全適格株を売買した基準版は総収益29%、WR 41.4%、Sharpe 0.48。取引数・PF・OOSなし。[原論文](https://concretumgroup.com/wp-content/uploads/2026/02/A-Profitable-Day-Trading-Strategy-For-The-U-S-Equity-Market.pdf)  
  **Grade B**。CRSPに上場廃止銘柄を含みsurvivorship biasは抑制。ただし改善はRVOL選別の効果で、ATR効果ではない。spread・slippage・borrow料なし。Pine：**Partial**（単一銘柄は可、全市場RVOL順位付けは不可）。基準版の弱さから、無選別では小売コスト後の生存性は低い。

- **MACD＋可変ATRトレーリング**  
  FX・金・原油・BTC、1時間足。MACD/Signal上抜けで買い、下抜けで売り・反転。ATR(12)×6の可変トレーリングSL、停止後はATR(12)×2超過まで同方向再参入禁止、週末前決済。  
  2017-09～2018-02、各資産の基準取引数59–162。spread・commission込み。ATR可変方式が単純MACDを平均的に上回ったが、最終構成のWR・PF・取引数は未報告。大量パラメータ探索後の事後選択、OOSなし。[査読論文](https://www.mdpi.com/1911-8074/11/3/56)  
  **Grade A**（査読済みだが実証品質は低い）。Pine：**Partial**（実装可能だが1–15分で未検証）。小売コスト耐性は証明されない。

補助的なランダム・エントリー研究では、ATRトレーリングが安定して固定SLを上回るのは約0.38 ATRのノイズ帯を越えてからで、最良域は0.8–1.0 ATR。ただし標本数、WR、PF、コスト、OOSが未開示で**Grade B**に留まる。[SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6432558)

したがって、ATRサイジングは主に損失分散とレバレッジ制約を整える道具であり、R単位の期待値を自動的に増やす証拠はない。採用判断には、固定枚数／固定幅との同一エントリーOOS比較と、spread＋commission＋少なくとも1 tickのslippageを必須とすべきである。
