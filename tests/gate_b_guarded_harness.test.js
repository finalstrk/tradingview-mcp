import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  LIVE_SUITE_MIGRATION_REGISTRY,
  createGuardedE2EHarness,
  scanLiveSuiteBoundary,
} from '../src/e2e/guarded_harness.js';
import {
  createApprovalBoundBenchmarkRunner,
  createBatchCaseOwner,
  createGateBLoopbackLedger,
  createGuardedE2EHarness as publicCreateGuardedE2EHarness,
  createPhase0ReadOnlyPlan,
  createQuoteCaseOwner,
  scanLiveSuiteBoundary as publicScanLiveSuiteBoundary,
} from '../src/e2e/index.js';

const TARGET = Object.freeze({
  targetId: 'target-0123456789abcdef',
  sessionId: 'session-0123456789abcdef',
  executionContextId: 7,
});

const CASES = Object.freeze([
  Object.freeze({ id: 'chart-read', surface: 'chart', mutation: false, requiresPineSignal: false }),
  Object.freeze({ id: 'study-add', surface: 'study', mutation: true, requiresPineSignal: false }),
  Object.freeze({ id: 'drawing-add', surface: 'drawing', mutation: true, requiresPineSignal: false }),
  Object.freeze({ id: 'replay-step', surface: 'replay', mutation: true, requiresPineSignal: false }),
  Object.freeze({ id: 'panel-toggle', surface: 'panel', mutation: true, requiresPineSignal: false }),
  Object.freeze({ id: 'pine-read', surface: 'pine', mutation: false, requiresPineSignal: false }),
  Object.freeze({ id: 'pine-write', surface: 'pine', mutation: true, requiresPineSignal: true }),
]);

function inventory(overrides = {}) {
  return {
    symbol: 'FX:USDJPY', resolution: '15', chartType: 1,
    studyIds: ['base-study'], drawingIds: [], panelIds: [], replayActive: false,
    pineIdentity: 'opaque-stable-id', ...overrides,
  };
}

function fakeOperations(options = {}) {
  let state = inventory(options.initial);
  const created = new Set();
  const calls = [];
  let active = 0;
  let maxActive = 0;
  let ownerlessMutations = 0;

  return {
    calls,
    metrics: () => ({ maxActive, ownerlessMutations, created: [...created], state }),
    async captureInventory(target) {
      calls.push(['capture', target]);
      return structuredClone(state);
    },
    async inspectReplay(target) {
      calls.push(['replay', target]);
      return { active: state.replayActive };
    },
    async inspectPineSignals(target) {
      calls.push(['pine-signal', target]);
      return { proven: options.pineProven === true };
    },
    async runOwnedCase(caseDefinition, target, owner) {
      calls.push(['case', caseDefinition.id, target, owner]);
      if (!owner || owner.kind !== 'guarded-e2e-owner') ownerlessMutations += Number(caseDefinition.mutation);
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        const behavior = options.behaviors?.[caseDefinition.id];
        if (behavior === 'hang') {
          return await new Promise((resolve, reject) => {
            owner.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          });
        }
        if (behavior === 'crash') throw new Error('RAW_CHILD_CRASH_SECRET');
        if (behavior === 'unknown') return { status: 'unknown', code: 'CASE_OUTCOME_UNKNOWN', createdIds: [] };
        const id = caseDefinition.mutation ? `created-${caseDefinition.id}` : null;
        if (id) created.add(id);
        if (caseDefinition.surface === 'study' && id) state.studyIds.push(id);
        if (caseDefinition.surface === 'drawing' && id) state.drawingIds.push(id);
        if (caseDefinition.surface === 'panel' && id) state.panelIds.push(id);
        if (caseDefinition.surface === 'replay' && id) state.replayActive = true;
        if (behavior === 'failure') return { status: 'failure', code: 'CASE_FAILED', createdIds: id ? [id] : [] };
        return { status: 'success', code: 'CASE_OK', createdIds: id ? [id] : [] };
      } finally {
        active -= 1;
      }
    },
    async cleanupCreated(ids, target, owner) {
      calls.push(['cleanup', [...ids], target, owner]);
      for (const id of ids) {
        created.delete(id);
        state.studyIds = state.studyIds.filter(value => value !== id);
        state.drawingIds = state.drawingIds.filter(value => value !== id);
        state.panelIds = state.panelIds.filter(value => value !== id);
      }
    },
    async restoreInventory(initial, target, owner) {
      calls.push(['restore', target, owner]);
      state = structuredClone(initial);
    },
    async countCreated(ids) {
      return ids.filter(id => created.has(id)).length;
    },
    async inventoriesEqual(initial, final) {
      return JSON.stringify(initial) === JSON.stringify(final);
    },
    async countOwnerlessMutations() {
      return ownerlessMutations;
    },
  };
}

function harness(operations, cases = CASES, deadlineMs = 30) {
  return createGuardedE2EHarness({ target: TARGET, cases, operations, deadlineMs });
}

test('exports the guarded harness through the E2E boundary', () => {
  assert.equal(publicCreateGuardedE2EHarness, createGuardedE2EHarness);
  assert.equal(publicScanLiveSuiteBoundary, scanLiveSuiteBoundary);
  for (const exported of [
    createApprovalBoundBenchmarkRunner, createBatchCaseOwner, createGateBLoopbackLedger,
    createPhase0ReadOnlyPlan, createQuoteCaseOwner,
  ]) assert.equal(typeof exported, 'function');
});

test('runs every surface serially under one explicit target and restores all mutations', async () => {
  const operations = fakeOperations({ pineProven: true });
  const runner = harness(operations);
  const result = await runner.run();

  assert.equal(result.status, 'success');
  assert.equal(result.code, 'E2E_GUARD_OK');
  assert.equal(result.initial_final_invariant, true);
  assert.equal(result.created_remaining_count, 0);
  assert.equal(result.ownerless_mutation_count, 0);
  assert.equal(result.pine_mode, 'atomic');
  assert.equal(operations.metrics().maxActive, 1);
  assert.deepEqual(operations.metrics().created, []);
  assert.deepEqual(operations.metrics().state, inventory());
  const observedTargets = operations.calls
    .flatMap(call => call.filter(value => value?.targetId === TARGET.targetId));
  assert.ok(observedTargets.length > 0);
  assert.ok(observedTargets.every(target => target === runner.target));
  assert.deepEqual(result.cases.map(entry => entry.id), CASES.map(entry => entry.id));
});

test('uses read-only Pine fallback when authoritative signals are not proven', async () => {
  const operations = fakeOperations({ pineProven: false });
  const result = await harness(operations).run();

  assert.equal(result.status, 'success');
  assert.equal(result.pine_mode, 'read-only');
  assert.deepEqual(result.cases.find(entry => entry.id === 'pine-write'), {
    id: 'pine-write', surface: 'pine', status: 'skipped', code: 'PINE_SIGNAL_UNPROVEN',
  });
  assert.equal(operations.calls.some(call => call[0] === 'case' && call[1] === 'pine-write'), false);
});

test('fails before mutation when replay is initially active', async () => {
  const operations = fakeOperations({ initial: { replayActive: true }, pineProven: true });
  const result = await harness(operations).run();

  assert.deepEqual(result, {
    status: 'failure', code: 'INITIAL_REPLAY_ACTIVE', cases: [], pine_mode: 'unknown',
    initial_final_invariant: true, created_remaining_count: 0, ownerless_mutation_count: 0,
  });
  assert.equal(operations.calls.some(call => call[0] === 'case'), false);
});

test('partial failure, child crash, timeout and unknown remain fixed and always restore', async () => {
  for (const [behavior, expectedCode] of [
    ['failure', 'CASE_FAILED'],
    ['crash', 'CASE_EXECUTION_FAILED'],
    ['hang', 'CASE_DEADLINE_EXCEEDED'],
    ['unknown', 'CASE_OUTCOME_UNKNOWN'],
  ]) {
    const operations = fakeOperations({ pineProven: true, behaviors: { 'drawing-add': behavior } });
    const result = await harness(operations).run();
    const outcome = result.cases.find(entry => entry.id === 'drawing-add');
    assert.equal(outcome.code, expectedCode, behavior);
    assert.equal(result.status, behavior === 'failure' || behavior === 'crash' ? 'failure' : 'unknown');
    assert.equal(result.initial_final_invariant, true);
    assert.equal(result.created_remaining_count, 0);
    assert.equal(result.ownerless_mutation_count, 0);
    assert.deepEqual(operations.metrics().created, []);
    assert.deepEqual(operations.metrics().state, inventory());
    assert.doesNotMatch(JSON.stringify(result), /RAW_CHILD_CRASH_SECRET/);
  }
});

test('restore failure dominates success and reports invariant as unproven', async () => {
  const operations = fakeOperations({ pineProven: true });
  operations.restoreInventory = async () => { throw new Error('RAW_RESTORE_SECRET'); };
  const result = await harness(operations).run();
  assert.equal(result.status, 'unknown');
  assert.equal(result.code, 'OUTER_RESTORE_FAILED');
  assert.equal(result.initial_final_invariant, false);
  assert.doesNotMatch(JSON.stringify(result), /RAW_RESTORE_SECRET/);
});

test('configuration rejects duplicate cases and mutable target aliases', () => {
  const operations = fakeOperations();
  assert.throws(
    () => createGuardedE2EHarness({ target: TARGET, cases: [CASES[0], CASES[0]], operations, deadlineMs: 30 }),
    error => error?.code === 'E2E_HARNESS_INVALID_CONFIGURATION',
  );
  const target = { ...TARGET };
  const runner = createGuardedE2EHarness({ target, cases: [CASES[0]], operations, deadlineMs: 30 });
  target.targetId = 'changed';
  assert.notEqual(runner.target.targetId, target.targetId);
  assert.equal(Object.isFrozen(runner.target), true);
});

test('static boundary gate rejects bypasses after every live suite migration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gate-b-boundary-'));
  await mkdir(join(root, 'tests'));
  const fixtures = {
    'e2e.test.js': "import CDP from 'chrome-remote-interface'; await Input.dispatchKeyEvent({}); await fetch('https://example.test');",
    'batch_e2e.test.js': "import CRI from 'chrome-remote-interface';",
    'pine_facade_e2e.test.js': "import { execFileSync } from 'node:child_process'; execFileSync('node', []);",
    'graphics_e2e.test.js': 'export const safe = true;',
    'launch_e2e.test.js': 'export const safe = true;',
    'quote_e2e.test.js': 'export const safe = true;',
  };
  await Promise.all(Object.entries(fixtures).map(([name, source]) => writeFile(join(root, 'tests', name), source)));

  const report = await scanLiveSuiteBoundary(root);
  assert.equal(report.status, 'failure');
  assert.equal(report.code, 'LIVE_SUITE_BYPASS_DETECTED');
  assert.deepEqual(report.pending, []);
  assert.deepEqual(report.bypasses.map(entry => entry.kind).sort(), [
    'child-process', 'direct-cdp', 'direct-cdp', 'direct-fetch', 'direct-input',
  ]);
});

test('static boundary gate accepts the real migrated children with zero direct bypasses', async () => {
  const root = new URL('..', import.meta.url).pathname;
  const report = await scanLiveSuiteBoundary(root);
  assert.equal(report.status, 'success');
  assert.equal(report.code, 'LIVE_SUITE_MIGRATION_READY');
  assert.deepEqual(report.pending, []);
  assert.deepEqual(report.bypasses, []);
  assert.ok(LIVE_SUITE_MIGRATION_REGISTRY.every(entry => entry.state === 'ready'));
});

test('static boundary gate rejects unknown live suites and registry drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gate-b-boundary-'));
  await mkdir(join(root, 'tests'));
  await Promise.all(LIVE_SUITE_MIGRATION_REGISTRY.map(({ file }) => writeFile(join(root, file), 'export {};')));
  await writeFile(join(root, 'tests', 'surprise_e2e.test.js'), 'export {};');
  const report = await scanLiveSuiteBoundary(root);
  assert.equal(report.status, 'failure');
  assert.equal(report.code, 'LIVE_SUITE_BOUNDARY_DRIFT');
  assert.deepEqual(report.unknown_files, ['tests/surprise_e2e.test.js']);
});
