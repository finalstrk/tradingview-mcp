# Research: vwap_014

**Topic ID:** vwap_014  
**Family:** vwap  
**Date:** 2026-07-17  
**Question:** Anchored VWAP based intraday strategies: any quantified backtests?

---

結論：定量バックテストは存在します。ただし、任意イベントに固定する「純粋なAVWAP」で高品質な学術証拠は見つかりませんでした。最も再現性が高い研究はセッション始値アンカーのVWAPで、現実的コスト適用後はエッジが大幅に弱まります。

1. VWAP Trend Trading（Grade A：独立再現コードあり）

- 市場・足：QQQ/TQQQ、1分足、RTH。
- ルール：9:30 ETからVWAPをリセット。1分足終値がVWAP上なら資金100%でロング、下ならショート。反対側で即反転。16:00前に全決済。固定SL/TPなし。
- 原報告：2018–2023、QQQ 21,967取引、勝率17%、平均利益/損失5.67、総収益671%、Sharpe 2.1、MDD 9.4%。手数料$0.0005/株、スリッページ・スプレッドゼロ。[SSRN論文](https://papers.ssrn.com/sol3/Delivery.cfm/4631351.pdf?abstractid=4631351&mirid=1)
- 独立LEAN再現：24,387注文、収益592.9%、Sharpe 1.754、MDD 9.1%、勝率17%。しかし固定パラメータの2023年9月以降OOSではSharpe約0.7、損益分岐コストは往復1bp未満で、通常のQQQ実効スプレッドを下回るとの感応度結果。[コード・バックテスト](https://www.quantconnect.com/terminal/cache/embedded_backtest_b115d0894231d55994b1068202f6c0ae.html)
- Pine v6：Yes。
- 評価：銘柄選択・公表前期間への適合、ゼロスプレッド仮定が重大。現実的な小売約定では生存しない可能性が高い。構成銘柄サバイバーシップより「QQQを成功後に選んだ」選択バイアスが問題。

2. Opening-drive peak AVWAP retest（Grade B）

- 市場・足：NQ/ES/YM/RTY、5分足、2024年。
- ルール：RTH最初の6本中の最高値バーをアンカー。AVWAPの10本傾きが正ならロング、負ならショート。終値がAVWAP±0.1%以内へ戻れば参入。TP 0.5%、SL 0.3%、最大30本、終値判定、EOD決済、9:30–16:00 ET限定。
- 結果：NQ 505取引、勝率50.69%、PF1.21、MDD8.66%；ES 519、50.48%、PF1.29；RTY 464、50.22%、PF1.20；YM 510、46.08%、PF0.98。手数料と「realistic」スリッページ込みだがモデル詳細なし。[方法](https://www.fractiz.com/strategies/anchored-vwap/)／[NQ結果](https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/)
- Pine v6：Yes。
- 評価：液体な先物では価格幅がスプレッドより十分大きく、コスト後にも残る可能性はある。しかし単年・同期間でアンカーを比較後に最良設定を選択しており、OOSなし。PF1.2前後は劣化余地が小さい。YMの失敗は市場横断頑健性の弱さを示す。

3. QQQ Morning VWAP–RSI Pullback（Grade B）

- 市場・足：QQQ、5分足、2024-01～2025-06。
- ルール：9:45以降にVWAP上（下）3連続終値。VWAPタッチ＋RSI(2)<25（>75）後、次の陽線かつVWAP上でロング（逆でショート）。SL 1.5ATR、TP前日高安（既に突破なら2ATR）。1日各方向1回。
- 結果：全312取引、勝率52.6%、PF1.54、+$11,230。9:45–11:30だけでは186取引、勝率62.4%、PF2.08；それ以降はPF0.69/0.53。$0.02/株/片道、スリッページ・スプレッドなし。[詳細](https://www.pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest)
- Pine v6：Yes。
- 評価：朝時間帯はコストを吸収し得るが、時間フィルターが同一標本から事後発見されており強い過剰適合リスク。OOSなし。

4. CPI-event AVWAP next-day continuation（Grade C）

- ES・15分足。CPI発表8:30 ETをアンカー。当日終値がAVWAP上/下なら翌日11:00に同方向、±25ポイントのTP/SL。
- 2022-12～2024-02、わずか11取引、利益約$4,600、Sharpe 0.42。勝率・PF・OOSなし、スリッページゼロ。[検証記事](https://scalpradar.com/blog/2024/3/backtesting-an-anchored-vwap-strategy/)
- Pine v6：Partial。CPI日程を手動入力する必要あり。
- 評価：サンプル不足でエッジとは判断不能。

総評：純粋なイベントAVWAPの証拠は弱く、現状の最良評価は「研究仮説としては有望だが、実運用可能な普遍的エッジは未証明」です。特にOOS、未調整パラメータ、実スプレッドを同時に満たす検証が不足しています。
