---
topic_id: meta_097
family: meta
date: 2026-07-17
question: Multi-symbol robustness testing standards for intraday strategies
---

## 結論

強い証拠があるのは「限定条件下の市場現象」であり、銘柄を替えても同一パラメータで利益が残る汎用スキャルピング手法ではありません。推奨する合格基準は、①上場廃止を含む時点整合ユニバース、②時系列walk-forward＋未使用銘柄へのleave-one-symbol-out、③銘柄別・年別成績、④実スプレッド、手数料、スリッページ、借株料を1倍・2倍で検証、⑤次足約定、⑥試した全仕様数を記録してDeflated Sharpe/CSCVを適用、です。多重検定下では通常のt=2は弱く、t>3程度が提案されています。[Harvey–Liu–Zhu](https://www.nber.org/papers/w20592)、[Deflated Sharpe Ratio](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551)

## 候補ロジック

**1. Stocks-in-Play 5分ORB — 米国株、5分足 — Grade B**

- エントリー：9:30–9:35 ET足が陽線なら高値への買いストップ、陰線なら安値への売りストップ。ドージーは見送り。
- 決済：14日ATRの10%を逆行ストップ。未到達なら16:00決済。利確目標なし。
- フィルター：株価>$5、14日平均出来高>100万株、ATR>$0.50、初動5分出来高÷過去14日同時間平均≥1、当日相対出来高上位20銘柄。
- 成績：2016–2023、約7,000銘柄。純リターン1,637%、年率41.6%、Sharpe 2.81、勝率48.4%、MDD 12%。手数料$0.0035/株。取引数、PF、真正OOSは未報告。[論文・規則と結果](https://www.wealth-lab.com/api/discussion/download/pdf/8007-ssrn-4729284-1-pdf)
- リスク：CRSPで上場廃止銘柄を含み、survivorshipは適切。一方、相対出来高選択と10%ATRは同期間で発見・評価されており過剰適合余地が大きい。スプレッド、スリッページ、借株料なし。平均優位性は相対出来高≥1でも僅か0.08R/取引なので、低価格株では小売コスト後に残るか疑わしい。
- Pine v6：**partial**。単一銘柄版は可能。約7,000銘柄から日次上位20を動的選択する完全再現はPineの外部銘柄取得制限上困難。

**2. First-half-hour → last-half-hour momentum — SPY＋10 ETF、30分窓 — Grade A**

- エントリー：前日終値から10:00 ETまでのリターンが正なら15:30買い、負なら売り。
- 決済：16:00。ストップなし。基本は全営業日。高ボラ・高出来高・景気後退・重要指標日は効果増大。
- 成績：SPY 1993–2013、約21年。年率6.67%、標準偏差6.19%、Sharpe 1.08、OOS R^2 1.4%、費用後も有意。QQQ、IWM、TLT等10 ETFでも検出。PF・勝率・正確な取引数は未報告。[JFE論文](https://www.sciencedirect.com/science/article/pii/S0304405X18301351)
- 反証：2010–2018の独立SPY追試は$0.01/株込み、1,165取引、勝率49.7%、年率−1.37%、Sharpe −2.70。5 ETF中、僅かにプラスはTLTのみ。[追試](https://stocksoftresearch.com/the-truth-about-intraday-momentum/)
- リスク：ETFのsurvivorshipは小さいが、流動性上位ETFの事後選択余地あり。30分保有ゆえスプレッド比率が高く、現在の小売実装では**混合～弱い証拠**。
- Pine v6：**yes**。

**3. 高頻度ペア・リバーサル — FTSE100、主に60分足 — Grade A**

- エントリー：264時間で正規化価格のSSD最小5/20ペアを選び、132時間取引。スプレッドが形成期標準偏差の2倍または3倍を超えたら割安側買い・割高側売り。
- 決済：スプレッド収束、または取引期間終了。セッションフィルターなし。
- 成績：2007年、30個の重複OOS窓。2σ・上位5ペアは年率19.8% gross→15bp費用後5.44%、平均3.84往復/ペア。3σでは15.24%→7.01%。1バー約定遅延では費用後マイナス。[査読論文](https://www.ucc.ie/en/media/research/centreforinvestmentresearch/wp/wp1004high-frequency-equity-pairs-trading.pdf)
- リスク：わずか1年、FTSE100構成銘柄の時点整合性が不明、危機期依存。小売の二脚同時約定・借株・スプレッドではエッジ生存は**非現実的**。
- Pine v6：**partial**。固定ペアなら可能だが、全銘柄ランキングと同時二脚執行は不可。原研究の主結果は1–15分足ではない。
