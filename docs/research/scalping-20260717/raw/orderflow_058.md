---
topic_id: orderflow_058
family: orderflow
date: 2026-07-17
question: Momentum bursts in time-and-sales / tape: any quantified retail-replicable edge?
---

結論：公開証拠が支持するのは「約定バーストそのもの」より、流動性の高い指数ETFにおける低頻度の intraday momentum である。秒以下のテープ／板 imbalance は予測力があっても、速度・スプレッド・手数料で小口優位になりにくい。

**1. First-half-hour → last-half-hour momentum — Grade A**

市場：SPY、追加検証10 ETF。時間軸：30分。  
Entry：前日16:00→当日10:00のリターンが正なら15:30にロング、負ならショート。Exit：16:00。ストップなし。500約定未満の日を除外。高出来高・高ボラ日に強い。  
結果：1993–2013、約21年（正確な日数・PFなし）。成功率54.37%、年率6.67%、Sharpe 1.08。再帰的OOS \(R^2=1.2\%\)。2005年以降、bid/ask spread控除後も年率6.52%、Sharpe 1.00。[Gao et al., Journal of Financial Economics](https://www.sciencedirect.com/science/article/pii/S0304405X18301351)  
Pine v6：**Yes**。1–15分足から10:00値・15:30 entry・16:00 exitを構成可能。  
評価：SPYならコスト後存続は plausible。ただし手数料・追加slippage・空売り制約を完全には含まず、2013年以降の減衰が最大の懸念。SPYを事後選択した selection bias は残る。

**2. Dynamic Noise-Area breakout — Grade B**

市場：SPY。1分データ、判定は毎時00/30分。  
Entry：過去14日について同時刻までの「始値からの絶対変動率」を平均し、当日始値／前日終値から上下境界を作る。境界上ならロング、下ならショート。Exit：ロングは `max(上境界,VWAP)`、ショートは `min(下境界,VWAP)` を逆抜け、または16:00。  
結果：2007–2024、7,668 trades。勝率37%、平均$0.09/share、年率9.7%、Sharpe 1.24、MDD 12%、累積380%。$0.0035/share commission＋$0.001/share slippage込み。PFなし。[Zarattini et al.](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4824172)  
Pine：**Yes**。VWAPと時刻別14日平均を配列で実装可能。  
評価：コスト耐性は一応 plausible。ただし同一サンプル内でstop/VWAP/14日設定を改良し、独立OOSなし。著者選択・parameter overfitting が強い。

**3. Millisecond OFI predictor — Grade B、否定結果**

市場：QQQ、ARCA L2。10秒bar＋30分rolling推定。  
Entry：板イベントからOFIを計算し、予測価格変化が$0.003 take-feeを超えれば100株を同方向へ成行。Exit：反対signal／引け30分前にflat。独立stopなし。  
結果：2012年の無作為3か月。June −1.47%、August −1.16%；QQQとの差も有意でない \(p=0.1957\)。ARCA feeとtick fill simulation込み、勝率・PFなし。[論文・コード・日次結果](https://www.slideshare.net/slideshow/order-flow-imbalance-trading-algorithm/62752025)  
Pine：**No**。millisecond L2、キャンセル、queue/fill情報を取得不能。小売コスト後edgeなし。単一ETF・3か月でサンプルも不足。

**4. 5-minute signed-trade imbalance — Grade B**

市場：LSEのAZN/VOD。  
Entry：5分間のbuyer-initiated件数－seller-initiated件数を総件数で割り、`>0.6`で買い、`<-0.6`で売り。Exit：反対signal。08:30–16:30、ask買い/bid売り。  
結果：開発60日/銘柄。AZN 366 trades、勝率36.89%、平均+0.00607%/trade；VOD 544 trades、勝率20.59%、平均−0.01832%。commissionなし。残り34日のOOSにはこの単独OFIを採用せず。[Tartu thesis](https://dspace.ut.ee/server/api/core/bitstreams/2f58b937-bbc8-45a9-932e-5780e0c1e9f4/content)  
Pine：**No/partial**。通常OHLCVにはaggressor sideがなく、volume-delta proxyは別物。spread後でも弱く、追加費用には耐えない。

補強的な否定証拠として、3,850万SPY約定・36日では低entropy（下位5%）後の5分絶対変動は2.89倍だったが、方向正解率は45%で偶然と有意差なし。[研究](https://arxiv.org/abs/2512.15720) テープは「動きそう」を示しても「どちらへ」を十分示さない。

総じて、survivorshipより深刻なのは銘柄・期間・閾値の事後選択、非独立OOS、latency無視である。小売再現候補は1、次点で2。純粋なtape burst scalpingには、現時点で堅い公開edgeは見当たらない。
