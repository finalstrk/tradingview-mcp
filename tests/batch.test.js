import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { BatchError, batchRun } from '../src/core/batch.js';
import { registerBatchTools } from '../src/tools/batch.js';

function chartState(symbol, timeframe, barCount = 100) {
  return {
    api_available: true,
    symbol,
    timeframe,
    bar_count: barCount,
    bars_fingerprint: `${symbol}/${timeframe}/${barCount}`,
  };
}

function createDependencies(overrides = {}) {
  const state = chartState('FX:INITIAL', '1D');
  const calls = {
    symbols: [],
    restorationSymbols: [],
    symbolSignals: [],
    timeframes: [],
    restorationTimeframes: [],
    timeframeSignals: [],
    readiness: [],
    actions: [],
    sleeps: [],
  };
  let now = 0;
  const refreshBars = () => {
    state.bars_fingerprint = `${state.symbol}/${state.timeframe}/${state.bar_count}`;
  };
  const dependencies = {
    getChartApi: async () => 'window.__chart',
    getChartCollection: async () => 'window.__collection',
    setSymbol: async (symbol, context = {}) => {
      (context.phase === 'restoration' ? calls.restorationSymbols : calls.symbols).push(symbol);
      calls.symbolSignals.push(context.signal);
      state.symbol = symbol;
      refreshBars();
    },
    setTimeframe: async (timeframe, context = {}) => {
      (context.phase === 'restoration' ? calls.restorationTimeframes : calls.timeframes).push(timeframe);
      calls.timeframeSignals.push(context.signal);
      state.timeframe = timeframe;
      refreshBars();
    },
    waitForChartReady: async (symbol, timeframe, _timeout, options = {}) => {
      calls.readiness.push({ symbol, timeframe, options });
      return { ...state };
    },
    readChartState: async () => ({ ...state }),
    executeAction: async context => {
      calls.actions.push({ symbol: context.symbol, timeframe: context.timeframe, action: context.action });
      return { success: true, value: `${context.symbol}/${context.timeframe}` };
    },
    sleep: async (milliseconds, signal) => calls.sleeps.push({ milliseconds, signal }),
    now: () => now++,
    ...overrides,
  };
  return { dependencies, calls, state };
}

const defaultRequest = {
  symbols: ['FX:USDJPY', 'FX:EURUSD'],
  timeframes: ['5', '15'],
  action: 'get_ohlcv',
  delay_ms: 0,
  ohlcv_count: 10,
};

test('BatchError carries a stable code for row-level serialization', () => {
  const error = new BatchError('BATCH_TEST', 'test error');
  assert.equal(error.code, 'BATCH_TEST');
  assert.equal(error.message, 'test error');
});

test('blank or empty requested identities fail before chart API discovery or mutation', async t => {
  const cases = [
    ['mixed blank symbol', { symbols: ['FX:USDJPY', '   '], timeframes: ['5'] }],
    ['empty symbols', { symbols: [], timeframes: ['5'] }],
    ['blank symbol', { symbols: ['\t'], timeframes: ['5'] }],
    ['mixed blank timeframe', { symbols: ['FX:USDJPY'], timeframes: ['5', '  '] }],
    ['empty timeframes', { symbols: ['FX:USDJPY'], timeframes: [] }],
    ['null timeframes', { symbols: ['FX:USDJPY'], timeframes: null }],
  ];

  for (const [name, input] of cases) {
    await t.test(name, async () => {
      let apiCalls = 0;
      const fixture = createDependencies({
        getChartApi: async () => { apiCalls += 1; return 'window.__chart'; },
        getChartCollection: async () => { apiCalls += 1; return 'window.__collection'; },
      });

      const result = await batchRun({
        ...defaultRequest,
        ...input,
        _deps: fixture.dependencies,
      });

      assert.equal(result.success, false);
      assert.equal(result.error?.code, 'BATCH_INVALID_INPUT');
      assert.ok(result.results.every(row => row.error.code === 'BATCH_INVALID_INPUT'));
      assert.equal(apiCalls, 0);
      assert.deepEqual(fixture.calls.symbols, []);
      assert.deepEqual(fixture.calls.timeframes, []);
      assert.deepEqual(fixture.calls.readiness, []);
      assert.deepEqual(fixture.calls.actions, []);
      assert.equal(result.restoration.reason, 'mutation_not_started');
    });
  }
});

test('omitted timeframes freeze the initial authoritative timeframe', async () => {
  const fixture = createDependencies();

  const result = await batchRun({
    symbols: ['FX:INITIAL'],
    action: 'get_ohlcv',
    delay_ms: 0,
    _deps: fixture.dependencies,
  });

  assert.equal(result.success, true);
  assert.equal(result.results[0].timeframe, '1D');
  assert.deepEqual(result.results[0].requested, { symbol: 'FX:INITIAL', timeframe: '1D' });
  assert.deepEqual(fixture.calls.symbols, []);
  assert.deepEqual(fixture.calls.timeframes, []);
  assert.equal(fixture.calls.actions.length, 1);
  assert.equal(result.restoration.reason, 'mutation_not_started');
});

test('batch MCP schema rejects empty and blank identity arrays with safeParse', async t => {
  let registeredSchema;
  const server = {
    tool: (_name, _description, schema) => { registeredSchema = schema; },
  };
  registerBatchTools(server, { batchRun: async () => ({ success: true }) });
  const schema = z.object(registeredSchema);
  const base = { symbols: ['FX:A'], action: 'get_ohlcv' };

  await t.test('symbols requires at least one item', () => {
    assert.equal(schema.safeParse({ ...base, symbols: [] }).success, false);
  });
  await t.test('each symbol must be nonblank after trim', () => {
    assert.equal(schema.safeParse({ ...base, symbols: ['   '] }).success, false);
  });
  await t.test('provided timeframes requires at least one nonblank item', () => {
    assert.equal(schema.safeParse({ ...base, timeframes: [] }).success, false);
    assert.equal(schema.safeParse({ ...base, timeframes: ['\t'] }).success, false);
  });
  assert.equal(schema.safeParse(base).success, true, 'omitted timeframes remains valid');
});

test('runs deterministically and sets each symbol once for its timeframe group', async () => {
  const { dependencies, calls } = createDependencies();
  const result = await batchRun({ ...defaultRequest, _deps: dependencies });

  assert.deepEqual(calls.symbols, ['FX:USDJPY', 'FX:EURUSD']);
  assert.deepEqual(calls.timeframes, ['5', '15', '5', '15']);
  assert.deepEqual(calls.actions, [
    { symbol: 'FX:USDJPY', timeframe: '5', action: 'get_ohlcv' },
    { symbol: 'FX:USDJPY', timeframe: '15', action: 'get_ohlcv' },
    { symbol: 'FX:EURUSD', timeframe: '5', action: 'get_ohlcv' },
    { symbol: 'FX:EURUSD', timeframe: '15', action: 'get_ohlcv' },
  ]);
  assert.deepEqual(calls.sleeps, [], 'delay_ms: 0 must not fall back to a blind sleep');
  assert.equal(result.success, true);
  assert.equal(result.total_iterations, 4);
  assert.equal(result.completed, 4);
  assert.equal(result.successful, 4);
  assert.equal(result.failed, 0);
  assert.equal(result.unstarted, 0);
  assert.equal(result.results.length, 4);
  for (const row of result.results) {
    assert.equal(row.success, true);
    assert.equal(row.action_started, true);
    assert.deepEqual(row.requested, { symbol: row.symbol, timeframe: row.timeframe });
    assert.deepEqual(row.observed, { symbol: row.symbol, timeframe: row.timeframe, bar_count: 100 });
  }
});

test('restores the initial authoritative state after success, row failure, and abort', async t => {
  const initial = { symbol: 'FX:INITIAL', timeframe: '1D' };

  await t.test('normal completion', async () => {
    const fixture = createDependencies();
    const result = await batchRun({
      ...defaultRequest,
      symbols: ['FX:USDJPY'],
      timeframes: ['5'],
      _deps: fixture.dependencies,
    });
    assert.deepEqual(
      { symbol: fixture.state.symbol, timeframe: fixture.state.timeframe },
      initial,
    );
    assert.deepEqual(result.restoration.requested, initial);
    assert.equal(result.restoration.attempted, true);
    assert.equal(result.restoration.success, true);
    assert.equal(result.success, true);
  });

  await t.test('row failure', async () => {
    const fixture = createDependencies({
      executeAction: async () => { throw new Error('action failed'); },
    });
    const result = await batchRun({
      ...defaultRequest,
      symbols: ['FX:USDJPY'],
      timeframes: ['5'],
      _deps: fixture.dependencies,
    });
    assert.deepEqual(
      { symbol: fixture.state.symbol, timeframe: fixture.state.timeframe },
      initial,
    );
    assert.equal(result.failed, 1);
    assert.equal(result.restoration.success, true);
  });

  await t.test('abort uses an independent cleanup signal', async () => {
    const controller = new AbortController();
    const fixture = createDependencies();
    fixture.dependencies.waitForChartReady = async (symbol, timeframe, _timeout, options) => {
      if (options.signal === controller.signal) {
        const error = Object.assign(new Error('cancel during readiness'), { code: 'CHART_READINESS_ABORTED' });
        controller.abort(error);
        throw error;
      }
      return { ...fixture.state, symbol, timeframe };
    };
    const result = await batchRun({
      ...defaultRequest,
      symbols: ['FX:USDJPY'],
      timeframes: ['5'],
      signal: controller.signal,
      _deps: fixture.dependencies,
    });
    assert.equal(result.cancelled, true);
    assert.deepEqual(
      { symbol: fixture.state.symbol, timeframe: fixture.state.timeframe },
      initial,
    );
    assert.equal(result.restoration.success, true);
    assert.notEqual(fixture.calls.symbolSignals.at(-1), controller.signal);
    assert.equal(fixture.calls.symbolSignals.at(-1)?.aborted, false);
  });
});

test('restoration timeout is bounded and fails the top-level result closed', async () => {
  const fixture = createDependencies({ restorationTimeoutMs: 5 });
  fixture.dependencies.waitForChartReady = async (symbol, timeframe, _timeout, options) => {
    if (options.signal) return new Promise(() => {});
    return { ...fixture.state, symbol, timeframe };
  };
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    _deps: fixture.dependencies,
  });

  assert.equal(result.success, false);
  assert.equal(result.restoration.required, true);
  assert.equal(result.restoration.attempted, true);
  assert.equal(result.restoration.success, false);
  assert.equal(result.restoration.error.code, 'CHART_RESTORATION_TIMEOUT');
  assert.equal(result.error.code, 'CHART_RESTORATION_TIMEOUT');
});

test('passes the pre-mutation bars baseline into readiness', async () => {
  const initial = { ...chartState('FX:INITIAL', '1D'), bars_fingerprint: 'old-bars' };
  const ready = { ...chartState('FX:USDJPY', '5'), bars_fingerprint: 'new-bars' };
  let readinessOptions;
  let actions = 0;
  let stateReads = 0;
  const { dependencies } = createDependencies({
    readChartState: async () => {
      const index = stateReads++;
      return { ...(index === 0 || index >= 4 ? initial : ready) };
    },
    waitForChartReady: async (_symbol, _timeframe, _timeout, options) => {
      if (!options.signal) {
        readinessOptions = options;
        return { ...ready };
      }
      return { ...initial };
    },
    executeAction: async () => { actions += 1; return { success: true }; },
  });
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    _deps: dependencies,
  });

  assert.equal(readinessOptions.baselineFingerprint, 'old-bars');
  assert.equal(readinessOptions.requireFingerprintChange, true);
  assert.equal(actions, 1);
  assert.equal(result.success, true);
});

test('same authoritative identity skips a symbol setter that would start a delayed reload', async () => {
  const initial = { ...chartState('FX:SAME', '5'), bars_fingerprint: 'old-bars' };
  let executionSetters = 0;
  let reloadStarted = false;
  let actions = 0;
  const fixture = createDependencies({
    readChartState: async () => ({ ...initial }),
    setSymbol: async (_symbol, context = {}) => {
      if (context.phase !== 'restoration') {
        executionSetters += 1;
        reloadStarted = true;
      }
    },
    setTimeframe: async () => {},
    waitForChartReady: async () => ({ ...initial }),
    executeAction: async () => {
      actions += 1;
      return { success: true, used_stale_data: reloadStarted };
    },
  });

  const result = await batchRun({
    symbols: ['FX:SAME'],
    timeframes: ['5'],
    action: 'get_ohlcv',
    delay_ms: 0,
    _deps: fixture.dependencies,
  });

  assert.equal(executionSetters, 0);
  assert.equal(reloadStarted, false);
  assert.equal(actions, 1);
  assert.equal(result.success, true);
  assert.equal(result.results[0].result.used_stale_data, false);
  assert.equal(result.results[0].oracle_verified, true);
  assert.equal(result.restoration.reason, 'mutation_not_started');
});

test('execution and restoration setters follow the changed-component matrix', async t => {
  const cases = [
    {
      name: 'symbol only',
      symbol: 'FX:A', timeframe: '1D',
      executionSymbols: ['FX:A'], executionTimeframes: [],
      restorationSymbols: ['FX:INITIAL'], restorationTimeframes: [],
      mutationRequired: true,
    },
    {
      name: 'timeframe only',
      symbol: 'FX:INITIAL', timeframe: '5',
      executionSymbols: [], executionTimeframes: ['5'],
      restorationSymbols: [], restorationTimeframes: ['1D'],
      mutationRequired: true,
    },
    {
      name: 'both',
      symbol: 'FX:A', timeframe: '5',
      executionSymbols: ['FX:A'], executionTimeframes: ['5'],
      restorationSymbols: ['FX:INITIAL'], restorationTimeframes: ['1D'],
      mutationRequired: true,
    },
    {
      name: 'same',
      symbol: 'FX:INITIAL', timeframe: '1D',
      executionSymbols: [], executionTimeframes: [],
      restorationSymbols: [], restorationTimeframes: [],
      mutationRequired: false,
    },
  ];

  for (const expected of cases) {
    await t.test(expected.name, async () => {
      const fixture = createDependencies();
      const result = await batchRun({
        symbols: [expected.symbol],
        timeframes: [expected.timeframe],
        action: 'get_ohlcv',
        delay_ms: 0,
        _deps: fixture.dependencies,
      });

      assert.equal(result.success, true);
      assert.deepEqual(fixture.calls.symbols, expected.executionSymbols);
      assert.deepEqual(fixture.calls.timeframes, expected.executionTimeframes);
      assert.deepEqual(fixture.calls.restorationSymbols, expected.restorationSymbols);
      assert.deepEqual(fixture.calls.restorationTimeframes, expected.restorationTimeframes);
      const executionReadiness = fixture.calls.readiness.find(call => !call.options.signal);
      assert.equal(executionReadiness.options.requireFingerprintChange, expected.mutationRequired);
    });
  }
});

test('unneeded timeframe setters cannot schedule a delayed fingerprint reload', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => t.mock.timers.reset());
  const fixture = createDependencies();
  const delayedPhases = [];
  fixture.dependencies.setTimeframe = async (timeframe, context = {}) => {
    const phase = context.phase || 'execution';
    const calls = phase === 'restoration'
      ? fixture.calls.restorationTimeframes
      : fixture.calls.timeframes;
    calls.push(timeframe);
    if (fixture.state.timeframe === timeframe) {
      delayedPhases.push(phase);
      setTimeout(() => {
        fixture.state.bars_fingerprint = `late-${phase}`;
      }, 10);
      return;
    }
    fixture.state.timeframe = timeframe;
    fixture.state.bars_fingerprint = `${fixture.state.symbol}/${timeframe}/${fixture.state.bar_count}`;
  };

  const result = await batchRun({
    symbols: ['FX:A'],
    timeframes: ['1D'],
    action: 'get_ohlcv',
    delay_ms: 0,
    _deps: fixture.dependencies,
  });
  const fingerprintAtReturn = fixture.state.bars_fingerprint;

  t.mock.timers.tick(20);

  assert.equal(result.success, true);
  assert.deepEqual(delayedPhases, []);
  assert.deepEqual(fixture.calls.timeframes, []);
  assert.deepEqual(fixture.calls.restorationTimeframes, []);
  assert.equal(fixture.state.bars_fingerprint, fingerprintAtReturn);
});

test('readiness timeout is fail-closed and prevents the action', async () => {
  let actions = 0;
  const timeout = Object.assign(new Error('not ready'), {
    code: 'CHART_READINESS_TIMEOUT',
    observed: chartState('FX:USDJPY', '5', 0),
  });
  const { dependencies } = createDependencies({
    waitForChartReady: async () => { throw timeout; },
    executeAction: async () => { actions += 1; return { success: true }; },
  });

  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    _deps: dependencies,
  });

  assert.equal(actions, 0);
  assert.equal(result.success, false);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].action_started, false);
  assert.equal(result.results[0].error.code, 'CHART_READINESS_TIMEOUT');
});

test('a soft false readiness result is fail-closed and prevents the action', async () => {
  let actions = 0;
  const { dependencies } = createDependencies({
    waitForChartReady: async () => false,
    executeAction: async () => { actions += 1; return { success: true }; },
  });
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    _deps: dependencies,
  });

  assert.equal(actions, 0);
  assert.equal(result.success, false);
  assert.equal(result.results[0].error.code, 'CHART_READINESS_FAILED');
});

test('an immediate pre-action state mismatch prevents the action', async () => {
  let actions = 0;
  let reads = 0;
  const { dependencies } = createDependencies({
    readChartState: async () => reads++ === 0
      ? chartState('FX:INITIAL', '1D', 100)
      : chartState('FX:USDJPY', '', 100),
    executeAction: async () => { actions += 1; return { success: true }; },
  });
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['15'],
    _deps: dependencies,
  });

  assert.equal(actions, 0);
  assert.equal(result.results[0].success, false);
  assert.equal(result.results[0].error.code, 'CHART_STATE_MISMATCH');
  assert.equal(result.results[0].observed.timeframe, '');
});

test('unknown actions and unavailable chart APIs fail every planned row without mutation', async () => {
  const unknown = createDependencies();
  const unknownResult = await batchRun({
    ...defaultRequest,
    action: 'not-an-action',
    _deps: unknown.dependencies,
  });
  assert.equal(unknownResult.success, false);
  assert.equal(unknownResult.failed, 4);
  assert.deepEqual(unknown.calls.symbols, []);
  assert.deepEqual(unknown.calls.actions, []);
  assert.ok(unknownResult.results.every(row => row.error.code === 'BATCH_UNKNOWN_ACTION'));

  const unavailable = createDependencies({
    getChartApi: async () => { throw new Error('missing chart api'); },
    getChartCollection: async () => { throw new Error('missing collection'); },
  });
  const unavailableResult = await batchRun({ ...defaultRequest, _deps: unavailable.dependencies });
  assert.equal(unavailableResult.success, false);
  assert.equal(unavailableResult.failed, 4);
  assert.deepEqual(unavailable.calls.symbols, []);
  assert.deepEqual(unavailable.calls.actions, []);
  assert.ok(unavailableResult.results.every(row => row.error.code === 'CHART_API_UNAVAILABLE'));

  let collectionOnlyActions = 0;
  const collectionOnly = createDependencies({
    getChartApi: async () => { throw new Error('active chart api missing'); },
    getChartCollection: async () => 'window.__collection',
    executeAction: async () => { collectionOnlyActions += 1; return { success: true }; },
  });
  const collectionOnlyResult = await batchRun({ ...defaultRequest, _deps: collectionOnly.dependencies });
  assert.equal(collectionOnlyActions, 0);
  assert.equal(collectionOnlyResult.failed, 4);
  assert.ok(collectionOnlyResult.results.every(row => row.error.code === 'CHART_API_UNAVAILABLE'));
});

test('thrown and soft action errors both fail the row and top-level result', async t => {
  const cases = [
    ['throw', async () => { throw new Error('core exploded'); }, 'core exploded'],
    ['success false', async () => ({ success: false, error: 'soft false' }), 'soft false'],
    ['error field', async () => ({ error: 'soft error' }), 'soft error'],
    ['literal false', async () => false, 'Action returned false'],
  ];
  for (const [name, executeAction, message] of cases) {
    await t.test(name, async () => {
      const { dependencies } = createDependencies({ executeAction });
      const result = await batchRun({
        ...defaultRequest,
        symbols: ['FX:USDJPY'],
        timeframes: ['5'],
        _deps: dependencies,
      });
      assert.equal(result.success, false);
      assert.equal(result.failed, 1);
      assert.match(result.results[0].error.message, new RegExp(message));
    });
  }
});

test('cancellation stops later combinations and exposes a deterministic resume point', async () => {
  const controller = new AbortController();
  let actions = 0;
  const { dependencies } = createDependencies({
    executeAction: async () => {
      actions += 1;
      controller.abort(new Error('stop after first'));
      return { success: true };
    },
  });

  const result = await batchRun({ ...defaultRequest, signal: controller.signal, _deps: dependencies });

  assert.equal(actions, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.success, false);
  assert.equal(result.completed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.unstarted, 3);
  assert.deepEqual(result.resume_from, { index: 1, symbol: 'FX:USDJPY', timeframe: '15' });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].success, false);
  assert.equal(result.results[0].action_started, true);
  assert.equal(result.results[0].ambiguous, true);
  assert.equal(result.results[0].oracle_verified, false);
  assert.equal(result.results[0].error.code, 'BATCH_ACTION_CANCELLED_AMBIGUOUS');
  assert.equal(result.restoration.success, true);
});

test('cancellation during readiness leaves the current and later rows unstarted', async () => {
  const controller = new AbortController();
  let actions = 0;
  const abortError = Object.assign(new Error('cancelled while waiting'), {
    code: 'CHART_READINESS_ABORTED',
  });
  const { dependencies } = createDependencies({
    waitForChartReady: async () => {
      controller.abort(abortError);
      throw abortError;
    },
    executeAction: async () => { actions += 1; return { success: true }; },
  });

  const result = await batchRun({ ...defaultRequest, signal: controller.signal, _deps: dependencies });
  assert.equal(actions, 0);
  assert.equal(result.cancelled, true);
  assert.equal(result.completed, 0);
  assert.equal(result.unstarted, 4);
  assert.deepEqual(result.resume_from, { index: 0, symbol: 'FX:USDJPY', timeframe: '5' });
  assert.deepEqual(result.results, []);
});

test('abort resolved inside the post-action oracle makes the current row ambiguous', async () => {
  const controller = new AbortController();
  const initial = chartState('FX:INITIAL', '1D');
  const ready = chartState('FX:A', '5');
  let executionReads = 0;
  let actions = 0;
  const fixture = createDependencies({
    readChartState: async ({ signal } = {}) => {
      if (signal === controller.signal) {
        executionReads += 1;
        if (executionReads === 1) return { ...initial };
        if (executionReads === 2) return { ...ready };
        controller.abort(new Error('abort while oracle resolves'));
        return { ...ready };
      }
      return { ...fixture.state };
    },
    executeAction: async () => { actions += 1; return { success: true }; },
  });

  const result = await batchRun({
    symbols: ['FX:A', 'FX:B'],
    timeframes: ['5'],
    action: 'get_ohlcv',
    delay_ms: 0,
    signal: controller.signal,
    _deps: fixture.dependencies,
  });

  assert.equal(actions, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.success, false);
  assert.equal(result.completed, 1);
  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.unstarted, 1);
  assert.deepEqual(result.resume_from, { index: 1, symbol: 'FX:B', timeframe: '5' });
  assert.equal(result.results[0].success, false);
  assert.equal(result.results[0].action_started, true);
  assert.equal(result.results[0].ambiguous, true);
  assert.equal(result.results[0].oracle_verified, false);
  assert.equal(result.results[0].error.code, 'BATCH_ACTION_CANCELLED_AMBIGUOUS');
  assert.equal(result.restoration.success, true);
});

test('strategy success requires two identical stable fingerprints', async () => {
  let stableCalls = 0;
  const stable = createDependencies({
    executeAction: undefined,
    getStrategyResults: async () => {
      stableCalls += 1;
      return { success: true, metrics: { net_profit: 42, trades: 7 }, source: 'fixture' };
    },
  });
  delete stable.dependencies.executeAction;
  const stableResult = await batchRun({
    ...defaultRequest,
    symbols: ['FX:INITIAL'],
    timeframes: ['1D'],
    action: 'get_strategy_results',
    _deps: stable.dependencies,
  });
  assert.equal(stableCalls, 2);
  assert.equal(stableResult.success, true);
  assert.match(stableResult.results[0].strategy_fingerprint, /^[a-f0-9]{8,}$/);

  let unstableCalls = 0;
  const unstable = createDependencies({
    executeAction: undefined,
    readinessTimeoutMs: 8,
    getStrategyResults: async () => ({
      success: true,
      metrics: { net_profit: ++unstableCalls },
      source: 'fixture',
    }),
  });
  delete unstable.dependencies.executeAction;
  const unstableResult = await batchRun({
    ...defaultRequest,
    symbols: ['FX:INITIAL'],
    timeframes: ['1D'],
    action: 'get_strategy_results',
    _deps: unstable.dependencies,
  });
  assert.ok(unstableCalls >= 2);
  assert.equal(unstableResult.success, false);
  assert.equal(unstableResult.results[0].error.code, 'STRATEGY_FINGERPRINT_UNSTABLE');
});

test('strategy mutation rejects stable old-old and waits for changed new-new', async () => {
  const snapshots = [
    { success: true, metrics: { net_profit: 1 }, source: 'fixture' },
    { success: true, metrics: { net_profit: 1 }, source: 'fixture' },
    { success: true, metrics: { net_profit: 2 }, source: 'fixture' },
    { success: true, metrics: { net_profit: 2 }, source: 'fixture' },
  ];
  let strategyCalls = 0;
  const fixture = createDependencies({
    executeAction: undefined,
    getStrategyResults: async () => snapshots[Math.min(strategyCalls++, snapshots.length - 1)],
  });
  delete fixture.dependencies.executeAction;
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    action: 'get_strategy_results',
    _deps: fixture.dependencies,
  });

  assert.equal(strategyCalls, 4, 'one pre-mutation baseline plus old/new/new polling is required');
  assert.equal(result.success, true);
  assert.equal(result.results[0].result.metrics.net_profit, 2);
  assert.equal(result.results[0].strategy_fingerprint, result.results[0].strategy_oracle_fingerprint);
});

test('duplicate symbols preserve the exact input product without duplicate group execution', async () => {
  const fixture = createDependencies();
  const result = await batchRun({
    ...defaultRequest,
    symbols: ['FX:A', 'FX:A'],
    timeframes: ['5', '15'],
    _deps: fixture.dependencies,
  });

  assert.equal(result.total_iterations, 4);
  assert.equal(result.completed, 4);
  assert.equal(result.unstarted, 0);
  assert.equal(result.resume_from, null);
  assert.equal(result.results.length, 4);
  assert.deepEqual(result.results.map(row => [row.symbol, row.timeframe]), [
    ['FX:A', '5'],
    ['FX:A', '15'],
    ['FX:A', '5'],
    ['FX:A', '15'],
  ]);
  assert.deepEqual(fixture.calls.symbols, ['FX:A'], 'consecutive duplicate symbol groups use one safe setter');
});

test('abort during initial timeframe read leaves every planned row unstarted', async () => {
  const controller = new AbortController();
  const fixture = createDependencies({
    readChartState: async () => {
      const error = Object.assign(new Error('cancel initial state read'), { code: 'CDP_OPERATION_ABORTED' });
      controller.abort(error);
      throw error;
    },
  });
  const result = await batchRun({
    symbols: ['FX:A', 'FX:B'],
    action: 'get_ohlcv',
    signal: controller.signal,
    _deps: fixture.dependencies,
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.completed, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.unstarted, 2);
  assert.deepEqual(result.resume_from, { index: 0, symbol: 'FX:A', timeframe: null });
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.restoration, {
    required: false,
    attempted: false,
    success: true,
    reason: 'mutation_not_started',
  });
});

test('batch MCP tool propagates the request AbortSignal', async () => {
  let handler;
  const server = {
    tool: (_name, _description, _schema, registeredHandler) => { handler = registeredHandler; },
  };
  let received;
  registerBatchTools(server, {
    batchRun: async input => {
      received = input;
      return { success: false, cancelled: true };
    },
  });
  const controller = new AbortController();
  await handler({ symbols: ['FX:USDJPY'], action: 'get_ohlcv', delay_ms: 0 }, { signal: controller.signal });
  assert.equal(received.signal, controller.signal);
  assert.equal(received.delay_ms, 0);
});

test('batch MCP tool marks failed or cancelled structured results as isError', async t => {
  const cases = [
    ['failed', { success: false, cancelled: false, failed: 1 }, true],
    ['cancelled', { success: false, cancelled: true, unstarted: 1 }, true],
    ['successful', { success: true, cancelled: false, failed: 0 }, false],
  ];
  for (const [name, payload, expectedIsError] of cases) {
    await t.test(name, async () => {
      let handler;
      const server = {
        tool: (_name, _description, _schema, registeredHandler) => { handler = registeredHandler; },
      };
      registerBatchTools(server, { batchRun: async () => payload });
      const response = await handler({ symbols: ['FX:A'], action: 'get_ohlcv' }, {});
      assert.equal(response.isError, expectedIsError);
      assert.deepEqual(JSON.parse(response.content[0].text), payload);
    });
  }
});
