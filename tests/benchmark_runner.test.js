import test from 'node:test';
import assert from 'node:assert/strict';

import { createApprovalBoundBenchmarkRunner } from '../src/e2e/benchmark_runner.js';

const DIGESTS = Object.freeze({
  envelope: 'a'.repeat(64),
  head: 'b'.repeat(40),
  diff: 'c'.repeat(64),
  manifest: '9'.repeat(64),
  build: 'd'.repeat(64),
  workload: 'e'.repeat(64),
});
const TARGET = Object.freeze({
  targetId: 'target-1', sessionId: 'session-1', executionContextId: 7,
});

function provenance(overrides = {}) {
  return {
    envelope_sha256: DIGESTS.envelope,
    repository_head: DIGESTS.head,
    working_tree_diff_sha256: DIGESTS.diff,
    test_manifest_sha256: DIGESTS.manifest,
    build_sha256: DIGESTS.build,
    workload_sha256: DIGESTS.workload,
    target: { ...TARGET },
    ...overrides,
  };
}

function fixture(overrides = {}) {
  const rawArtifacts = [];
  const calls = [];
  const config = {
    approval: provenance(),
    sampleCount: 30,
    adapters: Object.freeze({
      read: Object.freeze({ read: async () => ({}) }),
      mutate: Object.freeze({ mutate: async () => ({}) }),
      pine: Object.freeze({ request: async () => ({}) }),
    }),
    operations: {
      async readProvenance() { return provenance(); },
      async executeSample({ phase, index, adapters }) {
        calls.push(['sample', phase, index, adapters]);
        return phase === 'before' ? 100 + index : 80 + index;
      },
      async restore() { calls.push(['restore']); return true; },
      async readLedger() {
        return { restorePassed: true, budgetPassed: true, unknownCount: 0, directActionCount: 0 };
      },
    },
    artifactSink: Object.freeze({
      async write(value) { rawArtifacts.push(value); return { artifactId: 'artifact-1' }; },
    }),
    ...overrides,
  };
  return { config, calls, rawArtifacts };
}

test('runs 30 paired samples with one provenance and returns only secret-safe aggregates', async () => {
  const { config, calls, rawArtifacts } = fixture();
  const summary = await createApprovalBoundBenchmarkRunner(config).run();

  assert.equal(summary.status, 'success');
  assert.equal(summary.code, 'BENCHMARK_OK');
  assert.equal(summary.sample_count, 30);
  assert.equal(summary.before.p50, 114.5);
  assert.equal(summary.before.p95, 127.55);
  assert.equal(summary.after.p50, 94.5);
  assert.equal(summary.paired_delta.p50, -20);
  assert.deepEqual(Object.keys(summary.paired_delta).sort(), ['bootstrap_ci95', 'p50', 'p95']);
  assert.deepEqual(summary.paired_delta.bootstrap_ci95, { lower: -20, upper: -20 });
  assert.equal(summary.artifact_id, 'artifact-1');
  assert.equal(JSON.stringify(summary).includes('samples'), false);
  assert.equal(rawArtifacts.length, 1);
  assert.deepEqual(Object.keys(rawArtifacts[0]).sort(), [
    'after_samples', 'before_samples', 'bindings', 'schema',
  ]);
  assert.deepEqual(Object.keys(rawArtifacts[0].bindings).sort(), [
    'build_sha256', 'envelope_sha256', 'repository_head', 'test_manifest_sha256',
    'working_tree_diff_sha256', 'workload_sha256',
  ]);
  assert.equal(rawArtifacts[0].before_samples.length, 30);
  assert.equal(rawArtifacts[0].after_samples.length, 30);
  assert.doesNotMatch(
    JSON.stringify(rawArtifacts[0]),
    /target-1|session-1|targetId|sessionId|executionContextId|https?:|RAW_/,
  );
  assert.equal(calls.filter(call => call[0] === 'sample').length, 60);
  assert.deepEqual(calls.at(-1), ['restore']);
});

test('rejects digest mismatch and target drift before the next action', async () => {
  for (const changed of [
    { build_sha256: 'f'.repeat(64) },
    { target: { ...TARGET, executionContextId: 8 } },
  ]) {
    let reads = 0;
    const { config, calls, rawArtifacts } = fixture();
    config.operations.readProvenance = async () => {
      reads += 1;
      return reads === 1 ? provenance() : provenance(changed);
    };
    const result = await createApprovalBoundBenchmarkRunner(config).run();
    assert.equal(result.status, 'failure');
    assert.equal(result.code, 'BENCHMARK_PROVENANCE_MISMATCH');
    assert.equal(calls.filter(call => call[0] === 'sample').length, 0);
    assert.equal(rawArtifacts.length, 0);
    assert.deepEqual(calls.at(-1), ['restore']);
  }
});

test('rejects provenance drift that occurs during the final action', async () => {
  let reads = 0;
  const { config, calls, rawArtifacts } = fixture();
  config.operations.readProvenance = async () => {
    reads += 1;
    return reads === 121
      ? provenance({ repository_head: 'f'.repeat(40) })
      : provenance();
  };

  const result = await createApprovalBoundBenchmarkRunner(config).run();
  assert.equal(result.code, 'BENCHMARK_PROVENANCE_MISMATCH');
  assert.equal(calls.filter(call => call[0] === 'sample').length, 60);
  assert.equal(rawArtifacts.length, 0);
  assert.deepEqual(calls.at(-1), ['restore']);
});

test('rejects fewer than 30 pairs without invoking an action', async () => {
  const { config, calls } = fixture({ sampleCount: 29 });
  assert.throws(
    () => createApprovalBoundBenchmarkRunner(config),
    error => error?.code === 'BENCHMARK_INVALID_CONFIGURATION',
  );
  assert.equal(calls.length, 0);
});

test('restore or ledger failure invalidates results and never writes raw artifacts', async () => {
  for (const [mutate, code] of [
    [config => { config.operations.restore = async () => false; }, 'BENCHMARK_RESTORE_FAILED'],
    [config => { config.operations.readLedger = async () => ({ restorePassed: true, budgetPassed: false, unknownCount: 0, directActionCount: 0 }); }, 'BENCHMARK_LEDGER_REJECTED'],
    [config => { config.operations.readLedger = async () => ({ restorePassed: true, budgetPassed: true, unknownCount: 1, directActionCount: 0 }); }, 'BENCHMARK_LEDGER_REJECTED'],
  ]) {
    const { config, rawArtifacts } = fixture();
    mutate(config);
    const result = await createApprovalBoundBenchmarkRunner(config).run();
    assert.equal(result.status, 'failure');
    assert.equal(result.code, code);
    assert.equal(rawArtifacts.length, 0);
  }
});

test('rejects unapproved action surfaces and never exposes raw errors or samples', async () => {
  for (const extra of [
    { fetch: async () => {} },
    { cri: async () => {} },
    { transport: {} },
  ]) {
    const { config } = fixture({ adapters: { ...fixture().config.adapters, ...extra } });
    assert.throws(
      () => createApprovalBoundBenchmarkRunner(config),
      error => error?.code === 'BENCHMARK_INVALID_CONFIGURATION',
    );
  }

  const secret = 'RAW_BENCHMARK_SECRET';
  const { config, rawArtifacts } = fixture();
  config.operations.executeSample = async () => { throw new Error(secret); };
  const result = await createApprovalBoundBenchmarkRunner(config).run();
  assert.equal(result.code, 'BENCHMARK_ACTION_FAILED');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  assert.equal(rawArtifacts.length, 0);
});
