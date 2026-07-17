# VWAP-Based Scalping Research

**Topic ID**: vwap_018  
**Family**: vwap  
**Date**: 2026-07-17  
**Question**: Where does VWAP-based scalping work best: index futures vs FX vs crypto? Evidence.

---

結論：暫定順位は「株価指数先物 ＞ 暗号資産 ＞ スポットFX」。ただし、厳密なアウト・オブ・サンプル（OOS）検証まで通過したVWAPスキャルピングは見つからず、指数先物も「有望な仮説」の段階である。

- **Opening-drive Anchored VWAP retest** — ES/NQ/YM/RTY、5分足。9:30–10:00 ETの最高値バーからAVWAPを開始。10バー傾斜が上向きならAVWAP±0.1%への押しで買い、下向きなら売り。利確0.5%、損切り0.3%、最大30バー、RTH限定。2024年、手数料・スリッページ込みでES：519件、勝率50.48%、PF 1.29、Sharpe 2.32、DD 7.62%；NQ：505件、50.69%、PF 1.21；RTY：464件、PF 1.20；YM：510件、PF 0.98。[ルールと結果](https://www.fractiz.com/strategies/anchored-vwap/)、[ES詳細](https://www.fractiz.com/backtest-samples/anchored-vwap-strategy-es-5m-2024/)。**Grade B**。Pine v6：**Yes**。ただし5種類のアンカーから事後的に最良のものを選び、年も1年だけ。OOSなし、連続先物のロール処理とスリッページ式も非公開。想定コスト下では生存したが、PF 1.2台は実約定悪化への余裕が小さい。

- **VWAP Trend／"Holy Grail"** — 指数代理QQQ、1分足。9:30 ETリセットのHLC3-VWAP。確定足終値が上なら次足で買い、下なら売り、交差ごとに反転、15:59頃に全決済。固定ストップはVWAP反対側への終値交差。[SSRN原研究](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4631351)は2018–2023年で+671%、Sharpe 2.1、DD 9.4%。独立LEAN再現は24,387注文、勝率17%、+592.9%、Sharpe 1.754、手数料$6,479だが、2023年9月以降の固定パラメータOOSはSharpe約0.7、往復約1bp超で消失。[コード・結果](https://www.quantconnect.com/terminal/cache/embedded_backtest_b115d0894231d55994b1068202f6c0ae.html)。**Grade A（再現コード＋データ。SSRN自体は未査読）**。Pine：**Yes**。指数市場にVWAP構造がある証拠だが、QQQの小口成行では現実のスプレッドを耐えない。

- **Dual prior-day AVWAP breakout** — USDJPY。前日高値バー・安値バーから2本のAVWAPを開始。上側を終値突破で買い、下側突破で売り、反対シグナルで反転、日末決済。日初から外側なら見送り、固定SL/TPなし。30件、勝率53%、PF 2.02、純益$3,322／$10,000。[方法](https://forextester.com/blog/anchored-vwap/)。**Grade B**。Pine：**Partial**—計算可能だが時間足、期間、コストが非開示で、掲載画像の残高とも不整合。さらにスポットFXはOTCで市場全体の出来高がなく、TradingViewでは業者依存のtick volumeになり得る。[BIS](https://www.bis.org/publ/work1094.htm)。標本30・OOSなしでは、スプレッド後の生存を主張できない。

- **BTC VWAP trend filter** — BTCUSDT、15分足。終値>VWAPで100%ロング、終値<VWAPで全決済。2024–2025年、1,304件、勝率49%、+19.7%、Sharpe 0.84、DD 12.1%。Binance perpetual手数料＋2bpスリッページ。[コードと設定](https://www.manifoldbt.com/strategies/vwap-strategy-python)。**Grade A（再実行可能）**。Pine：**Yes**。ただしPF、OOS、funding、VWAPリセット時刻が不明で、結果も「illustrative」。別のBTC平均回帰では100件、勝率59%でもPF 0.97、手数料$403、−0.51%だった。[反証](https://www.coinquant.ai/blog/vwap-strategy-on-bitcoin-what-3-months-of-intraday-backtest-data-shows)。

総合すると、中央集約された実出来高と低い固定コストを持つES/NQが最も筋が良い。暗号資産は取引所別出来高・手数料・fundingに依存し結果は混合、FXは出来高定義そのものが弱い。QQQ/BTC/USDJPYの事後選択には銘柄生存・選択バイアス、全候補に期間・フィルター探索による過適合がある。現時点で「小売コスト後も頑健」と言えるのはない。
