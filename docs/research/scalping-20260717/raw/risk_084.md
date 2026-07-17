# risk_084

**Topic ID**: risk_084
**Family**: risk
**Date**: 2026-07-17
**Question**: Partial take-profit (TP1/TP2) vs single target for scalps: quantified comparisons

---

Bottom line: I found no Grade-A study directly showing that TP1/TP2 scaling out beats a comparable single target for 1–15-minute retail scalping. The best direct evidence is negative: partial exits raise the measured win rate but do not improve risk-adjusted return. Stronger evidence also indicates that profit caps often truncate the few large winners carrying breakout expectancy.

1. Structural-break XAUUSD with asymmetric partial exit — XAUUSD, tick-level, 2024–2026.

Entry: proprietary structural-range break; exact formula, timeframe, session and filters are not disclosed. Exit: asymmetric partial profit-taking versus controlled alternative exit policies; exact TP fractions/levels and stop are also undisclosed. Results: 1,571 trades; entry component Sharpe 2.6–3.1, robust to random-entry placebo, multiple-testing correction, rolling windows and slippage stress. Partial exit increased win rate but added no risk-adjusted return. Exact win-rate change, PF and cost schedule are not reported in the accessible paper description. Evidence B: SSRN working paper, no public code/data, commercially interested co-author, and authors themselves call for full-coverage real-tick replication. Pine v6: no—only a non-equivalent approximation is possible because the signal is proprietary and results may depend on tick sequencing. Survivorship is low as a single-market issue, but regime/selection and author-conflict risks are high. Retail XAUUSD spread variation could readily erase an unreported incremental edge. [Source](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6941458)

2. GAORB with stop-only versus stop plus take-profit — Taiwan Index Futures, 1-minute OHLC, 2007-11-01–2018-12-31.

Entry: during the 15–30-minute opening range calculate high \(h\), low \(l\), and price SD \(\sigma\); enter long above \(B_u=h+\epsilon_1\sigma\), short below \(B_l=l+\epsilon_2\sigma\). Parameters are optimized on the preceding two months and applied to the next month. Exit: EOD; stop at \(T_{SL}(B_u-B_l)\). The TP variant activates after a similarly scaled gain and exits the entire position after a 1/3, 2/3 or 1.0 retracement of maximum unrealized gain—this is single-position profit locking, not TP1/TP2.

Approximately one million bars; trade count and costs not reported. Best stop-only: annual return 9.303%, win rate 39.017%, PF 1.177, Sharpe 2.495, MDD 1,336 points. Adding TP: 4.051%, 43.578%, PF 1.09, Sharpe 1.320, MDD 1,249. Thus TP improved win rate but roughly halved return and Sharpe. Evidence A: peer-reviewed, monthly walk-forward, but no code and a 65,536-parameter GA creates substantial overfitting risk. Pine: partial—entry/exits are expressible, but reproducing the rolling GA is impractical. No equity survivorship problem; contract-roll bias is possible. With PF only 1.09–1.18 before disclosed costs, retail survival is doubtful. [Paper](https://doi.org/10.1016/j.knosys.2021.106769), [full methodology/results](https://www.researchgate.net/publication/348997462_Evolutionary_ORB-based_model_with_protective_closing_strategies)

3. Five-minute equity ORB, uncapped single exit — roughly 7,000 US stocks, 2016–2023.

Entry: stocks above $5, prior-14-day average volume ≥1 million and ATR >$0.50; after 09:30–09:35 ET, buy the opening-range high only when that candle is bullish, or short its low when bearish; no doji trades. Exit: stop 10% of daily ATR; otherwise 16:00 ET. Results: trade count not reported; hit rate 41.4%, total return 29%, annual return 3.2%, Sharpe 0.48, MDD 13%, alpha 3.3%; $0.0035/share commission included, but spread/slippage omitted. Evidence B: detailed, CRSP universe includes delisted stocks, so survivorship is explicitly controlled; however, there is no clean holdout. Pine: yes per symbol; portfolio-wide replication is no. The small return after commission is unlikely to tolerate aggressive market-order spread/slippage. [Source](https://www.alexandria.unisg.ch/server/api/core/bitstreams/3c2989c4-688d-4d78-8a71-f02690990d51/content)

Conclusion: evidence favors single/EOD exits for positively skewed breakout scalps. TP1/TP2 may smooth drawdown and cosmetically raise win rate, but there is no reliable evidence here that it raises expectancy after retail costs.