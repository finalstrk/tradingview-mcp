import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AdapterError,
  createCdpMutationAdapter,
  createCdpReadAdapter,
  createKeyboardAdapter,
  createPineFacadeAdapter,
} from '../src/e2e/index.js';

const CONTEXT = Object.freeze({
  targetId: 'target-1',
  sessionId: 'session-1',
  executionContextId: 7,
});

function fakeTransport(overrides = {}) {
  const calls = [];
  const releases = [];
  return {
    calls,
    releases,
    getContext: async () => ({ ...CONTEXT }),
    call: async (method, params, context) => {
      calls.push({ method, params, context });
      return { result: { value: true, objectId: 'remote-1' } };
    },
    request: async (operation, payload, context) => {
      calls.push({ operation, payload, context });
      return { ok: true };
    },
    releaseObject: async objectId => releases.push(objectId),
    ...overrides,
  };
}

function assertCode(code) {
  return error => {
    assert.ok(error instanceof AdapterError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal('cause' in error, false);
    assert.equal(JSON.stringify(error).includes('SECRET'), false);
    return true;
  };
}

describe('safe E2E adapters', () => {
  it('rejects missing configuration with a fixed error', () => {
    assert.throws(() => createCdpReadAdapter(), assertCode('E2E_ADAPTER_INVALID_CONFIGURATION'));
  });

  it('CDP read verifies context and releases returned remote objects', async () => {
    const transport = fakeTransport();
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });

    const result = await adapter.read('Runtime.evaluate', { expression: '1 === 1' });

    assert.equal(result.result.value, true);
    assert.deepEqual(transport.calls, [{
      method: 'Runtime.evaluate',
      params: { expression: '1 === 1' },
      context: CONTEXT,
    }]);
    assert.deepEqual(transport.releases, ['remote-1']);
  });

  it('rejects unknown capabilities without transport calls', async () => {
    const transport = fakeTransport();
    const read = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });
    const mutation = createCdpMutationAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });

    await assert.rejects(read.read('Page.navigate', {}), assertCode('E2E_ADAPTER_CAPABILITY_DENIED'));
    await assert.rejects(mutation.mutate('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_CAPABILITY_DENIED'));
    assert.equal(transport.calls.length, 0);
  });

  it('rejects accessor-bearing arguments before transport execution', async () => {
    const transport = fakeTransport();
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });
    const params = {};
    Object.defineProperty(params, 'expression', { enumerable: true, get: () => 'SECRET' });

    await assert.rejects(
      adapter.read('Runtime.evaluate', params),
      assertCode('E2E_ADAPTER_INVALID_ARGUMENT'),
    );
    assert.equal(transport.calls.length, 0);
  });

  it('maps thrown secret-bearing errors to a fixed safe code with no retry', async () => {
    let attempts = 0;
    const transport = fakeTransport({
      call: async () => {
        attempts += 1;
        throw new Error('SECRET token');
      },
    });
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });

    await assert.rejects(adapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_TRANSPORT_FAILED'));
    assert.equal(attempts, 1);
  });

  it('times out once and absorbs a late rejection', async () => {
    let rejectLate;
    let attempts = 0;
    const late = new Promise((resolve, reject) => { rejectLate = reject; });
    const transport = fakeTransport({
      call: async () => {
        attempts += 1;
        return late;
      },
    });
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 5 });
    const unhandled = [];
    const listener = reason => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      await assert.rejects(adapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_DEADLINE_EXCEEDED'));
      rejectLate(new Error('LATE_SECRET_SENTINEL'));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(attempts, 1);
      assert.deepEqual(unhandled, []);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('releases a remote object that resolves after the deadline', async () => {
    let resolveLate;
    const late = new Promise(resolve => { resolveLate = resolve; });
    const transport = fakeTransport({ call: async () => late });
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 5 });

    await assert.rejects(adapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_DEADLINE_EXCEEDED'));
    resolveLate({ result: { objectId: 'late-remote' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(transport.releases, ['late-remote']);
  });

  it('fails closed on pre-call and post-call context drift', async () => {
    const before = fakeTransport({ getContext: async () => ({ ...CONTEXT, targetId: 'other' }) });
    const beforeAdapter = createCdpReadAdapter({ transport: before, expectedContext: CONTEXT, deadlineMs: 50 });
    await assert.rejects(beforeAdapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_CONTEXT_MISMATCH'));
    assert.equal(before.calls.length, 0);

    let reads = 0;
    const after = fakeTransport({
      getContext: async () => (++reads === 1 ? { ...CONTEXT } : { ...CONTEXT, sessionId: 'drift' }),
    });
    const afterAdapter = createCdpReadAdapter({ transport: after, expectedContext: CONTEXT, deadlineMs: 50 });
    await assert.rejects(afterAdapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_CONTEXT_MISMATCH'));
    assert.equal(after.calls.length, 1);
    assert.deepEqual(after.releases, ['remote-1']);
  });

  it('guards transport capabilities again at execution time', async () => {
    const transport = fakeTransport();
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });
    transport.call = null;
    await assert.rejects(adapter.read('Runtime.evaluate', {}), assertCode('E2E_ADAPTER_CAPABILITY_UNAVAILABLE'));
  });

  it('maps a throwing capability accessor to a fixed safe error', async () => {
    const transport = fakeTransport();
    Object.defineProperty(transport, 'call', {
      configurable: true,
      get() { throw new Error('SECRET getter'); },
    });
    const adapter = createCdpReadAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });
    await assert.rejects(
      adapter.read('Runtime.evaluate', {}),
      assertCode('E2E_ADAPTER_CAPABILITY_UNAVAILABLE'),
    );
  });

  it('Pine facade adapter uses an allowlist and performs one request', async () => {
    const transport = fakeTransport();
    const adapter = createPineFacadeAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });
    assert.deepEqual(await adapter.request('check', { source: 'indicator("x")' }), { ok: true });
    assert.equal(transport.calls.length, 1);
    await assert.rejects(adapter.request('delete', {}), assertCode('E2E_ADAPTER_CAPABILITY_DENIED'));
  });

  it('keyboard always attempts keyUp when keyDown fails', async () => {
    const events = [];
    const transport = fakeTransport({
      call: async (method, params) => {
        events.push({ method, params });
        if (params.type === 'keyDown') throw new Error('SECRET keydown failure');
        return {};
      },
    });
    const keyboard = createKeyboardAdapter({ transport, expectedContext: CONTEXT, deadlineMs: 50 });

    await assert.rejects(keyboard.press({ key: 'Escape', code: 'Escape' }), assertCode('E2E_ADAPTER_TRANSPORT_FAILED'));
    assert.deepEqual(events.map(event => event.params.type), ['keyDown', 'keyUp']);
  });
});
