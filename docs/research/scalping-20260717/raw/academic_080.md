# Academic Retail Day-Trader Profitability: Base Rates & Implementable Logics
**Topic ID**: academic_080  
**Date**: 2026-07-17  
**Research Question**: Academic studies of retail day-trader profitability base rates (Brazil/Taiwan studies): honest numbers. Find concrete intraday/scalping logic with quantified evidence (win rate, profit factor, sample size, costs, out-of-sample).

---

ベースレートは厳しい。

- ブラジル：新規19,646人のmini-Ibovespa先物トレーダーを追跡。300日超継続した1,551人では、手数料控除後97%が損失、最低賃金超は1.1%、銀行員初任給超は0.5%。平均日次損益は−US$48.81で、経験による改善も確認されない。生存者だけを見てもこの結果である。[Chague et al.](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101)
- 台湾：1992–2006年、年平均約45万人。一定額以上取引した27.7万人の約20%は「その年」には費用控除後プラスだが、前年成績から翌年も予測可能に儲かるのは約4,000人、全体の1%未満。上位500人は翌年37.9bp/日（割引手数料想定）だが、これは公開テクニカルルールではなく、情報・銘柄特化能力らしい。[Barber et al.](https://www.sciencedirect.com/science/article/abs/pii/S1386418113000190)

## 具体的候補：

### 1. 終値30分モメンタム — SPY、30分足  
前日終値→10:00のリターンが正なら15:30にロング、負ならショート。16:00決済、ストップ・追加フィルターなし。1993–2013年の約5,200営業日（正確なN、勝率、PFは未報告）。年率平均6.67%、標準偏差6.19%、Sharpe 1.08、費用後約6.52%、OOS予測R² 1.4%。査読済みだが、R²は小さく後年・他市場の追試は混合。流動性の高いSPYなら費用耐性は一応 plausible。Evidence A。[Gao et al.](https://www.sciencedirect.com/science/article/abs/pii/S0304405X18301351) Pine v6：Yes。1–15分足から時間帯リターンを集計可能。

### 2. KOSPI終盤共同シグナル — KOSPI、30分  
オーバーナイト、第二30分、引け前第二30分の3リターンが全て正なら最終30分ロング、全て負ならショート、符号不一致は見送り。引け決済、ストップなし。2004–2016年、3,087日。772取引、勝率58.8%、報告リターン16.77%、Sharpe 0.167、PFなし、OOSなし。ロング限定は482取引、勝率66.81%、27.2%、Sharpe 0.291。スプレッドを推計しただけで実売買コストを損益から厳密控除せず、現物指数自体も売買不能。Edge surviving costsは未証明。Evidence A。[Tsai et al.](https://www.mdpi.com/1911-8074/15/11/523) Pine：Partial（指数シグナルを先物等へ移すベーシス問題）。

### 3. 5分ORB＋相対出来高 — 米国株、5分  
9:30–9:35足が陽線なら高値ブレイク買い、陰線なら安値ブレイク売り。14日ATRの10%をストップ、16:00決済。価格>$5、14日平均出来高>100万株、ATR>$0.50、初動RVOL≥1、当日RVOL上位20銘柄。2016–2023年、約7,000銘柄、勝率48.4%、年率41.6%、Sharpe 2.81、MDD12%、総収益1,637%。取引数・PF・OOSなし。上場廃止銘柄込みでsurvivorship biasは抑制。ただし全期間でRVOL・5分・ATRストップを選択しており過適合リスク大。$0.0035/株の委託料のみで、スプレッド、滑り、空売り調達費なし。実売買での存続は疑わしい。Evidence B。[Zarattini et al.](https://alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content) Pine：Partial（単一銘柄は可能、全市場RVOL上位20の選別は不可）。

### 4. SPY Noise-Area Momentum — SPY、1–30分  
過去14日の同時刻までの絶対騰落率で上下バンドを作り、HH:00/HH:30に上抜けロング・下抜けショート。ロングはmax（上側バンド、VWAP）、ショートはmin（下側バンド、VWAP）を半時間ごとにストップ判定、引け決済。2007–2024年、7,668取引、取引勝率37%、平均$0.09/株、年率19.6%、Sharpe 1.33、MDD25%、PF・独立OOSなし。手数料$0.0035＋滑り$0.001/株を含むが、反復改良・非公開コードなので過適合が重大。SPY限定なら費用後存続は候補中最も plausible だが未確証。Evidence B。[論文PDF](https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf) Pine：Yes。

---

## 結論

公開証拠から「小口個人が再現可能」と強く言えるA級スキャルピング手法はない。最も堅い発見は、利益者の存在よりも、持続的利益のベースレートが1%未満という否定的結果である。
