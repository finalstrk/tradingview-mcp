# VWAP Slope and Price-Position as Intraday Regime Filter

**Topic ID**: vwap_015  
**Family**: vwap  
**Date**: 2026-07-17  
**Research Question**: VWAP slope / price-above-below-VWAP as a regime filter: measured effect on intraday strategies

---

結論：VWAPの方向・傾きには条件付きの情報価値が見えるが、独立OOS、現実的コスト、再現可能な約定記録まで揃った証拠はほぼない。「単独で強いレジームフィルター」とはまだ言えず、特に5分足ではPF 1.0–1.2程度の脆弱な結果が多い。

- **VWAP Trend Trading** — QQQ/TQQQ、1分足。9:31の終値がVWAP上なら次足でロング、下ならショート。その後、反対側で1分足が確定するたび決済・反転し、16:00強制決済。RTH限定、VWAPは9:30リセット、常時100%資金投入。2018-01～2023-09、QQQ 21,967取引、勝率17.0%、平均利益/損失5.67、推計PF約1.16、総収益671%、Sharpe 2.1、MDD 9.4%。TQQQ 22,399取引、勝率17.2%、8,242%、Sharpe 1.7、MDD 36.1%。手数料$0.0005/株込みだがスリッページ・スプレッドはゼロ、OOSなし。[論文](https://concretumgroup.com/wp-content/uploads/2026/02/Volume-Weighted-Average-Price.pdf) **Grade B**（SSRN、非査読、コード・データ非公開）。Pine v6：**Yes**。ただし次足約定とRTHを厳密に実装する必要がある。QQQ/TQQQを上昇相場後に選んだ選択バイアス、巨大な複利売買量、約22,000回の往復が重大。小口QQQでも生存可能性は未確認、TQQQの公表成績は現実的リテールコストでは特に疑わしい。

- **VWAP Slope Pullback Continuation** — NQ/ES/YM/RTY、5分足。`VWAP[t]−VWAP[t−10]`が正なら、終値がVWAP±0.15%帯へ入った時ロング、負ならショート。利確+0.50%、損切り−0.30%、30本経過または16:00で決済。9:30–16:00 ET限定。2024年：NQ 565取引、勝率49.20%、PF1.11、Sharpe1.02、MDD13.56%；ES 605、49.09%、PF1.08；YM 583、45.80%、PF1.01；RTY 525、50.10%、PF1.29。[方法・結果](https://www.fractiz.com/strategies/vwap-pullback/) **Grade B**。Pine：**Yes**。コスト、連続先物ロール、データ、OOSの開示がなく、10本という最良値を2024年内で選択。PF1.01–1.11は通常の手数料＋1–2ティックで消える可能性が高い。RTYだけ比較的余裕があるが選択後報告の疑いが強い。

- **VWAP 0.60% Short Fade** — 同4指数先物、5分足。終値がRTH VWAPより0.60%以上ならショート。終値がVWAP以下へ戻る、エントリーから+0.40%逆行、30本、または引けで決済。2024年：NQ 79取引、勝率48.10%、PF1.00；ES 36、52.78%、PF1.20；YM 35、62.86%、PF2.01；RTY 147、41.50%、PF1.00。ロング側は全パラメータで正のセルなし。[結果](https://www.fractiz.com/strategies/vwap-fade/) **Grade B**。Pine：**Yes**。YMの35件は小標本で、2024年の上昇相場を見てショート専用化した明白なレジーム／過適合リスクがある。YM以外はコスト後にほぼ生存しない。

- **BTC VWAP Long/Flat** — BTCUSDT、15分足。終値>VWAPなら資金100%ロング、終値<VWAPならフラット。2024–2025、1,304取引、勝率49%、総収益19.7%、Sharpe0.84、MDD12.1%。Binance先物手数料＋固定2bpスリッページ込み、PF・OOSなし。[コードと設定](https://www.manifoldbt.com/strategies/vwap-strategy-python) **Grade A**（公開コードと公開データ取得手順。ただし掲載値自体は「illustrative」）。Pine：**Partial**—実装可能だが24時間市場のVWAPリセット時刻が未明示。コスト後プラスとの主張はあるが、単一の生存銘柄BTCを事後選択しており、独立再実行前には信用できない。

総合すると、最も再検証価値があるのは「傾き＋VWAPへの押し目」だが、現状のPFではリテール約定コストを超える確証がない。VWAPはエッジ本体というより、トレンド日とレンジ日を分ける候補特徴量として、固定ルールのオン／オフ差をウォークフォワードで測るべきである。
