# Research: Previous Close / Settlement Mean Reversion Intraday

**Topic ID**: levels_025  
**Family**: levels  
**Date**: 2026-07-17  
**Question**: Previous close / settlement price mean reversion intraday: evidence

---

結論：前日終値からの乖離に日中反転傾向はある。しかし、単純な「寄付きで逆張り」はコスト控除後に消える例が多い。比較的強い結果は、横断面選別・市場ヘッジを伴い、単一銘柄のPine戦略には直接移植できない。

1. S&P 500 overnight-jump reversal（Grade A）

市場・足：当時のS&P 500全構成銘柄、1分足、1998–2015。前日390本とclose→openリターンにBNSジャンプ検定（0.1%水準）を適用し、z値上位10銘柄を9:30 ETにギャップと逆方向へ売買。S&P 500で市場ヘッジし、120分後に全決済。ストップ、ニュース除外なし。

4,527日、過去構成984銘柄を使用しサバイバーシップを抑制。20bp/pair往復コスト後、日次+0.17%、年率51.47%、Sharpe 2.38、勝ち日58.41%、最大DD 68.17%。損益分岐コスト35–40bp。日次ローリングOOSだが、120分という出口は同一期間の事前イベント分析から選択されており、完全な独立OOSではない。PF未報告。[論文・全手法と表](https://www.mdpi.com/1911-8074/12/2/51)

Pine v6：partial。単一銘柄のジャンプ検定と120分決済は可能だが、500銘柄横断ランキング、動的構成銘柄、市場中立ポートフォリオは現実的でない。流動性大型株なら小売コストにも耐える可能性はあるが、古い標本と異常に高いリターンには再検証が必要。

2. 単純Top-10 gap fade（Grade A、重要な負例）

同じ市場・期間。|open / previous close − 1|上位10銘柄を9:30に機械的に逆張りし、120分後決済。ストップ・追加フィルターなし。

同じ4,527日、20bpコスト後は日次−0.03%、年率−6.59%、勝ち日41.79%。つまり「大きなギャップだから戻る」だけでは負ける。選択バイアスは小さいが、横断ランキングの仕様依存は残る。[比較結果](https://www.mdpi.com/1911-8074/12/2/51)

Pine：partial。個別銘柄の固定ギャップ閾値版は容易だが、Top-10選択は困難。現実的スプレッド・手数料には耐えない。

3. DJIA ±1%/±1.5% opening-gap fade（Grade B）

市場・足：DJIA 30銘柄、15分、1999–2000。openが前日close比−1%/−1.5%以下なら寄付き買い、+1%/+1.5%以上なら空売り、9:45決済。ストップ・セッションフィルターなし。

408,240観測。最初の15分平均は、下方ギャップで+0.1843%/+0.2409%、上方ギャップで−0.1225%/−0.1710%（すべてp<1%）。ただしmid-quoteでは反転利益が非有意となり、取引コストを賄えない。勝率・PF・独立OOSなし。短い2年標本、固定DJIA構成、bid–ask bounceが重大。[詳細手法・結果](https://www.researchgate.net/publication/228548405_Decomposing_Overnight_Price_Reversals_Implications_FOR_Trading_Strategies)

Pine：yes。最も実装しやすいが、証拠は実売買可能なエッジを否定している。

4. Futures CO–OC cross-sectional reversal（Grade B）

市場：35 CME先物（株価指数5、金利11、商品11、通貨9）、1982–2014。各日のclose→翌openリターンが横断平均より低い契約を寄付き買い、高い契約を売り、偏差比例・ドル中立で同日close決済。ストップなし。流動性最大限月へロール。

平均日次粗利益／Sharpeは、株価指数0.25%/4.08、金利0.06%/2.20、商品0.17%/1.93、通貨0.04%/1.26。2007–2014分割でもSharpe 1.30–6.68。ただし手数料・spread・roll slippage未控除、真のOOSなし、PF・勝率未報告。高回転なので小売での残存性は未証明。[論文PDF](https://www.cicfconf.org/sites/default/files/paper_357.pdf)

Pine：no/partial。単一先物版は作れるが、根拠となる横断面ポートフォリオは再現困難。

総合判断：反転という統計現象は実在する一方、単純なprevious-close gap fillの売買可能性は弱い。TradingViewで試すなら、単一銘柄の勝率最適化より、次バー約定、RTH closeの厳密な定義、少なくともspread＋commission＋1–2tick slippage、walk-forward、ロール別検証を必須にすべきである。
