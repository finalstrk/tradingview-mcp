import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {
  CHART_OPERATION_REGISTRY,
  CHART_OPERATION_REGISTRY_SHA256,
  createChartOperationBridge,
} from '../src/e2e/chart_operation_registry.js';

const EXPECTED = Object.freeze({
  targetId: 'target', frameId: 'frame', loaderId: 'loader',
  uniqueContextId: 'context', sessionId: 'session',
});

function fixture() {
  const calls = [];
  const reviewedAdapters = Object.freeze({
    inspectIdentity: async () => ({ ...EXPECTED }),
    read: async (...args) => { calls.push(['read', ...args]); return { result: { value: true } }; },
    mutate: async (...args) => { calls.push(['mutate', ...args]); return { result: { value: true } }; },
    input: async (...args) => { calls.push(['input', ...args]); return {}; },
    capture: async (...args) => { calls.push(['capture', ...args]); return { data: 'AA==' }; },
    network: async (...args) => { calls.push(['network', ...args]); return { ok: true, status: 200, body: {} }; },
  });
  return { calls, reviewedAdapters };
}

test('registry is digest-bound and every entry has the complete reviewed contract', () => {
  assert.match(CHART_OPERATION_REGISTRY_SHA256, /^[a-f0-9]{64}$/);
  assert.ok(Object.keys(CHART_OPERATION_REGISTRY).length > 0);
  for (const [id, entry] of Object.entries(CHART_OPERATION_REGISTRY)) {
    assert.match(id, /^chart\.[a-z0-9_.-]+$/);
    assert.deepEqual(Object.keys(entry).sort(), [
      'budget_key', 'kind', 'method', 'params', 'result_schema',
    ]);
    assert.ok(['read', 'mutation', 'input', 'capture', 'network'].includes(entry.kind));
    assert.equal(typeof entry.method, 'string');
    assert.equal(typeof entry.budget_key, 'string');
    assert.equal(typeof entry.result_schema, 'string');
    assert.ok(Object.isFrozen(entry));
    if (entry.kind === 'read' || entry.kind === 'mutation') {
      assert.doesNotThrow(() => Function(`return (${entry.params.functionDeclaration})`));
      assert.doesNotMatch(entry.params.functionDeclaration, /\beval\s*\(|new\s+Function|Runtime\.evaluate/);
    }
  }
  assert.ok(Object.isFrozen(CHART_OPERATION_REGISTRY));
});

test('bridge accepts only an operation ID plus plain protocol values', async () => {
  const { calls, reviewedAdapters } = fixture();
  const bridge = createChartOperationBridge({ reviewedAdapters });
  await bridge.execute('chart.op.004', {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'read');
  assert.equal(calls[0][1], 'Runtime.callFunctionOn');
  assert.match(calls[0][2].functionDeclaration, /^function\(\)/);

  await assert.rejects(bridge.execute('unknown', {}), error => error?.code === 'CHART_OPERATION_DENIED');
  for (const args of [
    { expression: 'SECRET' }, Object.assign(Object.create(null), { extra: true }),
  ]) await assert.rejects(
    bridge.execute('chart.op.004', args),
    error => error?.code === 'CHART_OPERATION_ARGUMENT_INVALID',
  );
  assert.equal(JSON.stringify(calls).includes('SECRET'), false);
});

test('mutation uses one fixed callFunctionOn declaration and protocol arguments', async () => {
  const { calls, reviewedAdapters } = fixture();
  const bridge = createChartOperationBridge({ reviewedAdapters });
  await bridge.execute('chart.op.007', { p0: 'NASDAQ:AAPL' });
  assert.equal(calls[0][0], 'mutate');
  assert.equal(calls[0][1], 'Runtime.callFunctionOn');
  assert.match(calls[0][2].functionDeclaration, /^function\(p0\)/);
  assert.deepEqual(calls[0][2].arguments, [{ value: 'NASDAQ:AAPL' }]);
  assert.equal(JSON.stringify(calls[0]).includes('eval('), false);

  for (const args of [{}, { p0: () => {} }, { p0: new Proxy({}, {}) }]) {
    await assert.rejects(
      bridge.execute('chart.op.007', args),
      error => error?.code === 'CHART_OPERATION_ARGUMENT_INVALID',
    );
  }
});

test('result projection is secret-safe and does not retain adapter references', async () => {
  const secret = { result: { value: true }, apiKey: 'SECRET', fn() {} };
  const reviewedAdapters = Object.freeze({
    ...fixture().reviewedAdapters,
    read: async () => secret,
  });
  const result = await createChartOperationBridge({ reviewedAdapters })
    .execute('chart.op.004', {});
  assert.equal(result, true);
  assert.notEqual(result, secret);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('adapter failures are replaced without retaining secret-bearing causes', async () => {
  const reviewedAdapters = Object.freeze({
    ...fixture().reviewedAdapters,
    read: async () => { throw new Error('SECRET transport failure'); },
  });
  await assert.rejects(
    createChartOperationBridge({ reviewedAdapters }).execute('chart.op.004', {}),
    error => {
      assert.equal(error?.code, 'CHART_OPERATION_EXECUTION_FAILED');
      assert.equal(JSON.stringify(error).includes('SECRET'), false);
      assert.equal('cause' in error, false);
      return true;
    },
  );
});

test('fixed bottom-panel cleanup operations use close() once with no hidden fallback', () => {
  const closeOperationIds = [
    'chart.op.047', 'chart.op.050', 'chart.op.053',
    'chart.op.055', 'chart.op.085', 'chart.op.143',
  ];
  for (const id of closeOperationIds) {
    const declaration = CHART_OPERATION_REGISTRY[id].params.functionDeclaration;
    const calls = [];
    const sandbox = {
      window: {
        TradingView: {
          bottomWidgetBar: {
            close(...args) { calls.push(args); return true; },
            hide() { throw new Error('hide fallback is forbidden'); },
            hideWidget() { throw new Error('removed API must not be selected'); },
          },
        },
      },
    };

    vm.runInNewContext(`(${declaration})()`, sandbox);

    assert.deepEqual(calls, [[]], `${id} must call close exactly once with no arguments`);
    assert.doesNotMatch(declaration, /hideWidget|\.hide\s*\(/);
  }
});
