import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  COORDINATOR_SAFE_STOP_CODE,
  GATE_B_BUDGETS,
  GATE_B_COMMAND,
  LIVE_CASE_REGISTRY,
  LIVE_CASE_REGISTRY_SHA256,
  acquireGateBLease,
  activateGateBFromApprovalFile,
  buildLiveChildEnvironment,
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

async function writeApproval(path, nonce, envelope, mode = 0o600) {
  await writeFile(path, `${JSON.stringify({ schema_version: 1, envelope, nonce })}\n`, { mode });
  await chmod(path, mode);
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
  assert.equal(envelope.live_adapter_dispatch, 'INJECTED_REVIEWED_ADAPTER_ONLY');
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

test('secure approval-file ingress persists the lease before exposing an injected live plan', async () => {
  await withTempState(async stateDir => {
    const nonce = 'a'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const approvalPath = join(stateDir, '..', 'approval.json');
    await writeApproval(approvalPath, nonce, envelope);
    const expected = expectedBindings(envelope);
    const events = [];
    const result = await activateGateBFromApprovalFile({
      approvalFilePath: approvalPath,
      stateDir,
      nowMs: Date.UTC(2030, 0, 1),
      measureBindings: async () => ({ ...expected }),
      liveAdapter: async plan => {
        events.push('adapter');
        assert.equal(await readFile(plan.lease.spentPath, 'utf8').then(Boolean), true);
        assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
        assert.equal(Object.hasOwn(plan, 'nonce'), false);
        return { status: 'ready' };
      },
    });
    assert.deepEqual(events, ['adapter']);
    assert.deepEqual(result.adapter_result, { status: 'ready' });
    assert.equal(result.phase, 'live_plan_dispatched');
    await releaseGateBLease(result.lease);
  });
});

test('approval-file ingress rejects missing, symlink, unsafe mode, malformed and extra fields before state', async () => {
  await withTempState(async stateDir => {
    const root = join(stateDir, '..');
    const expected = expectedBindings(approvalDraft());
    const common = { stateDir, measureBindings: async () => expected, liveAdapter: async () => ({}) };
    await assert.rejects(
      activateGateBFromApprovalFile({ ...common, approvalFilePath: join(root, 'missing.json') }),
      error => error?.code === 'GATE_B_APPROVAL_FILE_UNAVAILABLE',
    );

    const nonce = 'b'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const real = join(root, 'real.json');
    await writeApproval(real, nonce, envelope);
    const link = join(root, 'link.json');
    await symlink(real, link);
    await assert.rejects(
      activateGateBFromApprovalFile({ ...common, approvalFilePath: link }),
      error => error?.code === 'GATE_B_APPROVAL_FILE_UNSAFE',
    );

    const unsafe = join(root, 'unsafe.json');
    await writeApproval(unsafe, nonce, envelope, 0o640);
    await assert.rejects(
      activateGateBFromApprovalFile({ ...common, approvalFilePath: unsafe }),
      error => error?.code === 'GATE_B_APPROVAL_FILE_UNSAFE',
    );

    for (const [name, value] of [
      ['malformed', '{x'],
      ['extra', JSON.stringify({ schema_version: 1, envelope, nonce, extra: true })],
    ]) {
      const path = join(root, `${name}.json`);
      await writeFile(path, value, { mode: 0o600 });
      await assert.rejects(
        activateGateBFromApprovalFile({ ...common, approvalFilePath: path }),
        error => error?.code === 'GATE_B_APPROVAL_FILE_INVALID',
      );
    }
    await assert.rejects(readFile(join(stateDir, 'active.lock', 'owner')), error => error?.code === 'ENOENT');
  });
});

test('activation rejects expired, digest mismatch, measurement drift and absent adapter without dispatch', async () => {
  await withTempState(async stateDir => {
    const nonce = 'c'.repeat(64);
    const root = join(stateDir, '..');
    const calls = [];
    async function attempt(name, envelope, options = {}) {
      const path = join(root, `${name}.json`);
      await writeApproval(path, nonce, envelope);
      return activateGateBFromApprovalFile({
        approvalFilePath: path,
        stateDir,
        nowMs: options.nowMs ?? Date.UTC(2030, 0, 1),
        measureBindings: options.measureBindings || (async () => expectedBindings(envelope)),
        liveAdapter: options.hasOwnProperty('liveAdapter') ? options.liveAdapter : async () => { calls.push(name); },
      });
    }
    await assert.rejects(attempt('expired', approvalDraft({ nonce, expiresAt: '2029-01-01T00:00:00.000Z' })), e => e?.code === 'GATE_B_APPROVAL_EXPIRED');
    const valid = approvalDraft({ nonce });
    await assert.rejects(attempt('digest', { ...valid, envelope_sha256: '0'.repeat(64) }), e => e?.code === 'GATE_B_ENVELOPE_DIGEST_MISMATCH');
    let measurements = 0;
    await assert.rejects(attempt('drift', valid, {
      measureBindings: async () => ({ ...expectedBindings(valid), repository_head: (++measurements === 1 ? valid.repository_head : 'f'.repeat(40)) }),
    }), e => e?.code === 'GATE_B_MEASUREMENT_DRIFT');
    await assert.rejects(attempt('no-adapter', valid, { liveAdapter: null }), e => e?.code === 'GATE_B_LIVE_ADAPTER_UNAVAILABLE');
    assert.deepEqual(calls, []);
  });
});

test('TOCTOU drift spends no nonce while adapter failure leaves spent and crash lock durable', async () => {
  await withTempState(async stateDir => {
    const nonce = 'd'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const approvalPath = join(stateDir, '..', 'approval.json');
    await writeApproval(approvalPath, nonce, envelope);
    await assert.rejects(
      activateGateBFromApprovalFile({
        approvalFilePath: approvalPath,
        stateDir,
        measureBindings: async () => expectedBindings(envelope),
        liveAdapter: async () => { throw new Error('simulated crash'); },
      }),
      error => error?.code === 'GATE_B_LIVE_ADAPTER_FAILED',
    );
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
    assert.equal(await readFile(join(stateDir, 'spent', `${sha256(nonce)}.json`), 'utf8').then(Boolean), true);
  });
});

test('live child environment strips approval secrets and coordinator-only controls', () => {
  const nonce = 'e'.repeat(64);
  const env = buildLiveChildEnvironment({
    PATH: '/bin',
    GATE_B_APPROVAL_FILE: '/secret/approval.json',
    GATE_B_APPROVAL_NONCE: nonce,
    APPROVAL_NONCE: nonce,
    SAFE_VALUE: 'ok',
    INNOCENT_NAME: `prefix-${nonce}`,
  }, [nonce]);
  assert.deepEqual(env, { PATH: '/bin', SAFE_VALUE: 'ok', TRADINGVIEW_MCP_COORDINATOR_MODE: 'live-child' });
  assert.doesNotMatch(JSON.stringify(env), new RegExp(nonce));
});
