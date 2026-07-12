import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CdpAbortError,
  CdpDeadlineError,
  createConnectionManager,
} from '../src/connection.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleWithin(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function createClient({ evaluate, enable = {}, close } = {}) {
  const client = new EventEmitter();
  client.closeCalls = 0;
  client.Runtime = {
    enable: enable.Runtime || (async () => {}),
    evaluate: evaluate || (async () => ({ result: { value: true } })),
  };
  client.Page = { enable: enable.Page || (async () => {}) };
  client.DOM = { enable: enable.DOM || (async () => {}) };
  client.close = async () => {
    client.closeCalls += 1;
    return close?.(client);
  };
  return client;
}

function createManager({ clients, cdpFactory, ...overrides } = {}) {
  const queue = [...(clients || [])];
  let factoryCalls = 0;
  const manager = createConnectionManager({
    cdpFactory: cdpFactory || (async () => {
      factoryCalls += 1;
      const next = queue.shift();
      if (!next) throw new Error('No mock CDP client queued');
      return next;
    }),
    fetchFn: async () => ({
      ok: true,
      json: async () => [{ id: `target-${factoryCalls + 1}`, type: 'page', url: 'https://www.tradingview.com/chart/test/' }],
    }),
    sleep: async () => {},
    maxRetries: 1,
    baseDelay: 0,
    ...overrides,
  });
  return { manager, factoryCalls: () => factoryCalls };
}

describe('CDP connection lifecycle', () => {
  it('shares one in-flight connection attempt across 32 concurrent callers', async () => {
    const factoryGate = deferred();
    const candidate = createClient();
    let factoryCalls = 0;
    const { manager } = createManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        await factoryGate.promise;
        return candidate;
      },
    });

    const callers = Array.from({ length: 32 }, () => manager.getClient());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(factoryCalls, 1);

    factoryGate.resolve();
    const clients = await Promise.all(callers);
    assert.equal(factoryCalls, 1);
    assert.ok(clients.every(client => client === candidate));
  });

  it('closes a partial domain-enable failure exactly once and never publishes it', async () => {
    const failed = createClient({
      enable: { Page: async () => { throw new Error('Page.enable failed'); } },
      close: client => client.emit('disconnect'),
    });
    const healthy = createClient();
    const { manager, factoryCalls } = createManager({ clients: [failed, healthy] });

    await assert.rejects(manager.getClient(), /Page\.enable failed/);
    assert.equal(failed.closeCalls, 1);

    assert.equal(await manager.getClient(), healthy);
    assert.equal(factoryCalls(), 2);
    assert.equal(failed.closeCalls, 1);
  });

  it('does not let a stale generation disconnect clear the current client', async () => {
    const closeGate = deferred();
    const stale = createClient({ close: () => closeGate.promise });
    const current = createClient();
    const { manager, factoryCalls } = createManager({ clients: [stale, current] });

    assert.equal(await manager.getClient(), stale);
    const disconnecting = manager.disconnect();
    assert.equal(await manager.getClient(), current);

    stale.emit('disconnect');
    closeGate.resolve();
    await disconnecting;

    assert.equal(await manager.getClient(), current);
    assert.equal(factoryCalls(), 2);
    assert.equal(stale.closeCalls, 1);
  });

  it('closes an explicitly detected liveness-invalid client exactly once', async () => {
    const invalid = createClient({
      evaluate: async () => { throw new Error('WebSocket closed'); },
      close: client => client.emit('disconnect'),
    });
    const healthy = createClient();
    const { manager } = createManager({ clients: [invalid, healthy] });

    await manager.getClient();
    await assert.rejects(manager.checkClientHealth({ timeoutMs: 50 }), /WebSocket closed/);
    assert.equal(invalid.closeCalls, 1);
    assert.equal(await manager.getClient(), healthy);
    assert.equal(invalid.closeCalls, 1);
  });
});

describe('bounded CDP operations', () => {
  it('applies the evaluate deadline while target discovery is pending', async () => {
    const { manager } = createManager({
      fetchFn: async () => new Promise(() => {}),
    });
    const started = performance.now();

    await assert.rejects(
      settleWithin(manager.evaluate('21 * 2', { timeoutMs: 50 }), 150, 'discovery wait did not settle'),
      error => {
        assert.ok(error instanceof CdpDeadlineError);
        assert.equal(error.code, 'CDP_DEADLINE_EXCEEDED');
        assert.equal(error.operation, 'Runtime.evaluate');
        return true;
      },
    );

    assert.ok(performance.now() - started < 100);
  });

  it('applies AbortSignal while the CDP factory is pending', async () => {
    const controller = new AbortController();
    let factoryCalls = 0;
    const { manager } = createManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        return new Promise(() => {});
      },
    });
    const pending = manager.evaluate('21 * 2', { signal: controller.signal, timeoutMs: 1000 });
    setTimeout(() => controller.abort(new Error('cancel factory wait')), 20);

    await assert.rejects(
      settleWithin(pending, 150, 'factory wait did not settle'),
      error => {
        assert.ok(error instanceof CdpAbortError);
        assert.equal(error.code, 'CDP_OPERATION_ABORTED');
        return true;
      },
    );
    assert.equal(factoryCalls, 1);
  });

  it('abandons and closes a candidate stuck in domain enable', async () => {
    const enableGate = deferred();
    const stuck = createClient({
      enable: { Runtime: async () => enableGate.promise },
    });
    const healthy = createClient({ evaluate: async () => ({ result: { value: 42 } }) });
    const { manager, factoryCalls } = createManager({ clients: [stuck, healthy] });

    await assert.rejects(
      settleWithin(manager.evaluate('21 * 2', { timeoutMs: 50 }), 150, 'domain enable wait did not settle'),
      error => error instanceof CdpDeadlineError,
    );
    assert.equal(stuck.closeCalls, 1);

    enableGate.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(await manager.evaluate('21 * 2', { timeoutMs: 100 }), 42);
    assert.equal(factoryCalls(), 2);
    assert.equal(stuck.closeCalls, 1);
  });

  it('keeps one shared connection attempt when one caller aborts', async () => {
    const factoryGate = deferred();
    const candidate = createClient({ evaluate: async () => ({ result: { value: 42 } }) });
    const controller = new AbortController();
    let factoryCalls = 0;
    const { manager } = createManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        return factoryGate.promise;
      },
    });

    const cancelled = manager.evaluate('21 * 2', { signal: controller.signal, timeoutMs: 1000 });
    const survivor = manager.evaluate('21 * 2', { timeoutMs: 500 });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort(new Error('cancel one waiter'));

    await assert.rejects(
      settleWithin(cancelled, 150, 'cancelled waiter did not settle'),
      error => error instanceof CdpAbortError,
    );
    assert.equal(factoryCalls, 1);
    assert.equal(candidate.closeCalls, 0);

    factoryGate.resolve(candidate);
    assert.equal(await survivor, 42);
    assert.equal(factoryCalls, 1);
  });

  it('closes a factory candidate that arrives after the last caller abandons it', async () => {
    const factoryGate = deferred();
    const stale = createClient();
    const healthy = createClient({ evaluate: async () => ({ result: { value: 42 } }) });
    let factoryCalls = 0;
    const { manager } = createManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        return factoryCalls === 1 ? factoryGate.promise : healthy;
      },
    });

    await assert.rejects(
      settleWithin(manager.evaluate('21 * 2', { timeoutMs: 50 }), 150, 'abandoned factory wait did not settle'),
      error => error instanceof CdpDeadlineError,
    );

    factoryGate.resolve(stale);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stale.closeCalls, 1);
    assert.equal(await manager.evaluate('21 * 2', { timeoutMs: 100 }), 42);
    assert.equal(factoryCalls, 2);
    assert.equal(stale.closeCalls, 1);
  });

  it('cancels retry backoff when the final waiter deadline expires', async () => {
    let factoryCalls = 0;
    let activeBackoffs = 0;
    let backoffCompleted = false;
    let forceCleanup;
    const sleep = (ms, signal) => new Promise(resolve => {
      let settled = false;
      activeBackoffs += 1;
      const finish = completed => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        activeBackoffs -= 1;
        backoffCompleted = completed;
        resolve();
      };
      const onAbort = () => finish(false);
      const timer = setTimeout(() => finish(true), ms);
      signal?.addEventListener('abort', onAbort, { once: true });
      forceCleanup = () => finish(false);
    });
    const { manager } = createManager({
      cdpFactory: async () => {
        factoryCalls += 1;
        throw new Error('factory failed');
      },
      sleep,
      maxRetries: 5,
      baseDelay: 1000,
    });
    const started = performance.now();

    try {
      await assert.rejects(
        manager.evaluate('21 * 2', { timeoutMs: 50 }),
        error => error instanceof CdpDeadlineError,
      );
      await new Promise(resolve => setImmediate(resolve));

      assert.ok(performance.now() - started < 100);
      assert.equal(activeBackoffs, 0);
      assert.equal(backoffCompleted, false);
      assert.equal(factoryCalls, 1);
    } finally {
      forceCleanup?.();
    }
  });

  it('settles a never-ending evaluate with a typed 50 ms deadline error within 100 ms', async () => {
    const never = new Promise(() => {});
    const candidate = createClient({ evaluate: async () => never });
    const { manager } = createManager({ clients: [candidate] });
    const started = performance.now();

    await assert.rejects(
      manager.evaluate('new Promise(function() {})', { awaitPromise: true, timeoutMs: 50 }),
      error => {
        assert.ok(error instanceof CdpDeadlineError);
        assert.equal(error.code, 'CDP_DEADLINE_EXCEEDED');
        assert.equal(error.operation, 'Runtime.evaluate');
        assert.equal(error.timeoutMs, 50);
        return true;
      },
    );

    assert.ok(performance.now() - started < 100);
    assert.equal(candidate.closeCalls, 1);
  });

  it('honors AbortSignal and removes its listener after cancellation', async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    let abortListeners = 0;
    signal.addEventListener = (type, listener, options) => {
      if (type === 'abort') abortListeners += 1;
      return add(type, listener, options);
    };
    signal.removeEventListener = (type, listener, options) => {
      if (type === 'abort') abortListeners -= 1;
      return remove(type, listener, options);
    };

    const candidate = createClient({ evaluate: async () => new Promise(() => {}) });
    const { manager } = createManager({ clients: [candidate] });
    const pending = manager.evaluate('new Promise(function() {})', { awaitPromise: true, signal, timeoutMs: 1000 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(abortListeners, 1);

    controller.abort(new Error('cancelled by caller'));
    await assert.rejects(pending, error => {
      assert.ok(error instanceof CdpAbortError);
      assert.equal(error.code, 'CDP_OPERATION_ABORTED');
      assert.equal(error.operation, 'Runtime.evaluate');
      return true;
    });

    assert.equal(abortListeners, 0);
    assert.equal(candidate.closeCalls, 1);
  });

  it('never automatically replays a mutating expression after transport failure', async () => {
    let firstCalls = 0;
    const failed = createClient({
      evaluate: async () => {
        firstCalls += 1;
        throw new Error('ambiguous transport failure');
      },
    });
    const healthy = createClient({ evaluate: async () => ({ result: { value: 'second call' } }) });
    const { manager, factoryCalls } = createManager({ clients: [failed, healthy] });

    await assert.rejects(manager.evaluate('window.orderCount += 1'), /ambiguous transport failure/);
    assert.equal(firstCalls, 1);
    assert.equal(factoryCalls(), 1);
    assert.equal(failed.closeCalls, 1);

    assert.equal(await manager.evaluate('window.orderCount += 1'), 'second call');
    assert.equal(factoryCalls(), 2);
  });

  it('uses exactly one Runtime.evaluate command on the cached-client hot path', async () => {
    let evaluateCalls = 0;
    const candidate = createClient({
      evaluate: async () => {
        evaluateCalls += 1;
        return { result: { value: 42 } };
      },
    });
    const { manager } = createManager({ clients: [candidate] });

    await manager.getClient();
    assert.equal(await manager.evaluate('21 * 2'), 42);
    assert.equal(evaluateCalls, 1);
  });

  it('returns a typed deadline for an already-expired raw command without discovery or factory work', async () => {
    let fetchCalls = 0;
    let commandCalls = 0;
    const candidate = createClient();
    candidate.Page.captureScreenshot = async () => {
      commandCalls += 1;
      return { data: '' };
    };
    const { manager, factoryCalls } = createManager({
      clients: [candidate],
      fetchFn: async () => {
        fetchCalls += 1;
        return {
          ok: true,
          json: async () => [{ id: 'target', type: 'page', url: 'https://www.tradingview.com/chart/test/' }],
        };
      },
    });

    await assert.rejects(
      manager.sendCdpCommand(
        'Page',
        'captureScreenshot',
        { format: 'png' },
        { deadline: Date.now() - 1 },
      ),
      error => {
        assert.ok(error instanceof CdpDeadlineError);
        assert.equal(error.code, 'CDP_DEADLINE_EXCEEDED');
        assert.equal(error.operation, 'Page.captureScreenshot');
        assert.equal(error.timeoutMs, 0);
        assert.equal(error.ambiguous, true);
        assert.equal(error.retryable, false);
        return true;
      },
    );

    assert.equal(fetchCalls, 0);
    assert.equal(factoryCalls(), 0);
    assert.equal(commandCalls, 0);
    assert.equal(candidate.closeCalls, 0);
  });

  it('keeps an explicitly invalid timeoutMs as a RangeError before connection work', async () => {
    const candidate = createClient();
    let commandCalls = 0;
    candidate.Page.captureScreenshot = async () => {
      commandCalls += 1;
      return { data: '' };
    };
    const { manager, factoryCalls } = createManager({ clients: [candidate] });

    await assert.rejects(
      manager.sendCdpCommand(
        'Page',
        'captureScreenshot',
        { format: 'png' },
        { timeoutMs: 0, deadline: Date.now() - 1 },
      ),
      error => error instanceof RangeError && /timeoutMs/.test(error.message),
    );

    assert.equal(factoryCalls(), 0);
    assert.equal(commandCalls, 0);
    assert.equal(candidate.closeCalls, 0);
  });
});
