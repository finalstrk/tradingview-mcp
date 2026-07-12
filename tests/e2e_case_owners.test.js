import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBatchCaseOwner } from '../src/e2e/cases/batch.js';
import { createPineFacadeCaseOwner } from '../src/e2e/cases/pine_facade.js';
import { createQuoteCaseOwner } from '../src/e2e/cases/quote.js';

const bridge = (reports, calls = []) => Object.freeze({ execute: async id => { calls.push(id); return structuredClone(reports[id]); } });

test('batch owner retains four-row restore assertions through one fixed operation', async () => {
  const initial = { api_available: true, symbol: 'FX:USDJPY', timeframe: '15', bar_count: 100 };
  const rows = ['FX:USDJPY', 'FX:EURUSD'].flatMap(symbol => ['5', '15'].map(timeframe => ({ requested: { symbol, timeframe }, observed: { symbol, timeframe, bar_count: 10 }, oracle_verified: true })));
  const calls = [];
  const owner = createBatchCaseOwner({ operationBridge: bridge({ 'owner.batch.1': {
    initial, restored: initial, before_chart_ids: ['fixed'], after_chart_ids: ['fixed'], target_preserved: true,
    result: { success: true, failed: 0, results: rows, restoration: { required: true, attempted: true, success: true, requested: { symbol: initial.symbol, timeframe: initial.timeframe } } },
  } }, calls) });
  assert.deepEqual(await owner.run('batch_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(calls, ['owner.batch.1']);
  assert.deepEqual(await owner.run('attacker-controlled'), { status: 'failure', code: 'CASE_FAILED' });
});

test('quote owners preserve both 20-iteration contracts using fixed IDs only', async () => {
  const calls = [];
  const report = { iterations: 20, mismatches: 0, chart_mutations: 0, disconnects: 1, price_fields_leaked: 0 };
  const owner = createQuoteCaseOwner({ operationBridge: bridge({ 'owner.quote.1': report, 'owner.quote.2': report }, calls) });
  assert.deepEqual(await owner.run('quote_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(await owner.run('quote_2'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(calls, ['owner.quote.1', 'owner.quote.2']);
});

test('Pine Facade owner fixes network and child operations in the reviewed registry', async () => {
  const calls = [];
  const owner = createPineFacadeCaseOwner({ operationBridge: bridge({
    'owner.pine_facade.1': { accepted: true },
    'owner.pine_facade.2': { error_count: 1, unknown_function_reported: true },
    'owner.pine_facade.3': { status: 400 },
    'owner.pine_facade.4': { exit_code: 0, success: true, compiled: true },
    'owner.pine_facade.5': { exit_code: 0, compiled: false, error_count: 1 },
  }, calls) });
  for (const id of ['pine_facade_1', 'pine_facade_2', 'pine_facade_3', 'pine_facade_4', 'pine_facade_5']) assert.deepEqual(await owner.run(id), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(calls, [1, 2, 3, 4, 5].map(number => `owner.pine_facade.${number}`));
});

test('migrated owners and children expose no raw CDP, fetch or process capability', async () => {
  for (const file of ['../src/e2e/cases/batch.js', '../src/e2e/cases/quote.js', '../src/e2e/cases/pine_facade.js', 'batch_e2e.test.js', 'quote_e2e.test.js', 'pine_facade_e2e.test.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|node:child_process|Runtime\.evaluate|execFile|spawn\s*\(/);
  }
});
