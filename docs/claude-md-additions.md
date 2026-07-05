# CLAUDE.md 追記パッチ案

この文書は `CLAUDE.md` を直接編集せず、後で追記するためのパッチ案です。下記の markdown ブロックを、指定位置にそのまま挿入してください。

## 1. Decision Tree への追加

挿入位置: `CLAUDE.md` の `## Decision Tree — Which Tool When` 内で、`### "Analyze my chart" (full report workflow)` の直後、`### "Change the chart"` の前に追加します。

```markdown
### "Should I take this trade?" (trade decision support)
1. Check `journal/registry.json` first — only setup x market entries with `status: "adopted"` are eligible for live trade judgement
2. Use `/trade-judge <symbol>` when a DT Pine indicator shows a forming or triggered setup
3. Read DT Pine labels via `data_get_pine_labels` with `study_filter: "DT "` and parse `DT|<setup_id>|<dir>|<state>|entry=...|sl=...|tp1=...|tp2=...`
4. Confirm MTF context, key levels, active session, RR, and recent track record before returning `GO`, `WAIT`, or `NO-GO`
5. Record each judgement as one JSONL line in `journal/judgements/YYYY-MM.jsonl`
6. If the trade is taken, link the later trade record with `judgement_id` in `journal/trades/YYYY-MM.jsonl`
7. Do not treat non-adopted setups as live signals; route them to `/setup-verify` or replay practice

### "Log my trade" / "Practice setups"
- Use `/trade-log` after live or replay exits to append one execution record to `journal/trades/YYYY-MM.jsonl`
- Preserve `setup`, `market`, `symbol`, `direction`, actual entry/exit, `r_multiple`, `followed_plan`, mistakes, and notes
- Use `/replay-drill <setup> <symbol> <timeframe> <date>` to practice adopted or candidate setups in TradingView replay mode
- Replay trades should use `mode: "replay"` so stats can separate practice from live execution
```

## 2. Architecture 近くへの追加

挿入位置: `CLAUDE.md` の `## Architecture` セクションで、既存のアーキテクチャ図の直後、`Pine graphics path:` の前に追加します。

```markdown
DT trading system paths:
- `pine/setups/` contains the DT setup library: `orb`, `vwap_reversion`, `pdh_pdl_break`, `ema_pullback`, and `nr_squeeze`
- `journal/` is the evidence layer: registry status, backtest summaries, judgement JSONL, trade JSONL, and generated setup stats
- Live trade decisions are gated by `journal/registry.json`; only `adopted` setup x market combinations should feed `/trade-judge`
```

## 3. 追記後の確認ポイント

- Decision Tree に `/trade-judge`、`/trade-log`、`/replay-drill` の入口が追加されていること。
- `journal/registry.json` の `adopted` status が live 判断のゲートであることが明記されていること。
- `journal/judgements/YYYY-MM.jsonl` と `journal/trades/YYYY-MM.jsonl` の記録規約が Decision Tree から辿れること。
- Architecture 近くに `pine/setups/` と `journal/` の役割が短く追加されていること。
