---
topic_id: squeeze_043
family: squeeze
date: 2026-07-17
question: Volatility-regime filters (VIX level, ATR percentile) and their measured effect on scalp win rates
---

結論：VIX水準またはATRパーセンタイルが「1–15分足スキャルプの勝率を安定的に改善する」というGrade Aの直接証拠は見つからなかった。最良の結果でも、フィルター単独の増分効果が未分離、OOS不足、または取引コスト後の期待値がほぼゼロである。

1. ES/NQ・VIX/ATRフィルター付き15分ORB  
市場：ES、NQ。時間足：15分の寄付きレンジ、5分執行。  
エントリー：9:30–9:45 ETの高安を記録。Opening Range÷日足ATR(14)が0.25–0.60、VIX 16–25、ブレイク足出来高がレンジ形成中平均以上の場合、5分足終値が高値超えで買い、安値割れで売り。  
出口：レンジ反対端または中点±5分ATRの0.25倍をストップ。50%をレンジ幅1倍で利確し建値移動、残りを1.5倍、12:00までに全決済。  
成績：無条件52–55%、ATR追加56–59%、ATR+VIXで58–62%、平均R:R 1.8。2018/19–2025とされるが、取引数、PF、OOS、手数料モデルは非開示。  
証拠：B（詳細ルールはあるが販売業者の未再現集計）。[Volatility Box](https://volatilitybox.com/research/opening-range-volatility-breakout/)  
Pine v6：Yes。  
リスク：閾値探索・選択的報告が強く疑われる。単一先物なので生存者バイアスは小さいが、契約ロール処理不明。コスト後生存は未証明。「1.8Rで勝率60%」は数字同士も不自然に良すぎる。

2. ES ATR Percentile Breakout  
市場：ES。時間足：1時間（したがってスキャルプ証拠ではない）。  
エントリー：ATRが過去100本の第10百分位未満になった後、5本高値突破で買い／5本安値割れで売り。セッション条件なし。  
出口：ATRストップと称するが倍率・利確規則は非開示。  
成績：2023-01～2026-03、228取引、勝率46.9%、PF 1.40、最大DD 10.2%、Sharpe 1.47。往復$4.50＋片道1tickスリッページ込み。OOSなし。  
証拠：C（データ・コード・全約定表なし）。[PineScriptForge](https://pinescriptforge.com/es/atr-percentile-breakout/backtest)  
Pine v6：Partial。ロジック自体は可能だが、1–15分への転用は未検証。  
リスク：短い単一市場標本とパラメータ最適化。生存者問題は小さい。1分足では摩擦が大幅に増え、PF 1.40が残る根拠はない。

3. Percentile Noise-Area Momentum  
市場：ES/NQ。時間足：5分。  
エントリー：90日の日中値幅分布から25/75百分位境界を作り、価格が境界外に2本連続、出来高が20本中央値超。9:30–15:00 ETのみ。任意で50MA方向一致。VIX 30–40は半サイズ、40超は停止。  
出口：最低3本保持後に境界内へ戻れば決済、最大78本、16:00全決済。任意で0.5%トレール／レンジ2倍利確。  
成績：2011–2026、3,847取引、勝率54.3%、PF 1.64、最大DD 16.4%。片道1tick＋往復$4.20。365日学習・90日OOSのSharpe 0.94（全体1.18）。2tickではSharpe 0.64。  
証拠：B（詳細だがコード・データなし、仕様に任意項目が多い）。[研究PDF](https://misango.me/static/Papers/Intraday_Momentum_Paper/Intraday_Momentum_Research_Report.pdf)  
Pine v6：Partial。日中値幅の日次配列と複数銘柄ポートフォリオ再現が難所。  
リスク：複雑性と任意設定による過適合。先物の生存者リスクは小さい。1tick想定なら生存可能性はあるが、2tickで急減するため脆弱。

4. VIX先物・終盤30分モメンタム  
市場：期近VIX先物。30分足。  
エントリー：開始30分のリターンが正なら14:45に買い、負なら売り。15:15決済。高いS&P実現ボラ／VoVで効果が強い。  
成績：2006–2015、2,132日。コスト後年率21.78%、Sharpe 1.16。高VoVでは年率34.61%対低VoV 9.94%。勝率・PFは未報告。  
証拠：A（査読誌、tickデータ、頑健性検定。ただし公開再現コードなし）。[Journal of Banking & Finance](https://ideas.repec.org/a/eee/jbfina/v148y2023ics0378426622003260.html)  
Pine v6：Partial（15分足2本で集約可能だがVIX先物データ契約が必要）。  
リスク：生存者問題は小さい。勝率改善の証拠ではなく、VIX水準フィルターでもない。学術的に最も強いが、通常の株価スキャルプへの外挿は不適切である。
