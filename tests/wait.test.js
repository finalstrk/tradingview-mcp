import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ChartReadinessAbortError,
  ChartReadinessTimeoutError,
  chartStateMatches,
  normalizeChartSymbol,
  normalizeChartTimeframe,
  readChartState,
  waitForChartReady,
} from '../src/wait.js';

function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async milliseconds => { current += milliseconds; },
  };
}

function state(symbol, timeframe, barCount = 20) {
  return {
    api_available: true,
    symbol,
    timeframe,
    bar_count: barCount,
    bars_fingerprint: `${symbol}/${timeframe}/${barCount}`,
  };
}

test('normalizes authoritative symbol and timeframe values without accepting empties', () => {
  assert.equal(normalizeChartSymbol(' fx:eurusd '), 'FX:EURUSD');
  assert.equal(normalizeChartTimeframe(' d '), '1D');
  assert.equal(normalizeChartTimeframe('15'), '15');
  assert.equal(chartStateMatches(state('FX:EURUSD', '15'), 'fx:eurusd', '15'), true);
  assert.equal(chartStateMatches(state('', '15'), 'FX:EURUSD', '15'), false);
  assert.equal(chartStateMatches(state('FX:EURUSD', ''), 'FX:EURUSD', '15'), false);
  assert.equal(chartStateMatches(state('FX:EURUSD', '5'), 'FX:EURUSD', '15'), false);
});

test('a delayed-data (_DL) exchange variant of the requested symbol is authoritative', () => {
  assert.equal(chartStateMatches(state('CME_MINI_DL:ES1!', '5'), 'CME_MINI:ES1!', '5'), true);
  assert.equal(chartStateMatches(state('cme_mini_dl:es1!', '5'), 'CME_MINI:ES1!', '5'), true);
  // Direction matters: a real-time observation never satisfies a _DL request.
  assert.equal(chartStateMatches(state('CME_MINI:ES1!', '5'), 'CME_MINI_DL:ES1!', '5'), false);
  // Different exchange or ticker is still a mismatch.
  assert.equal(chartStateMatches(state('CBOT_DL:ES1!', '5'), 'CME_MINI:ES1!', '5'), false);
  assert.equal(chartStateMatches(state('CME_MINI_DL:NQ1!', '5'), 'CME_MINI:ES1!', '5'), false);
  // Symbols without an exchange prefix never match a prefixed variant.
  assert.equal(chartStateMatches(state('CME_MINI_DL:ES1!', '5'), 'ES1!', '5'), false);
});

test('waitForChartReady accepts a stable _DL redirect of the requested symbol', async () => {
  const redirected = state('CME_MINI_DL:ES1!', '15', 200);
  const clock = fakeClock();
  let calls = 0;

  const observed = await waitForChartReady('CME_MINI:ES1!', '15', 100, {
    evaluate: async () => { calls += 1; return redirected; },
    now: clock.now,
    sleep: clock.sleep,
    pollIntervalMs: 5,
    stableChecks: 2,
  });

  assert.equal(calls, 2);
  assert.equal(observed.symbol, 'CME_MINI_DL:ES1!');
});

test('readChartState uses only the authoritative chart API, not DOM heuristics', async () => {
  let expression;
  const observed = await readChartState({
    evaluate: async source => {
      expression = source;
      return state('FX:USDJPY', '5', 300);
    },
  });

  assert.equal(observed.symbol, 'FX:USDJPY');
  assert.match(expression, /TradingViewApi/);
  assert.doesNotMatch(expression, /document\.querySelector/);
  assert.doesNotMatch(expression, /querySelectorAll/);
});

test('waitForChartReady succeeds only after exact symbol and timeframe are both stable', async () => {
  const states = [
    { api_available: false, symbol: '', timeframe: '', bar_count: 0 },
    state('FX:EURUSD', '5'),
    state('', '15'),
    state('FX:EURUSD', '15', 0),
    state('FX:EURUSD', '15', 200),
    state('FX:EURUSD', '15', 200),
  ];
  const clock = fakeClock();
  let calls = 0;

  const observed = await waitForChartReady('FX:EURUSD', '15', 100, {
    evaluate: async () => states[Math.min(calls++, states.length - 1)],
    now: clock.now,
    sleep: clock.sleep,
    pollIntervalMs: 5,
    stableChecks: 2,
  });

  assert.equal(calls, 6);
  assert.equal(observed.symbol, 'FX:EURUSD');
  assert.equal(observed.timeframe, '15');
  assert.equal(observed.bar_count, 200);
});

test('a mutated chart requires a changed and stable bars fingerprint', async () => {
  const oldBars = { ...state('FX:EURUSD', '15', 200), bars_fingerprint: 'old-bars' };
  const newBars = { ...state('FX:EURUSD', '15', 200), bars_fingerprint: 'new-bars' };
  const states = [oldBars, oldBars, newBars, newBars];
  const clock = fakeClock();
  let calls = 0;

  const observed = await waitForChartReady('FX:EURUSD', '15', 100, {
    evaluate: async () => states[Math.min(calls++, states.length - 1)],
    now: clock.now,
    sleep: clock.sleep,
    pollIntervalMs: 5,
    stableChecks: 2,
    baselineFingerprint: 'old-bars',
    requireFingerprintChange: true,
  });

  assert.equal(calls, 4, 'old identity with old bars must not satisfy readiness');
  assert.equal(observed.bars_fingerprint, 'new-bars');

  let sameStateCalls = 0;
  const sameState = await waitForChartReady('FX:EURUSD', '15', 100, {
    evaluate: async () => { sameStateCalls += 1; return oldBars; },
    now: clock.now,
    sleep: clock.sleep,
    pollIntervalMs: 5,
    stableChecks: 2,
    baselineFingerprint: 'old-bars',
    requireFingerprintChange: false,
  });
  assert.equal(sameStateCalls, 2, 'a true no-mutation path may accept a stable unchanged fingerprint');
  assert.equal(sameState.bars_fingerprint, 'old-bars');
});

test('unknown or mismatched observed state times out with requested and observed details', async () => {
  const clock = fakeClock();
  await assert.rejects(
    waitForChartReady('FX:EURUSD', '15', 20, {
      evaluate: async () => state('FX:EURUSD', '', 200),
      now: clock.now,
      sleep: clock.sleep,
      pollIntervalMs: 5,
      stableChecks: 1,
    }),
    error => {
      assert.ok(error instanceof ChartReadinessTimeoutError);
      assert.equal(error.code, 'CHART_READINESS_TIMEOUT');
      assert.deepEqual(error.requested, { symbol: 'FX:EURUSD', timeframe: '15' });
      assert.equal(error.observed.timeframe, '');
      return true;
    },
  );
});

test('abort is typed and stops further readiness polling', async () => {
  const controller = new AbortController();
  controller.abort(new Error('caller cancelled'));
  let polls = 0;

  await assert.rejects(
    waitForChartReady('FX:GBPUSD', '5', 100, {
      signal: controller.signal,
      evaluate: async () => { polls += 1; return state('FX:GBPUSD', '5'); },
    }),
    error => {
      assert.ok(error instanceof ChartReadinessAbortError);
      assert.equal(error.code, 'CHART_READINESS_ABORTED');
      return true;
    },
  );
  assert.equal(polls, 0);
});
