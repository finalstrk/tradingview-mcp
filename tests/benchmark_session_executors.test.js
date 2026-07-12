import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { compileRestrictedBenchmarkExecutor } from '../src/e2e/benchmark_workload_loader.js';

async function artifacts() {
  const baselineBytes = await readFile(new URL('../src/e2e/benchmark/baseline_executor.js', import.meta.url));
  const candidateBytes = await readFile(new URL('../src/e2e/benchmark/candidate_executor.js', import.meta.url));
  return {
    baseline: compileRestrictedBenchmarkExecutor(baselineBytes, 'baseline'),
    createCandidate: compileRestrictedBenchmarkExecutor(candidateBytes, 'candidate'),
  };
}

test('approved baseline and current candidate executors show numeric session-reuse improvement', async () => {
  const { baseline, createCandidate } = await artifacts();
  let clock = 0;
  const counts = { baselineAttach: 0, baselineDetach: 0, baselineVerify: 0, candidateAttach: 0, candidateDetach: 0, candidateVerify: 0 };
  const baselineCapability = Object.freeze({
    async connect() { clock += 5; return {}; },
    async attach(connection) { assert.ok(connection); counts.baselineAttach += 1; return {}; },
    async enable() {},
    async verify() { counts.baselineVerify += 1; clock += 1; },
    async evaluateReadyStateLength() { clock += 2; return { objectId: 'baseline-object', value: 7 }; },
    async release() {},
    async detach() { counts.baselineDetach += 1; clock += 5; },
    async close() {},
  });
  const candidate = createCandidate(Object.freeze({
    async open() { counts.candidateAttach += 1; clock += 5; },
    async verify() { counts.candidateVerify += 1; clock += 1; },
    async evaluateReadyStateLength() { clock += 2; return { objectId: 'candidate-object', value: 7 }; },
    async release() {},
    async close() { counts.candidateDetach += 1; clock += 5; },
  }), 30);
  const before = [];
  const after = [];
  for (let index = 0; index < 30; index += 1) {
    let started = clock;
    assert.equal(await baseline(baselineCapability), 7);
    before.push(clock - started);
    started = clock;
    assert.equal(await candidate.execute(index), 7);
    after.push(clock - started);
  }
  await candidate.restore();
  assert.ok(after.reduce((sum, value) => sum + value, 0) < before.reduce((sum, value) => sum + value, 0));
  assert.deepEqual(counts, {
    baselineAttach: 30, baselineDetach: 30, baselineVerify: 60,
    candidateAttach: 1, candidateDetach: 1, candidateVerify: 60,
  });
});

test('candidate failure closes its owner session and both artifacts reject incomplete capabilities', async () => {
  const { baseline, createCandidate } = await artifacts();
  await assert.rejects(baseline(Object.freeze({})), /BASELINE_EXECUTOR_CAPABILITY_INVALID/);
  assert.throws(() => createCandidate(Object.freeze({})), /CANDIDATE_EXECUTOR_CAPABILITY_INVALID/);
  let closed = 0;
  const candidate = createCandidate(Object.freeze({
    async open() {}, async verify() {},
    async evaluateReadyStateLength() { throw new Error('SECRET'); },
    async release() {}, async close() { closed += 1; },
  }), 30);
  await assert.rejects(candidate.execute(0), /SECRET/);
  assert.equal(closed, 1);
});
