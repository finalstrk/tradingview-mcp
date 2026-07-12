import test from 'node:test';
import assert from 'node:assert/strict';
import CDP from 'chrome-remote-interface';

import { batchRun } from '../src/core/batch.js';

const TARGET_ID = process.env.TV_BATCH_E2E_TARGET_ID || '';
const HOST = 'localhost';
const PORT = 9222;
const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';
const CHART_COLLECTION = 'window.TradingViewApi._chartWidgetCollection';

async function evaluate(client, expression, { awaitPromise = false, timeoutMs = 15000 } = {}) {
  let timer;
  try {
    const response = await Promise.race([
      client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Runtime.evaluate exceeded ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  } finally {
    clearTimeout(timer);
  }
}

async function state(client) {
  return evaluate(client, `(() => {
    const chart = window.TradingViewApi?._activeChartWidgetWV?.value?.();
    const bars = chart?._chartWidget?.model?.()?.mainSeries?.()?.bars?.();
    return {
      api_available: Boolean(chart),
      symbol: String(chart?.symbol?.() ?? ''),
      timeframe: String(chart?.resolution?.() ?? ''),
      bar_count: Number(bars?.size?.() ?? 0),
    };
  })()`);
}

async function restore(client, initial) {
  await evaluate(client, `(() => {
    const chart = ${CHART_API};
    chart.setSymbol(${JSON.stringify(initial.symbol)});
    chart.setResolution(${JSON.stringify(initial.timeframe)});
    return true;
  })()`);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const observed = await state(client);
    if (observed.symbol === initial.symbol
      && observed.timeframe === initial.timeframe
      && observed.bar_count > 0) return observed;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('failed to restore explicitly selected chart target');
}

test('batch live state machine is exact and restores the explicitly selected existing target', {
  skip: TARGET_ID ? false : 'set TV_BATCH_E2E_TARGET_ID to a pre-probed healthy existing chart target',
  timeout: 120000,
}, async () => {
  const beforeTargets = await CDP.List({ host: HOST, port: PORT });
  const selected = beforeTargets.find(target => target.id === TARGET_ID);
  assert.ok(selected, 'explicit target must already exist');
  assert.equal(selected.type, 'page');

  let client;
  let initial;
  let restored;
  let sutRestored = false;
  try {
    client = await CDP({ host: HOST, port: PORT, target: TARGET_ID });
    await client.Runtime.enable();
    initial = await state(client);
    assert.equal(initial.api_available, true);
    assert.ok(initial.bar_count > 0, 'explicit target must be healthy before mutation');

    const dependencies = {
      evaluate: (expression, options) => evaluate(client, expression, options),
      evaluateAsync: (expression, options) => evaluate(client, expression, { ...options, awaitPromise: true }),
      getClient: async () => client,
      getChartApi: async () => CHART_API,
      getChartCollection: async () => CHART_COLLECTION,
    };
    const result = await batchRun({
      symbols: ['FX:USDJPY', 'FX:EURUSD'],
      timeframes: ['5', '15'],
      action: 'get_ohlcv',
      delay_ms: 0,
      ohlcv_count: 10,
      _deps: dependencies,
    });
    assert.equal(result.success, true);
    assert.equal(result.failed, 0);
    assert.equal(result.results.length, 4);
    assert.equal(result.restoration.required, true);
    assert.equal(result.restoration.attempted, true);
    assert.equal(result.restoration.success, true);
    for (const row of result.results) {
      assert.equal(row.requested.symbol, row.observed.symbol);
      assert.equal(row.requested.timeframe, row.observed.timeframe);
      assert.ok(row.observed.bar_count > 0);
      assert.equal(row.oracle_verified, true);
    }
    // Assert the SUT's own cleanup before the outer safety-net finally can help.
    restored = await state(client);
    assert.deepEqual(
      { symbol: restored.symbol, timeframe: restored.timeframe },
      { symbol: initial.symbol, timeframe: initial.timeframe },
    );
    assert.ok(restored.bar_count > 0);
    assert.deepEqual(result.restoration.requested, {
      symbol: initial.symbol,
      timeframe: initial.timeframe,
    });
    sutRestored = true;
  } finally {
    if (client && initial && !sutRestored) restored = await restore(client, initial);
    // This detaches the debugger session only; it does not close the target/tab.
    await client?.close().catch(() => {});
  }

  assert.deepEqual(
    { symbol: restored.symbol, timeframe: restored.timeframe },
    { symbol: initial.symbol, timeframe: initial.timeframe },
  );
  const afterTargets = await CDP.List({ host: HOST, port: PORT });
  const chartIds = targets => targets
    .filter(target => target.type === 'page' && /^https:\/\/[^/]*tradingview\.com\/chart\//.test(target.url))
    .map(target => target.id)
    .sort();
  assert.deepEqual(chartIds(afterTargets), chartIds(beforeTargets));
  assert.ok(afterTargets.some(target => target.id === TARGET_ID));
});
