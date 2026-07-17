# WORKSTATE

Last updated: 2026-07-17

## Scalping verification round 2 + intraday_momo_pure (2026-07-18) — COMPLETE

- `intraday_momo_pure` ablation 検証（futures + fx、15分足 n=133-151）: **両市場 rejected**。
  ablation 仮説は**反証**: 先物では pure が全銘柄で overlay 版より悪化
  （ΔPF -0.08〜-0.18、ΔWR -2.7〜-4.6pp、n 完全一致のペア比較）。SL/TP オーバーレイは
  エッジを削っていたのではなく損失を緩和していた。fx は sizing 差で記述的比較に留まるが
  PF 0.19-0.57 帯で同様に fail。Codex (gpt-5.6-sol high) レビューで判定整合・比較方向を
  確認（full-sample tail 未検証と ES/NQ/YM 非独立性は caveat として registry notes 記録）。
  証跡14本。復元検証済み。
- **最終結論**: 検証した全 setup × 市場（momo fx/futures、noise_break stocks_us、
  vwap_rsi_pullback stocks_us、momo_pure fx/futures = 計8組）が rejected、
  torb futures が insufficient_data。adopted 0件。intraday momentum 系は
  overlay 有無に関わらずこの環境・データでは不成立と結論。
- 残る未検証: torb（先物 RT データ契約待ち）、noise_break/vwap_rsi_pullback の
  fx・futures・stocks_jp、全 setup の stocks_jp。ただし全ファミリーの evidence が
  弱い現状では、新規検証より新しいエッジ仮説の発掘を推奨。
- MCP バグ追加知見: pine ツールの Monaco 検出は `getEditors()[0]` が hidden
  pre-warmed instance を掴む。`getDomNode() === container` 照合での修正を推奨
  （既起票の pine editor バグタスクに該当、別セッションで修正中）。

- setup-verify 実施結果（stocks_us、BATS:* 解決を証跡記録）:
  - `noise_break` / stocks_us: **rejected**。5分足 n=379-402 で PF 0.87-1.14 / WR 21-25%。
    TSLA のみ黒字だが WR 基準未達。1分足は履歴 ~2.7ヶ月で insufficient（n-gate 優先を
    Codex レビューで確認）。QQQ は参考扱いで投票外。証跡8本。
  - `vwap_rsi_pullback` / stocks_us: **rejected**。5分足 n=184-234 で PF 0.84-0.98。
    重要発見: 源泉銘柄 QQQ ×源泉の朝窓（0945-1130）でも PF 0.998 の完全損益分岐
    （源泉主張は朝窓 PF 2.08）→ 源泉研究自体の OOS 減衰シグナルとして registry notes に
    記録。long-only 分解でも救済不可。証跡4本。
  - adopted は引き続き 0件。検証済み: momo(fx/futures)・noise_break(stocks_us)・
    vwap_rsi_pullback(stocks_us) 全て rejected、torb(futures) insufficient_data。
- `intraday_momo_pure` を新規実装（candidate 登録済み）: SL/TP1 オーバーレイなし・
  EODのみの源泉忠実 ablation 変種。災害ストップは 0=OFF 既定・有効化 run は別変種扱い。
  ラベルは `sl=none`/`tp1=none`/`tp2=none` エンコード（PINE_CONVENTIONS の price-only
  文法からの逸脱は README に記録、規約側の追記は将来課題）。sizing は Fixed 1 既定。
  Codex (gpt-5.6-sol high) 設計パス採用。spec-check 通過。契約テスト SETUP_IDS に追加。
- 検証エージェント定義 `.claude/agents/codex-setup-verifier.md` を永続化。
- Codex model 注記: このアカウント（ChatGPT 認証）は `gpt-5.6` 単体を受け付けず、
  実行は全て `gpt-5.6-sol` (effort high)。
- torb 再検証は先物リアルタイムデータ契約が前提のため保留（外部前提）。
- test:unit 491/491 PASS。momo_pure の live コンパイル検証は実施中/直後に記録。

## Scalping evidence research + 4 candidate setups (2026-07-17) — VERIFICATION ROUND 1 DONE

- setup-verify 実施結果（2026-07-17 夜）:
  - `torb` / futures: **insufficient_data**。アカウントが先物リアルタイム未契約で
    `*_DL` 遅延フィードへ強制解決、1分足履歴 ~300本かつ全て RTH 時間外で評価不能。
    証跡3本 + registry 更新済み（戦略品質の判定ではない）。
  - `intraday_momo` / futures・fx: **両市場 rejected**。15分足で全銘柄 n>=145 の十分
    サンプル、PF 0.19-0.65 / WR 26-42% で基準（WR45+PF1.3 or WR35+PF1.6）に遠く届かず。
    証跡14本 + registry 更新済み。文献警告（通貨変種最弱・SPY変種減衰）と整合。
    先物は口座 percent_of_equity 10% では1枚も建たないため futures のみ fixed 1
    contract に変更（唯一の調整、証跡・notes 記録済み）。
  - adopted は引き続き 0件。noise_break / vwap_rsi_pullback は未検証（candidate のまま）。
- 未コミット: momo 証跡14本 + registry + 本 WORKSTATE。ワークツリー3本
  （ツールバグ修正の並行セッション）稼働中は `.git/config.worktree` 権限で
  当セッションの git が使用不能。ワークツリー掃除後にコミット予定。
- MCPツールバグ3件は別タスク起票済み（pine editor 二重Monacoノード /
  chart系 "evaluate is not defined" / batch_run の _DL リダイレクト）。
  momo 実走で判明した追加知見: `ui_open_panel` が pine-editor を silently no-op
  するケースあり（`pine-dialog-button` クリックで回避）。

## (前段) Scalping evidence research 実装記録 (2026-07-17)

- 100体の Codex (gpt-5.6-sol, effort high, read-only sandbox, web search) 調査
  ワークフロー実施（85/100成功）。10ファミリー統合 → `docs/research/scalping-20260717/`
  （raw 87本、family_*.md 10本、REPORT.md）。
- 総括は誠実に負寄り: コスト・OOS適用後に大半のエッジは消滅。生き残った4ロジックを
  DT setup として実装（全て candidate、adopted ゲートは不変・adopted 0件）:
  `torb`（IEEE Access 査読、指数先物・1分OR）/ `intraday_momo`（JFE + 62先物46年、
  SPY変種は独立再検証で負け→先物優先）/ `noise_break`（SSRN + 3独立記事、Grade B）/
  `vwap_rsi_pullback`（QQQ単一研究、Grade B）。
- 成果物: `pine/setups/{torb,intraday_momo,noise_break,vwap_rsi_pullback}/`
  （indicator + strategy + README）、`journal/specs/*_spec.json`（strategy-spec-check
  全通過・watch/paper-only）、registry 4エントリ追加、
  `tests/scalp_setups_contract.test.js`（test:unit 登録済み）、
  PINE_CONVENTIONS.md allowlist 追加、agent定義
  `.claude/agents/codex-scalp-{researcher,implementer}.md`。
- 検証（完了）: セットアップ別敵対的レビュー 4/4 PASS → Codex (gpt-5.6-sol high)
  レビュー3巡（R1: critical 1 + high 14 → 修正 / R2: 新規 high 5（time_close の
  セッション判定はバー開始時刻基準、RTH-only での inSession[1] 遷移不発 等）→ 修正 /
  R3: f_minToHHMM 整数化漏れ1件 → 修正 → micro-review `VERDICT: ok`）。
  `npm run test:unit` 486/486 PASS。全8 Pineファイルを live TradingView で
  pine_smart_compile 検証（エラー0、momo strategy に情報警告1のみ）。
- インシデント（復旧済み）: pine_smart_compile の保存が active slot の
  「増田式 Daily Watchlist v1」に上書きされていた。`pine/screeners/masuda_daily_watchlist.pine`
  から復元・保存し、pine_get_source でタイトル・82行・内容一致を検証済み。
  クラウド版履歴に旧版あり。以後のコンパイル検証は復元手順を必須化。
- 並行セッション注意: 本ブランチは別の自動化セッションが 13:25/15:35 に書き換えており、
  HEAD には本作業の中間版が `feat(scalp): Add candidate setup pack` として取り込み済み。
  最終版（レビュー3巡通過後）は未コミットの working-tree 差分（13ファイル +815/-347）。
  コミットはユーザー判断待ち。
- 境界: 全て paper/研究層。live 判定対象になるには既存 setup-verify バックテスト
  ゲート通過が必要。発注・執行は常に人間。

## DT Pair-Trader layer (2026-07-15) — BUILT, unverified live

- 新規レイヤー: リアルタイム・ペアトレーディング支援。3層コスト設計
  （main=オーケストレーションのみ / Sonnet サブエージェント4種 / 重い推論は
  公式 `codex@openai-codex` companion の Codex gpt-5.6-sol high へ委譲）。
- 成果物: `.claude/agents/{pair-trader-orchestrator,market-watcher,setup-analyst,risk-officer,journal-scribe}.md`、
  `.claude/commands/pair-session.md`、`docs/pair-trader.md`、`.gitignore` に `._*` 追加。
- ガードレール: registry `adopted` かつ signal `forming|triggered` のみライブ判定。
  state がそれ以外または label 0件は `no_signal`、forming/triggered かつ non-adopted
  だけを `live_ineligible` / `NOT-ELIGIBLE` とする（判定・screenshot・journal・
  companion なし）。発注・執行は常に人間。eligible 判定だけを journal JSONL に記録
  （GO/WAIT/NO-GO）、breakdown 100点スケール
  （setup30/mtf20/level15/session10/track10/rr15）。
- 既知の制約:
  - 公式 companion は `task --fresh`、`--write` なしで read-only Codex task
    sandbox を使用。プロンプト末尾の no-file-write 指示と実行前後の3 fingerprint
    比較は defense in depth として維持。
  - invocation plugin の `--tools` は built-in tool を制限し、検証済み agent
    frontmatter が exact MCP/subagent capability boundary を定義する。`allowedTools` は
    permission preapproval であって availability 境界ではない。親に Bash/raw data
    tool はない一方、子 agent の Bash 内 command と no-order は hard enforcement
    ではない点を residual として維持。
  - project agent 定義の runtime discovery は新しい Claude Code session で確認が必要。
  - この sandbox シェルでは `node` が nvm lazy-load 破損で直接実行不可の環境がある
    （journal-scribe の `node scripts/journal_stats.js` が失敗しうる）。
- codex-review 2巡実施（gpt-5.6-sol high）。1巡目 high 7 / medium 2 → 修正、
  2巡目の残指摘のうち「Bash のコマンド単位 allowlist 強制」は agent frontmatter の
  表現力上不可のため Known Limitations として文書化（hook 強制は将来課題）。
  watcher は Ubuntu の実名 `mcp__tradingview__...` 読み取りツールだけを allowlist。
- Revision lane（2026-07-16）:
  - bounded main-thread agent を追加。`start|next` は1 cycleでreturn、`end` は health
    非依存で summary のみ。
  - watcher に `snapshot_status` を追加し、quote / DT labels / OHLCV summary の失敗を
    incomplete として judgement path を停止。
  - setup/risk は eligibility を companion 前に検査し、成功出力返却、degraded fallback、
    `analysis_mode` 伝播を契約化。
  - judgement append は最終行を再読・parse・id/shape 検証。`journal_stats.js` は trade
    append 後だけ実行。
  - offline verification PASS: real frontmatter YAML parse（`._*` 除外）、setup/risk
    companion block `bash -n`、non-adopted/non-live-state sentinel 実行、watcher 7 tool
    / orchestrator 7 tool exact assertion、`src/tools` 登録 78 unique、stale Pair-Trader
    reference scan、許可 path 8/8、`git diff --check @{upstream}`。live TradingView、
    journal append、companion model 実行は未実施。
- Final repair lane（2026-07-16）:
  - summary の exact zero object を health/chart/registry より前に初期化し、health failure
    または完了 cycle 0件の bounded `end` は health/tools/workers を含めずゼロ値を返す。
  - watcher の complete 条件を expected/observed symbol+timeframe 一致、usable quote、
    `study_filter: "DT "` 成功（0件可）、OHLCV summary true/count20、current-cycle tool
    response 由来の fresh ISO-8601 timestamp の全成立へ強化。不成立は
    `snapshot_failed` として registry 前に停止。
  - judgement は final-line の expected id / shape / exact object をすべて検証した
    `verified=true` だけを `journal_status=appended` / `status=completed` として summary
    加算。失敗は planned id 付き `journal_failed`、加算・削除・書換・再試行なしで
    live judgement を停止。
  - `tests/pair_trader_contract.test.js` を追加し、`test:unit` に1回だけ登録。Node built-in
    のみで exact tools、state mapping、snapshot、journal gate、bounded zero end、
    gpt-5.6-sol/high と `--write` 不在を実ファイルから検査。
  - validation: contract test 6/6 PASS、manifest package-gates PASS、frontmatter YAML
    6 files PASS（`._*` 除外）、`git diff --check` PASS。指定 focused `node --test`
    では contract file は PASS、既存 manifest の nested Node `spawnSync` が managed
    sandbox の `EPERM` で1件のみ実行不能（契約/selection assertion の失敗ではない）。
    Node 18 の既知・無関係な MockTimers API 差は `tests/batch.test.js` で25件中1件
    failure（object 引数ではなく Array が必要）として再確認し、本 lane では未修正。
- Runtime contract repair lane（2026-07-16）— OFFLINE PASS、live re-smoke pending:
  - 0.5.3 smoke で、command contract Read 後に health より先に agent markdown / registry
    を Read。health unavailable は正しく `health_failed` になったが、final が prose/fence
    付きで `required_cycle_id` / `required_cycle_seq` / `session_summary` / `note` を出し、
    `action` を欠いたため plugin が `structured_contract_failure` で fail closed した。
  - bounded `start|next` は command contract のみ Read → exact zero summary 初期化・resume
    値の in-memory 検証 → 次の tool を fresh
    `mcp__tradingview__tv_health_check` に固定。health 成功前の agent/registry/chart state
    Read、Agent、他 MCP を禁止し、agent markdown は事前 Read せず exact subtype で委譲。
    bounded `end` は resumed context のみを使う zero-Read/zero-tool 経路に分離。
  - bounded final は13 exact keys の raw JSON object 1個に固定。input-only alias を output
    `cycle_id` / `cycle_seq` に写し、`session_summary` / `note` と prose/fence/extra field を禁止。
    nested `summary` は nonnegative counts、count sum、unique ids、id length の不変条件を固定。
  - validation: focused contract 8/8 PASS、manifest classification/package gates 11/11 PASS、
    Pair-Trader agent frontmatter exact tools 5/5 PASS、stale refs 0、diff whitespace PASS。
    full manifest は 11/12 で、残る1件は managed sandbox が nested
    `/home/yukio/.hermes/node/bin/node` を `spawnSync ... EPERM` で拒否した既知の環境 residual。
    live TradingView / Claude、journal append、commit、push は未実施。
- Pre-push review repair lane（2026-07-17）— OFFLINE PASS、live-ready ではない:
  - MASUDA shadow watcher は `last_fired` の単なる不一致ではなく単調増加だけを新規通知とし、
    timestamp 回帰時は通知せず保存済みstateも巻き戻さない。
  - interactive direct mode の `next check` / chart-context change も、次cycleまたはchart操作の
    前に fresh `mcp__tradingview__tv_health_check` を必須化。
  - RED→GREEN focused tests 14/14 PASS。独立Claude reviewは
    `Clean. Pushable development; not live-ready.`。子agent Bashのcommand-level強制不足、
    live TradingView/CDP、journal append、companion実走は既知residualのまま。
- スモーク検証（2026-07-15、commit ca1b88f 後）:
  - market-watcher: MCP 未接続環境で fail-path PASS（テンプレート遵守・データ捏造
    なし・MTF 全 unknown 報告）。
  - journal-scribe: 不正レコード（verdict enum 違反 + score≠breakdown 合計）を
    正しく 2 件とも検出し書き込みゼロで拒否。journal 内容差分ゼロを git で確認。
  - CDP (localhost:9222) は HTTP 000 — TradingView Desktop 未起動。
- Ubuntu Hermes 統合（2026-07-15、追加契約）:
  - 運用経路は Ubuntu Hermes/Fern orchestrator → Hermes `pair_trader_cycle` →
    Claude Code execution hub → project subagents → setup/risk の公式
    `codex@openai-codex` companion（gpt-5.6-sol/high）。
  - companion は `installed_plugins.json` の `codex@openai-codex` 有効 installPath
    から動的解決し、無効・path/script 不在時は fail closed。
  - Ubuntu の Claude MCP `tradingview` は `/usr/bin/node
    /home/yukio/Coding/tradingview-mcp/src/server.js` で登録済みで、`claude mcp list`
    は connected を報告済み。ただしこれは登録・接続一覧の証拠に限られ、live
    CDP/TradingView health と `/pair-session` 実走は未証明。
- 未実施（ライブ実走の前提条件）:
  1. TradingView Desktop を CDP (port 9222) 付きで起動し、live health を確認。
  2. 新セッションで `/pair-session <symbol>` を実走し、read-only watcher、
     registry gate、companion delegation の end-to-end 動作を確認。


## Side project: quant-github-atlas (2026-07-07) — COMPLETED

- `/home/yukio/Coding/quant-github-atlas/` に世界のクオンツトレードGitHub分析基盤を構築完了（本リポジトリのコードは未変更）。
- 実績: Codex CLI (gpt-5.5, xhigh, fast, `--sandbox read-only`, web search) 計116回（本体100 + QC起点の修復16）、エラー0。カタログ452 repos / 43カテゴリ / 不正行0、Top30深掘り、セキュリティ監査30 repo、レポート10本、敵対的QC 4本。
- 主要セキュリティ検出: hummingbot pickle RCE疑義(high)、RD-Agent 未認証ポート(high)、tensortrade docsドメイン乗っ取り。詳細は `reports/security.md`。
- 再利用可能パターン: Codex read-only sandbox + Claude haiku 検証ラッパー + Workflow 並列14。サブエージェント定義 `~/.claude/agents/codex-{quant-researcher,security-auditor,synthesizer}.md`（次セッションから registry 有効）。

## Current state

### Audit / hardening stream (2026-07-12)

- Branch `codex/tradingview-audit-hardening` contains the hardening intent
  commits from the 2026-07-08 baseline. At this revision start it was 1 commit
  ahead of `fork/codex/tradingview-audit-hardening`, with uncommitted Pair-Trader
  contract changes; it is not synchronized with `fork`.
- P1-01 through P1-06 operational hardening is committed in separate intent
  groups. The remaining baseline raw CDP calls are P2 notes outside the
  accepted P1 paths.
- Gate A0 Pine discovery is implemented and independently Approved. After the
  P1-07/P1-08 approval-boundary hardening, the offline A0 suite passes 191/191
  on repeated runs. The current digest-bound Gate A1 artifact is
  `cb9461dae3e319cd0eee5ab68d42f1b9723b024d12b6b24f74b13642fc08ae65`.
  Every earlier digest, approval, and nonce is invalid.
- An earlier Gate A1 attempt used its exact command, target tuple, budgets, and
  residual caveat are frozen in the A0 approval envelope. The one approved attempt
  exited 1 at `PINE_DISCOVERY_OPEN` with ledger `1/0/1`, retry/fallback `0`,
  probe absent, and residual `UNKNOWN`; it was not retried.
- Independent read-only evidence found the exact target/tuple/frame/context
  unchanged, editor closed, and no process/tab/context mutation. The reviewed
  open method is callable, but the reviewed close method
  `hideWidget('pine-editor')` is currently non-callable. The open failure is
  therefore classified as `THROW_OR_POST_OPEN_VISIBILITY_UNPROVEN` until a
  separately approved diagnostic can distinguish the two without reopening.
- A later exact Gate A1 attempt safely stopped in `PREFLIGHT` with
  `PINE_DISCOVERY_CLOSE_CAPABILITY`, zero open/probe/close actions, and a
  closed residual because the approved `hideWidget` capability was absent.
  The spent nonce was not reused. Offline remediation now binds the sole Gate
  A1 close mutation to the no-argument `bottomWidgetBar.close()` path that was
  live-verified upstream on TradingView Desktop 3.2.0 / Electron 38. Its
  callability on the current exact target remains unverified until the fresh
  read-only preflight runs; every prior digest, approval, and nonce remains
  invalid.
- Gate A1 evidence was independently integrated into
  `docs/superpowers/plans/2026-07-12-gate-a1-evidence-integration.md`.
  P1-07 close-capability fail-closed preflight, P1-08 fixed open-stage result
  classification, P1-09 closed-editor read-only boundary, and P1-10 the new
  digest-bound close-strategy approval artifact are complete offline. Gate B
  production runtime v5 is also complete offline: actual main, 24 fixed cases
  in six fixed children, digest-bound registries, secure lease, authenticated
  session/protocol ledger, restore verification, and benchmark provenance are
  implemented. Live dispatch remains approval-gated.
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
- The latest independent final review is `Accepted` with zero Critical, zero
  Important, and zero Minor findings. Gate B v5 repository unit verification
  passed 445 tests.
  `npm test` remains an approval-gated safe stop with a zero-action ledger
  (`external_action_count=0`, `live_test_started=false`).
- Gate B binds a logical inventory of 11 operations, 978 attach and 978 detach
  events, 7,832 reads, 122 mutations, 12 input events, 6 network requests, 8
  child processes, 3 captures, and one full-gate invocation. These are offline
  approval ceilings and simulated-ledger expectations, not live measurements.
- Baseline benchmark provenance is fixed at commits `28e257e` and `c8ba1d9`.
  Candidate code landed at `c78f0b5`; after the documentation commit, fresh
  approval generation must bind `candidate_repository_commit` to the then-
  current final HEAD rather than reusing `c78f0b5` as the candidate binding.
- No live CRI/CDP operation, TradingView/UI mutation, external network action,
  save, reload, tab/process operation, Gate A1 retry, full live E2E, or real
  benchmark was run for the latest offline issues. Gate A1 is blocked on fresh
  exact written approval and a fresh one-shot approval file. Gate B is blocked
  on a separately approved fresh v5 envelope and one-shot nonce; that live run
  must supply the actual numeric before/after benchmark result.

- Historical TradingView trade-decision support artifacts and workflow notes remain in this repository; the older setup-verification context below is retained.
- The previously pushed hardening commits were clean; the current offline
  residual issue set is pending its final semantic commits. No unrelated
  untracked trade-system path is part of this audit stream.
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
- Do not run Gate A1 until the user gives fresh written approval for digest
  `cb9461dae3e319cd0eee5ab68d42f1b9723b024d12b6b24f74b13642fc08ae65`
  and its exact command, and a fresh one-shot approval file is safely issued.
  Never reuse an old digest, approval, or nonce.
- Do not run Gate B live execution until a fresh v5 envelope binds the final
  post-documentation HEAD, a fresh one-shot nonce is issued, and the user gives
  separate exact written approval. The approved live run must perform the real
  E2E and paired benchmark; offline ledger values are not speed measurements.
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
- 2026-07-13: Completed P1-07/P1-08/P1-09/P1-10 and the Gate B coordinator
  offline foundation. Repeated A0 verification passed 191/191, repository unit
  passed 332/332, and focused residual verification passed 33/33.
- 2026-07-13: Independent final review returned `Accepted` with Critical 0,
  Important 0, and Minor 0. `npm test` safe-stopped with a zero-action ledger;
  no live/CDP/UI/network operation was performed.
- 2026-07-13: Regenerated the offline Gate A1 approval envelope at digest
  `cb9461dae3e319cd0eee5ab68d42f1b9723b024d12b6b24f74b13642fc08ae65`.
  No approval instance, nonce, or live-valid expiry was issued.
- 2026-07-13: Rebound the offline Gate A1 open contract to the fixed
  read-only `showWidget` capability preflight and sole
  `showWidget('pine-editor')` mutation. Open and close visibility now use up to
  50 x 200 ms finite polls; no activate-tab, DOM-click, keyboard, focus, or
  second mutation fallback is permitted. Current-target callability remains
  unverified until a fresh exact approval and one-shot run.
- 2026-07-13: Replaced the drifted Gate A1 close contract with the fixed
  read-only `close()` capability preflight and sole no-argument close
  mutation. Production panel close now uses callable `close()` when
  `hideWidget` is absent and fails instead of falsely reporting `closed` when
  no close path exists. Gate B fixed close operations use the same current
  no-argument close contract without changing operation inventory counts.
- 2026-07-13: Completed Gate B production runtime v5 at candidate code commit
  `c78f0b5`, with 24 fixed cases, six children, production main, secure lease,
  authenticated session/protocol ledger, restore verification, and immutable
  benchmark provenance. Baseline provenance commits are `28e257e` and
  `c8ba1d9`.
- 2026-07-13: Gate B final offline review returned `Accepted` with Critical 0,
  Important 0, and Minor 0; repository unit verification passed 445 tests and
  `npm test` safe-stopped with zero external actions. No live/CDP/UI/network
  action or real benchmark was run.
- 2026-07-08: Launched TradingView Desktop with `HOME=/home/yukio` and CDP port 9222, then repaired current Linux/TradingView-build E2E drift: Linux binary path detection, visible-range assertion, bottom widget close fallback, and replay-stop cleanup.
- 2026-07-08: Ran targeted E2E for `tv_launch|chart_set_visible_range|ui_open_panel|replay_stop`; 4/4 passed.
- 2026-07-08: Ran full `npm run test`; 95/95 tests passed.
- 2026-07-17: Fixed `batch_run` for delayed-data futures redirects: `chartStateMatches` now accepts an observed `_DL` exchange variant of the requested symbol (one-directional, `src/wait.js` `isDelayedSymbolVariant`), success rows record `resolved_symbol` / `symbol_redirected`, and `get_strategy_results` retries once on `STRATEGY_FINGERPRINT_UNSTABLE` (`src/core/batch.js`). Added 5 regression tests; `tests/wait.test.js` + `tests/batch.test.js` 59/59 passed and `npm test` offline checks (unit, manifest) passed with live E2E safe-stopped as designed.

## Blockers

- Gate A1 requires fresh written approval of the exact current envelope and a
  fresh one-shot approval file. All older digests, approvals, and nonces are
  invalid; no retry is authorized by this WORKSTATE entry.
- Gate B production runtime is implemented and accepted offline, but no fresh
  v5 live envelope or nonce has been issued. Generate approval only after the
  final documentation commit so `candidate_repository_commit` binds current
  HEAD; then obtain separate exact written approval. Full live E2E and the
  actual numeric before/after benchmark remain unexecuted.

- CDP was unavailable during the 2026-07-07 read-only daily review sample run and the first 2026-07-08 full test attempt. Treat CDP/MCP failure as a hard stop for chart-state claims; do not fabricate chart or backtest results.
- Current full verification is clean after launching TradingView with CDP: `npm run test` passed 95/95 on 2026-07-08.
- Pine Cloud persistence is currently using the active script slot: after saving setup strategies, `pine list` showed `scriptName = DT ORB v1` and current setup `scriptTitle` (latest: `DT NR Squeeze v1`). This is acceptable for the current backtest evidence loop but should be fixed with a true Save As flow before relying on separate Cloud script names.
