# Research Report: PDH/PDL Sweep-and-Reverse Strategies

**Topic ID**: levels_021  
**Family**: levels  
**Date**: 2026-07-17  
**Question**: Previous-day high/low sweep-and-reverse (liquidity sweep) strategies: quantified backtests

---

結論：前日高値・安値の sweep-and-reverse を直接検証したGrade A資料は見つからなかった。確認できた証拠は弱く、単純な逆張りを支持しない。

- **TJR Liquidity-Based Intraday Trading** — NVDA、1分足。前日高安＋直近H1/H4水準を固定バッファ以上抜けた後、①直近構造を終値で反転、②inverse FVG、③79%戻しのいずれかを確認。さらにFVG・反転脚50%・order/breaker blockへの再接触と方向一致終値で成行。ストップは反転脚極値外、利確は最寄りの反対側流動性水準、なければ固定R、16:00 ET強制決済。8:30–16:00 ET、リスク2%。2025-01-02～2026-03-12、275取引、勝率43.64%、PF 1.18、+18.39%、最大DD 9.37%。フォワードはわずか6取引、勝率50%、PF 0.68、−$50。[論文](https://www.diva-portal.org/smash/get/diva2%3A2064818/FULLTEXT01.pdf) **Grade B**。Pine v6：**部分可**。FVG/BOS等は実装可能だが、tick順序・bid/ask・同一バー内約定を1～15分OHLCだけでは完全再現できない。前日高安以外の水準も混在するため、PDH/PDL単独の成績ではない。NVDAという事後選択されやすい銘柄・短い強気相場・多数の実装判断による過適合リスクが大きい。手数料・スリッページが明示されず、期待値$6.69/取引、PF 1.18は実コスト後に消える可能性が高い。

- **Previous-Day Extreme Contrarian** — EUR/USD、H1判定。最初のH1終値がPDL未満なら買い、PDH超なら売り。利確は反対側の前日極値、ストップは56期間H8 ATRの2倍、1日1取引、セッションフィルターなし。5年・886取引、勝率68%、純益わずか$40、Sharpe 0.13、平均勝ち$3.64／平均負け$7.87、PF未報告。コード公開、ランダム執行遅延あり。[MQL5記事・コード](https://www.mql5.com/en/articles/19130) **Grade B**。Pine v6：**可**（1～15分足からD1/H1/H8を参照）。著者はOOSと呼ぶが、訓練・凍結・評価期間の分離は示されない。銘柄survivorshipは小さい一方、単一通貨ペア依存。利益は1取引約4.5セントしかなく、通常のスプレッド・委託料で確実に赤字化する。

- **20-bar Wick Sweep** — MNQ、MGC、NAS CFD、XAU CFD、5分足。20本のスイング極値を1 ATR以上wickで抜き、終値がレンジ内へ戻ったら反対方向へ終値エントリー。ストップはwick外＋buffer、目標はレンジ反対端または最低2R。セッション条件は非開示。12か月：MNQ 487取引／53%／PF1.34、MGC 412／51%／1.21、NAS 524／55%／1.41、XAU 438／54%／1.32、合計1,861／53%／1.32。[結果](https://puravidaedge.com/blog/liquidity-sweep-strategies-backtest-results) **Grade C**。Pine v6：**可**だが前日高安ではなく20-bar極値であり、置換後の成績は未知。コード・データ・OOS・委託料なし、商用サイトの仮想結果。著者自身、通常より1～2tick悪いslippageを報告しており、PF1.21付近は小口先物コスト後に危険。

反証も重要で、YMの直近6か月ではPDH突破後81%が陽線引け、PDL突破後63%が陰線引けと、無条件fadeより継続を示す。ただし取引損益・標本数は非開示。[Edgeful](https://www.edgeful.com/blog/posts/previous-day-range-indicator-tradingview) またNQ 3,121日ではPDH/PDL到達確率は詳細に検証されているが、逆張り収益性は検証されていない。[TradingStats](https://tradingstats.net/pdh-pdl-sweep-probability/)

総評：現状は「条件付きなら研究候補」止まり。survivorshipより、銘柄・期間選択、複数フィルター探索、コスト欠落、OOS不足が主要リスクである。現実的コスト後も残ると確認されたPDH/PDL reversal edgeはない。
