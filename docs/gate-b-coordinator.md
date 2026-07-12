# Gate B coordinator activation boundary

## Current offline completion status

Gate B production runtime v5 is implemented offline: the actual coordinator
main, secure one-shot lease, authenticated loopback session/protocol ledger,
24 fixed cases across six fixed children, digest-bound registries, guarded
owner adapters, restore verification, and benchmark provenance/execution are
present. Independent final offline review returned `Accepted` with Critical 0,
Important 0, and Minor 0. Repository unit verification passed 445 tests, and
normal `npm test` safe-stopped with `external_action_count=0`.

The approved logical inventory is 11 operations, 978 attach and 978 detach
events, 7,832 protocol reads, 122 protocol mutations, 12 protocol input events,
6 network requests, 8 child processes, 3 captures, and one full-gate
invocation. These are fixed approval ceilings and offline simulated-ledger
expectations, not measurements from a live TradingView run.

No live CDP/UI/network action, full live E2E, or real paired benchmark has been
run in this completion stream. Gate B activation therefore still requires a
fresh v5 envelope, separate written approval, and a fresh one-shot nonce. The
live run must produce the actual baseline/candidate numeric benchmark result;
no offline fixture value is evidence of speed improvement.

`tests/test-coordinator.mjs` keeps normal `npm test` invocations offline. They
run the repeatable checks and return `OFFLINE_APPROVAL_REQUIRED` with a
zero-action ledger. Live activation is available only through the exported
programmatic boundary; no CLI argument contains or grants access to a nonce.

The exported Gate B helpers freeze and verify:

- repository HEAD, working-tree diff, test manifest, target policy, command,
  coordinator version, budgets, expiry, nonce digest, and registry digest;
- an atomic Git-common-dir `tradingview-mcp-e2e/active.lock` ownership lease;
- a durable one-shot `spent/<nonce-digest>.json` record without nonce plaintext;
- a digest-bound registry containing only reviewed live-suite case IDs.

`activateGateBFromApprovalFile` accepts an approval-file path from its trusted
caller, not from the public CLI. The file must be a single-link regular file
owned by the current uid, mode `0600`, at most 64 KiB, and opened with
`O_NOFOLLOW`. Its exact JSON fields are `schema_version`, `envelope`, and a
64-character lowercase hexadecimal `nonce`. The same open file description is
read and restatted, so pathname replacement cannot substitute its contents.

After secure ingress, the coordinator measures HEAD, working-tree diff, test
manifest, and explicit target policy twice. Both measurements must match each
other and the signed envelope while the approval is unexpired. Only then does
it create and fsync the global active lock and one-shot spent marker. A live
plan is exposed solely to an explicitly injected adapter after those durable
writes. The plan contains only the nonce digest embedded in lease paths; it
never contains nonce plaintext. Child environments drop approval-, nonce-,
secret-, token-, and Gate-B-named variables and redact the actual nonce value.

The state directory is not caller-selectable. Normal repositories and linked
worktrees resolve through their strict `.git`/`gitdir`/`commondir` chain to the
same Git common directory. Symlink aliases, unsafe Git pointers, and explicit
`stateDir` overrides are rejected. State, lock-owner, and spent-marker access
uses no-follow descriptors; child paths are opened relative to the retained
state-directory descriptor through `/proc/self/fd` so alternate caller paths
cannot create separate nonce registries.

Offline fault-injection covers missing files, symlinks, unsafe modes, malformed
or extended schemas, digest and binding mismatches, expiry, measurement drift,
unknown case IDs, concurrent locks, spent nonce reuse, crash residue, stale
lock ownership, absent adapters, and nonce non-propagation. If adapter dispatch
throws, outcome is unknown: the spent marker and active lock remain durable and
the same nonce cannot be retried.

The approval envelope binds dispatch to
`INJECTED_REVIEWED_ADAPTER_ONLY`. The coordinator does not import a live test,
open IPC, connect to CDP, send input, or perform network access by itself. If a
reviewed adapter is not injected, activation fails closed before consuming the
nonce. Actual live execution still requires a separately generated, current,
fresh Gate B approval file and explicit external-action authorization.

## Migrated live registry and budgets

All six historical live child files are migration-ready. They contain only
fixed `client.dispatch(case_id)` calls; the static boundary gate reports zero
direct CDP, fetch, input, or child-process bypasses. External operations live
in coordinator-owned case modules and are reachable only through the
authenticated loopback ledger and an injected reviewed adapter.

The central approval registry and IPC registry contain the same 24 case IDs:
13 chart-suite groups, `batch_1`, `quote_1..2`, `pine_facade_1..5`,
`graphics_ohlcv_1`, `graphics_primitives_1`, and `launch_reuse_1`. Their digest
is part of every Gate B approval envelope, so adding, removing, or renaming a
case invalidates prior approval material.
The envelope separately binds the IPC dispatch-registry digest and the exact
global budget object, so changing either case reachability or any ceiling
invalidates approval.

This production contract uses Gate B approval schema version 5 and coordinator
version `gate-b-production-v5`. Earlier drafts and their registry digests are
invalid even if their repository bindings otherwise appear current. The v5
envelope additionally binds the exact ordered 24-case set, six-child manifest,
full target context, build, workload, chart- and owner-operation registries,
the fixed `owner_local_pre_post` session policy, and benchmark-configuration
digests. The approved target context intentionally carries no concrete CDP
session ID: each operation owner establishes its own session and proves that
local session unchanged immediately before and after its operation.
The envelope also carries `issued_at` and `expires_at`; every transition reads
a fresh monotonic wall-clock value and enforces `issued_at <= now < expires_at`.
Clock rollback, expiry during measurement, or expiry before the first live
effect fails closed.

The approval binds the exact fixed protocol inventory: 11 logical operations,
978 CDP session attaches and detaches, 7,832 protocol reads, 122 protocol
mutations, 12 protocol input events, 6 network requests, 8 child processes, 3
captures, and one full-gate invocation. These are protocol-level approval
counts rather than inferred UI categories or live observations. The offline
production-factory E2E test asserts the exact simulated ledger, so registry,
session-lifecycle, or transport drift requires a new approval digest rather
than silent headroom.

The paired N=30 benchmark binds four immutable artifacts. The baseline workload
is loaded only from approved commit `28e257eeba9c103278612a0672d67d35a597ca7e`
at `src/e2e/benchmark/baseline_workload.js`, and the baseline executor only from
commit `c8ba1d90c6bbc8cab4f5811aed45f1f839044c71` at
`src/e2e/benchmark/baseline_executor.js`. Candidate workload and executor are
loaded with `git show` from the approved candidate commit at
`src/e2e/benchmark/candidate_workload.js` and
`src/e2e/benchmark/candidate_executor.js`; working-tree reads are forbidden.
All four artifact digests, fixed paths, baseline commits, candidate commit, and
the fixed workload digest are envelope and provenance fields. Baseline and
candidate workload and executor digests must differ.

The production code landed in candidate code commit
`c78f0b5`. That commit is provenance for implementation review, not a reusable
approval binding after documentation commits change HEAD. When fresh approval
material is generated, `candidate_repository_commit` must equal the then-current
final repository HEAD, and the candidate workload/executor must be loaded from
that exact commit. The fixed baseline commits remain `28e257e` and `c8ba1d9`.

Case registry entries carry no prepaid action deltas. The strictly serial IPC
adapter calls `control.authorize(counter, delta)` immediately before each real
effect. An overflow throws before that effect starts. The supplied reviewed
adapter wrapper classifies CDP read/mutation, text, key, mouse, capture, and
network operations and increments the authoritative ledger at dispatch time.
Adapter dispatch concurrency is exactly one. Throw, deadline, malformed result,
or a failure after any authorized effect is `unknown` and increments
`outcome_unknown_count`; `failure` is accepted only with explicit
`effect_started:false` and no authorization in that dispatch.

## Full approved state machine

The exact-command live branch remains unavailable from CLI flags and never
accepts nonce plaintext. `TRADINGVIEW_MCP_GATE_B_APPROVAL_FILE` may contain only
the path to the mode-0600 approval file. The main process imports one fixed,
production-only reviewed factory; callers cannot inject cases, owners,
benchmark results, ledgers, or executable configuration. With a complete fixed
assembly, the `npm test` coordinator consumes the one-shot lease, creates
the authenticated loopback ledger, runs fixed child case dispatches through
the guarded harness, verifies cleanup/restoration, and only then runs the
approval-bound paired benchmark. A known completion releases the active lock
while retaining the spent marker. Unknown outcomes retain the crash lock.
Missing approval or any fixed runtime component fails before lease consumption;
normal `npm test` continues through the offline safe-stop path.
Only repository HEAD, full tracked/untracked diff, and the fixed manifest are
measured before lease creation. CDP, localhost build discovery, target/frame/
loader/context verification, and every other live measurement run only after
the spent marker and active lock are durable, through the same IPC control as
the cases and benchmark. A live-measurement fault therefore retains both the
spent marker and crash lock.

## Phase 0b read-only mode

`--phase0-read-only` is a separate nonce-free coordinator branch. It does not
create an active lock or spent lease and cannot transition into the Gate B live
plan. The CLI alone supplies no target, transport, or capability, so a direct
CLI invocation fails closed with `PHASE0_CONFIGURATION_REQUIRED`.

A trusted in-process caller may inject an explicit target fixture consisting
only of an exact target/session/execution-context tuple and a read transport.
The coordinator passes that fixture to `createPhase0ReadOnlyPlan` and
`runPhase0ReadOnly`. The opaque plan permits one fixed `Runtime.evaluate` read
per explicit target through the CDP read adapter. Mutation, network, keyboard,
input, UI, child-live-test, tab, and process capabilities are neither issued
nor accepted.

Successful output contains only the reviewed aggregate schema and numeric
ledger. Target and session identities, transports, expressions, raw errors,
and arbitrary page values are excluded. Configuration or runner failures are
collapsed to fixed codes with a zero-action ledger. Normal `npm test` behavior
is unchanged and continues to stop offline with `OFFLINE_APPROVAL_REQUIRED`.
