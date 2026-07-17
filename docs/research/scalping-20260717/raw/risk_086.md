# Research: Slippage Models for Market vs Limit Entries in Scalping Backtests

**topic_id**: risk_086  
**family**: risk  
**date**: 2026-07-17  
**question**: Slippage models for market vs limit entries in scalping backtests: recommended assumptions.

---

結論：市場成行と指値を同じ約定モデルで扱うべきではない。今回確認できた候補にGrade Aはなく、最良でも詳細な未査読研究のGrade Bだった。

推奨約定仮定：

- 成行：シグナル確定バーではなく次バー始値で約定。片道コストを「手数料＋半スプレッド＋追加スリッページ／市場インパクト」とする。板データがなければ通常時と2倍コストのストレスケースを併記する。MNQなら後述研究の往復2.0ポイントを最低基準、3–4ポイントも試す。SPYの実弾1,000件超・想定元本5,000万ドルの実験では、予定分足始値に対する平均スリッページは$0.001/株だったが、極めて流動性の高いSPY固有の下限値である。[原論文](https://concretumgroup.com/wp-content/uploads/2026/02/Beat-the-Market.pdf)
- 指値：「高値・安値がタッチ＝全量約定」は禁止。最低1ティック、ストレス時2ティックの価格通過を要求し、未約定なら取引自体を飛ばす。可能なら板前方数量と実取引量から約定率を推定する。TY先物の1,683指値では約1/3が未約定、約定後ドリフトは−0.45ティック。別実験でも不利な約定がES 767/941、NQ 1269/1929、CL 518/625、ZN 199/224だった。[Negative Drift](https://arxiv.org/pdf/2407.16527)、[Adverse Selection Simulation](https://arxiv.org/pdf/2409.12721)
- Pine v6：`use_bar_magnifier=true`、`backtest_fill_limits_assumption=1–2`を使い、同一バー内でストップと利確が両方触れた場合は不利側を採用する。TradingView自身も、単なる指値到達では実市場の約定を保証できないとしている。[公式仕様](https://www.tradingview.com/pine-script-docs/concepts/strategies/)

候補1 — SPY Noise-Area Intraday Momentum（Grade B）。市場SPY、1分データ、売買判定30分間隔。過去14日について同時刻までの始値からの絶対変動を平均し、当日始値・前日終値で調整した上下境界を作る。HH:00/HH:30で上抜けなら成行買い、下抜けなら売り。ロングは価格が`max(上側境界,VWAP)`を下回れば退出、ショートは`min(下側境界,VWAP)`を上回れば退出、残りは16:00決済。2007–2024、7,668取引、取引勝率37%、平均$0.09/株、総収益1,985%、Sharpe 1.33、MDD 25%、PF未報告。手数料$0.0035/株、スリッページ$0.001/株；市場インパクトモデルでもSharpe 1.17。ただし独立OOSなしで、出口改良も同一標本内。流動性の高いSPYではコスト後存続は「 plausible だが未証明」。Pine：1分足はYes、5–15分足で完全再現はPartial。[論文](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172)

候補2 — 5分ORB＋Relative Volume（Grade B）。米国株7,000銘柄超。価格>$5、14日平均出来高≥100万株、ATR>$0.50、最初の5分出来高が14日同時区間平均以上、その上位20銘柄。最初の足が陽線なら高値に買いストップ、陰線なら安値に売りストップ。損切りは約定値から14日ATRの10%、16:00全決済。2016–2023、勝率48.4%、総収益1,637%、Sharpe 2.81、MDD 12%；取引数・PF・OOSなし。上場廃止銘柄を含みサバイバーシップは抑制されているが、同一期間でフィルターを発見し、スプレッド／スリッページ未計上。寄付きの高RV個別株では小売コスト後の存続は疑わしい。Pine：単一銘柄はYes、全市場上位20選別はNo、総合Partial。[論文](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284)

候補3 — MNQ 25分ORB（否定結果、Grade B）。5分足、RTH 09:30–16:00。09:30–09:55の高安を確定し、終値でブレイク確認後、次バー始値で進入；15バー後退出、固定ストップなし。2021–2025の947日を拡張窓OOS検証。ロング447件、勝率55.5%、往復2ポイント控除後+2.82ポイント、T=1.50；年別−1.42、+2.43、+7.04と不安定。ショート428件、勝率47.7%、−2.16ポイント。PF未報告。現実的コスト後の堅牢なエッジなし。Pine：Yes。[論文](https://arxiv.org/pdf/2605.04004)
