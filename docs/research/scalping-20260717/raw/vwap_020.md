---
topic_id: vwap_020
family: vwap
date: 2026-07-17
question: Public GitHub repositories with reproducible VWAP intraday backtests and published results
---

# VWAP Intraday Scalping — Research Findings

厳格に検索した結果、条件を十分満たす公開GitHubはほぼ1件でした。多くはコード・元データ・OOSのいずれかが欠けています。

1. **BTCUSDT VWAP trend**

市場・時間足：Binance BTCUSDT perpetual、15分足、2024–2025年。  
ルール：終値が当日VWAP超なら100%ロング、下ならフラット。明示的なstop/targetなし。日次VWAPリセットの時刻は要確認。  
結果：+19.7%、Sharpe 0.84、最大DD −12.1%、勝率49%、1,304取引。Binance先物手数料＋片道2bp slippage込み。PF・OOSなし。  
出典：[方法・コード・結果](https://www.manifoldbt.com/strategies/vwap-strategy-python)、[GitHub](https://github.com/Jimmy7892/manifoldbt)  
評価：**A（最も再現可能）**。公開Binanceデータを取得する実行コードがある。ただし結果自体が「illustrative」とされ、資金調達料、別期間・別銘柄検証がない。単一BTCなのでsurvivorshipは小さいが、期間選択リスクあり。モデル化コスト後もプラスなので小口では残存可能性があるが、Sharpe 0.84は強い証拠ではない。Pine v6：**Yes**。日次アンカー時刻と先物手数料を明示すれば実装容易。

2. **VWAP Trend Trading（QQQ/TQQQ）**

市場・時間足：QQQ/TQQQ、1分足、2018-01–2023-09、RTH。  
ルール：9:31の終値がVWAP上ならロング、下ならショート。その後、1分終値がVWAPを反対側へ抜けるたび即反転。15:59/16:00に手仕舞い、常時100%資金投入。固定stop/targetなし。  
原論文結果：QQQは21,967取引、勝率17.0%、平均利益/損失5.67、総収益671%、Sharpe 2.1、DD 9.4%。手数料$0.0005/株、slippageなし。TQQQは22,399取引、勝率17.2%、総収益8,242%、DD 36.1%。  
出典：[SSRN系working paper](https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf)、[公開QuantConnect再実装](https://www.quantconnect.com/terminal/cache/embedded_backtest_acf328725ee542884ccb12ed0be5d316.html)  
評価：**B**。査読済みではなく、原データ・MATLABコード非公開、OOSなし。さらにQuantConnectの変更版は30,045注文、勝率22%、−66.2%、Sharpe −0.16と失敗しており、時間帯・約定実装への極端な感応性を示す。ETF消滅バイアスはないが、QQQ/TQQQ選択と期間選択が強い。原論文自身も高い手数料で有効性低下と認め、retail spread/slippage後の生存は未確認。Pine v6：**Yes**。

3. **Opening-drive Anchored VWAP retest**

市場・時間足：NQ/ES/YM/RTY、5分足、2024年RTH。  
ルール：最初の30分の最高値バーからVWAPをアンカー。10バー傾きが正なら、価格がVWAP±0.1%へ戻った時ロング、負ならショート。TP 0.5%、stop 0.3%、最大30バー、引け決済、再エントリーなし。  
結果：NQ 505取引、勝率50.69%、PF 1.21、Sharpe 1.83、DD 8.66%；ES 519取引、50.48%、PF 1.29、DD 7.62%。「realistic slippage」と手数料込みだが算式非公開。YMはPF 0.98。  
出典：[方法](https://www.fractiz.com/strategies/anchored-vwap/)、[NQ結果](https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/)、[ES結果](https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-es-5m-2024/)  
評価：**B**。コード・データ・OOSなし。同年・同パラメータの複数市場検証は有益だが、最良anchorを同じ2024年から選んでおり過剰適合。PF 1.2前後は摩擦推定誤差で消え得る。Pine v6：**Yes**。

4. **QQQ VWAP–RSI pullback**

市場・時間足：QQQ、5分足、2024-01–2025-06。  
ルール：9:45以降、VWAP上/下に3連続終値。VWAP接触＋RSI(2)<25/>75後、次の陽線/陰線で入る。stop 1.5ATR、targetは前日高安（既突破なら2ATR）。15:00以降なし、各方向1回。  
結果：312取引、勝率52.6%、PF 1.54、+$11,230。$0.02/株/片道込み。事後抽出した9:45–11:30は186取引、勝率62.4%、PF 2.08；以後はPF 0.69/0.53。  
出典：[詳細方法・結果](https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest)  
評価：**B**。コード・データ・OOSなし。朝枠は同一標本から発見されており、強いmultiple-testingリスクがある。元ルールPF 1.54は高めの株式手数料後なので小口で残る可能性はあるが、spread/slippage未計上。Pine v6：**Yes**。

総括：**OOS付きA級GitHub証拠は見つからない**。最も重要な所見は、単純VWAP反転が実装差で大幅利益から破産級損失まで変わること、PF 1.2級の先物結果は摩擦誤差に弱いこと、PF 2超の朝枠は未検証の事後選択だという点である。
