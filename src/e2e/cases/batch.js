import assert from 'node:assert/strict';
import CDP from 'chrome-remote-interface';

import { batchRun } from '../../core/batch.js';
import { runFixedCase } from './fixed_result.js';

export const BATCH_CASE_IDS = Object.freeze(['batch_1']);

const HOST = 'localhost';
const PORT = 9222;
const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';
const CHART_COLLECTION = 'window.TradingViewApi._chartWidgetCollection';

async function defaultEvaluate(client, expression, { awaitPromise = false, timeoutMs = 15_000 } = {}) {
  let timer;
  try {
    const response = await Promise.race([
      client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('BATCH_CASE_DEADLINE_EXCEEDED')), timeoutMs);
      }),
    ]);
    if (response.exceptionDetails) throw new Error('BATCH_CASE_EVALUATION_FAILED');
    return response.result?.value;
  } finally {
    clearTimeout(timer);
  }
}

async function readState(evaluate, client) {
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

async function restore(evaluate, client, initial, sleep) {
  await evaluate(client, `(() => {
    const chart = ${CHART_API};
    chart.setSymbol(${JSON.stringify(initial.symbol)});
    chart.setResolution(${JSON.stringify(initial.timeframe)});
    return true;
  })()`);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const observed = await readState(evaluate, client);
    if (observed.symbol === initial.symbol && observed.timeframe === initial.timeframe && observed.bar_count > 0) {
      return observed;
    }
    await sleep(100);
  }
  throw new Error('BATCH_CASE_RESTORE_FAILED');
}

export function createBatchCaseOwner({
  targetId,
  listTargets = () => CDP.List({ host: HOST, port: PORT }),
  connect = id => CDP({ host: HOST, port: PORT, target: id }),
  evaluate = defaultEvaluate,
  batchRunImpl = batchRun,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  return Object.freeze({
    async run(caseId) {
      if (caseId !== 'batch_1' || typeof targetId !== 'string' || targetId.length === 0) {
        return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      }
      return runFixedCase(async () => {
        const beforeTargets = await listTargets();
        const selected = beforeTargets.find(target => target.id === targetId);
        assert.ok(selected, 'explicit target must already exist');
        assert.equal(selected.type, 'page');

        let client;
        let initial;
        let restored;
        let sutRestored = false;
        try {
          client = await connect(targetId);
          await client.Runtime.enable();
          initial = await readState(evaluate, client);
          assert.equal(initial.api_available, true);
          assert.ok(initial.bar_count > 0);
          const result = await batchRunImpl({
            symbols: ['FX:USDJPY', 'FX:EURUSD'],
            timeframes: ['5', '15'],
            action: 'get_ohlcv',
            delay_ms: 0,
            ohlcv_count: 10,
            _deps: {
              evaluate: (expression, options) => evaluate(client, expression, options),
              evaluateAsync: (expression, options) => evaluate(client, expression, { ...options, awaitPromise: true }),
              getClient: async () => client,
              getChartApi: async () => CHART_API,
              getChartCollection: async () => CHART_COLLECTION,
            },
          });
          assert.equal(result.success, true);
          assert.equal(result.failed, 0);
          assert.equal(result.results.length, 4);
          assert.equal(result.restoration.required, true);
          assert.equal(result.restoration.attempted, true);
          assert.equal(result.restoration.success, true);
          assert.deepEqual(result.restoration.requested, {
            symbol: initial.symbol,
            timeframe: initial.timeframe,
          });
          for (const row of result.results) {
            assert.equal(row.requested.symbol, row.observed.symbol);
            assert.equal(row.requested.timeframe, row.observed.timeframe);
            assert.ok(row.observed.bar_count > 0);
            assert.equal(row.oracle_verified, true);
          }
          restored = await readState(evaluate, client);
          assert.deepEqual(
            { symbol: restored.symbol, timeframe: restored.timeframe },
            { symbol: initial.symbol, timeframe: initial.timeframe },
          );
          assert.ok(restored.bar_count > 0);
          sutRestored = true;
        } finally {
          if (client && initial && !sutRestored) restored = await restore(evaluate, client, initial, sleep);
          await client?.close().catch(() => {});
        }
        assert.deepEqual(
          { symbol: restored.symbol, timeframe: restored.timeframe },
          { symbol: initial.symbol, timeframe: initial.timeframe },
        );
        const afterTargets = await listTargets();
        const chartIds = targets => targets
          .filter(target => target.type === 'page' && /^https:\/\/[^/]*tradingview\.com\/chart\//.test(target.url))
          .map(target => target.id)
          .sort();
        assert.deepEqual(chartIds(afterTargets), chartIds(beforeTargets));
        assert.ok(afterTargets.some(target => target.id === targetId));
      });
    },
  });
}
