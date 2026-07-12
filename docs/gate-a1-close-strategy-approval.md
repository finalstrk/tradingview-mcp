# Gate A1 close-strategy approval artifact

Status: `PENDING_FRESH_WRITTEN_APPROVAL`

This artifact supersedes every earlier Gate A1 digest, exact command, approval,
and nonce. It describes one bounded live discovery attempt only. Reading or
reviewing this file does not authorize that attempt.

## Digest-bound execution envelope

```json
{
  "bundle_sha256": "a856202346587e399ff5326bf8be9cebe63b05cd0814081e6b6366627e465477",
  "exact_command": "node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=a856202346587e399ff5326bf8be9cebe63b05cd0814081e6b6366627e465477",
  "target_id": "119DB9629A03197CFB120366EA6729CC",
  "initial_tuple": {
    "symbol": "FX:USDJPY",
    "resolution": "15",
    "chart_type": 1,
    "study_count": 12,
    "shape_count": 0,
    "replay_started": false,
    "bottom_widget_open": false,
    "pine_editor_open": false
  },
  "budgets": {
    "open": 1,
    "probe": 1,
    "close": 1,
    "retry": 0,
    "fallback": 0
  },
  "forbidden_effects": [
    "SOURCE_MUTATION",
    "SAVE",
    "KEYBOARD_INPUT",
    "MOUSE_INPUT",
    "HARNESS_INITIATED_EXTERNAL_NETWORK",
    "PINE_FACADE_POST",
    "PAGE_RELOAD",
    "TAB_OPERATION",
    "PROCESS_OPERATION"
  ],
  "operation_deadline_ms": 1000,
  "work_deadline_ms": 20000,
  "cleanup_reserve_ms": 10000,
  "total_hard_deadline_ms": 30000,
  "hard_exit_cleanup_limit": "PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN",
  "tradingview_page_initiated_network": "UNKNOWN",
  "approval": {
    "schema_version": 1,
    "secret_ingress_env": "PINE_DISCOVERY_APPROVAL_FILE",
    "file_mode": "0600",
    "nonce_format": "64 lowercase hexadecimal characters",
    "issued_at": "strict ISO-8601 UTC timestamp supplied by approver",
    "expires_at": "strict ISO-8601 UTC timestamp supplied by approver",
    "max_ttl_ms": 300000,
    "one_shot": true
  }
}
```

The command is valid only when the SHA-256 of
`scripts/pine_discovery_gate_a1.mjs` equals `bundle_sha256`. Any file change,
target or tuple mismatch, expired approval, missing fresh one-shot nonce, or
command difference invalidates approval and must stop before an editor-open
action.

## Approval instance and one-shot lease

The live command accepts approval only through the environment variable
`PINE_DISCOVERY_APPROVAL_FILE`. Its value must be an absolute path. Every
existing component of its parent directory is checked with `lstat` and must be
a real directory, not a symlink. The parent is then fixed with
`O_RDONLY | O_DIRECTORY | O_NOFOLLOW`. Its `/proc/self/fd/<dirfd>` target and
device/inode are verified against the directory descriptor. The approval file
is accessed only below that descriptor anchor.
The approval file is opened once with `O_RDONLY | O_NOFOLLOW`; that same file
descriptor is used for `stat` and read.
It must be a regular, non-symlink file whose exact permission mode is `0600`
and whose size is from 1 through 8,192 bytes. After parsing and binding checks,
the pathname is checked again and its device/inode must still equal the opened
descriptor. Any path replacement or metadata race fails closed. The approval
instance is strict JSON: no additional or missing fields are accepted. Its
exact top-level fields are
`schema_version`, `nonce`, `bundle_sha256`, `target_id`, `exact_command`,
`issued_at`, `expires_at`, `initial_tuple`, and `budgets`.

`schema_version` must equal `1`. The digest, command, target, complete initial
tuple, and complete budgets object must exactly match the envelope above. The
nonce must contain exactly 64 lowercase hexadecimal characters. `issued_at`
and `expires_at` must use canonical millisecond ISO-8601 UTC form
`YYYY-MM-DDTHH:mm:ss.sssZ`; issue time must not be in the future, expiry must be
after both issue time and current time, and the issue-to-expiry TTL must be at
most 300,000 ms.

Immediately before approval acceptance, the original parent pathname must still
refer to the anchored directory device/inode. A rename or replacement at any
checked phase fails closed. The spent registry is not derived from the approval
path: it is fixed to the repository's strictly resolved Git common directory at
`.git/tradingview-mcp-gate-a1/spent` (or the corresponding common directory for
a linked worktree). Neither CLI nor environment can override it. The registry
directory is mode `0700`, is fixed with its own verified directory-FD anchor,
and is shared by approval files in every directory. After validation, the
harness creates a distinct spent marker there with
`O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW` and exact mode `0600`, then syncs the
marker and its parent directory. Its filename is derived only from the SHA-256
of the nonce. Its exact JSON fields are `schema_version`, `nonce_digest`,
`envelope_digest`, `issued_at`, and `expires_at`; it contains neither nonce nor
approval plaintext. `envelope_digest` is the SHA-256 of the exact approval-file
bytes. This durable spent lease is established before
`chrome-remote-interface` is imported. A pre-existing spent path, concurrent
claimant, malformed instance, crash residue, expired instance, reused nonce,
the same approval copied to another directory, symlinked parent, or pathname
race fails closed before CRI import and before
any live action. The nonce plaintext is never accepted in CLI arguments,
written to the spent filename or marker, or emitted to stdout/stderr.

No approval instance, nonce, or live-valid expiry exists yet. Those values may
be generated safely only after fresh written approval of this exact artifact.

## Close contract and proof boundary

- Close owner: `window.TradingView.bottomWidgetBar` in the fixed main-world
  context.
- Close path: the sole approved mutation calls the owner's `hideWidget`
  function.
- Close argument: the exact literal `pine-editor`.
- Capability preflight: before opening, a read-only call proves
  `typeof window.TradingView.bottomWidgetBar.hideWidget === 'function'`.
  Missing, throwing, timed-out, non-boolean, changed, or disappearing
  capability detected during this preflight fails closed with open/probe/close
  counters all zero. Capability loss after preflight is still possible; it
  makes the close fail and the residual state may be `UNKNOWN`.
- Target identity: every fixed main-world call is bracketed by Node-side checks
  of the exact target ID, strict TradingView chart target predicate, main-frame
  ID and loader ID, and tracked default-context `uniqueContextId`. Navigation,
  context invalidation, or identity drift rejects the operation without target
  fallback.
- Visibility proof: editor visibility is only the boolean result of the fixed
  selector `.monaco-editor.pine-editor-monaco`. Open and close are each proved
  by at most eight finite polls. A callable method or successful invocation is
  not itself visibility proof.
- Deadlines: each CDP operation has a 1,000 ms deadline; work is limited to
  20,000 ms; 10,000 ms is reserved for cleanup; the total hard deadline is
  30,000 ms.

The open action is
`window.TradingView.bottomWidgetBar.activateScriptEditorTab()` and is allowed
at most once. The secret-safe read-only discovery probe is allowed only after
visibility is proved open and is allowed at most once. The close action is
allowed at most once, including failure or unknown outcome.

## Residual-state and effect limits

The result may report only `CLOSED`, `OPEN`, or `UNKNOWN` for editor residual
state. Close success requires both one close attempt and post-close visibility
proved closed. A close failure, timeout, context drift, malformed response, or
hard exit may leave the editor or CDP session state `UNKNOWN`; no retry,
fallback target, second close, reload, or compensating mutation is authorized.
The 30,000 ms process exit can interrupt `finally`, so cleanup is not guaranteed
after the hard deadline.

The following effects are forbidden and have budget zero:

- source mutation or save;
- keyboard or mouse input;
- harness-initiated external network;
- Pine Facade POST;
- page reload;
- tab creation, closure, or other tab operation;
- TradingView process start, stop, or other process operation.

Loopback CDP transport is a control channel and does not authorize external
network access. TradingView page-initiated background network caused by opening
the editor is not observed by this envelope and remains `UNKNOWN`; neither zero
traffic nor absence of page network effects may be claimed.

## Gate separation

This artifact does not approve Gate B or a full E2E run. Gate B now has an
authenticated loopback ledger, secure approval-file ingress, migrated fixed
case children, guarded owner modules, and an approval-bound benchmark runner.
Those paths remain inactive by default: dispatch is restricted to
`INJECTED_REVIEWED_ADAPTER_ONLY`, and normal `npm test` stops offline with zero
external actions. No fresh Gate B approval file or nonce has been issued, and
no full live E2E or before/after live benchmark has been run or approved.

A Gate A1 success may provide evidence for later design work, but it cannot be
treated as Gate B approval. The Gate B v5 implementation is complete and
independently accepted offline, but activation still requires a new
digest-bound v5 envelope, separate written approval, and a different fresh
one-shot nonce.

## Machine-checkable approval checklist

All predicates below must be true at approval time and immediately before the
single live attempt. `user_written_approval` and `fresh_nonce_issued` deliberately
remain false until those events occur.

```json
{
  "schema": "tradingview-mcp.gate-a1-close-strategy-approval.v1",
  "artifact_status": "PENDING_FRESH_WRITTEN_APPROVAL",
  "bundle_sha256_expected": "a856202346587e399ff5326bf8be9cebe63b05cd0814081e6b6366627e465477",
  "exact_command_matches_envelope": true,
  "target_id_exact": true,
  "initial_tuple_exact": true,
  "close_owner_exact": true,
  "close_path_exact": true,
  "close_argument_exact": true,
  "identity_checks_required": true,
  "visibility_proof_required": true,
  "finite_deadlines_bound": true,
  "residual_unknown_accepted": true,
  "budgets_bound": true,
  "forbidden_effects_bound": true,
  "hard_exit_cleanup_limit_bound": true,
  "page_initiated_network_claim": "UNKNOWN",
  "approval_instance_exact_fields": [
    "schema_version",
    "nonce",
    "bundle_sha256",
    "target_id",
    "exact_command",
    "issued_at",
    "expires_at",
    "initial_tuple",
    "budgets"
  ],
  "approval_file_env": "PINE_DISCOVERY_APPROVAL_FILE",
  "approval_file_absolute_regular_non_symlink_0600": true,
  "approval_parent_components_non_symlink": true,
  "approval_parent_open_flags": "O_RDONLY|O_DIRECTORY|O_NOFOLLOW",
  "approval_parent_proc_fd_anchor_verified": true,
  "approval_parent_dev_ino_reverified_before_marker": true,
  "approval_open_flags": "O_RDONLY|O_NOFOLLOW",
  "approval_same_fd_stat_and_read": true,
  "approval_path_dev_ino_reverified": true,
  "approval_path_race_fail_closed": true,
  "approval_schema_version": 1,
  "approval_timestamps_strict_utc": true,
  "approval_max_ttl_ms": 300000,
  "approval_nonce_format": "^[a-f0-9]{64}$",
  "spent_registry": "<git-common-dir>/tradingview-mcp-gate-a1/spent",
  "spent_registry_caller_override_allowed": false,
  "spent_registry_mode": "0700",
  "spent_registry_dirfd_anchor_verified": true,
  "spent_registry_global_across_approval_directories": true,
  "spent_marker_open_flags": "O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW",
  "spent_marker_mode": "0600",
  "spent_marker_exact_fields": [
    "schema_version",
    "nonce_digest",
    "envelope_digest",
    "issued_at",
    "expires_at"
  ],
  "spent_marker_contains_nonce_or_approval_plaintext": false,
  "spent_lease_before_cri_import": true,
  "approval_one_shot": true,
  "approval_secret_non_disclosure_required": true,
  "old_approval_invalid": true,
  "old_nonce_invalid": true,
  "nonce_reuse_allowed": false,
  "independent_review_zero_critical": false,
  "independent_review_zero_important": false,
  "user_written_approval": false,
  "fresh_nonce_issued": false,
  "gate_b_approved": false,
  "live_execution_allowed": false
}
```

`live_execution_allowed` may become true exactly once only after the current
bundle digest and exact command are independently rechecked, review has zero
Critical and zero Important findings, the user gives fresh written approval for
this exact envelope, and a new one-shot nonce is issued without logging it or
placing it in CLI arguments. Old approval text and every old or spent nonce are
invalid and must never be reused.

Suggested written approval, with the digest and command retained verbatim:

> Gate A1 envelope `a856202346587e399ff5326bf8be9cebe63b05cd0814081e6b6366627e465477`
> and exact command
> `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=a856202346587e399ff5326bf8be9cebe63b05cd0814081e6b6366627e465477`
> are approved for one attempt against target
> `119DB9629A03197CFB120366EA6729CC` only. I accept open/probe/close budgets
> 1/1/1, retry/fallback 0, the forbidden effects above, page-initiated network
> `UNKNOWN`, and the possibility that failure or hard exit leaves editor/session
> residual state `UNKNOWN`. This does not approve Gate B or full live E2E.
