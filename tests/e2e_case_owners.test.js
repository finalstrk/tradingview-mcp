import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createBatchCaseOwner } from '../src/e2e/cases/batch.js';
import { createPineFacadeCaseOwner } from '../src/e2e/cases/pine_facade.js';
import { createQuoteCaseOwner } from '../src/e2e/cases/quote.js';

test('batch owner retains the four-row restore and target invariants behind one fixed case', async () => {
  const targetId = 'a'.repeat(32);
  const targets = [{ id: targetId, type: 'page', url: 'https://www.tradingview.com/chart/example/' }];
  const initial = { api_available: true, symbol: 'FX:USDJPY', timeframe: '15', bar_count: 100 };
  let enabled = 0;
  let closed = 0;
  const client = { Runtime: { enable: async () => { enabled += 1; } }, close: async () => { closed += 1; } };
  const owner = createBatchCaseOwner({
    targetId,
    listTargets: async () => targets,
    connect: async id => { assert.equal(id, targetId); return client; },
    evaluate: async (_client, expression) => {
      assert.equal(_client, client);
      assert.match(expression, /TradingViewApi/);
      return initial;
    },
    batchRunImpl: async request => {
      assert.deepEqual(request.symbols, ['FX:USDJPY', 'FX:EURUSD']);
      assert.deepEqual(request.timeframes, ['5', '15']);
      assert.equal(request.action, 'get_ohlcv');
      assert.equal(request.ohlcv_count, 10);
      const results = request.symbols.flatMap(symbol => request.timeframes.map(timeframe => ({
        requested: { symbol, timeframe }, observed: { symbol, timeframe, bar_count: 10 }, oracle_verified: true,
      })));
      return {
        success: true, failed: 0, results,
        restoration: { required: true, attempted: true, success: true, requested: { symbol: initial.symbol, timeframe: initial.timeframe } },
      };
    },
  });
  assert.deepEqual(await owner.run('batch_1'), { status: 'success', code: 'CASE_OK' });
  assert.equal(enabled, 1);
  assert.equal(closed, 1);
  assert.deepEqual(await owner.run('attacker-controlled'), { status: 'failure', code: 'CASE_FAILED' });
});

test('quote owners preserve both 20-iteration contracts and expose only fixed outcomes', async () => {
  const chart = { symbol: 'FX:USDJPY', resolution: '15', chart_type: 1, layout: 's', active_index: 0, panes: [] };
  const state = { chart, bar: { time: 123, close: 150.5 } };
  let mismatchCalls = 0;
  let matchingCalls = 0;
  let disconnects = 0;
  const owner = createQuoteCaseOwner({
    snapshot: async () => structuredClone(state),
    getQuoteImpl: async ({ symbol }) => {
      if (symbol.startsWith('P1_03_NEVER_MATCH_')) {
        mismatchCalls += 1;
        throw Object.assign(new Error('mismatch'), {
          code: 'QUOTE_SYMBOL_MISMATCH', requested_symbol: symbol, observed_symbol: chart.symbol,
        });
      }
      matchingCalls += 1;
      return { success: true, symbol, time: state.bar.time, close: state.bar.close };
    },
    disconnectImpl: async () => { disconnects += 1; },
  });
  assert.deepEqual(await owner.run('quote_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(await owner.run('quote_2'), { status: 'success', code: 'CASE_OK' });
  assert.equal(mismatchCalls, 20);
  assert.equal(matchingCalls, 20);
  assert.equal(disconnects, 2);
});

test('Pine Facade owner fixes all sources, URL and method inside coordinator ownership', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const source = options.body.get('source');
    if (source.includes('this_function_does_not_exist')) {
      return { ok: true, status: 200, json: async () => ({ result: { errors2: [{ message: 'this_function_does_not_exist' }] } }) };
    }
    if (source === '') return { ok: false, status: 400, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ result: {} }) };
  };
  const cliInputs = [];
  const owner = createPineFacadeCaseOwner({
    fetchImpl,
    runCli: source => {
      cliInputs.push(source);
      return source.includes('nonexistent_var')
        ? { stdout: JSON.stringify({ compiled: false, error_count: 1 }), exitCode: 0 }
        : { stdout: JSON.stringify({ success: true, compiled: true }), exitCode: 0 };
    },
  });
  for (const caseId of ['pine_facade_1', 'pine_facade_2', 'pine_facade_3', 'pine_facade_4', 'pine_facade_5']) {
    assert.deepEqual(await owner.run(caseId), { status: 'success', code: 'CASE_OK' });
  }
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url, 'https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000');
    assert.equal(request.options.method, 'POST');
  }
  assert.equal(cliInputs.length, 2);
});

test('migrated live children contain only fixed case IDs and no external action parameters', async () => {
  for (const file of ['batch_e2e.test.js', 'quote_e2e.test.js', 'pine_facade_e2e.test.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|node:child_process|Runtime\.evaluate/);
    assert.doesNotMatch(source, /source\s*:|target(?:Id|_id)\s*:|method\s*:|https?:\/\//);
    assert.match(source, /\.dispatch\(['"][a-z0-9_]+['"]\)/);
  }
});
