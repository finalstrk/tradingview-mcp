# Gate A1 Evidence Integration and Next Approval Plan

Status: Gate A1 attempted once; evidence integrated; no live retry approved

Date: 2026-07-12

## Decision summary

Gate A1 exited safely with `PINE_DISCOVERY_OPEN` and exit code 1. The
effect ledger is `open=1/probe=0/close=1/retry=0/fallback=0`; no discovery
probe ran. Independent read-only checks found the exact target, chart tuple,
frame tree, context identity, target inventory, and current closed-editor
state unchanged. They also found that `activateScriptEditorTab` was callable
at observation time, while the approved `hideWidget('pine-editor')` close
method was not callable.

The result proves an open-stage failure and a safe stop. It does not prove
whether the open call threw, returned a non-boolean result, or succeeded but
failed to produce visible Monaco state within the bounded poll. The current
post-run closed snapshot is current-state evidence only; it is not causal
proof that a close operation succeeded after an open.

No additional live CDP/UI/network operation, exact A1 command, or full/live
npm gate is permitted under the spent A1 envelope. Offline unit and A0 tests
remain safe to rerun. A new close path, fallback, digest, and approval nonce
are required before another live attempt.

## Evidence and rejected inferences

| Finding | Evidence | Safe interpretation |
|---|---|---|
| Open phase failed | sanitized A1 result, `PINE_DISCOVERY_OPEN`, exit 1 | open failure; raw cause intentionally unavailable |
| Probe did not run | `probe_invocation_count=0`, `probe=null` | no Pine signal or source evidence was obtained |
| Current target was stable | exact target/tuple/frame/context/inventory read-only match | no observed target drift during the evidence read |
| Open method existed | fixed read reported `activateScriptEditorTab` callable | does not prove invocation success or visibility |
| Close capability mismatched | fixed read reported `hideWidget` non-callable | the approved close path cannot currently prove closure |
| Current editor is closed | fixed post-run visibility read | does not prove post-open close causality |
| Page network | harness network budget was zero; page-initiated traffic was not observed | network absence remains `UNKNOWN` |

The following inferences are rejected: “closed means it never opened”,
“callable means open succeeded”, “a closed snapshot means close succeeded”,
and “the failure was a deadline/context drift”. The artifact maps explicit
deadline/context failures separately, and independent identity checks were
stable; those causes remain low-probability rather than proven impossible.

## Why the current fallback is unsafe

- `scripts/pine_discovery_gate_a1.mjs` maps open action failure and unproven
  post-open visibility to the same fixed `PINE_DISCOVERY_OPEN` result.
- Its sole approved close declaration calls `hideWidget('pine-editor')`,
  which was not callable in the fixed read.
- `src/core/pine.js:84-117` uses an implicit activate/showWidget/DOM-click
  chain. `getSource`, `getErrors`, and `getConsole` call that chain when the
  editor is closed, so they are not read-only fallbacks.
- `src/core/pine.js:694-730` uses a Pine Facade `fetch`, which is outside the
  A1 zero-network budget.
- `src/core/ui.js:31-60` has no independent close capability; it also relies on
  the same bottom-widget API.

## Independent issues for the next approval

These are offline-first issues. They must be approved as a new implementation
set before code changes begin.

### P1-07 — Close-capability fail-closed preflight

- **Deliverable:** a fixed, read-only preflight that verifies the reviewed
  close capability before any editor-open action; if unavailable or throwing,
  return a fixed unavailable error and keep `open=0`.
- **Verification:** fault-inject missing, throwing, and disappearing close
  capabilities; assert `open=0`, `probe=0`, `close=0`, `retry=0`,
  `fallback=0`, no UI mutation, and no network.
- **Done when:** all capability matrix cases pass deterministically and a
  static boundary check proves there is exactly one approved close path with
  no implicit fallback chain.

### P1-08 — Open-stage result classification

- **Deliverable:** a secret-safe fixed enum distinguishing action rejection,
  visibility unproven, and protocol/page failure without raw exception data.
- **Verification:** deterministic fixtures for action throw, non-boolean
  return, eight-poll visibility exhaustion, malformed remote result, and late
  deadline; validate the exact result schema and ledger.
- **Done when:** 100% of fixtures map to the documented enum, no raw cause or
  page value leaks, and the A0/unit/static gates pass with a newly reviewed
  digest.

### P1-09 — Closed-editor read-only boundary

- **Deliverable:** an editor-already-open-only wrapper for future discovery;
  closed editor returns fixed `PINE_EDITOR_UNAVAILABLE` without activate,
  show, DOM click, focus, keyboard, Input, or fetch.
- **Verification:** closed/open fixtures with counters and a network guard;
  chart-only state projections remain read-only; all forbidden counters stay
  zero.
- **Done when:** boundary tests pass for every closed/open/error case and no
  live fallback is called before a separate approval.

### P1-10 — New close strategy approval artifact

- **Deliverable:** a reviewed contract naming the current close owner/path,
  argument, identity check, visibility proof, deadline, and residual-state
  handling, plus a new digest-bound exact command/envelope.
- **Verification:** independent read-only review, exact target/tuple proof,
  digest equality, and a fresh one-shot nonce; explicitly forbid old nonce
  reuse, retry, fallback, save, reload, and page-network claims.
- **Done when:** independent review has zero Critical/Important findings and
  the user provides written approval for the new envelope.

## Post-review remediation completed offline

The independent final review found two P1-01 safety-boundary gaps and one
low-severity contract drift. They were fixed without live operations:

- **P1-01 transport metadata:** `CdpTransportError` now wraps generic
  transport failures after client invalidation with fixed
  `CDP_TRANSPORT_ERROR`, operation, timeout, `ambiguous=true`, and
  `retryable=false`; the raw cause is retained only for diagnostics and is
  excluded from JSON. Reconnect and close-once fixtures cover evaluate,
  raw-command, and health-check paths.
- **P1-01 Pine cancellation:** fixed post-click, post-keyboard, and post-save
  waits now raise typed `CdpAbortError` values with operation-specific names.
  Five offline fixtures cover compile, save, and smart-compile paths and
  assert fixed metadata plus no raw cancellation-cause leakage.
- **Health contract drift:** the MCP schema and CLI help now say that healthy
  CDP endpoints are always reused and `kill_existing` applies only before a
  new launch when no healthy endpoint is available. Lifecycle behavior was
  unchanged and the wording is regression-tested.

Verification for these remediations is syntax clean, focused tests 46/46,
and `npm run test:unit` 277/277 across 37 suites with zero failure,
cancellation, or skip.

No P0 is demonstrated by the available evidence. P1 is warranted because
cleanup and Pine-state causality cannot be proven, while the current snapshot
and target identity remained stable.

## Completion boundary

Already complete: P1-01 through P1-06 implementation and benchmarks,
post-review P1-01 remediation, 277/277 unit tests, Gate A0 157/157 on three
consecutive runs, independent A0 review, frozen digest, one bounded A1
attempt, evidence integration, and clean synchronized commits.

Still unmet: successful Pine discovery, causal source/dirty/save/Cloud
evidence, Gate A evidence decision, P1-07 through P1-10 implementation and
verification, Gate B/full live E2E, final broad review, and the final all-
criteria completion claim.
