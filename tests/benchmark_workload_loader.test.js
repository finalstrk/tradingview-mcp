import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { compileRestrictedBenchmarkExecutor, compileRestrictedBenchmarkWorkload } from '../src/e2e/benchmark_workload_loader.js';

test('loads the two fixed import-free workload modules in isolated contexts', async () => {
  for (const name of ['baseline_workload.js', 'candidate_workload.js']) {
    const bytes = await readFile(new URL(`../src/e2e/benchmark/${name}`, import.meta.url));
    const execute = compileRestrictedBenchmarkWorkload(bytes, name);
    const calls = [];
    const capability = name.startsWith('baseline')
      ? Object.freeze({ async measureReadyStateLengthLegacy() { calls.push(name); return 7; } })
      : Object.freeze({ async measureReadyStateLengthCandidate() { calls.push(name); return 7; } });
    const result = await execute(capability);
    assert.equal(result, 7);
    assert.deepEqual(calls, [name]);
  }
});

test('loads independent baseline and candidate executor artifacts with distinct lifecycle structure', async () => {
  const baselineBytes = await readFile(new URL('../src/e2e/benchmark/baseline_executor.js', import.meta.url));
  const candidateBytes = await readFile(new URL('../src/e2e/benchmark/candidate_executor.js', import.meta.url));
  assert.notDeepEqual(baselineBytes, candidateBytes);
  const baseline = compileRestrictedBenchmarkExecutor(baselineBytes, 'baseline');
  const createCandidate = compileRestrictedBenchmarkExecutor(candidateBytes, 'candidate');
  const baselineCalls = [];
  const connection = {};
  const session = {};
  const baselineValue = await baseline(Object.freeze({
    async connect() { baselineCalls.push('connect'); return connection; },
    async attach(actual) { assert.equal(actual, connection); baselineCalls.push('attach'); return session; },
    async enable(actual) { assert.equal(actual, session); baselineCalls.push('enable'); },
    async verify(actual) { assert.equal(actual, session); baselineCalls.push('verify'); },
    async evaluateReadyStateLength(actual) { assert.equal(actual, session); baselineCalls.push('evaluate'); return { objectId: 'remote-1', value: 7 }; },
    async release(actual, objectId) { assert.equal(actual, session); assert.equal(objectId, 'remote-1'); baselineCalls.push('release'); },
    async detach(actualConnection, actualSession) { assert.equal(actualConnection, connection); assert.equal(actualSession, session); baselineCalls.push('detach'); },
    async close(actual) { assert.equal(actual, connection); baselineCalls.push('close'); },
  }));
  assert.equal(baselineValue, 7);
  assert.deepEqual(baselineCalls, ['connect', 'attach', 'enable', 'verify', 'evaluate', 'release', 'verify', 'detach', 'close']);

  const candidateCalls = [];
  const candidate = createCandidate(Object.freeze({
    async open() { candidateCalls.push('open'); },
    async verify() { candidateCalls.push('verify'); },
    async evaluateReadyStateLength() { candidateCalls.push('evaluate'); return { objectId: 'remote-2', value: 7 }; },
    async release(objectId) { assert.equal(objectId, 'remote-2'); candidateCalls.push('release'); },
    async close() { candidateCalls.push('close'); },
  }), 30);
  for (let index = 0; index < 30; index += 1) assert.equal(await candidate.execute(index), 7);
  assert.equal(candidateCalls.filter(call => call === 'open').length, 1);
  assert.equal(candidateCalls.filter(call => call === 'close').length, 1);
  assert.equal(candidateCalls.filter(call => call === 'verify').length, 60);
});

test('rejects imports, IO globals, code generation and interface drift', () => {
  for (const source of [
    "import 'node:fs';\n",
    "export const workloadId = 'tradingview-ready-state-length-v1';\n\nexport async function execute(capability) { return process.env.SECRET; }\n",
    "export const workloadId = 'wrong';\n\nexport async function execute(capability) { return 1; }\n",
    "export const workloadId = 'tradingview-ready-state-length-v1';\n\nexport async function execute(capability) { return Function('return 1')(); }\n",
  ]) assert.throws(() => compileRestrictedBenchmarkWorkload(Buffer.from(source)), /PRODUCTION_RUNTIME_BENCHMARK_MODULE_DENIED/);
  assert.throws(() => compileRestrictedBenchmarkExecutor(Buffer.from("import 'node:fs';\n"), 'baseline'), /PRODUCTION_RUNTIME_BENCHMARK_EXECUTOR_DENIED/);
});
