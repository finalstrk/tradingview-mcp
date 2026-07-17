# Heikin-Ashi or Bar-Pattern Continuation Entries: Quantified Tests

**topic_id**: pullback_037
**family**: pullback
**date**: 2026-07-17
**research_question**: Heikin-Ashi or bar-pattern based continuation entries: quantified tests

---

結論：Heikin-Ashi単独の信頼できる1–15分足エッジは見つからない。通常足の継続パターンも、単純なものはコスト控除後ほぼ消える。比較的有望なのは、単なる足形ではなく「時間帯」または「異常出来高」を条件にした継続である。

- **83種の日本式ローソク足ルール** — DJIA構成30銘柄、5分足。TA-Lib標準定義の83パターン発生時に、過去10本のEMAトレンドで売買方向を決め、シグナル確定足終値または次足始値で入り、10本保有（再発なら延長）。ストップなし。2010-04-01～2011-04-13、約630,000観測、ルール別0～22,459取引。コスト前は平均リターン基準26/83、Sharpe基準27/83が有意だったが、片道5bpとデータスヌーピング補正後は83ルール・最大24,232組合せすべてが買い持ちを上回れなかった。勝率/PF/OOSなし。[論文・詳細](https://studylib.net/doc/28072047/ssrn-2125889) **Grade A**（Quantitative Finance査読）。Pine：**partial**―個別ルールは実装可能だが、全銘柄横断検定は困難。DJIA固定構成によるサバイバーシップ、同一標本での選択リスクあり。小売コストには明確に耐えない。

- **Market Intraday Momentum** — SPY、30分区間（5/15分足から集約可能）。前日終値→当日10:00のリターンが正なら15:30にロング、負ならショート、16:00決済。ストップ・追加フィルターなし。1993–2013の全営業日（約5,000取引）、年率6.67%、標準偏差6.19%、Sharpe 1.08、OOS \(R^2\) 1.4%；勝率/PF未報告。取引コスト後も有意と報告し、他10 ETFにも確認。[JFE論文](https://www.sciencedirect.com/science/article/pii/S0304405X18301351) **Grade A**。Pine：**yes**。SPY自体のサバイバーシップは小さいが、ETF横断選択と2013年以降の劣化が未確認。流動性の高いSPYならコスト耐性は一応 plausible。ただし引け約定のスリッページを再検証すべき。

- **5分ORB＋Relative Volume** — 約7,000米国株。最初の5分が陽線なら高値に買いストップ、陰線なら安値に売りストップ。価格>$5、14日平均出来高≥100万株、ATR>$0.50、初動出来高÷過去14日同時刻平均≥1、上位20銘柄のみ。損切りは約定値から14日ATRの10%、未決済なら16:00手仕舞い。2016–2023、勝率48.4%、総収益1,637%、年率41.6%、Sharpe 2.81、MDD 12%；PF・取引数・OOSなし。手数料$0.0035/株のみ。[研究](https://www.wealth-lab.com/api/discussion/download/pdf/8007-ssrn-4729284-1-pdf)、[再実装コード](https://www.quantconnect.com/research/18444/opening-range-breakout-for-stocks-in-play/) **Grade B**。Pine：**partial**―単一銘柄ロジックは可能だが、7,000銘柄ランキングは不可。CRSPは上場廃止を含みサバイバーシップ対策済みだが、フィルター選択・OOS欠如・スプレッド/スリッページ無視が重大。狭い0.1ATRストップなので、小売約定後も同成績が残るとは考えにくい。

- **MNQ 25分ORB** — MNQ、5分足、09:30–09:55 ETレンジ突破を次足始値で追随し、15本後に時間決済（固定ストップなし）。2021–2025、947日、ロング447件：勝率55.5%、平均純益+2.82pt、t=1.50。年別は−1.42/+2.43/+7.04ptで不安定。2pt往復コスト、拡張窓walk-forward済み。ショート428件は損失。[arXiv](https://arxiv.org/pdf/2605.04004) **Grade B**。Pine：**yes**。単一先物・短期間・連続限月処理のリスクあり。有意性・年次安定性を満たさず、小売コスト後の確立したエッジではない。

- **Heikin-Ashi色転換＋EMA50** — 15分、掲載名はHSIだが本文にNQとの矛盾あり。HA陽線・下ヒゲなし・実価格>EMA50で買い、逆で売り。ATRストップ/トレーリング/目標とするが倍率・セッション未開示。494件、勝率41.9%、PF1.12、Sharpe 0.76、$4.50往復＋1tick、walk-forward/Monte Carloを「主張」。[掲載ページ](https://pinescriptforge.com/hsi/heikin-ashi-trend/backtest) **Grade C**。Pine：**partial**―ルール欠落で再現不能。PF1.12は誤差と追加スリッページで消える水準で、信頼できるエッジとは扱えない。
