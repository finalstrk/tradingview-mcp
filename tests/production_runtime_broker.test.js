import assert from 'node:assert/strict';
import test from 'node:test';

import { CHART_OPERATION_REGISTRY, createChartOperationBridge } from '../src/e2e/chart_operation_registry.js';
import { OWNER_OPERATION_REGISTRY, createOwnerOperationBridge } from '../src/e2e/owner_operation_registry.js';
import { createTestProductionRuntimeBroker as createProductionRuntimeBroker } from './helpers/production_runtime_broker_test_helper.js';
import {
  BASELINE_ARTIFACT_SHA256, BASELINE_MODULE_PATH, BASELINE_REPOSITORY_COMMIT,
  BASELINE_EXECUTOR_ARTIFACT_SHA256, BASELINE_EXECUTOR_MODULE_PATH, BASELINE_EXECUTOR_REPOSITORY_COMMIT,
  BENCHMARK_WORKLOAD_SHA256, CANDIDATE_ARTIFACT_SHA256, CANDIDATE_MODULE_PATH,
  CANDIDATE_EXECUTOR_ARTIFACT_SHA256, CANDIDATE_EXECUTOR_MODULE_PATH,
  PRODUCTION_PROTOCOL_DERIVATION, PRODUCTION_PROTOCOL_INVENTORY,
} from '../src/e2e/production_runtime_transports.js';

const TARGET = Object.freeze({ targetId: 'target-1', sessionId: 'owner_local_pre_post', executionContextId: 7 });
const LOCAL_IDENTITY = Object.freeze({ ...TARGET, sessionId: 'local-session-1' });
const PROVENANCE = Object.freeze({
  baseline_artifact_sha256: BASELINE_ARTIFACT_SHA256,
  baseline_executor_artifact_sha256: BASELINE_EXECUTOR_ARTIFACT_SHA256,
  baseline_executor_module_path: BASELINE_EXECUTOR_MODULE_PATH,
  baseline_executor_repository_commit: BASELINE_EXECUTOR_REPOSITORY_COMMIT,
  baseline_module_path: BASELINE_MODULE_PATH,
  baseline_repository_commit: BASELINE_REPOSITORY_COMMIT,
  benchmark_workload_sha256: BENCHMARK_WORKLOAD_SHA256,
  envelope_sha256: 'a'.repeat(64), repository_head: 'b'.repeat(40), working_tree_diff_sha256: 'c'.repeat(64),
  test_manifest_sha256: 'd'.repeat(64), build_sha256: 'e'.repeat(64), candidate_artifact_sha256: CANDIDATE_ARTIFACT_SHA256,
  candidate_module_path: CANDIDATE_MODULE_PATH, candidate_repository_commit: '6'.repeat(40),
  candidate_executor_artifact_sha256: CANDIDATE_EXECUTOR_ARTIFACT_SHA256,
  candidate_executor_module_path: CANDIDATE_EXECUTOR_MODULE_PATH,
  workload_sha256: 'f'.repeat(64), target: TARGET,
});
const brokerConfig = deadlineMs => ({ target: TARGET, deadlineMs, transportContext: {} });
const authority = overrides => Object.seal({ ...PROVENANCE, ...overrides });
async function bind(broker, ledger) {
  await broker.measureStaticBindings();
  await broker.measureLiveBindings(ledger);
  return broker.createBoundSession(ledger, authority());
}

function resultForOwner(operation) {
  const result = {};
  for (const [key, type] of Object.entries(operation.result_schema.required)) {
    result[key] = type === 'array' ? [] : type === 'object' ? {} : type === 'boolean' ? true : type === 'number' ? 0 : 'ok';
  }
  return result;
}

function fixture(overrides = {}) {
  const calls = [];
  let identity = LOCAL_IDENTITY;
  const authorize = (control, counters) => {
    for (const counter of [].concat(counters || [])) control?.authorize(counter, 1);
  };
  const makeIdentity = () => {
    let active = false;
    return async control => {
      if (control) control.authorize(active ? 'cdp_session_detach_count' : 'cdp_session_attach_count', 1);
      active = !active;
      return identity;
    };
  };
  const constructors = Object.freeze({
    createChartTransport: () => Object.freeze({ execute: async (kind, method, params, _target, control, counters) => { authorize(control, counters); calls.push(['chart', kind, method, params]); return null; }, identity: makeIdentity() }),
    createOwnerTransport: () => Object.freeze({ execute: async (id, operation, _target, control, counters) => { authorize(control, counters); calls.push(['owner', id]); return resultForOwner(operation); }, identity: makeIdentity() }),
    createGuardTransport: () => Object.freeze({ execute: async (name, args, _target, control, counters) => { authorize(control, counters); calls.push(['guard', name, args]); return name === 'inspectReplay' ? { active: false } : name === 'inspectPineSignals' ? { proven: true } : name.startsWith('count') ? 0 : name === 'inventoriesEqual' || name === 'restoreInventory' || name === 'cleanupCreated' ? true : {}; }, identity: makeIdentity() }),
    createBenchmarkTransport: () => Object.freeze({ executeSample: async ({ phase }, _target, _provenance, control, counters) => { authorize(control, counters); calls.push(['benchmark', phase]); return phase === 'before' ? 2 : 1; }, restore: async (_target, _provenance, control, counters) => { authorize(control, counters); return true; }, identity: makeIdentity() }),
    createArtifactTransport: () => Object.freeze({ write: async (_value, _provenance, control, counters) => { authorize(control, counters); calls.push(['artifact']); return { artifactId: 'artifact-1' }; }, identity: makeIdentity() }),
    createMeasurementTransport: () => Object.freeze({
      measureStaticBindings: async () => ({
        repository_head: PROVENANCE.repository_head,
        working_tree_diff_sha256: PROVENANCE.working_tree_diff_sha256,
        test_manifest_sha256: PROVENANCE.test_manifest_sha256,
      }),
      measureLiveBindings: async () => ({
        target_policy: { kind: 'explicit_target_id', target_id: TARGET.targetId },
        target_context: { target_id: TARGET.targetId, execution_context_id: TARGET.executionContextId, frame_id: 'frame-1', loader_id: 'loader-1', unique_context_id: 'context-1' },
        build_sha256: PROVENANCE.build_sha256,
      }),
      identity: makeIdentity(),
    }),
    ...overrides,
  });
  return { calls, constructors, drift() { identity = { ...LOCAL_IDENTITY, sessionId: 'drifted' }; } };
}

function control(budgets = {}) {
  const counters = {};
  const value = Object.freeze({
    authorize(key, delta = 1) {
      const next = (counters[key] || 0) + delta;
      if (next > (budgets[key] ?? 10_000)) { const error = new Error('OVER'); error.code = 'IPC_BUDGET_EXCEEDED'; throw error; }
      counters[key] = next;
    },
    snapshot: () => Object.freeze({ ...counters }),
  });
  return { value, counters };
}

test('all 156 chart and 11 owner registry operations use one bound control and exact context', async () => {
  const f = fixture();
  const ledger = control();
  const broker = await createProductionRuntimeBroker(brokerConfig(50), f.constructors);
  const runtime = await bind(broker, ledger.value);
  const chart = createChartOperationBridge({ reviewedAdapters: runtime.reviewedAdapters });
  for (const [id, operation] of Object.entries(CHART_OPERATION_REGISTRY)) {
    const args = Object.fromEntries(operation.params.argument_names.map(name => [name, name === 'x' || name === 'y' || name === 'width' || name === 'height' ? 1 : 'value']));
    await chart.execute(id, args);
  }
  const owner = createOwnerOperationBridge({ transport: runtime.ownerTransport, expectedContext: TARGET, deadlineMs: 50 });
  for (const id of Object.keys(OWNER_OPERATION_REGISTRY)) await owner.execute(id);
  assert.equal(f.calls.filter(call => call[0] === 'chart').length, 156);
  assert.equal(f.calls.filter(call => call[0] === 'owner').length, 11);
  assert.ok(Object.values(ledger.counters).reduce((sum, value) => sum + value, 0) >= 167);
});

test('over-budget, drift, throw, unknown operation and raw secrets fail closed', async () => {
  const f = fixture();
  const ledger = control({ cdp_read_count: 0 });
  const broker = await createProductionRuntimeBroker(brokerConfig(20), f.constructors);
  const runtime = await bind(broker, ledger.value);
  const first = CHART_OPERATION_REGISTRY['chart.op.001'];
  await assert.rejects(runtime.reviewedAdapters.read(first.method, {
    functionDeclaration: first.params.functionDeclaration,
    awaitPromise: false,
    returnByValue: true,
    arguments: [{ value: 'chart' }],
  }), error => error.code === 'RUNTIME_BROKER_BUDGET_EXCEEDED');
  assert.equal(f.calls.length, 0);
  assert.throws(() => runtime.ownerTransport.executeFixedOperation('unknown', {}, TARGET), error => error.code === 'RUNTIME_BROKER_OPERATION_DENIED');

  const f2 = fixture({ createChartTransport: () => Object.freeze({ execute: async () => { throw new Error('SECRET api token'); }, identity: async () => LOCAL_IDENTITY }) });
  const broker2 = await createProductionRuntimeBroker(brokerConfig(20), f2.constructors);
  const runtime2 = await bind(broker2, control().value);
  await assert.rejects(runtime2.reviewedAdapters.read(first.method, {
    functionDeclaration: first.params.functionDeclaration,
    awaitPromise: false,
    returnByValue: true,
    arguments: [{ value: 'chart' }],
  }), error => error.code === 'RUNTIME_BROKER_OPERATION_FAILED' && !JSON.stringify(error).includes('SECRET'));
  const f3 = fixture();
  const broker3 = await createProductionRuntimeBroker(brokerConfig(20), f3.constructors);
  const runtime3 = await bind(broker3, control().value);
  await runtime3.guardOperations.captureInventory(TARGET);
  f3.drift();
  await assert.rejects(runtime3.guardOperations.captureInventory(TARGET), error => error.code === 'RUNTIME_BROKER_CONTEXT_MISMATCH');
});

test('guard restore and benchmark measurement, action, restore and sink share the same ledger', async () => {
  const f = fixture();
  const ledger = control();
  const broker = await createProductionRuntimeBroker(brokerConfig(50), f.constructors);
  const runtime = await bind(broker, ledger.value);
  const initial = await runtime.guardOperations.captureInventory(TARGET);
  assert.equal(await runtime.guardOperations.restoreInventory(initial, TARGET, Object.freeze({ kind: 'guarded-e2e-owner' })), true);
  assert.deepEqual(await runtime.benchmarkOperations.readProvenance(), PROVENANCE);
  assert.equal(await runtime.benchmarkOperations.executeSample({ phase: 'before', index: 0, adapters: runtime.benchmarkAdapters }), 2);
  assert.equal(await runtime.benchmarkOperations.restore(), true);
  assert.deepEqual(await runtime.artifactSink.write({ schema: 'test' }), { artifactId: 'artifact-1' });
  assert.ok(ledger.counters.cdp_protocol_read_count >= 1);
  assert.ok(ledger.counters.cdp_protocol_mutation_count >= 1);
  assert.equal(ledger.counters.cdp_session_attach_count, ledger.counters.cdp_session_detach_count);
});

test('session binding is one-shot and rejects untrusted control shapes', async () => {
  const broker = await createProductionRuntimeBroker(brokerConfig(50), fixture().constructors);
  const bindControl = control().value;
  await broker.measureStaticBindings();
  await broker.measureLiveBindings(bindControl);
  assert.throws(() => broker.createBoundSession({ authorize() {}, snapshot() {} }, authority()), /RUNTIME_BROKER_CONTROL_INVALID/);
  assert.throws(() => broker.createBoundSession(control().value, { ...PROVENANCE }), /RUNTIME_BROKER_AUTHORITY_INVALID/);
  assert.throws(() => broker.createBoundSession(control().value, authority({ repository_head: '0'.repeat(40) })), /RUNTIME_BROKER_AUTHORITY_INVALID/);
  broker.createBoundSession(bindControl, authority());
  assert.throws(() => broker.createBoundSession(control().value, authority()), /RUNTIME_BROKER_ALREADY_BOUND/);
});

test('static measurement has no live control and failed actions still detach the actual owner session', async () => {
  const f = fixture({
    createChartTransport: () => {
      let attached = false;
      return Object.freeze({
        async identity(control) { control.authorize(attached ? 'cdp_session_detach_count' : 'cdp_session_attach_count', 1); attached = !attached; return LOCAL_IDENTITY; },
        async execute() { throw new Error('SECRET'); },
      });
    },
  });
  const broker = await createProductionRuntimeBroker(brokerConfig(50), f.constructors);
  const staticBindings = await broker.measureStaticBindings();
  assert.equal(staticBindings.repository_head, PROVENANCE.repository_head);
  const ledger = control();
  await broker.measureLiveBindings(ledger.value);
  const runtime = broker.createBoundSession(ledger.value, authority());
  const first = CHART_OPERATION_REGISTRY['chart.op.001'];
  await assert.rejects(runtime.reviewedAdapters.read(first.method, {
    functionDeclaration: first.params.functionDeclaration, awaitPromise: false, returnByValue: true,
    arguments: [{ value: 'chart' }],
  }), error => error.code === 'RUNTIME_BROKER_OPERATION_FAILED' && !JSON.stringify(error).includes('SECRET'));
  assert.equal(ledger.counters.cdp_session_attach_count, ledger.counters.cdp_session_detach_count);
});

test('fixed protocol inventory is exact, finite and uses distinct benchmark artifacts', () => {
  assert.deepEqual(PRODUCTION_PROTOCOL_INVENTORY, {
    logical_operation_count: 11, cdp_session_attach_count: 978, cdp_session_detach_count: 978,
    cdp_protocol_read_count: 7832, cdp_protocol_mutation_count: 122,
    cdp_protocol_input_count: 12, network_request_count: 6, child_process_count: 8, capture_count: 3,
  });
  assert.ok(Object.values(PRODUCTION_PROTOCOL_INVENTORY).every(Number.isSafeInteger));
  const { chart, owners, guard, benchmark, live_measurement: live } = PRODUCTION_PROTOCOL_DERIVATION;
  const sessions = chart.actions + chart.identity_only_sessions + owners.sessions + guard.sessions
    + benchmark.provenance_sessions + benchmark.legacy_sessions + benchmark.candidate_sessions + benchmark.artifact_sessions + live.sessions;
  assert.equal(PRODUCTION_PROTOCOL_INVENTORY.cdp_session_attach_count, sessions);
  assert.equal(PRODUCTION_PROTOCOL_INVENTORY.cdp_session_detach_count, sessions);
  assert.equal(PRODUCTION_PROTOCOL_INVENTORY.cdp_protocol_read_count,
    7 * (chart.actions + chart.identity_only_sessions) + 3 * chart.read_actions + 2 * chart.mutation_actions
    + 7 * owners.sessions + owners.action_reads + 7 * guard.sessions + guard.action_reads
    + benchmark.protocol_reads + live.protocol_reads);
  assert.equal(PRODUCTION_PROTOCOL_INVENTORY.child_process_count,
    owners.children + benchmark.loader_children + benchmark.artifact_children);
  assert.equal(PRODUCTION_PROTOCOL_INVENTORY.capture_count,
    chart.capture_actions + benchmark.loader_captures + benchmark.artifact_captures);
});

test('chart protocol derivation matches every fixed call site and deterministic repeated hook', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/e2e/cases/chart_suite.js', import.meta.url), 'utf8');
  const ids = [...source.matchAll(/executeOperation\('([^']+)'/g)].map(match => match[1]);
  for (const id of ['chart.op.138', 'chart.op.139', 'chart.op.140', 'chart.op.141', 'chart.op.142', 'chart.op.143']) {
    for (let repeat = 0; repeat < 12; repeat += 1) ids.push(id);
  }
  for (let repeat = 0; repeat < 3; repeat += 1) ids.push('chart.op.001');
  for (let repeat = 0; repeat < 9; repeat += 1) { ids.push('chart.op.057'); ids.push('chart.op.058'); }
  const kinds = ids.reduce((counts, id) => {
    const operation = CHART_OPERATION_REGISTRY[id];
    assert.ok(operation, `unregistered operation ${id}`);
    counts[operation.kind] = (counts[operation.kind] || 0) + 1;
    return counts;
  }, {});
  const { identity_only_sessions: _identitySessions, ...chartActions } = PRODUCTION_PROTOCOL_DERIVATION.chart;
  assert.deepEqual({
    actions: ids.length, read_actions: kinds.read, mutation_actions: kinds.mutation,
    input_actions: kinds.input, capture_actions: kinds.capture, network_actions: kinds.network,
  }, chartActions);
});

test('production broker fixes constructors internally and production sources cannot import the test helper', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/e2e/production_runtime_broker.js', import.meta.url), 'utf8');
  assert.match(source, /FIXED_PRODUCTION_TRANSPORT_CONSTRUCTORS/);
  assert.match(source, /function createProductionRuntimeBroker\(configuration\)/);
  assert.doesNotMatch(source, /production_runtime_broker_test_helper|tests\/helpers/);
  assert.equal(source.match(/function createProductionRuntimeBroker\(([^)]*)\)/)?.[1], 'configuration');
  for (const file of ['index.js', 'live_runtime_factory.js', 'production_live_runtime.js']) {
    const production = await readFile(new URL(`../src/e2e/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(production, /production_runtime_broker_test_helper|tests\/helpers/);
  }
  const transports = await readFile(new URL('../src/e2e/production_runtime_transports.js', import.meta.url), 'utf8');
  assert.doesNotMatch(transports, /ownerSessionId|owner-.*randomBytes/);
  assert.match(transports, /Target\.attachToTarget/);
  assert.match(transports, /Target\.detachFromTarget/);
  assert.match(transports, /BASELINE_EXECUTOR_REPOSITORY_COMMIT/);
  assert.match(transports, /compileRestrictedBenchmarkExecutor\(baselineExecutorBytes, 'baseline'/);
  assert.match(transports, /compileRestrictedBenchmarkExecutor\(candidateExecutorBytes, 'candidate'/);
  assert.match(transports, /createLegacyBenchmarkPrimitives/);
  assert.doesNotMatch(transports, /createBenchmarkSessionExecutors|benchmark_session_executors/);
});
