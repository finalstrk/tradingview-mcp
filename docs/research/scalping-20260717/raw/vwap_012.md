# VWAP First Touch After Open: Directional Statistics and Tradability

**topic_id**: vwap_012  
**family**: vwap  
**date**: 2026-07-17  
**question**: First touch of VWAP after the open: directional statistics and tradability

---

結論：寄り後の「VWAP初回接触」限定で、コスト込み・アウト・オブ・サンプル（OOS）まで備えたGrade A証拠は見つからない。公開結果は弱いか、条件探索後の数字である。現時点では売買エッジではなく、検証候補と扱うべきである。

1. QQQ・初回VWAPプルバック

- 市場/足：QQQ、5分足。
- ルール：上向きVWAPかつ価格が上側→VWAP接触/貫通→次足が上で確定して買い。売りは反転。ストップ＝接触足安値/高値、利確＝2R。9:45–15:30 ET。
- 結果：全プルバック938件、勝率56.4%、PF1.69、平均+$0.34。寄り付き時間帯の「initial pullback」は勝率68.4%だが件数非開示。
- 証拠：[詳細手法](https://tosindicators.com/research/what-moving-average-pullback-is-best-for-qqq-5-min-chart)、Grade B。
- Pine v6：Yes。
- 評価：実際のテストは初回限定でなく1日3–4回。スリッページ、手数料、OOSなし。68.4%は時間帯を事後選択した可能性が高く、実売買根拠として弱い。

2. QQQ・RSI付き朝VWAPリクレイム

- 市場/足：QQQ、5分足。
- ルール：9:45以降VWAP上で3本連続確定→VWAP接触かつRSI(2)<25→次の陽線がVWAP上で確定して買い。ストップ＝VWAP−1.5ATR、利確＝前日高値または既に突破済みなら+2ATR。売りは逆。
- 条件：9:45–11:30 ET。
- 結果：朝186件、勝率62.4%、PF2.08、+$17,190。全時間312件、52.6%、PF1.54、+$11,230。昼74件PF0.69、午後52件PF0.53。
- 証拠：[18か月バックテスト](https://pinegen.ai/resources/pine-script-user-case-studies/vwap-pullback-strategy-qqq-backtest)、Grade B。
- Pine v6：Yes。
- 評価：初回限定の明記なし。手数料・スリッページ・OOSなし。朝枠、RSI閾値、3本条件を同一期間で選んだデータスヌーピング疑惑が強い。PF2.08ならQQQの通常コストを吸収し得るが、現状は未確認。

3. 株価指数先物・VWAP傾斜方向プルバック

- 市場/足：NQ、ES、YM、5分足、2024年。
- ルール：10本前比でVWAP上向きならVWAP±0.15%帯で買い、下向きなら売り。TP 0.50%、SL 0.30%、最大30本、16:00手仕舞い。
- 結果：NQ 565件、49.20%、PF1.11；ES 605件、49.09%、PF1.08；YM 583件、45.80%、PF1.01。
- 証拠：[Fractiz](https://www.fractiz.com/strategies/vwap-pullback/)、Grade B。
- Pine v6：Yes。
- 評価：初回限定でなく、単年内のパラメータ探索。先物ロール方法とコスト開示も不十分。PF1.01–1.11は小売手数料、1ティック以上のスリッページで消える可能性が高い。

4. VWAPクロス常時反転（近接する学術的比較対象）

- 市場/足：QQQ/TQQQ、1分足、2018–2023。
- ルール：9:31にVWAP上なら買い、下なら売り。終値がVWAP反対側へ移るたび反転し、16:00手仕舞い。
- 結果：QQQ 21,967件、勝率17.0%、平均利益/損失5.67、手数料後+671%、Sharpe 2.1、最大DD9.4%。PF非開示、OOSなし。
- 証拠：[SSRN原稿](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4631351)、Grade B（査読誌ではない）。
- Pine v6：Yes。
- 評価：約1,300万株の回転に対し手数料のみで、スプレッド/市場インパクトなし。TQQQでは約8億株という非現実的な複利規模。初回接触の証拠ではない。

反証として、公開Binanceデータ・片道0.06%費用のVWAPプルバックは、5分足9,124件で勝率11.7%、PF0.22、15分足3,097件で15.1%、PF0.37となり、ともに資金をほぼ全損した。[OOS・パラメータ検証](https://strategyverdict.com/verdicts/)でも利益は4時間足だけだった。Grade B、Pine実装Yesだが1–15分ではNo-trade判定が妥当である。

総合すると、QQQ単一銘柄、2024年先物、現存する大型株・主要暗号資産はいずれも銘柄選択/生存者バイアスがある。最も有望な「朝QQQ」も未検証の条件探索結果であり、現段階で実弾投入を支持できない。
