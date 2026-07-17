# Research: levels_026

**Topic ID:** levels_026  
**Family:** levels  
**Date:** 2026-07-17  
**Question:** Objective support/resistance retest entries: any rigorously quantified studies?

---

## Analysis

結論：客観的なS/R再試験に関する強い証拠は乏しく、再現性の高い結果ほど否定的です。有望に見えるものも、独立OOS検証を欠きます。

- **Opening-range "Touch and Turn" fade — Grade B**  
  市場：米大型株10銘柄・米指数CFD4種、1分足、2022–2025。最初の15分足が前14日ATRの25%以上なら、陰線時にレンジ安値で買い、陽線時に高値で売る。開始後90分以内のみ。利確はレンジ内38.2%、損切り幅は2:1の利益/損失比になる位置。同一足で両方到達なら損切り優先、往復2bp。5,119取引すべての銘柄が赤字。株式PF 0.67–0.85、指数PF 0.66–0.74、勝率27.6–34.5%。OOSなし。現在も流動的な銘柄だけなのでサバイバー・選択バイアスあり。ただし、その有利な選択でも失敗したため否定結果は重い。小売コスト後の生存可能性：**ほぼなし**。[方法・全結果・スクリプト](https://whatdoesntwork.com/research/opening-range-touch-turn-scalper/)  
  Pine v6：**Yes**。ATR、時間帯、指値、保守的な同一足処理まで実装可能。

- **DAX ORB breakout–retest–continuation — Grade B**  
  DAX CFD。開始15分レンジを終値で突破後、60分以内に旧レンジ端±5ptへ戻り、再度外側で終値確定＋反応足確認して順張り。探索範囲はOR 15/30分、許容3/5/8pt、突破後最大伸長0.5/1/1.5R。SLはレベル外最低10pt、BE・時間・セッション終了決済。ただしTP/BEの完全な数値仕様は非公開。0.5ptスリッページ込み：基準64取引、勝率20.3%、PF 0.51、−330pt、90% PF区間0.25–0.85。浅い再試験でも60取引・PF 0.45。2026年3–6月のみ、OOSなし。18組を事前登録した点は良いが標本が極小。小売コスト後：**明確に不可**。[研究票](https://warchhold.com/algostrategien/research/build/2026-06-15_dax_orb_retest)  
  Pine：**Partial**。入口は実装可能だが、完全な出口仕様が不足。

- **Inverse floor-pivot continuation — Grade B**  
  EUR/USD・USD/CHF（tick、各152日）、GBP/JPY（1分、3,839日）。前日HLCからP、S1–S3、R1–R3を算出。通常型はS接触で買い/R接触で売り、逆型は反対。各レベル1日1回、TP/SLは接触価格から対称に±x%P。GBP/JPY、x=0.01%では通常勝率34.2%、したがって逆型65.8%、平均保有22分、コスト前の機械的PF約1.92。x=0.15%では逆型56.6%、推定粗PF約1.30、保有2–3時間。ところがmid-price約定、スプレッド・手数料なし、OOSなし、勝敗クラスタリングも有意。0.01%幅は小売FXスプレッドでほぼ消える。x=0.15%も未証明。[Lund修士論文PDF](https://lup.lub.lu.se/student-papers/record/8979805/file/8979814.pdf)  
  Pine：**Yes**。

- **Opening-drive anchored VWAP retest — Grade B**  
  NQ/ES/RTY/YM、5分足、2024。最初の30分の最高値バーをanchorとし、AVWAPの10本傾き方向へ、終値がAVWAP±0.1%へ戻ったら入る。RTHのみ。TP 0.5%、SL 0.3%、30本時間決済。手数料$2.75/注文とスリッページ込み。NQ：505取引、勝率50.69%、PF1.21、Sharpe1.83。ES：519、50.48%、PF1.29、Sharpe2.32。RTY PF1.20、YM PF0.98。単年・設定選択後の結果でOOSなし、コード/データ非公開。小売コストは既に一部反映され、**候補中唯一 plausibly viable**だが、独立期間での確認前は採用不可。[NQ詳細](https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-nq-5m-2024/)  
  Pine：**Yes**。

強い事前確率として、査読研究はRUB/USDの10年tickデータで8,000超のテクニカル規則をSPA補正し、実測bid–askを入れると利益の大半が消えたと報告しています（Grade A）。[Finance Research Letters](https://www.sciencedirect.com/science/article/pii/S1544612316300587)

総評：AVWAP以外は否定またはコスト前だけの効果です。次に検証するなら、AVWAPルールを固定し、2021–2023を完全OOS、複数先物・実spread・翌足約定で再試験するのが妥当です。
