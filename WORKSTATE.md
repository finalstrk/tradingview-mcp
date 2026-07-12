# WORKSTATE

Last updated: 2026-07-12

## Side project: quant-github-atlas (2026-07-07) — COMPLETED

- `/home/yukio/Coding/quant-github-atlas/` に世界のクオンツトレードGitHub分析基盤を構築完了（本リポジトリのコードは未変更）。
- 実績: Codex CLI (gpt-5.5, xhigh, fast, `--sandbox read-only`, web search) 計116回（本体100 + QC起点の修復16）、エラー0。カタログ452 repos / 43カテゴリ / 不正行0、Top30深掘り、セキュリティ監査30 repo、レポート10本、敵対的QC 4本。
- 主要セキュリティ検出: hummingbot pickle RCE疑義(high)、RD-Agent 未認証ポート(high)、tensortrade docsドメイン乗っ取り。詳細は `reports/security.md`。
- 再利用可能パターン: Codex read-only sandbox + Claude haiku 検証ラッパー + Workflow 並列14。サブエージェント定義 `~/.claude/agents/codex-{quant-researcher,security-auditor,synthesizer}.md`（次セッションから registry 有効）。

## Current state

### Audit / hardening stream (2026-07-12)

- Branch `codex/tradingview-audit-hardening` contains the hardening intent
  commits from the 2026-07-08 baseline and is synchronized with `fork`.
- P1-01 through P1-06 operational hardening is committed in separate intent
  groups. The remaining baseline raw CDP calls are P2 notes outside the
  accepted P1 paths.
- Gate A0 Pine discovery is implemented and independently Approved. The
  offline spec is 157/157 on three consecutive runs; the original unit gate
  was 269/269 and the latest repository unit gate is 302/302. The frozen
  artifact digest is
  `0400ce7e163bc475f2a68609551754fe4530f67062ba87ca6e0e3cb25d5d9125`.
- Gate A1 was attempted once. The exact command, target tuple, budgets, and
  residual caveat are frozen in the A0 approval envelope. The one approved attempt
  exited 1 at `PINE_DISCOVERY_OPEN` with ledger `1/0/1`, retry/fallback `0`,
  probe absent, and residual `UNKNOWN`; it was not retried.
- Independent read-only evidence found the exact target/tuple/frame/context
  unchanged, editor closed, and no process/tab/context mutation. The reviewed
  open method is callable, but the reviewed close method
  `hideWidget('pine-editor')` is currently non-callable. The open failure is
  therefore classified as `THROW_OR_POST_OPEN_VISIBILITY_UNPROVEN` until a
  separately approved diagnostic can distinguish the two without reopening.
- Gate A1 evidence was independently integrated into
  `docs/superpowers/plans/2026-07-12-gate-a1-evidence-integration.md`.
  The safe next issues are P1-07 close-capability fail-closed preflight,
  P1-08 open-stage result classification, P1-09 closed-editor read-only
  boundary, and P1-10 a new close-strategy approval artifact. These are
  offline-first and require a new implementation/design approval; the old
  A1 nonce cannot be reused.
- Final read-only review findings were resolved offline. `4d8d75f` clarifies
  the intentional health reuse-first contract in MCP/CLI help and adds
  description regression tests. `5f873a6` adds fixed `CdpTransportError`
  metadata for generic transport failures and typed `CdpAbortError` results
  for Pine post-action waits, with raw-cause-safe reconnect and cancellation
  fixtures. No live behavior or Gate A1 allowance was expanded.
- Additional preserved work was committed separately: `9441cea` adds
  benchmark, candidate-count, IS/OOS/final-holdout, parameter-freeze,
  execution-cost stress, and robustness gates to strategy specification; and
  `1180bef` makes bounded daily-review output always disconnect the shared CDP
  client. Both remain paper/read-only boundaries and do not authorize live
  trading or A1 operations.
- The strategy false-positive review was closed by `841eaf6` and `fde9022`:
  placeholder prose is rejected, ISO IS/OOS/holdout ranges must be ordered
  and non-overlapping, semantic cost/fill/robustness predicates are required,
  and aliases are selected by valid predicates.
- The coordinator boundary was implemented in `d56636e`: `npm test`,
  `test:e2e`, `test:all`, and broad helpers route through one coordinator;
  without a fresh approval nonce they run offline unit/manifest checks and
  emit a fixed `OFFLINE_APPROVAL_REQUIRED` zero-action ledger.
- Final minor hardening commits `9bcd9e9`, `3e487ab`, and `6aff2aa` cover
  report disconnect failures, validate direct TradingView probe identity and
  port inputs, and bound never-settling custom stream fetchers.
- `3eafd93` adds fail-closed strategy research gates for per-variant negative
  evidence, executed diagnostics, point-in-time data, leverage/funding, and
  concentration semantics. `5ccb414` gives each stream fetch attempt its own
  abort controller so timeout cancellation reaches the underlying fetcher;
  both changes are covered by focused and adversarial tests and preserve the
  paper/read-only boundary.
- The final offline review approved the pushed hardening set: adversarial
  probes 42/42, focused strategy/stream 24/24, and repository unit 302/302.
  `npm test` remains an approval-gated safe stop with zero external actions.
- Gate B/full live E2E remain pending; the offline final review is approved. No
  live CRI/CDP operation, TradingView/UI mutation, network POST, save, reload,
  tab/process operation, or Gate A1 retry was run in this stream.

- Historical TradingView trade-decision support artifacts and workflow notes remain in this repository; the older setup-verification context below is retained.
- The repository is clean after the hardening commits; no untracked trade-system paths are part of this audit stream.
- `journal/registry.json` contains 5 setups. All `fx` setup x market entries (`orb`, `vwap_reversion`, `pdh_pdl_break`, `ema_pullback`, `nr_squeeze`) have been verified and marked `rejected`; non-fx market entries are still `candidate`.
- No setup x market is currently `adopted`; `/trade-judge` should still return structurally gated `NO-GO` for live judgement.
- Read-only daily review artifacts now exist: `docs/read-only-daily-review.md`, `scripts/daily_review.js`, and `tests/daily_review.test.js`. This is a reporting/review layer only; it does not place orders, mutate chart state, or operate broker/payment UIs.
- Strategy specification gate artifacts now exist: `docs/strategy-spec-check.md`, `scripts/strategy_spec_check.js`, and `tests/strategy_spec_check.test.js`. This validates whether an idea is specified enough for research/paper review; it never authorizes live orders.

## Decisions

- Backtest priority: `orb` → `vwap_reversion` → `pdh_pdl_break` → `ema_pullback` → `nr_squeeze`.
- Market priority: `fx` first, then `futures`, then `stocks_us`, then `stocks_jp`.
- Backtest adoption criteria remain those in `skills/setup-verify/SKILL.md`; do not weaken the adopted gate.
- After each completed setup-level verification, stop and show `git status` plus `git diff --stat` before continuing.
- LLM/automation for daily review is a research/review layer, not the alpha final layer. Final trade direction, size, order timing, SL/TP, kill switches, and live execution remain human/predefined-rule decisions.
- New strategy ideas must pass `npm run strategy-spec-check -- <spec.json>` before being treated as paper/review candidates. Complete specs are still `watch`/paper-only, not `act` or live execution.

## Current plan

1. Continue setup verification on `fx` symbols (`FX:USDJPY`, `FX:EURUSD`, `FX:GBPUSD`, `FX:AUDUSD`) on 5m and 15m.
2. Use the `skills/setup-verify/SKILL.md` 9-step flow.
3. Save one JSON file per setup/symbol/timeframe/date under `journal/backtests/`.
4. Update `journal/registry.json` market status only from recorded backtest evidence.
5. If any setup x market becomes `adopted`, run `/trade-judge` E2E on that combination and append a judgement JSONL record.

## Next actions

- Stop after completed `nr_squeeze` / `fx` verification and show `git status` plus `git diff --stat` before continuing.
- If approved, proceed to `futures` market verification using the same setup-verify evidence loop.
- Do not retry Gate A1 or add a close fallback. Obtain a new design/approval
  decision for the current TradingView close API mismatch first.
- Do not run `/trade-judge` E2E yet; no setup x market is `adopted`.
- For the read-only reviewer, manually run `npm run daily-review -- --no-watchlist --bars 50` after TradingView Desktop is available on CDP. Keep it manual until the output proves useful and low-noise.
- For any new strategy hypothesis, first generate/fill the JSON template with `npm run strategy-spec-check -- --template`, then run `npm run strategy-spec-check -- <spec.json>` and route missing-critical ideas to `no-action`.

## Validation log

- 2026-07-05: Read continuation instruction file from `/home/yukio/Desktop/2026-07-05-tradingview-trade-system-next-steps.md`.
- 2026-07-05: Confirmed repo status: `CLAUDE.md` modified and trade-system artifact directories untracked.
- 2026-07-05: Confirmed `journal/registry.json` still has all market statuses as `candidate`.
- 2026-07-05: Updated project-local `skills/setup-verify/SKILL.md` Step 2 to require confirming the TradingView save dialog via `ui_click({ by: "text", value: "保存" })` and verifying with `pine_list_scripts`.
- 2026-07-05: Confirmed TradingView CDP is connected via `node src/cli/index.js status` (`cdp_connected: true`, chart `FX:USDJPY`, resolution `5`).
- 2026-07-05: Confirmed `pine/setups/orb/orb_strategy.pine` passes `pine analyze` and `pine check` with 0 errors.
- 2026-07-05: Ran `npm run test`; 92/95 tests passed, with observed environment/UI failures in `tv_launch`, `ui_open_panel`, and `replay_stop`. The test run rewrote Pine Editor to the E2E sample; restored the previous `DT ORB v1` editor source from `/tmp/current_orb.pine` afterward.
- 2026-07-05: With user approval, overwrote Pine Editor with `pine/setups/orb/orb_strategy.pine`, compiled with 0 errors, saved `DT ORB v1` to TradingView Cloud as version 15.0, and set FX inputs to `Session preset=London`, `OR window=0800-0830`.
- 2026-07-05: Fixed `src/core/data.js` strategy detection for overlay strategies (`meta.is_price_study=true`) and compacted strategy metrics; updated `src/core/batch.js` to use the internal strategy metrics path for `get_strategy_results`.
- 2026-07-05: Ran ORB/fx backtest batch for `FX:USDJPY`, `FX:EURUSD`, `FX:GBPUSD`, `FX:AUDUSD` on 5m/15m. Wrote 8 JSON files under `journal/backtests/`.
- 2026-07-05: Updated `journal/registry.json`: `orb.markets.fx.status = rejected`, `bt_winrate = 0.492374`, `bt_pf = 0.850331`, evidence paths attached. Rationale: all 5m runs had n<100; all sufficient 15m runs failed PF threshold.
- 2026-07-05: Updated `journal/README.md` backtest schema example to include effective `inputs`, `winrate_pct`, and `currency`, matching the generated evidence files.
- 2026-07-05: Verified `src/core/data.js` and `src/core/batch.js` with `node --check`; ran `npm run test:unit` successfully (29/29). Parsed `journal/registry.json` and all 8 backtest JSON files successfully.
- 2026-07-05: Restored TradingView chart to `FX:USDJPY` 5m after the ORB/fx batch.
- 2026-07-05: Confirmed `pine/setups/vwap_reversion/vwap_reversion_strategy.pine` passes `pine analyze` and `pine check` with 0 errors.
- 2026-07-05: With user approval, overwrote Pine Editor with `pine/setups/vwap_reversion/vwap_reversion_strategy.pine`, compiled with 0 errors, saved the active TradingView Cloud script to version 16.0, and confirmed the chart strategy title as `DT VWAP Reversion v1`.
- 2026-07-05: Set VWAP/fx inputs to `Session preset=NY` with default RSI/trend settings, then ran VWAP/fx backtest batch for `FX:USDJPY`, `FX:EURUSD`, `FX:GBPUSD`, `FX:AUDUSD` on 5m/15m. Wrote 8 JSON files under `journal/backtests/`.
- 2026-07-05: Updated `journal/registry.json`: `vwap_reversion.markets.fx.status = rejected`, `bt_winrate = 0.325091`, `bt_pf = 0.844102`, evidence paths attached. Rationale: all 5m runs had n<100; all sufficient 15m runs failed WR/PF threshold.
- 2026-07-05: Restored TradingView chart to `FX:USDJPY` 5m after the VWAP/fx batch.
- 2026-07-05: Re-verified `src/core/data.js` and `src/core/batch.js` with `node --check`; ran `npm run test:unit` successfully (29/29). Parsed `journal/registry.json` and all 16 backtest JSON files successfully.
- 2026-07-05: Confirmed `pine/setups/pdh_pdl_break/pdh_pdl_break_strategy.pine` passes `pine analyze` and `pine check` with 0 errors.
- 2026-07-05: Overwrote Pine Editor with `pine/setups/pdh_pdl_break/pdh_pdl_break_strategy.pine`, compiled with 0 errors, saved the active TradingView Cloud script to version 17.0, and confirmed the chart strategy title as `DT PDH PDL Break v1`.
- 2026-07-05: Set PDH/PDL fx inputs to `Session preset=NY`, `Retest timeout=12`, then ran PDH/PDL fx backtest batch for `FX:USDJPY`, `FX:EURUSD`, `FX:GBPUSD`, `FX:AUDUSD` on 5m/15m. Wrote 8 JSON files under `journal/backtests/`.
- 2026-07-05: Updated `journal/registry.json`: `pdh_pdl_break.markets.fx.status = rejected`, `bt_winrate = 0.391143`, `bt_pf = 0.894389`, evidence paths attached. Rationale: all 5m runs had n<100; only EURUSD 15m passed, not a market majority.
- 2026-07-05: Restored TradingView chart to `FX:USDJPY` 5m after the PDH/PDL fx batch.
- 2026-07-05: Re-verified `src/core/data.js` and `src/core/batch.js` with `node --check`; ran `npm run test:unit` successfully (29/29). Parsed `journal/registry.json` and all 24 backtest JSON files successfully.
- 2026-07-05: Confirmed `pine/setups/ema_pullback/ema_pullback_strategy.pine` passes `pine analyze` and `pine check` with 0 errors.
- 2026-07-05: Overwrote Pine Editor with `pine/setups/ema_pullback/ema_pullback_strategy.pine`, compiled with 0 errors, saved the active TradingView Cloud script to version 18.0, and confirmed the chart strategy title as `DT EMA Pullback v1`.
- 2026-07-05: Set EMA Pullback fx inputs to `Session preset=NY`, `EMA20=20`, `EMA50=50`, `Slope lookback=5`, `Trigger window=3`, `Max distance=1.0 ATR`, `Max signals/day=2`, then ran EMA Pullback fx backtest batch for `FX:USDJPY`, `FX:EURUSD`, `FX:GBPUSD`, `FX:AUDUSD` on 5m/15m. Wrote 8 JSON files under `journal/backtests/`.
- 2026-07-05: Updated `journal/registry.json`: `ema_pullback.markets.fx.status = rejected`, `bt_winrate = 0.284925`, `bt_pf = 0.675665`, evidence paths attached. Rationale: all runs had n>=100, but every symbol/timeframe failed WR/PF threshold.
- 2026-07-05: Restored TradingView chart to `FX:USDJPY` 5m after the EMA Pullback fx batch.
- 2026-07-05: Re-verified `src/core/data.js` and `src/core/batch.js` with `node --check`; ran `npm run test:unit` successfully (29/29). Parsed `journal/registry.json` and all 32 backtest JSON files successfully.
- 2026-07-05: Confirmed `pine/setups/nr_squeeze/nr_squeeze_strategy.pine` passes `pine analyze` and `pine check` with 0 errors.
- 2026-07-05: Overwrote Pine Editor with `pine/setups/nr_squeeze/nr_squeeze_strategy.pine`, compiled with 0 errors, saved the active TradingView Cloud script to version 19.0, and confirmed the chart strategy title as `DT NR Squeeze v1`.
- 2026-07-05: Set NR Squeeze fx inputs to `Session preset=NY`, `NR lookback=7`, `Breakout window=3`, `Max signals/day=2`. The first FX batch lost CDP after `FX:USDJPY`; relaunched/navigated TradingView, reran the remaining symbols, then merged successful rows from both raw JSON files.
- 2026-07-05: Wrote 8 NR Squeeze fx JSON files under `journal/backtests/` and updated `journal/registry.json`: `nr_squeeze.markets.fx.status = rejected`, `bt_winrate = 0.398104`, `bt_pf = 0.628964`, evidence paths attached. Rationale: all runs had n>=100, but every symbol/timeframe failed WR/PF threshold.
- 2026-07-05: Restored TradingView chart to `FX:USDJPY` 5m after the NR Squeeze fx batch.
- 2026-07-05: Re-verified `src/core/data.js` and `src/core/batch.js` with `node --check`; ran `npm run test:unit` successfully (29/29). Parsed `journal/registry.json` and all 40 backtest JSON files successfully.
- 2026-07-07: Added read-only daily review spec, script, npm command, and unit tests. `node --check scripts/daily_review.js` and `node --check tests/daily_review.test.js` passed.
- 2026-07-07: Ran `npm run test:unit`; 31/31 tests passed after adding `tests/daily_review.test.js` to `test:unit`.
- 2026-07-07: Ran `npm run daily-review -- --no-watchlist --bars 50`; script produced a markdown report, correctly reported CDP unavailable, and still summarized local registry gate (`adopted=0`, `candidate=15`, `rejected=5`).
- 2026-07-08: Added deterministic read-only `strategy_spec_check` CLI/module, docs, npm script, and unit tests.
- 2026-07-08: Verified `node --check scripts/strategy_spec_check.js`, `node --check tests/strategy_spec_check.test.js`, existing daily-review checks, and `git diff --check`; all passed.
- 2026-07-08: Ran `npm run test:unit`; 36/36 tests passed after adding `tests/strategy_spec_check.test.js` to `test:unit`.
- 2026-07-08: Ran `npm run --silent strategy-spec-check -- --template` and parsed the output as JSON; ran `npm run --silent strategy-spec-check -- /tmp/complete_strategy_spec.json --strict`, which produced a complete paper/watch-only report with `live_order_allowed=false`.
- 2026-07-12: Re-ran syntax checks for the post-review health/CDP/Pine changes; all passed.
- 2026-07-12: Re-ran focused `connection`, `raw_command`, and `health_launch` tests: 46/46 passed.
- 2026-07-12: Re-ran `npm run test:unit` after post-review remediation: 277/277 tests passed, 37 suites, fail/cancelled/skipped 0.
- 2026-07-12: Validated preserved strategy/daily-review changes with focused 9/9 tests and `npm run test:unit` 279/279, 37 suites, fail/cancelled/skipped 0.
- 2026-07-12: Validated strategy hardening (11/11), coordinator/manifest (17/17), and `npm test` safe-stop (`external_action_count=0`, live=false).
- 2026-07-12: Validated final minor hardening with focused 26/26 tests and `npm run test:unit` 294/294, 37 suites, fail/cancelled/skipped 0.
- 2026-07-12: Committed and pushed `3eafd93` (strategy research gates) and
  `5ccb414` (per-fetch stream abort propagation) as separate intent groups;
  focused strategy/stream 24/24 and `npm run test:unit` 302/302 passed.
- 2026-07-12: Ran `npm test` through the coordinator; it emitted
  `OFFLINE_APPROVAL_REQUIRED` with `external_action_count=0` and
  `live_test_started=false`.
- 2026-07-08: Launched TradingView Desktop with `HOME=/home/yukio` and CDP port 9222, then repaired current Linux/TradingView-build E2E drift: Linux binary path detection, visible-range assertion, bottom widget close fallback, and replay-stop cleanup.
- 2026-07-08: Ran targeted E2E for `tv_launch|chart_set_visible_range|ui_open_panel|replay_stop`; 4/4 passed.
- 2026-07-08: Ran full `npm run test`; 95/95 tests passed.

## Blockers

- CDP was unavailable during the 2026-07-07 read-only daily review sample run and the first 2026-07-08 full test attempt. Treat CDP/MCP failure as a hard stop for chart-state claims; do not fabricate chart or backtest results.
- Current full verification is clean after launching TradingView with CDP: `npm run test` passed 95/95 on 2026-07-08.
- Pine Cloud persistence is currently using the active script slot: after saving setup strategies, `pine list` showed `scriptName = DT ORB v1` and current setup `scriptTitle` (latest: `DT NR Squeeze v1`). This is acceptable for the current backtest evidence loop but should be fixed with a true Save As flow before relying on separate Cloud script names.
