import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  COORDINATOR_SAFE_STOP_CODE,
  GATE_B_BUDGETS,
  GATE_B_COMMAND,
  LIVE_CASE_REGISTRY,
  LIVE_CASE_REGISTRY_SHA256,
  acquireGateBLease,
  buildGateBApprovalDraft,
  buildSafeStop,
  digestJson,
  parseInvocation,
  prepareGateBLease,
  releaseGateBLease,
  resolveLiveCase,
  runOfflineChecks,
  sha256,
  validateGateBApproval,
} from './test-coordinator.mjs';

function approvalDraft(overrides = {}) {
  const nonce = overrides.nonce || 'n'.repeat(48);
  const { nonce: _nonce, ...draftOverrides } = overrides;
  return buildGateBApprovalDraft({
    repositoryHead: 'a'.repeat(40),
    workingTreeDiffSha256: 'b'.repeat(64),
    testManifestSha256: 'c'.repeat(64),
    approvalNonceSha256: sha256(nonce),
    targetPolicy: { kind: 'explicit_target_id', target_id: 'D'.repeat(32) },
    expiresAt: '2035-01-01T00:00:00.000Z',
    ...draftOverrides,
  });
}

function expectedBindings(envelope) {
  return {
    repository_head: envelope.repository_head,
    working_tree_diff_sha256: envelope.working_tree_diff_sha256,
    test_manifest_sha256: envelope.test_manifest_sha256,
    target_policy: envelope.target_policy,
  };
}

async function withTempState(run) {
  const root = await mkdtemp(join(tmpdir(), 'tradingview-gate-b-'));
  try { return await run(join(root, 'state')); } finally { await rm(root, { recursive: true, force: true }); }
}

test('normal invocation plans only offline checks and no external actions', () => {
  const calls = [];
  const result = runOfflineChecks({
    runner(spec) {
      calls.push(spec);
      return { status: 0, signal: null, error: undefined };
    },
  });

  assert.deepEqual(calls.map(spec => spec.name), ['unit', 'manifest']);
  assert.equal(result.success, true);
  assert.equal(result.external_action_count, 0);
  assert.equal(result.live_test_started, false);
  assert.ok(calls.every(spec => spec.live === false));
});

test('invocation parser never grants live mode without an approval nonce', () => {
  assert.deepEqual(parseInvocation([]), {
    mode: 'offline',
    approval_present: false,
    reason: 'approval_required',
  });
  assert.deepEqual(parseInvocation(['--offline-only']), {
    mode: 'offline',
    approval_present: false,
    reason: 'offline_requested',
  });
  assert.deepEqual(parseInvocation(['--approval-envelope']), {
    mode: 'offline',
    approval_present: false,
    reason: 'approval_required',
  });
});

test('safe-stop payload has a fixed, zero-action ledger', () => {
  const payload = buildSafeStop({
    invocation: parseInvocation([]),
    checks: {
      success: true,
      external_action_count: 0,
      live_test_started: false,
      results: [],
    },
  });

  assert.equal(payload.code, COORDINATOR_SAFE_STOP_CODE);
  assert.equal(payload.status, 'safe_stop');
  assert.equal(payload.external_action_count, 0);
  assert.equal(payload.live_test_started, false);
  assert.deepEqual(payload.ledger, {
    cdp: 0,
    network: 0,
    ui: 0,
    child_live_test: 0,
  });
});

test('offline failure is reported without exposing child output', () => {
  const result = runOfflineChecks({
    runner() {
      return { status: 17, signal: null, stderr: 'SECRET_CHILD_OUTPUT' };
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.results[0].exit_code, 17);
  assert.equal(Object.hasOwn(result.results[0], 'stderr'), false);
});

test('coordinator source has no live transport or integration-test import', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./test-coordinator.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chrome-remote-interface|node:http|node:https|fetch\s*\(/);
  assert.doesNotMatch(source, /(?:import|require\s*\()[^\n]*(?:e2e|pine_facade|launch)_e2e\.test\.js/);
});

test('approval draft binds the fixed command, budgets, registry and its own digest', () => {
  const envelope = approvalDraft();
  const unsigned = { ...envelope };
  delete unsigned.envelope_sha256;

  assert.equal(envelope.full_command, GATE_B_COMMAND);
  assert.deepEqual(envelope.external_action_budgets, GATE_B_BUDGETS);
  assert.equal(envelope.live_case_registry_sha256, LIVE_CASE_REGISTRY_SHA256);
  assert.equal(envelope.envelope_sha256, digestJson(unsigned));
  assert.equal(envelope.live_adapter_dispatch, 'DISABLED_PENDING_FRESH_GATE_B_APPROVAL');
});

test('approval validation rejects digest mismatch, changed binding and expiration', () => {
  const envelope = approvalDraft();
  assert.equal(validateGateBApproval(envelope, expectedBindings(envelope), Date.UTC(2030, 0, 1)), true);

  assert.throws(
    () => validateGateBApproval({ ...envelope, repository_head: 'f'.repeat(40) }, expectedBindings(envelope), Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_ENVELOPE_DIGEST_MISMATCH',
  );
  assert.throws(
    () => validateGateBApproval(envelope, { ...expectedBindings(envelope), repository_head: 'f'.repeat(40) }, Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_APPROVAL_BINDING_MISMATCH',
  );
  assert.throws(
    () => validateGateBApproval(envelope, expectedBindings(envelope), Date.UTC(2040, 0, 1)),
    error => error?.code === 'GATE_B_APPROVAL_EXPIRED',
  );
  const malformed = approvalDraft({ repositoryHead: 'not-a-git-head' });
  assert.throws(
    () => validateGateBApproval(malformed, expectedBindings(malformed), Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_ENVELOPE_INVALID',
  );
});

test('approval validation accepts only an exact explicit 32-hex target policy', () => {
  const unsafePolicies = [
    {},
    { kind: 'automatic_target_selection', target_id: 'D'.repeat(32) },
    { kind: 'explicit_target_id', target_id: 'D'.repeat(31) },
    { kind: 'explicit_target_id', target_id: 'G'.repeat(32) },
    { kind: 'explicit_target_id', target_id: 'D'.repeat(32), fallback: true },
  ];

  for (const targetPolicy of unsafePolicies) {
    const envelope = approvalDraft({ targetPolicy });
    assert.throws(
      () => validateGateBApproval(envelope, expectedBindings(envelope), Date.UTC(2030, 0, 1)),
      error => error?.code === 'GATE_B_ENVELOPE_INVALID',
    );
  }

  const uppercase = approvalDraft({
    targetPolicy: { kind: 'explicit_target_id', target_id: 'ABCDEF0123456789ABCDEF0123456789' },
  });
  const lowercase = approvalDraft({
    targetPolicy: { kind: 'explicit_target_id', target_id: 'abcdef0123456789abcdef0123456789' },
  });
  assert.equal(validateGateBApproval(uppercase, expectedBindings(uppercase), Date.UTC(2030, 0, 1)), true);
  assert.equal(validateGateBApproval(lowercase, expectedBindings(lowercase), Date.UTC(2030, 0, 1)), true);
});

test('approval validation rejects extra or missing top-level keys even with a valid self-digest', () => {
  const approved = approvalDraft();
  const extraUnsigned = { ...approved, unreviewed_capability: true };
  delete extraUnsigned.envelope_sha256;
  const extra = { ...extraUnsigned, envelope_sha256: digestJson(extraUnsigned) };
  assert.throws(
    () => validateGateBApproval(extra, expectedBindings(extra), Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_ENVELOPE_INVALID',
  );

  const missingUnsigned = { ...approved };
  delete missingUnsigned.envelope_sha256;
  delete missingUnsigned.target_policy;
  const missing = { ...missingUnsigned, envelope_sha256: digestJson(missingUnsigned) };
  assert.throws(
    () => validateGateBApproval(missing, expectedBindings(missing), Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_ENVELOPE_INVALID',
  );
});

test('case registry rejects unknown cases and digest drift before any dispatch', () => {
  assert.deepEqual(resolveLiveCase('quote', LIVE_CASE_REGISTRY_SHA256), LIVE_CASE_REGISTRY.quote);
  assert.throws(
    () => resolveLiveCase('not-reviewed', LIVE_CASE_REGISTRY_SHA256),
    error => error?.code === 'GATE_B_UNKNOWN_CASE',
  );
  assert.throws(
    () => resolveLiveCase('quote', '0'.repeat(64)),
    error => error?.code === 'GATE_B_REGISTRY_DIGEST_MISMATCH',
  );
});

test('spent lease is one-shot and stores only nonce digest, envelope digest and budgets', async () => {
  await withTempState(async stateDir => {
    const nonce = 'n'.repeat(48);
    const envelope = approvalDraft();
    const lease = await acquireGateBLease({ stateDir, nonce, envelope, expected: expectedBindings(envelope), ownershipToken: 'owner-one' });
    await releaseGateBLease(lease);

    const stored = await readFile(lease.spentPath, 'utf8');
    assert.doesNotMatch(stored, new RegExp(nonce));
    assert.deepEqual(JSON.parse(stored), {
      schema_version: 1,
      envelope_sha256: envelope.envelope_sha256,
      external_action_budgets: GATE_B_BUDGETS,
    });
    await assert.rejects(
      acquireGateBLease({ stateDir, nonce, envelope, expected: expectedBindings(envelope), ownershipToken: 'owner-two' }),
      error => error?.code === 'GATE_B_NONCE_SPENT',
    );
  });
});

test('lease preparation binds the secret nonce digest and validates before creating state', async () => {
  await withTempState(async stateDir => {
    const nonce = 'p'.repeat(48);
    const envelope = approvalDraft({ nonce });
    await assert.rejects(
      prepareGateBLease({
        stateDir,
        nonce: 'q'.repeat(48),
        envelope,
        expected: expectedBindings(envelope),
        nowMs: Date.UTC(2030, 0, 1),
        ownershipToken: 'wrong-nonce-owner',
      }),
      error => error?.code === 'GATE_B_APPROVAL_BINDING_MISMATCH',
    );
    await assert.rejects(readFile(join(stateDir, 'active.lock', 'owner'), 'utf8'), error => error?.code === 'ENOENT');

    const lease = await prepareGateBLease({
      stateDir,
      nonce,
      envelope,
      expected: expectedBindings(envelope),
      nowMs: Date.UTC(2030, 0, 1),
      ownershipToken: 'approved-owner',
    });
    await releaseGateBLease(lease);
  });
});

test('active lock rejects concurrent coordinator and crash leaves spent lease and lock', async () => {
  await withTempState(async stateDir => {
    const crashNonce = 'c'.repeat(48);
    const envelope = approvalDraft({ nonce: crashNonce });
    const lease = await acquireGateBLease({
      stateDir,
      nonce: crashNonce,
      envelope,
      expected: expectedBindings(envelope),
      ownershipToken: 'crashed-owner',
    });

    await assert.rejects(
      acquireGateBLease({
        stateDir,
        nonce: 'd'.repeat(48),
        envelope: approvalDraft({ nonce: 'd'.repeat(48) }),
        expected: expectedBindings(approvalDraft({ nonce: 'd'.repeat(48) })),
        ownershipToken: 'concurrent-owner',
      }),
      error => error?.code === 'GATE_B_ACTIVE_LOCKED',
    );
    assert.equal(JSON.parse(await readFile(lease.spentPath, 'utf8')).envelope_sha256, envelope.envelope_sha256);
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8'), 'crashed-owner');
  });
});

test('release refuses a stale ownership token and preserves the active lock', async () => {
  await withTempState(async stateDir => {
    const lease = await acquireGateBLease({
      stateDir,
      nonce: 'o'.repeat(48),
      envelope: approvalDraft({ nonce: 'o'.repeat(48) }),
      expected: expectedBindings(approvalDraft({ nonce: 'o'.repeat(48) })),
      ownershipToken: 'right-owner',
    });
    await writeFile(join(stateDir, 'active.lock', 'owner'), 'other-owner');
    await assert.rejects(
      releaseGateBLease(lease),
      error => error?.code === 'GATE_B_LOCK_OWNERSHIP_MISMATCH',
    );
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8'), 'other-owner');
  });
});
