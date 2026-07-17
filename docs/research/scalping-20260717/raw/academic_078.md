---
topic_id: academic_078
family: academic
date: 2026-07-17
question: Limit-order-book predictability research: horizon, decay, and retail replicability
---

LOB予測力は実在するが、主な有効期限は「次の価格変化」から数秒未満である。115銘柄を調べた研究でも、有効ホライズンは平均約2回の価格変化までだった。したがって、1–15分足へ集約すると大半の情報が消える。[Kolm et al.](https://onlinelibrary.wiley.com/doi/10.1111/mafi.12413)

1. **最良気配Queue Imbalance方向売買 — Nasdaq株**

- ルール：\(I=(V_{bid}-V_{ask})/(V_{bid}+V_{ask})\)。ロジスティック回帰の上昇確率が50%超なら買い、未満なら売り、次のmid-price変化で決済（これは分類器を売買へ直訳したルールで、論文自体は売買検証していない）。ストップ・時間帯フィルターなし。
- 証拠：2014年、流動性上位10銘柄、各25,200標本。80/20ランダム分割、OOS 5,040標本/銘柄。OOS AUCはlarge-tick株0.70–0.80、small-tick株0.60–0.65。勝率、PF、PnL、コストは未報告。[論文](https://arxiv.org/abs/1512.03492)
- 評価：**B**。ランダム分割なので時系列OOSとして弱い。銘柄選択・単一年・large-tick優位による選択バイアスあり。1 tickを取る前にスプレッドを払うため、成行往復では小口でも採算性は立証されず、おそらく負。
- Pine v6：**不可**。履歴L1キュー数量もイベント単位の次価格変化も取得できない。

2. **DeepLOB反転売買 — LSE大型株**

- ルール：過去100 LOB更新×10階層をCNN-LSTMへ入力。Upならロング、Downならショートし、反対シグナルで反転。終日ポジションを持ち越さず16:00までに決済、08:30–16:00のみ、オークション除外。ストップなし。
- 証拠：2017年の5銘柄、約1.34億LOB更新、6か月学習・3か月検証・3か月OOS。報告精度は20/50/100更新先で70.17%/63.93%/61.52%。簡易売買の平均利益は−0.01～0.03 GBX/取引、中央値約0.01 GBXだが、典型スプレッド約0.1 GBX、手数料ゼロ・mid約定仮定。PF、勝率、取引数は未報告。[IEEE論文](https://www.oxford-man.ox.ac.uk/wp-content/uploads/2020/03/DeepLOB-Deep-Convolutional-Neural-Networks-for-Limit-Order-Books.pdf)、[公式コード](https://github.com/zcakhaa/DeepLOB-Deep-Convolutional-Neural-Networks-for-Limit-Order-Books)、[コスト検証](https://www.mdpi.com/2227-7390/10/8/1234)
- 評価：**A**（査読済み。ただしLSEデータ非公開）。スプレッドだけで中央値エッジの約10倍なので、現実の小売約定では明確に負。モデル・閾値・銘柄選択の過適合、単一年レジーム、非公開データによる再現性リスクあり。
- Pine v6：**不可**。LOB10階層・イベント列・学習済みニューラルネットを利用できない。

3. **Imbalance-aware at-touch market making — Nasdaq 11株**

- ルール：同じ\(I\)を5状態、スプレッドを2状態に離散化し、最適制御が許可する側で最良bid/askへ指値。最大在庫\(|q|\le50\)。30分区間終了時に残在庫を成行清算。寄付・引け区間を除く1日11区間、価格ストップなし。
- 証拠：2014年6/7–12月、125日×11区間/銘柄。保守的なキュー約定確率を使った年率Sharpeは、在庫罰則\(10^{-5}\)で11銘柄中10銘柄が正、範囲−3.18～12.17。勝率、PF、手数料は未報告。[査読論文・Table 7](https://ora.ox.ac.uk/objects/uuid%3A006addde-3a03-4d75-89c1-04b59026e1c0/files/me4008e0ecca779b45d59231ebca3e69c)
- 評価：**A**だが、シミュレート約定、手数料・遅延不足、パラメータ横断比較、単一年・選択銘柄のため過適合懸念が強い。小売のキュー順位とレイテンシでは生存性は疑わしい。
- Pine v6：**不可**。DOM、キュー順位、キャンセル再発注を再現できない。

結論：LOBは予測可能だが、検証されたエッジはバー取引より低遅延執行の領域にある。1–15分Pine戦略として小売再現可能な、コスト込み高品質エビデンスは見つからない。
