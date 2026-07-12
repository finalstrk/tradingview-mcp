# Gate B coordinator offline foundation

`tests/test-coordinator.mjs` currently implements only the repeatable offline
foundation for Gate B. A normal `npm test` invocation still runs offline checks
and returns `OFFLINE_APPROVAL_REQUIRED` with a zero-action ledger.

The exported Gate B helpers freeze and verify:

- repository HEAD, working-tree diff, test manifest, target policy, command,
  coordinator version, budgets, expiry, nonce digest, and registry digest;
- an atomic `.git/tradingview-mcp-e2e/active.lock` ownership lease;
- a durable one-shot `spent/<nonce-digest>.json` record without nonce plaintext;
- a digest-bound registry containing only reviewed live-suite case IDs.

Offline fault-injection covers digest and binding mismatches, expiry, unknown
case IDs, concurrent locks, spent nonce reuse, crash residue, and stale lock
ownership. The approval nonce is never accepted from CLI arguments.

Live adapter dispatch is intentionally absent. The approval draft records
`DISABLED_PENDING_FRESH_GATE_B_APPROVAL`; there is no code path that starts a
live test, opens IPC, connects to CDP, sends input, or performs network access.
A separately reviewed implementation and a fresh Gate B approval envelope are
required before that boundary can be enabled.
