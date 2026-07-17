# Scalping Evidence Research — 2026-07-17

100 Codex research agents (gpt-5.6-sol, reasoning effort high, read-only sandbox,
web search) investigated scalping/intraday logic evidence across 10 families,
followed by 10 per-family synthesis passes. 85/100 research tasks completed
successfully; raw findings are in `raw/`, per-family syntheses in
`family_*.md`.

## Headline finding (honest)

**No scalping logic with a guaranteed or even robustly-verified high win rate
exists in the surveyed evidence.** The sweep's strongest cross-family result is
negative: most published intraday edges shrink or flip negative once realistic
spreads, commissions, slippage, and out-of-sample tests are applied. Key base
rates: Taiwan full-population data shows only ~20% of active day traders are
profitable after costs; detecting a true 55% win rate needs ~617 independent
trades; no audited public track record pairs a verified profitable account with
a disclosed rule set.

## What survived

Four logics had the strongest (still imperfect) evidence and were implemented
as DT setups — all as `candidate` status, gated behind the existing
setup-verify → adopted pipeline:

| Setup | Evidence | Key caveat |
| --- | --- | --- |
| `torb` | IEEE Access peer-reviewed TORB (index futures) | Probe window chosen in-sample; no OOS since 2013; DT TP1/SL overlay untested vs EOD-only source exit |
| `intraday_momo` | JFE (Gao-Han-Li-Zhou) + 62-futures 1974-2020 extension | SPY variant FAILED an independent 2010-2018 replication (Sharpe -2.70); futures variant preferred |
| `noise_break` | SSRN working paper + 3 independent write-ups | Grade B; no independent OOS; author-tracked live slippage only |
| `vwap_rsi_pullback` | Single 2024-2025 QQQ study (recurred across 5 research passes) | Grade B; one source, one instrument, no OOS |

## What was rejected (selection)

- ICT-style concepts (FVG/order blocks): the only objective backtest found was
  strongly negative (11,391 trades, PF 0.81).
- Generic MNQ 25-min ORB: t=1.50, not significant; unstable year-by-year sign.
- VWAP band fades, NR7/inside-bar squeezes, EMA pullbacks, candlestick rules:
  edges vanish after costs in the best available tests.
- Order-flow (CVD/footprint/DOM) approaches: require data unavailable to Pine
  v6 OHLCV, or die after costs.
- Confluence stacking: the one controlled test found adding filters made the
  base strategy worse (t=1.50 → 80.7% stop-out rate).

## Implementation trail

- Setups: `pine/setups/{torb,intraday_momo,noise_break,vwap_rsi_pullback}/`
- Specs (all pass `npm run strategy-spec-check`, watch/paper-only):
  `journal/specs/*_spec.json`
- Registry: 4 new `candidate` entries in `journal/registry.json`; zero adopted.
- Contract test: `tests/scalp_setups_contract.test.js` (registered in
  `test:unit`).
- Verification: per-setup adversarial review (4/4 pass after one fix round),
  plus a cross-cutting Codex (gpt-5.6-sol high) final review whose findings
  were remediated; Pine files are statically reviewed but NOT yet compiled on
  live TradingView (`pine_smart_compile` pending — requires CDP).

## Non-negotiable boundary

These setups are research candidates. They must pass the existing backtest
adoption gate (`skills/setup-verify` criteria, evidence recorded in
`journal/backtests/`, registry updated from evidence only) before
`/trade-judge` or the pair-trader layer will treat their signals as live-
eligible. Nothing in this research authorizes live trading, and the DT layer
never places orders — the human remains the trader.
