import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {
  CdpAbortError,
  CdpDeadlineError,
  CdpTransportError,
  createConnectionManager,
} from '../src/connection.js';
import { batchRun } from '../src/core/batch.js';
import { registerPineTools } from '../src/tools/pine.js';

const PINE_SOURCE = readFileSync(new URL('../src/core/pine.js', import.meta.url), 'utf8');

function settleWithin(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function trackedTimers() {
  const active = new Set();
  return {
    setTimeoutFn(callback, milliseconds) {
      let handle;
      handle = setTimeout(() => {
        active.delete(handle);
        callback();
      }, milliseconds);
      active.add(handle);
      return handle;
    },
    clearTimeoutFn(handle) {
      active.delete(handle);
      clearTimeout(handle);
    },
    count: () => active.size,
  };
}

function trackAbortListeners(signal) {
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  let count = 0;
  signal.addEventListener = (type, listener, options) => {
    if (type === 'abort') count += 1;
    return add(type, listener, options);
  };
  signal.removeEventListener = (type, listener, options) => {
    if (type === 'abort') count -= 1;
    return remove(type, listener, options);
  };
  return () => count;
}

function createClient({ evaluate, captureScreenshot, dispatchKeyEvent } = {}) {
  const client = new EventEmitter();
  client.closeCalls = 0;
  client.Runtime = {
    enable: async () => {},
    evaluate: evaluate || (async () => ({ result: { value: true } })),
  };
  client.Page = {
    enable: async () => {},
    captureScreenshot: captureScreenshot || (async () => ({ data: '' })),
  };
  client.DOM = { enable: async () => {} };
  client.Input = {
    dispatchKeyEvent: dispatchKeyEvent || (async () => ({})),
  };
  client.close = async () => {
    client.closeCalls += 1;
  };
  return client;
}

function createManager(client, overrides = {}) {
  let factoryCalls = 0;
  const queue = [...(overrides.clients || [client])];
  const { clients: _clients, ...managerOverrides } = overrides;
  return {
    manager: createConnectionManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        return queue.shift() || client;
      },
      fetchFn: async () => ({
        ok: true,
        json: async () => [{ id: 'chart', type: 'page', url: 'https://www.tradingview.com/chart/test/' }],
      }),
      sleep: async () => {},
      maxRetries: 1,
      baseDelay: 0,
      ...managerOverrides,
    }),
    factoryCalls: () => factoryCalls,
  };
}

async function loadPineWithConnection(connection) {
  const context = vm.createContext({
    AbortController,
    URLSearchParams,
    clearTimeout,
    console,
    fetch: globalThis.fetch,
    setTimeout,
  });
  const connectionModule = new vm.SyntheticModule(
    ['CdpAbortError', 'evaluate', 'evaluateAsync', 'getClient', 'sendCdpCommand'],
    function initialize() {
      this.setExport('CdpAbortError', CdpAbortError);
      this.setExport('evaluate', connection.evaluate);
      this.setExport('evaluateAsync', connection.evaluateAsync || connection.evaluate);
      this.setExport('getClient', connection.getClient);
      this.setExport('sendCdpCommand', connection.sendCdpCommand);
    },
    { context },
  );
  const pineModule = new vm.SourceTextModule(PINE_SOURCE, {
    context,
    identifier: new URL('../src/core/pine.js', import.meta.url).href,
  });
  await pineModule.link(async specifier => {
    if (specifier === '../connection.js') return connectionModule;
    throw new Error(`Unexpected Pine dependency: ${specifier}`);
  });
  await pineModule.evaluate();
  return pineModule.namespace;
}

test('bounded raw Page command returns a typed 50 ms deadline without replay or leaks', async () => {
  const never = new Promise(() => {});
  let commandCalls = 0;
  const timers = trackedTimers();
  const client = createClient({
    captureScreenshot: async () => {
      commandCalls += 1;
      return never;
    },
  });
  const { manager } = createManager(client, timers);
  await manager.getClient();
  const started = performance.now();

  await assert.rejects(
    manager.sendCdpCommand('Page', 'captureScreenshot', { format: 'png' }, { timeoutMs: 50 }),
    error => {
      assert.ok(error instanceof CdpDeadlineError);
      assert.equal(error.code, 'CDP_DEADLINE_EXCEEDED');
      assert.equal(error.operation, 'Page.captureScreenshot');
      assert.equal(error.ambiguous, true);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.ok(performance.now() - started < 100);
  assert.equal(commandCalls, 1);
  assert.equal(client.closeCalls, 1);
  assert.equal(timers.count(), 0);
});

test('cached-client raw command hot path sends exactly one requested command', async () => {
  let evaluateCalls = 0;
  let commandCalls = 0;
  const client = createClient({
    evaluate: async () => {
      evaluateCalls += 1;
      return { result: { value: true } };
    },
    captureScreenshot: async params => {
      commandCalls += 1;
      return { data: params.format };
    },
  });
  const { manager, factoryCalls } = createManager(client);
  await manager.getClient();

  const result = await manager.sendCdpCommand('Page', 'captureScreenshot', { format: 'png' });

  assert.deepEqual(result, { data: 'png' });
  assert.equal(commandCalls, 1);
  assert.equal(evaluateCalls, 0, 'raw hot path must not add a liveness probe');
  assert.equal(factoryCalls(), 1);
  assert.equal(client.closeCalls, 0);
});

test('normalizes a generic raw-command transport failure and reconnects without replay', async () => {
  const transportCause = new Error('secret raw transport detail');
  let failedCalls = 0;
  const failed = createClient({
    captureScreenshot: async () => {
      failedCalls += 1;
      throw transportCause;
    },
  });
  const healthy = createClient({
    captureScreenshot: async () => ({ data: 'reconnected' }),
  });
  const { manager, factoryCalls } = createManager(failed, { clients: [failed, healthy] });
  await manager.getClient();

  await assert.rejects(
    manager.sendCdpCommand('Page', 'captureScreenshot', { format: 'png' }),
    error => {
      assert.ok(error instanceof CdpTransportError);
      assert.equal(error.code, 'CDP_TRANSPORT_ERROR');
      assert.equal(error.operation, 'Page.captureScreenshot');
      assert.equal(error.timeoutMs, 15000);
      assert.equal(error.ambiguous, true);
      assert.equal(error.retryable, false);
      assert.equal(error.cause, transportCause);
      assert.doesNotMatch(JSON.stringify(error), /secret raw transport detail/);
      return true;
    },
  );
  assert.equal(failedCalls, 1);
  assert.equal(failed.closeCalls, 1);

  assert.deepEqual(
    await manager.sendCdpCommand('Page', 'captureScreenshot', { format: 'png' }),
    { data: 'reconnected' },
  );
  assert.equal(factoryCalls(), 2);
  assert.equal(failed.closeCalls, 1);
});

test('chart helper discovery propagates AbortSignal and releases its listener/client', async () => {
  const controller = new AbortController();
  const listenerCount = trackAbortListeners(controller.signal);
  let evaluateCalls = 0;
  const client = createClient({
    evaluate: async () => {
      evaluateCalls += 1;
      return new Promise(() => {});
    },
  });
  const { manager } = createManager(client);
  const started = performance.now();
  const pending = manager.getChartApi({ signal: controller.signal, timeoutMs: 1000 });
  setTimeout(() => controller.abort(new Error('cancel chart discovery')), 10);

  await assert.rejects(settleWithin(pending, 100, 'chart helper ignored abort'), error => {
    assert.ok(error instanceof CdpAbortError);
    assert.equal(error.operation, 'Runtime.evaluate');
    return true;
  });

  assert.ok(performance.now() - started < 100);
  assert.equal(evaluateCalls, 1);
  assert.equal(listenerCount(), 0);
  assert.equal(client.closeCalls, 1);
});

test('batch screenshot aborts a blackholed Page command as an ambiguous row without replay', async () => {
  const controller = new AbortController();
  let commandCalls = 0;
  const client = createClient({
    captureScreenshot: async () => {
      commandCalls += 1;
      queueMicrotask(() => controller.abort(new Error('cancel screenshot')));
      return new Promise(() => {});
    },
  });
  const { manager } = createManager(client);
  const state = {
    api_available: true,
    symbol: 'FX:INITIAL',
    timeframe: '1D',
    bar_count: 100,
    bars_fingerprint: 'FX:INITIAL/1D/100',
  };
  const refresh = () => {
    state.bars_fingerprint = `${state.symbol}/${state.timeframe}/${state.bar_count}`;
  };
  const dependencies = {
    evaluate: manager.evaluate,
    evaluateAsync: manager.evaluateAsync,
    getClient: manager.getClient,
    sendCdpCommand: manager.sendCdpCommand,
    getChartApi: async () => 'window.__chart',
    getChartCollection: async () => 'window.__collection',
    setSymbol: async symbol => { state.symbol = symbol; refresh(); },
    setTimeframe: async timeframe => { state.timeframe = timeframe; refresh(); },
    readChartState: async () => ({ ...state }),
    waitForChartReady: async () => ({ ...state }),
    sleep: async () => {},
    readinessTimeoutMs: 50,
    restorationTimeoutMs: 50,
  };
  const started = performance.now();

  const result = await settleWithin(batchRun({
    symbols: ['FX:USDJPY'],
    timeframes: ['5'],
    action: 'screenshot',
    delay_ms: 0,
    signal: controller.signal,
    _deps: dependencies,
  }), 100, 'batch screenshot ignored abort');

  assert.ok(performance.now() - started < 100);
  assert.equal(commandCalls, 1);
  assert.equal(client.closeCalls, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].error.code, 'CDP_OPERATION_ABORTED');
  assert.equal(result.results[0].error.ambiguous, true);
  assert.equal(result.results[0].ambiguous, true);
  assert.equal(result.restoration.success, true);
});

for (const [name, evaluateResults] of [
  ['compile', [true, null]],
  ['save', [true]],
  ['smartCompile', [true, 0, null]],
]) {
  test(`Pine ${name} aborts a blackholed Input command within 100 ms`, async () => {
    const controller = new AbortController();
    const listenerCount = trackAbortListeners(controller.signal);
    let inputCalls = 0;
    const client = createClient({
      dispatchKeyEvent: async () => {
        inputCalls += 1;
        queueMicrotask(() => controller.abort(new Error(`cancel Pine ${name}`)));
        return new Promise(() => {});
      },
    });
    const { manager } = createManager(client);
    await manager.getClient();
    const results = [...evaluateResults];
    const pine = await loadPineWithConnection({
      evaluate: async () => results.shift(),
      evaluateAsync: async () => results.shift(),
      getClient: async () => client,
      sendCdpCommand: (...args) => manager.sendCdpCommand(...args),
    });
    const started = performance.now();

    await assert.rejects(
      settleWithin(pine[name]({ signal: controller.signal, timeoutMs: 1000 }), 100, `Pine ${name} ignored abort`),
      error => {
        assert.ok(error instanceof CdpAbortError);
        assert.equal(error.operation, 'Input.dispatchKeyEvent');
        return true;
      },
    );

    assert.ok(performance.now() - started < 100);
    assert.equal(inputCalls, 1);
    assert.equal(listenerCount(), 0);
    assert.equal(client.closeCalls, 1);
  });
}

for (const fixture of [
  { name: 'compile click', method: 'compile', evaluateResults: [true, 'Add to chart'], operation: 'Pine.compile.wait' },
  { name: 'compile keyboard', method: 'compile', evaluateResults: [true, null], operation: 'Pine.compile.wait' },
  { name: 'save after key dispatch', method: 'save', evaluateResults: [true], operation: 'Pine.save.wait' },
  { name: 'smartCompile click', method: 'smartCompile', evaluateResults: [true, 0, 'Add to chart'], operation: 'Pine.smartCompile.wait' },
  { name: 'smartCompile keyboard', method: 'smartCompile', evaluateResults: [true, 0, null], operation: 'Pine.smartCompile.wait' },
]) {
  test(`Pine ${fixture.name} cancellation during fixed post-action wait is typed and secret-safe`, async () => {
    const controller = new AbortController();
    const listenerCount = trackAbortListeners(controller.signal);
    let inputCalls = 0;
    let abortScheduled = false;
    const scheduleAbort = () => {
      if (abortScheduled) return;
      abortScheduled = true;
      setTimeout(() => controller.abort(new Error('secret Pine cancellation cause')), 0);
    };
    const client = createClient({
      dispatchKeyEvent: async event => {
        inputCalls += 1;
        if (event.type === 'keyUp') scheduleAbort();
        return {};
      },
    });
    const { manager } = createManager(client);
    await manager.getClient();
    const results = [...fixture.evaluateResults];
    const pine = await loadPineWithConnection({
      evaluate: async () => {
        const value = results.shift();
        if (typeof value === 'string') scheduleAbort();
        return value;
      },
      evaluateAsync: async () => results.shift(),
      getClient: async () => client,
      sendCdpCommand: (...args) => manager.sendCdpCommand(...args),
    });

    await assert.rejects(
      settleWithin(pine[fixture.method]({ signal: controller.signal, timeoutMs: 1000 }), 100, `${fixture.name} ignored abort`),
      error => {
        assert.ok(error instanceof CdpAbortError);
        assert.equal(error.code, 'CDP_OPERATION_ABORTED');
        assert.equal(error.operation, fixture.operation);
        assert.equal(error.ambiguous, true);
        assert.equal(error.retryable, false);
        assert.doesNotMatch(JSON.stringify(error), /secret Pine cancellation cause/);
        return true;
      },
    );
    const expectedInputCalls = fixture.name.includes('click') ? 0 : 2;
    assert.equal(inputCalls, expectedInputCalls);
    assert.equal(listenerCount(), 0);
    assert.equal(client.closeCalls, 0);
  });
}

test('Pine MCP handlers propagate the request AbortSignal to raw-command operations', async () => {
  const handlers = new Map();
  const server = {
    tool: (name, _description, _schema, handler) => handlers.set(name, handler),
  };
  const received = new Map();
  const coreApi = {
    compile: async options => { received.set('pine_compile', options); return { success: true }; },
    save: async options => { received.set('pine_save', options); return { success: true }; },
    smartCompile: async options => { received.set('pine_smart_compile', options); return { success: true }; },
  };
  registerPineTools(server, coreApi);
  const controller = new AbortController();

  for (const name of ['pine_compile', 'pine_save', 'pine_smart_compile']) {
    await handlers.get(name)({}, { signal: controller.signal });
    assert.equal(received.get(name).signal, controller.signal, `${name} dropped its request signal`);
  }
});

test('Pine MCP raw-command failure keeps typed ambiguous metadata and isError', async () => {
  let handler;
  const server = {
    tool: (name, _description, _schema, registeredHandler) => {
      if (name === 'pine_compile') handler = registeredHandler;
    },
  };
  registerPineTools(server, {
    compile: async () => {
      throw new CdpAbortError('Input.dispatchKeyEvent', new Error('cancel compile'));
    },
  });

  const response = await handler({}, { signal: new AbortController().signal });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(response.isError, true);
  assert.equal(payload.success, false);
  assert.equal(payload.code, 'CDP_OPERATION_ABORTED');
  assert.equal(payload.operation, 'Input.dispatchKeyEvent');
  assert.equal(payload.ambiguous, true);
  assert.equal(payload.retryable, false);
});
