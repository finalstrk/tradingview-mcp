import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

import { pollLoop } from '../src/core/stream.js';
import { createPinePageOperation, listScripts } from '../src/core/pine.js';
import { registerPineTools } from '../src/tools/pine.js';

function createProcessDouble() {
  const processDouble = new EventEmitter();
  processDouble.stdout = { write() {} };
  processDouble.stderr = { write() {} };
  return processDouble;
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

describe('stream termination', () => {
  it('does not remain stuck in an in-flight fetch and restores every listener', async () => {
    const processDouble = createProcessDouble();
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

    let fetchStarted = false;
    const pending = pollLoop(
      () => {
        fetchStarted = true;
        return new Promise(() => {});
      },
      { interval: 1000, label: 'test', signal, processRef: processDouble },
    );
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(fetchStarted, true);
    assert.equal(abortListeners, 1);
    assert.equal(processDouble.listenerCount('SIGINT'), 1);
    assert.equal(processDouble.listenerCount('SIGTERM'), 1);

    const started = performance.now();
    controller.abort(new Error('stop stream'));
    await settleWithin(pending, 100, 'stream termination timed out');

    assert.ok(performance.now() - started < 100);
    assert.equal(abortListeners, 0);
    assert.equal(processDouble.listenerCount('SIGINT'), 0);
    assert.equal(processDouble.listenerCount('SIGTERM'), 0);
  });
});

describe('Pine cancellation propagation', () => {
  it('aborts and removes page-side async work through its cancellation expression', async () => {
    let pageFetchAborted = false;
    const context = {
      window: {},
      AbortController,
      fetch: (_url, { signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          pageFetchAborted = true;
          reject(new Error('page fetch aborted'));
        }, { once: true });
      }),
    };
    const operation = createPinePageOperation(
      "return fetch('/never', { signal: controller.signal });",
      'pine-test-operation',
    );

    const pending = runInNewContext(operation.expression, context);
    await Promise.resolve();
    assert.equal(context.window.__tradingviewMcpAbortControllers.size, 1);

    assert.equal(runInNewContext(operation.cancelExpression, context), true);
    await assert.rejects(pending, /page fetch aborted/);
    assert.equal(pageFetchAborted, true);
    assert.equal(context.window.__tradingviewMcpAbortControllers.size, 0);
  });

  it('passes the request signal and page cancellation expression to CDP evaluateAsync', async () => {
    const controller = new AbortController();
    let captured;

    const result = await listScripts({
      signal: controller.signal,
      _deps: {
        evaluateAsync: async (expression, options) => {
          captured = { expression, options };
          return { scripts: [] };
        },
      },
    });

    assert.equal(result.count, 0);
    assert.equal(captured.options.signal, controller.signal);
    assert.match(captured.expression, /signal:\s*controller\.signal/);
    assert.match(captured.options.cancelExpression, /\.abort\(\)/);
  });

  it('forwards MCP cancellation to Pine core handlers', async () => {
    const handlers = new Map();
    const calls = [];
    const server = {
      tool(name, ...args) {
        handlers.set(name, args.at(-1));
      },
    };
    const core = {
      listScripts: async options => {
        calls.push({ name: 'list', options });
        return { success: true, scripts: [], count: 0 };
      },
      openScript: async options => {
        calls.push({ name: 'open', options });
        return { success: true, opened: true };
      },
    };
    registerPineTools(server, core);
    const controller = new AbortController();

    assert.equal(handlers.get('pine_list_scripts').length, 2);
    assert.equal(handlers.get('pine_open').length, 2);
    await handlers.get('pine_list_scripts')({}, { signal: controller.signal });
    await handlers.get('pine_open')({ name: 'Example' }, { signal: controller.signal });

    assert.equal(calls[0].options.signal, controller.signal);
    assert.equal(calls[1].options.signal, controller.signal);
    assert.equal(calls[1].options.name, 'Example');
  });
});
