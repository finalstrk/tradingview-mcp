# Gate B coordinator activation boundary

`tests/test-coordinator.mjs` keeps normal `npm test` invocations offline. They
run the repeatable checks and return `OFFLINE_APPROVAL_REQUIRED` with a
zero-action ledger. Live activation is available only through the exported
programmatic boundary; no CLI argument contains or grants access to a nonce.

The exported Gate B helpers freeze and verify:

- repository HEAD, working-tree diff, test manifest, target policy, command,
  coordinator version, budgets, expiry, nonce digest, and registry digest;
- an atomic `.git/tradingview-mcp-e2e/active.lock` ownership lease;
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
