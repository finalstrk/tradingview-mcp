# Connors RSI(2)-Style Short-Horizon Mean Reversion: Intraday Evidence

**Topic ID:** pullback_033  
**Family:** pullback  
**Date:** 2026-07-17  
**Research Question:** Connors RSI(2)-style short-horizon mean reversion adapted to intraday bars: results

---

Evidence is sparse and mostly negative. The strongest finding is that high win rates do not translate into net profitability once payoff asymmetry and trading friction are considered.

1. **SPY one-minute RSI reversal**

Market/timeframe: SPY, 1-minute, 2023, NYSE 09:30–16:00. Entry: RSI(14)<30 buys one share; RSI>70 sells one share; position capped at ±1, so an opposite signal first flattens and a repeated signal reverses. Exit/stop: opposite RSI threshold; no stop or target. Results: 3,582 transactions; only 2% profitable after a $1-per-transaction fee; gross result without fees only +$16.70. Profit factor not reported; no OOS. The appendix contains QuantConnect code and a reproducible backtest link. **Grade A** for reproducibility, despite weak experimental design. Pine v6: **yes**. Retail viability: **no**; gross edge was essentially zero before spreads. No constituent survivorship, but only one favorable calendar year was tested. [Paper/code](https://www.researchgate.net/publication/339897193_Short_Term_Trading_Models_-_Mean_Reversion_Trading_Strategies_and_the_Black_Swan_Events)

2. **BTC RSI oversold recovery**

Market/timeframe: BTCUSDT, 5- and 10-minute, 24/7. Entry: long when RSI(14) crosses back above 30 after being below it. Exit: RSI crosses above 70. No stop, time exit, trend filter, or session filter disclosed. Last three months: 5-minute—101 trades, 67.3% win rate, PF 1.35, +15.34%, Sharpe 2.08, max DD 10.97%; 10-minute—49 trades, 65.3%, PF 1.27, +8.34%, Sharpe 1.38, DD 14.61%. No OOS. **Grade B**: exact methodology and metrics, but no downloadable trade log and the pages do not identify the actual fee/spread settings. Pine v6: **yes**. Retail viability: **uncertain/fragile**; PF 1.27–1.35 over 49–101 trades could disappear under taker fees, spread and parameter instability. Serious three-month selection/overfitting risk. BTC is itself a survivor, creating asset-selection bias. [5-minute](https://www.coinquant.ai/strategies/btc-rsi-5m-backtest), [10-minute](https://www.coinquant.ai/strategies/btc-rsi-10m-backtest)

3. **RSI + Bollinger oversold**

Markets/timeframes: BTCUSDT 5-minute over six months; ETHUSDT 5/15-minute, period undisclosed. Entry: long when RSI(14)<30 and close is below BB(20,2) lower band. Exit: RSI>50 or close above the 20-SMA. No stop/session/trend filter. BTC: 359 trades, 64.1% winners, PF 0.91, −7.55%, Sharpe −0.75, DD 15.06%. ETH 5-minute: 723 trades, 63.07%, PF 0.89, −26.16%, DD 48.82%; ETH 15-minute: 514 trades, 62.26%, PF 0.82, −46.33%, DD 50.41%. No OOS or disclosed cost schedule. **Grade B**. Pine v6: **yes**. Retail viability: **no**—already negative before any unreported extra friction. [BTC](https://www.coinquant.ai/strategies/btc-mean-reversion-5m-backtest), [ETH 5m](https://www.coinquant.ai/strategies/eth-mean-reversion-5m-backtest), [ETH 15m](https://www.coinquant.ai/strategies/eth-mean-reversion-15m-backtest)

4. **One-minute Bollinger snap-back**

BTCUSDT, 1-minute, three months, 24/7. Buy close below BB(20,2); exit close above 20-SMA; no stop/filter. Results: 2,412 trades, 54% winners, PF 0.63, −55.30%, Sharpe −18.83, DD 55.30%. **Grade B**; Pine v6 **yes**; retail viability emphatically **no**. [Source](https://www.coinquant.ai/strategies/btc-bollinger-bands-1m-backtest)

The closest direct RSI(2) intraday publication tests US500 CFD on 30-minute bars—RSI(2)<5 above SMA200, exit above SMA5, 0.15% stop—but discloses results mainly as images, no costs/OOS, and only ~14 months: **Grade C**, insufficient evidence. [Source](https://www.mql5.com/en/articles/17636)

Bottom line: no robust 1–15-minute Connors-style edge is established. A newer walk-forward, cost-adjusted S&P study likewise reports intraday mean-reversion deflated Sharpe approximately zero. [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6977700)
