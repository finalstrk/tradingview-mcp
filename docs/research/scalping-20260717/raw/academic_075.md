# Research: FX Intraday Patterns Around Fixing Times (WM/R 4pm London)

**Topic ID:** academic_075  
**Family:** academic  
**Date:** 2026-07-17  
**Question:** FX intraday patterns around fixing times (WM/R 4pm London): academic evidence

---

結論：4pm Fix周辺の価格反転は学術的に確認されるが、現在のリテール向けスキャルピング利益としては弱い。最も強い論文も、顧客側のスプレッド控除後リターンは有意にマイナスとしている。

1. European-fix USD reversal — Grade A  
市場：G9対USD。5分データ、日次取引。

- ルール：外国通貨/USDを02:00 ETで売り（USD買い）、ECB Fix 08:15 ETで決済。16:00 Londonで外国通貨を買い（USD売り）、17:00 ETで決済。ECB–London間はノーポジション。
- ストップ：なし。時間決済。曜日・月末フィルターなし。
- 1999–2019、約5,300営業日。複合Europe戦略はEURで勝率56%、平均6.26bp/日、t=9.95、GBPは55%、4.95bp、t=7.96、等ウェイトG9は55%、3.51bp、t=7.03。PFは未報告。2014–2019には効果が明確に弱まった。正式な未使用OOSではないが、複数サブ期間・現物・先物・VWAPで方向性は再確認されている。
- 重要な否定結果：顧客市場の実効スプレッドを払う戦略はコスト控除後「有意にマイナス」。利益を得るのは主として流動性供給側。[Journal of Finance本文・複製コード](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13306)
- Pine v6：単一ペアなら可。DST対応の時刻指定が必要。ポートフォリオ版はpartial。
- リスク：現在の流動性上位通貨を遡及選択する軽いサバイバーシップ、公開後減衰、約2–6bpの薄いgross edge。リテールでは生存しない可能性が高い。

2. Month-end 5-minute Fix fade — Grade A  
市場：特にAUD/USD、CAD/USDほか21ペア。1/5/15分。

- 月末最終取引日、Fix直前5分の価格変化を測定。上昇してFixを迎えれば16:00で売り、下落なら買い。5分後決済。ストップなし。
- 2004–2013、約120月末（正確な戦略別Nは未掲載）。AUD/USD・5分は年率12.292%、Sharpe 4.353、最大DD 1.197%。CAD/USDは9.538%、3.450、1.041%。勝率・PF・OOSなし。コストは「Fixではゼロ、決済時に平均スプレッドの半分」のみ。[査読済み論文PDF](https://faculty.georgetown.edu/evansm1/wpapers_files/JBFrev1.pdf)
- Pine：partial。月末営業日判定と5分反転は可能だが、公式Fix価格で無コスト約定できず、2015年以降の5分FixもOHLCから正確に再現できない。
- リスク：21ペア×3時間幅から好成績ペアを選ぶ多重検定、操作疑惑前・制度変更前データ、真のOOSなし。主要4ペアはコスト感応度が高い。リテール約定では信頼できない。

3. S&P month-end hedge-flow momentum — Grade B  
市場：EUR/USD、GBP/USD、AUD/USD、USD/CAD。USD/JPYは逆方向。

- 月末最終日、月初来S&P 500が+2.5%超なら07:00 NYでUSD売り、−2.5%未満ならUSD買い。11:00 NY（London Fix）決済。範囲内なら取引なし。ストップなし。
- 2007–2022頃のEUR/USDで勝率62%だが、2018年以降は45%未満。PF、取引数、正式OOSなし。図表はコスト未控除。実運用5年黒字との記述は未監査。[詳細手法と劣化検証](https://www.spectramarkets.com/amfx/rip-month-end-models/)
- Pine：partial。SPX取得は可能だが、休日を含む「最終営業日」は手動カレンダーが必要。
- リスク：閾値と時刻が最適化済み、通貨選択も事後的。ヘッジの分散化という構造変化があり、著者自身が将来は概ね不採算と判断。現在のリテールedgeとは評価できない。

なお、OOS年率4.02%、Sharpe 3.43を掲げる別研究もあるが、公開ページから正確な売買規則・コスト・標本数を確認できないため、実装候補から除外した。[SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3069629)
