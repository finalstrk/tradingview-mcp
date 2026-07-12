import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GATE_B_IPC_CASE_REGISTRY,
  GATE_B_IPC_CASE_REGISTRY_SHA256,
} from '../src/e2e/gate_b_loopback_ipc.js';

import {
  COORDINATOR_SAFE_STOP_CODE,
  GATE_B_BUDGETS,
  GATE_B_COMMAND,
  GATE_B_SCHEMA_VERSION,
  GATE_B_BENCHMARK_CONFIG_SHA256,
  GATE_B_CHILD_MANIFEST_SHA256,
  GATE_B_EXECUTION_CASE_SET_SHA256,
  GATE_B_ORDERED_CASE_IDS,
  GATE_B_WORKLOAD_SHA256,
  GateBError,
  LIVE_CASE_REGISTRY,
  LIVE_CASE_REGISTRY_SHA256,
  acquireGateBLease,
  abandonGateBLease,
  activateGateBFromApprovalFile,
  buildLiveChildEnvironment,
  buildGateBApprovalDraft,
  buildSafeStop,
  digestJson,
  executeCoordinator,
  gateBInventoryIsExact,
  parseInvocation,
  prepareGateBLease,
  releaseGateBLease,
  resolveGateBStateDirectory,
  resolveLiveCase,
  runOfflineChecks,
  sha256,
  validateGateBApproval,
} from './test-coordinator.mjs';

function approvalDraft(overrides = {}) {
  const nonce = overrides.nonce || 'n'.repeat(48);
  const { nonce: _nonce, targetPolicy: suppliedPolicy, targetContext: suppliedContext, ...draftOverrides } = overrides;
  const targetPolicy = suppliedPolicy || { kind: 'explicit_target_id', target_id: 'D'.repeat(32) };
  const targetContext = suppliedContext || {
    target_id: targetPolicy.target_id, execution_context_id: 7,
    frame_id: 'frame-1', loader_id: 'loader-1', unique_context_id: 'context-1',
  };
  return buildGateBApprovalDraft({
    repositoryHead: 'a'.repeat(40),
    workingTreeDiffSha256: 'b'.repeat(64),
    testManifestSha256: 'c'.repeat(64),
    approvalNonceSha256: sha256(nonce),
    targetPolicy,
    targetContext,
    buildSha256: '8'.repeat(64),
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
    target_context: envelope.target_context,
    build_sha256: envelope.build_sha256,
  };
}

function staticBindings(envelope) {
  const value = expectedBindings(envelope);
  return {
    repository_head: value.repository_head,
    working_tree_diff_sha256: value.working_tree_diff_sha256,
    test_manifest_sha256: value.test_manifest_sha256,
  };
}

function liveBindings(envelope) {
  const value = expectedBindings(envelope);
  return { target_policy: value.target_policy, target_context: value.target_context, build_sha256: value.build_sha256 };
}

async function withTempState(run) {
  const root = await mkdtemp(join(tmpdir(), 'tradingview-gate-b-'));
  const repositoryRoot = join(root, 'repo');
  const stateDir = join(repositoryRoot, '.git', 'tradingview-mcp-e2e');
  await mkdir(join(repositoryRoot, '.git'), { recursive: true });
  try { return await run({ repositoryRoot, stateDir }); } finally { await rm(root, { recursive: true, force: true }); }
}

async function writeApproval(path, nonce, envelope, mode = 0o600) {
  await writeFile(path, `${JSON.stringify({ schema_version: GATE_B_SCHEMA_VERSION, envelope, nonce })}\n`, { mode });
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
  assert.deepEqual(parseInvocation(['--phase0-read-only']), {
    mode: 'phase0_read_only',
    approval_present: false,
    reason: 'explicit_read_only_requested',
  });
});

test('phase0 branch accepts only an injected explicit read plan and reports zero mutation ledger', async () => {
  const context = { targetId: 'SECRET_TARGET', sessionId: 'SECRET_SESSION', executionContextId: 7 };
  const transport = {
    async getContext() { return { ...context }; },
    async call() {
      return { result: { value: {
        readable: true,
        state: 'known',
        baseline_comparable: true,
        code: 'PHASE0_STATE_READ',
        counts: { studies: 2 },
      } } };
    },
    async releaseObject() {},
  };
  const result = await executeCoordinator({
    args: ['--phase0-read-only'],
    phase0Configuration: {
      deadlineMs: 50,
      targets: [{ transport, expectedContext: context }],
    },
  });
  assert.equal(result.exit_code, 0);
  assert.equal(result.payload.status, 'complete');
  assert.equal(result.payload.code, 'PHASE0_READ_ONLY_COMPLETE');
  assert.deepEqual(result.payload.ledger, {
    cdp_read: 1,
    cdp_mutation: 0,
    network: 0,
    input: 0,
    ui: 0,
    child_live_test: 0,
  });
  assert.equal(result.payload.approval_present, false);
  assert.equal(result.payload.lease_created, false);
  assert.equal(result.payload.live_test_started, false);
  assert.doesNotMatch(JSON.stringify(result.payload), /SECRET/);
});

test('phase0 branch fails closed without injected configuration and sanitizes runner failure', async () => {
  const missing = await executeCoordinator({ args: ['--phase0-read-only'] });
  assert.equal(missing.exit_code, 1);
  assert.equal(missing.payload.code, 'PHASE0_CONFIGURATION_REQUIRED');
  assert.deepEqual(missing.payload.ledger, {
    cdp_read: 0,
    cdp_mutation: 0,
    network: 0,
    input: 0,
    ui: 0,
    child_live_test: 0,
  });

  const failed = await executeCoordinator({
    args: ['--phase0-read-only'],
    phase0Configuration: { deadlineMs: 50, targets: [{ secret: 'SECRET_RAW_FAILURE' }] },
  });
  assert.equal(failed.exit_code, 1);
  assert.equal(failed.payload.code, 'PHASE0_READ_ONLY_FAILED');
  assert.doesNotMatch(JSON.stringify(failed.payload), /SECRET|INVALID_CONFIGURATION/);
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
  assert.equal(envelope.ipc_case_registry_sha256, GATE_B_IPC_CASE_REGISTRY_SHA256);
  assert.equal(envelope.envelope_sha256, digestJson(unsigned));
  assert.equal(envelope.live_adapter_dispatch, 'INJECTED_REVIEWED_ADAPTER_ONLY');
  assert.equal(envelope.schema_version, 5);
  assert.equal(envelope.baseline_repository_commit, '28e257eeba9c103278612a0672d67d35a597ca7e');
  assert.equal(envelope.candidate_repository_commit, envelope.repository_head);
  assert.notEqual(envelope.baseline_artifact_sha256, envelope.candidate_artifact_sha256);
  assert.equal(envelope.baseline_executor_repository_commit, 'c8ba1d90c6bbc8cab4f5811aed45f1f839044c71');
  assert.equal(envelope.baseline_executor_module_path, 'src/e2e/benchmark/baseline_executor.js');
  assert.equal(envelope.candidate_executor_module_path, 'src/e2e/benchmark/candidate_executor.js');
  assert.notEqual(envelope.baseline_executor_artifact_sha256, envelope.candidate_executor_artifact_sha256);
  assert.equal(envelope.execution_case_set_sha256, GATE_B_EXECUTION_CASE_SET_SHA256);
  assert.equal(envelope.child_manifest_sha256, GATE_B_CHILD_MANIFEST_SHA256);
  assert.equal(envelope.workload_sha256, GATE_B_WORKLOAD_SHA256);
  assert.equal(envelope.benchmark_config_sha256, GATE_B_BENCHMARK_CONFIG_SHA256);
  assert.equal(GATE_B_ORDERED_CASE_IDS.length, 24);
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

test('approval binds owner-local session policy and rejects concrete session identities', () => {
  const valid = approvalDraft();
  assert.equal(valid.session_policy, 'owner_local_pre_post');
  assert.equal(validateGateBApproval(valid, expectedBindings(valid), Date.UTC(2030, 0, 1)), true);
  const concrete = { ...valid, target_context: { ...valid.target_context, session_id: 'concrete-session' } };
  concrete.envelope_sha256 = digestJson(Object.fromEntries(Object.entries(concrete).filter(([key]) => key !== 'envelope_sha256')));
  assert.throws(() => validateGateBApproval(concrete, expectedBindings(concrete), Date.UTC(2030, 0, 1)), /GATE_B_ENVELOPE_INVALID/);
  const changed = { ...valid, session_policy: 'cross_process_exact' };
  changed.envelope_sha256 = digestJson(Object.fromEntries(Object.entries(changed).filter(([key]) => key !== 'envelope_sha256')));
  assert.throws(() => validateGateBApproval(changed, expectedBindings(changed), Date.UTC(2030, 0, 1)), /GATE_B_APPROVAL_BINDING_MISMATCH/);
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

test('approval validation binds the IPC dispatch registry digest', () => {
  const approved = approvalDraft();
  const unsigned = { ...approved, ipc_case_registry_sha256: '0'.repeat(64) };
  delete unsigned.envelope_sha256;
  const drifted = { ...unsigned, envelope_sha256: digestJson(unsigned) };
  assert.throws(
    () => validateGateBApproval(drifted, expectedBindings(drifted), Date.UTC(2030, 0, 1)),
    error => error?.code === 'GATE_B_REGISTRY_DIGEST_MISMATCH',
  );
});

test('case registry rejects unknown cases and digest drift before any dispatch', () => {
  assert.deepEqual(resolveLiveCase('quote_1', LIVE_CASE_REGISTRY_SHA256), LIVE_CASE_REGISTRY.quote_1);
  assert.throws(
    () => resolveLiveCase('not-reviewed', LIVE_CASE_REGISTRY_SHA256),
    error => error?.code === 'GATE_B_UNKNOWN_CASE',
  );
  assert.throws(
    () => resolveLiveCase('quote', '0'.repeat(64)),
    error => error?.code === 'GATE_B_REGISTRY_DIGEST_MISMATCH',
  );
});

test('central registry freezes every migrated child case and exact owner file', () => {
  const expected = {
    batch_1: 'tests/batch_e2e.test.js',
    quote_1: 'tests/quote_e2e.test.js', quote_2: 'tests/quote_e2e.test.js',
    pine_facade_1: 'tests/pine_facade_e2e.test.js', pine_facade_2: 'tests/pine_facade_e2e.test.js',
    pine_facade_3: 'tests/pine_facade_e2e.test.js', pine_facade_4: 'tests/pine_facade_e2e.test.js',
    pine_facade_5: 'tests/pine_facade_e2e.test.js',
    graphics_ohlcv_1: 'tests/graphics_e2e.test.js', graphics_primitives_1: 'tests/graphics_e2e.test.js',
    launch_reuse_1: 'tests/launch_e2e.test.js',
    ...Object.fromEntries([
      'health', 'chart', 'data', 'pine', 'drawing', 'ui', 'replay', 'alerts',
      'watchlist', 'indicators', 'batch', 'capture', 'context_size',
    ].map(group => [`chart_suite_${group}_1`, 'tests/e2e.test.js'])),
  };
  assert.deepEqual(Object.fromEntries(Object.entries(LIVE_CASE_REGISTRY).map(([id, value]) => [id, value.file])), expected);
  assert.equal(Object.keys(LIVE_CASE_REGISTRY).length, 24);
  assert.deepEqual(GATE_B_BUDGETS, {
    logical_operation_count: 11, cdp_session_attach_count: 978, cdp_session_detach_count: 978,
    cdp_protocol_read_count: 7832, cdp_protocol_mutation_count: 122, cdp_protocol_input_count: 12,
    network_request_count: 6, child_process_count: 8, capture_count: 3,
    full_external_gate_invocation_count: 1,
  });
  assert.deepEqual(Object.keys(GATE_B_IPC_CASE_REGISTRY).sort(), Object.keys(LIVE_CASE_REGISTRY).sort());
});

test('success inventory requires every exact ceiling with no missing or extra counters', () => {
  const exact = { ...GATE_B_BUDGETS, outcome_unknown_count: 0 };
  assert.equal(gateBInventoryIsExact(exact), true);
  for (const key of Object.keys(GATE_B_BUDGETS)) {
    assert.equal(gateBInventoryIsExact({ ...exact, [key]: exact[key] - 1 }), false, `under ${key}`);
    assert.equal(gateBInventoryIsExact({ ...exact, [key]: exact[key] + 1 }), false, `over ${key}`);
  }
  const missing = { ...exact }; delete missing.capture_count;
  assert.equal(gateBInventoryIsExact(missing), false);
  assert.equal(gateBInventoryIsExact({ ...exact, unexpected_count: 0 }), false);
  assert.equal(gateBInventoryIsExact({ ...exact, outcome_unknown_count: 1 }), false);
});

test('central registry matches every fixed dispatch in all six migrated children', async () => {
  const byFile = new Map();
  for (const [caseId, { file }] of Object.entries(LIVE_CASE_REGISTRY)) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(caseId);
  }
  for (const [file, expectedIds] of byFile) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const actualIds = [...source.matchAll(/\.dispatch\(['"]([a-z0-9_]+)['"]\)/g)].map(match => match[1]);
    assert.deepEqual(actualIds.sort(), expectedIds.sort(), file);
  }
  assert.equal(byFile.size, 6);
});

test('spent lease is one-shot and stores only nonce digest, envelope digest and budgets', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'n'.repeat(48);
    const envelope = approvalDraft();
    const lease = await acquireGateBLease({ repositoryRoot, nonce, envelope, expected: expectedBindings(envelope), ownershipToken: 'owner-one' });
    await releaseGateBLease(lease);

    const stored = await readFile(lease.spentPath, 'utf8');
    assert.doesNotMatch(stored, new RegExp(nonce));
    assert.deepEqual(JSON.parse(stored), {
      schema_version: GATE_B_SCHEMA_VERSION,
      envelope_sha256: envelope.envelope_sha256,
      external_action_budgets: GATE_B_BUDGETS,
    });
    await assert.rejects(
      acquireGateBLease({ repositoryRoot, nonce, envelope, expected: expectedBindings(envelope), ownershipToken: 'owner-two' }),
      error => error?.code === 'GATE_B_NONCE_SPENT',
    );
  });
});

test('lease preparation binds the secret nonce digest and validates before creating state', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'p'.repeat(48);
    const envelope = approvalDraft({ nonce });
    await assert.rejects(
      prepareGateBLease({
        repositoryRoot,
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
      repositoryRoot,
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
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const crashNonce = 'c'.repeat(48);
    const envelope = approvalDraft({ nonce: crashNonce });
    const lease = await acquireGateBLease({
      repositoryRoot,
      nonce: crashNonce,
      envelope,
      expected: expectedBindings(envelope),
      ownershipToken: 'crashed-owner',
    });

    await assert.rejects(
      acquireGateBLease({
        repositoryRoot,
        nonce: 'd'.repeat(48),
        envelope: approvalDraft({ nonce: 'd'.repeat(48) }),
        expected: expectedBindings(approvalDraft({ nonce: 'd'.repeat(48) })),
        ownershipToken: 'concurrent-owner',
      }),
      error => error?.code === 'GATE_B_ACTIVE_LOCKED',
    );
    assert.equal(JSON.parse(await readFile(lease.spentPath, 'utf8')).envelope_sha256, envelope.envelope_sha256);
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8'), 'crashed-owner');
    await abandonGateBLease(lease);
  });
});

test('release refuses a stale ownership token and preserves the active lock', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const lease = await acquireGateBLease({
      repositoryRoot,
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
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'a'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const approvalPath = join(stateDir, '..', 'approval.json');
    await writeApproval(approvalPath, nonce, envelope);
    const expected = expectedBindings(envelope);
    const events = [];
    const result = await activateGateBFromApprovalFile({
      approvalFilePath: approvalPath,
      repositoryRoot,
      nowMs: Date.UTC(2030, 0, 1),
      measureStaticBindings: async () => staticBindings(envelope),
      liveAdapter: async plan => {
        plan.assert_live_measurement_ready();
        plan.complete_live_preflight(liveBindings(envelope), liveBindings(envelope));
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
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const root = join(stateDir, '..');
    const expected = expectedBindings(approvalDraft());
    const common = {
      repositoryRoot,
      measureStaticBindings: async () => staticBindings(approvalDraft()),
      liveAdapter: async () => ({}),
    };
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
      ['extra', JSON.stringify({ schema_version: GATE_B_SCHEMA_VERSION, envelope, nonce, extra: true })],
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
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'c'.repeat(64);
    const root = join(stateDir, '..');
    const calls = [];
    async function attempt(name, envelope, options = {}) {
      const path = join(root, `${name}.json`);
      await writeApproval(path, nonce, envelope);
      return activateGateBFromApprovalFile({
        approvalFilePath: path,
        repositoryRoot,
        nowMs: options.nowMs ?? Date.UTC(2030, 0, 1),
        measureStaticBindings: options.measureStaticBindings || (async () => staticBindings(envelope)),
        liveAdapter: options.hasOwnProperty('liveAdapter') ? options.liveAdapter : async () => { calls.push(name); },
      });
    }
    await assert.rejects(attempt('expired', approvalDraft({ nonce, expiresAt: '2029-01-01T00:00:00.000Z' })), e => e?.code === 'GATE_B_APPROVAL_EXPIRED');
    const valid = approvalDraft({ nonce });
    await assert.rejects(attempt('digest', { ...valid, envelope_sha256: '0'.repeat(64) }), e => e?.code === 'GATE_B_ENVELOPE_DIGEST_MISMATCH');
    let measurements = 0;
    await assert.rejects(attempt('drift', valid, {
      measureStaticBindings: async () => ({ ...staticBindings(valid), repository_head: (++measurements === 1 ? valid.repository_head : 'f'.repeat(40)) }),
    }), e => e?.code === 'GATE_B_STATIC_MEASUREMENT_DRIFT');
    await assert.rejects(attempt('no-adapter', valid, { liveAdapter: null }), e => e?.code === 'GATE_B_LIVE_ADAPTER_UNAVAILABLE');
    assert.deepEqual(calls, []);
  });
});

test('TOCTOU drift spends no nonce while adapter failure leaves spent and crash lock durable', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'd'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const approvalPath = join(stateDir, '..', 'approval.json');
    await writeApproval(approvalPath, nonce, envelope);
    await assert.rejects(
      activateGateBFromApprovalFile({
        approvalFilePath: approvalPath,
        repositoryRoot,
        measureStaticBindings: async () => staticBindings(envelope),
        liveAdapter: async () => { throw new Error('simulated crash'); },
      }),
      error => error?.code === 'GATE_B_LIVE_ADAPTER_FAILED',
    );
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
    assert.equal(await readFile(join(stateDir, 'spent', `${sha256(nonce)}.json`), 'utf8').then(Boolean), true);
  });
});

test('live measurement starts only after durable lease and its failure retains spent lock', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = 'e'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const path = join(repositoryRoot, 'approval.json');
    await writeApproval(path, nonce, envelope);
    let liveCalls = 0;
    await assert.rejects(activateGateBFromApprovalFile({
      approvalFilePath: path, repositoryRoot, nowMs: Date.UTC(2030, 0, 1),
      measureStaticBindings: async () => staticBindings(envelope),
      liveAdapter: async plan => {
        plan.assert_live_measurement_ready();
        liveCalls += 1;
        assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
        assert.equal(await readFile(join(stateDir, 'spent', `${sha256(nonce)}.json`), 'utf8').then(Boolean), true);
        throw new GateBError('GATE_B_LIVE_MEASUREMENT_FAILED');
      },
    }), error => error?.code === 'GATE_B_LIVE_MEASUREMENT_FAILED');
    assert.equal(liveCalls, 1);
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
  });
});

test('activation clock is fresh, monotonic and rechecked before post-lease live effects', async () => {
  const base = Date.UTC(2030, 0, 1);
  const run = async (times, expiresAt, expectCode) => withTempState(async ({ repositoryRoot, stateDir }) => {
    const nonce = ((randomClockNonce++ % 15) + 1).toString(16).repeat(64);
    const envelope = approvalDraft({ nonce, issuedAt: new Date(base - 1_000).toISOString(), expiresAt });
    const path = join(repositoryRoot, 'approval.json');
    await writeApproval(path, nonce, envelope);
    let index = 0;
    const attempt = activateGateBFromApprovalFile({
      approvalFilePath: path, repositoryRoot,
      clock: () => times[Math.min(index++, times.length - 1)],
      measureStaticBindings: async () => staticBindings(envelope),
      liveAdapter: async plan => {
        plan.assert_live_measurement_ready();
        plan.complete_live_preflight(liveBindings(envelope), liveBindings(envelope));
        return { status: 'ready' };
      },
    });
    if (expectCode) {
      await assert.rejects(attempt, error => error?.code === expectCode);
      assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
      assert.equal(await readFile(join(stateDir, 'spent', `${sha256(nonce)}.json`), 'utf8').then(Boolean), true);
      return;
    }
    const result = await attempt;
    await releaseGateBLease(result.lease);
  });
  await run([base, base, base, base, base, base], new Date(base + 60_000).toISOString(), null);
  await run([base, base + 1, base - 1], new Date(base + 60_000).toISOString(), 'GATE_B_CLOCK_INVALID');
  await run([base, base + 1, base + 3_000], new Date(base + 2_000).toISOString(), 'GATE_B_APPROVAL_EXPIRED');
});

test('production default clock rereads Date.now and catches expiry after durable lease', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const base = Date.UTC(2030, 0, 1);
    const nonce = '9'.repeat(64);
    const envelope = approvalDraft({
      nonce, issuedAt: new Date(base - 1_000).toISOString(), expiresAt: new Date(base + 2_000).toISOString(),
    });
    const path = join(repositoryRoot, 'approval.json');
    await writeApproval(path, nonce, envelope);
    const originalNow = Date.now;
    const times = [base, base + 1, base + 3_000];
    let index = 0;
    Date.now = () => times[Math.min(index++, times.length - 1)];
    try {
      await assert.rejects(activateGateBFromApprovalFile({
        approvalFilePath: path, repositoryRoot,
        measureStaticBindings: async () => staticBindings(envelope),
        liveAdapter: async () => assert.fail('live dispatch must not start after expiry'),
      }), error => error?.code === 'GATE_B_APPROVAL_EXPIRED');
    } finally {
      Date.now = originalNow;
    }
    assert.equal(await readFile(join(stateDir, 'active.lock', 'owner'), 'utf8').then(Boolean), true);
  });
});

let randomClockNonce = 1;

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

test('Gate B state resolves to one Git common directory for normal and worktree roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gate-b-common-'));
  try {
    const main = join(root, 'main');
    const worktree = join(root, 'worktree');
    const common = join(main, '.git');
    const worktreeGitDir = join(common, 'worktrees', 'feature');
    await mkdir(worktreeGitDir, { recursive: true });
    await mkdir(worktree, { recursive: true });
    await writeFile(join(worktree, '.git'), `gitdir: ${worktreeGitDir}\n`, { mode: 0o600 });
    await writeFile(join(worktreeGitDir, 'commondir'), '../..\n', { mode: 0o600 });
    const mainState = await resolveGateBStateDirectory({ repositoryRoot: main });
    const worktreeState = await resolveGateBStateDirectory({ repositoryRoot: worktree });
    assert.equal(mainState, join(common, 'tradingview-mcp-e2e'));
    assert.equal(worktreeState, mainState);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Gate B state resolution rejects symlink roots and caller state-directory overrides', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gate-b-common-'));
  try {
    const repositoryRoot = join(root, 'repo');
    await mkdir(join(repositoryRoot, '.git'), { recursive: true });
    const alias = join(root, 'alias');
    await symlink(repositoryRoot, alias);
    await assert.rejects(
      resolveGateBStateDirectory({ repositoryRoot: alias }),
      error => error?.code === 'GATE_B_GIT_COMMON_DIR_UNSAFE',
    );
    await assert.rejects(
      acquireGateBLease({ stateDir: join(root, 'attacker-controlled') }),
      error => error?.code === 'GATE_B_STATE_OVERRIDE_FORBIDDEN',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('public coordinator rejects synthetic live configuration before lease consumption', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const result = await executeCoordinator({
      args: [],
      liveConfiguration: {
        approvalFilePath: join(repositoryRoot, 'approval.json'),
        repositoryRoot,
        measureBindings: async () => ({}),
        stateMachineConfiguration: { cases: [{ id: 'quote_1' }], dispatchOwner: async () => ({}) },
      },
    });
    assert.equal(result.exit_code, 1);
    assert.equal(result.payload.code, 'GATE_B_LIVE_CONFIGURATION_INVALID');
    await assert.rejects(readFile(join(stateDir, 'active.lock', 'owner')), error => error?.code === 'ENOENT');
  });
});

test('live configuration without a reviewed state machine fails before approval consumption', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const result = await executeCoordinator({ args: [], liveConfiguration: { repositoryRoot } });
    assert.equal(result.exit_code, 1);
    assert.equal(result.payload.code, 'GATE_B_LIVE_CONFIGURATION_INVALID');
    await assert.rejects(readFile(join(stateDir, 'active.lock', 'owner')), error => error?.code === 'ENOENT');
  });
});

test('relative, absolute and symlink coordinator entrypoints emit exactly one sanitized JSON line', async () => {
  const secretPath = '/missing/RAW_SECRET_APPROVAL.json';
  const root = new URL('..', import.meta.url).pathname;
  const absolute = join(root, 'tests', 'test-coordinator.mjs');
  const temporary = await mkdtemp(join(tmpdir(), 'coordinator-entry-'));
  const linked = join(temporary, 'coordinator.mjs');
  await symlink(absolute, linked);
  try {
    for (const entrypoint of ['tests/test-coordinator.mjs', absolute, linked]) {
      const child = spawnSync(process.execPath, [entrypoint], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, TRADINGVIEW_MCP_GATE_B_APPROVAL_FILE: secretPath }, timeout: 5_000,
      });
      assert.equal(child.status, 1, child.stderr);
      const lines = child.stdout.trim().split('\n');
      assert.equal(lines.length, 1);
      const payload = JSON.parse(lines[0]);
      assert.equal(payload.code, 'GATE_B_LIVE_CONFIGURATION_INVALID');
      assert.equal(payload.external_action_count, 0);
      assert.equal(payload.live_test_started, false);
      assert.doesNotMatch(`${child.stdout}${child.stderr}`, /RAW_SECRET_APPROVAL/);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('exact npm test reaches the fixed full state path through a test-only loader boundary', async () => {
  await withTempState(async ({ repositoryRoot, stateDir }) => {
    const sourceRoot = new URL('..', import.meta.url).pathname;
    await Promise.all([
      cp(join(sourceRoot, 'src'), join(repositoryRoot, 'src'), { recursive: true }),
      cp(join(sourceRoot, 'tests'), join(repositoryRoot, 'tests'), { recursive: true }),
      cp(join(sourceRoot, 'package.json'), join(repositoryRoot, 'package.json')),
      cp(join(sourceRoot, 'package-lock.json'), join(repositoryRoot, 'package-lock.json')),
    ]);
    await symlink(join(sourceRoot, 'node_modules'), join(repositoryRoot, 'node_modules'));
    const nonce = 'f'.repeat(64);
    const envelope = approvalDraft({ nonce });
    const approvalFilePath = join(repositoryRoot, 'approval.json');
    await writeApproval(approvalFilePath, nonce, envelope);
    const loader = new URL('./fixtures/gate_b_factory_loader.mjs', import.meta.url).pathname;
    const child = spawnSync('npm', ['test'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --experimental-loader=${loader}`.trim(),
        TRADINGVIEW_MCP_GATE_B_APPROVAL_FILE: approvalFilePath,
      },
    });
    assert.equal(child.status, 0, `${child.stderr}\n${child.stdout}`);
    const line = child.stdout.trim().split('\n').at(-1);
    const payload = JSON.parse(line);
    assert.equal(payload.status, 'live_complete');
    assert.equal(payload.code, 'GATE_B_LIVE_COMPLETE');
    assert.equal(payload.case_count, 24);
    assert.equal(payload.benchmark_sample_count, 30);
    assert.equal(payload.ledger.full_external_gate_invocation_count, 1);
    // Fixed 24-case callbacks, owner-local pre/post identity checks, guards,
    // and N=30 benchmark provenance/sample reads share one ledger.
    assert.equal(payload.ledger.cdp_protocol_read_count, 7832);
    assert.equal(payload.ledger.outcome_unknown_count, 0);
    await assert.rejects(readFile(join(stateDir, 'active.lock', 'owner')), error => error?.code === 'ENOENT');
    assert.equal(await readFile(join(stateDir, 'spent', `${sha256(nonce)}.json`), 'utf8').then(Boolean), true);
    assert.doesNotMatch(`${child.stdout}${child.stderr}`, new RegExp(nonce));
  });
});
