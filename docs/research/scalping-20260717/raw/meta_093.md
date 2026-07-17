# Research Topic: meta_093

**Topic ID**: meta_093  
**Family**: meta  
**Date**: 2026-07-17  
**Question**: Audited/verified track records of profitable scalpers: what instruments and styles do they actually trade?

---

結論：公開資料には「監査済み個人口座」と「完全な売買規則」が同時に揃う成功例はほぼない。取引所記録で確認できる勝者と、公開バックテストの戦略は分けて評価すべきである。

台湾証取の全取引記録（1992–2006年、年平均約45万人）では、費用控除後の勝者は約20%。前年上位500人は翌年も下位群を日次60bp超上回った。勝者は少数銘柄へ集中し、空売りを使い、小型・高ボラ株や決算期の短期変動を素早く予測した。受動注文比率はやや高いが、最上位者の注文の64%以上は積極注文だった。つまり実績から見えるスタイルは「スプレッド取り」より、情報イベントへの高速反応である。ただし具体的 entry/exit は非公開。[Journal of Financial Markets](https://faculty.haas.berkeley.edu/odean/papers/day%20traders/The%20Cross-Section%20of%20Speculator%20Skill.pdf)

1. **引け前30分モメンタム（証拠A）**  
市場：62先物（株価指数17、国債16、商品21、通貨8）、1974–2020。時間軸：1分集計、30分保有。Entry：各市場の引け30分前、前日終値から現在までのリターンが正なら買い、負なら売り。Exit：当日引け。Stopなし。通常取引時間のみ、各資産クラス等金額。株価指数では年率6.86%、Sharpe 1.73、勝率55%；国債2.16%/1.62/55%、商品4.34%/1.42/56%、通貨0.85%/0.87/53%。前後半サブサンプルと予測OOS検証あり。PF・取引数は未報告。表の成績は費用前で、ESは片道・往復の定義に注意しつつ「1 tick費用後も正のSharpe」とだけ報告。一般小口の手数料込みでは余裕は縮む。[JFE論文](https://www3.nd.edu/~zda/intramom.pdf) Pine v6：**Yes**。1–15分足から30分前判定と引け決済を再現可能。

2. **SPY Noise-Band＋VWAPモメンタム（証拠B）**  
市場：SPY、1分、2007–2024。各時刻の「寄付からの絶対騰落率」を過去14日同時刻で平均。上限＝max（当日始値、前日終値）×(1+平均)、下限＝min(...)×(1−平均)。HH:00/HH:30に上限外なら買い、下限外なら売り。Long stop＝max（現上限、VWAP）、Short stop＝min（現下限、VWAP）；同じ30分刻みで判定、16:00全決済。7,668取引、取引勝率37%（日次43%）、総収益380%、年率9.7%、Sharpe 1.24、MDD 12%。動的2%ボラ目標・最大4倍版は1,985%、年率19.6%、Sharpe 1.33、MDD 25%。PF未報告。$0.0035/株＋$0.001/株slippage込みだが、真のOOSなし、パラメータ追加後の同一期間再評価なので過剰適合リスク大。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf) Pine：**Yes**。ただし約定価格と動的レバレッジは近似。

3. **5分ORB＋Stocks-in-Play（証拠B）**  
市場：約7,000米国株、2016–2023。最初の5分足が陽線なら高値stop-buy、陰線なら安値stop-sell。価格>$5、14日平均出来高>100万株、ATR>$0.50、寄付5分相対出来高≥100%の上位20銘柄。Stop＝entry±日足ATRの10%；利確なし、16:00決済。勝率48.4%、総収益1,637%、年率41.6%、Sharpe 2.81、MDD 12%；取引数・PF・OOS未報告。上場廃止銘柄を含み生存者偏向は抑制したが、同一標本でフィルター選択。手数料$0.0035/株のみでspread/slippageなし。高ボラ個別株ゆえ、小口でも公表edgeが残るとは判断できない。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/A-Profitable-Day-Trading-Strategy-For-The-U.S.-Equity-Market.pdf) Pine：**Partial**。単一銘柄は可能だが、7,000銘柄横断ランキングは不可。

4. **ICT Cameron NQ scalp（証拠A、否定結果）**  
1H/15mの旧高安を目標、逆方向の5m swing sweep、30秒FVGへの戻りでentry。Baseは最大12pt stop・1R利確；高RR版はdisplacement swing stop、構造目標1.5–5R。費用0.25pt往復。短期ISでは高RR版PF 1.68・618取引だったが、2022–2025 OOSでは7,138取引、勝率22.9%、PF 0.95、−3,271pt。Baseも11,391取引、PF 0.81。典型的な選択・短期標本過適合であり、低い想定費用でも失敗した。[コード＋tick data](https://github.com/hindsight-finance/ict-cameron-scalp-model) Pine：**No**（1–15分足）。30秒FVGとtick順序が不可欠。

総合すると、最も堅い正の証拠は「流動性の高い先物を引け前だけ追随」。純粋な数秒～数分スキャルピングは、現実的費用とOOSを通すと証拠が弱いか負である。
