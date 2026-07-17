# meta_095 — Intraday/Scalping GitHub Reproducibility Research

**Topic ID**: meta_095  
**Family**: meta  
**Date**: 2026-07-17  
**Question**: GitHub repositories with reproducible intraday/scalping backtests including published results and data

---

結論：厳格な Grade A、すなわち「コード・使用データ・取引ログ・コスト・未使用OOS期間」が揃う GitHub リポジトリは見つからなかった。以下は検証価値のある候補だが、実運用可能なエッジが確立したとは言えない。

1. 20分ORB＋出来高確認

市場・足：米国株20銘柄、5分足、2016–2026。9:30–9:50の高安を範囲とし、10:00–11:30に、終値が高値／安値を突破し、出来高が同時刻平均の1.2倍以上なら次足で順張り。利確＝範囲幅0.75倍、損切り＝0.50倍、含益1範囲幅で建値ストップ、15:50決済、最大3銘柄。

4,292取引、勝率50.3%、PF 1.31、純益$30,989（元本$100k、1取引リスク$400）、CAGR 2.71%、Sharpe 2.47、最大DD 1.27%。$0.01/株スリッページ＋$0.005/株手数料、3倍スリッページにも耐えたとの報告。6か月学習／6か月WF後、固定パラメータで10年検証。[GitHub](https://github.com/sam-bateman/trading-orb)

Grade B。データは同梱されずAlpacaから取得。150銘柄から好成績20銘柄を選んだ可能性があり、重大な銘柄選択・サバイバーシップ偏りがある。平均純益は約$7.2/取引にすぎず、流動株ならコスト後存続は一応 plausible だが未確認。Pine v6：はい。ただし複数銘柄ポートフォリオ部分は別実装が必要。

2. SPY Noise-Area Intraday Momentum

市場・足：SPY、1分足、30分ごとに判定。過去14日の「同時刻における寄付からの絶対変動率」平均をσとし、上限＝max(当日始値、前日終値)×(1+σ)、下限は対応する逆式。価格が上限とVWAPをともに上回ればロング、下限とVWAPを下回ればショート。バンド／VWAP内へ戻れば反転または退出し、15:50に全決済。

独立GitHub再現（2022–2024）：総収益71.7%、年率19.9%、Sharpe 1.39、最大DD 9.9%。手数料$0.0035/株、スリッページ$0.001/株。[GitHub再現](https://github.com/esherma/algo_trading)／[原論文](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172)／[公開MATLAB実装](https://concretumgroup.com/backtesting-riding-intraday-trends-in-us-markets-using-matlab/)

Grade B。取引数・勝率・PFが非公表で、再現期間も原論文期間と重なり真のOOSではない。SPYの狭いスプレッドなら存続可能性は比較的高いが、スリッページ仮定は楽観的。Pine v6：はい。

3. NQ ORB＋Volume Profileリトレース

市場・足：NQ、1分足、2021–2026。9:30–9:45の範囲を終値で突破後、範囲内VAH/POC/VALへ戻ったところで入り、ORB端をストップ、反対側の範囲外を目標、締切／EOD決済。

ロング198件、勝率42.9%、期待値+0.417R、年+13.8R；ショート80件、42.5%、+0.558R、年+7.4R。[GitHub](https://github.com/dws-data/nas-orb-backtester)

Grade B。ただしデータ非同梱、突破幅・対象VP水準・目標値・コスト・OOSが明記されず、成績を額面通り採用できない。コスト後存続は未立証。Pine v6：部分的。VP再現と連続先物ロールが難点。

4. Stocks-in-Play 5分ORB

価格>$5、14日平均出来高>100万株、ATR14>$0.50から、最初の5分の相対出来高上位20銘柄を選択。最初の5分足が上昇なら高値突破買い、下降なら安値突破売り。損切り0.1×ATR、未決済なら大引け終了。

7,000超銘柄、2016–2023。純収益1,600%超、Sharpe 2.81、年率alpha 36%。手数料$0.0035/株。[SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4729284)／[ルール要約](https://www.cxoadvisory.com/individual-investing/intraday-trading-of-overactive-stocks-via-opening-range-breakout/)

Grade B。査読前でコード・データ・OOS・取引数がなく、スプレッド、スリッページ、市場インパクトも不足。ニュース銘柄への成行的ストップ注文なので、個人コスト後の生存性は疑わしい。Pine v6：部分的。単一銘柄の売買規則は可能だが、全市場上位20銘柄のリアルタイム選別は不可能。
