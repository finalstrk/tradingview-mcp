import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OWNER_OPERATION_REGISTRY,
  OWNER_OPERATION_REGISTRY_SHA256,
  createOwnerOperationBridge,
} from '../src/e2e/owner_operation_registry.js';

const context = Object.freeze({ targetId: 'fixed-target', sessionId: 'fixed-session', executionContextId: 7 });

test('registry fixes kind, budget, method, arguments and schema for every owner operation', () => {
  assert.match(OWNER_OPERATION_REGISTRY_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(Object.keys(OWNER_OPERATION_REGISTRY).length, 11);
  for (const [id, operation] of Object.entries(OWNER_OPERATION_REGISTRY)) {
    assert.match(id, /^owner\./);
    assert.ok(['cdp', 'network', 'child-process'].includes(operation.kind));
    assert.ok(['cdp_calls', 'network_requests', 'child_processes'].includes(operation.budget));
    assert.equal(typeof operation.method, 'string');
    assert.ok(Object.isFrozen(operation.args));
    assert.ok(Object.isFrozen(operation.result_schema));
  }
  const child = OWNER_OPERATION_REGISTRY['owner.pine_facade.4'];
  assert.equal(child.args.parameter0, 'node');
  assert.deepEqual(child.args.argv, ['pine', 'check']);
  assert.equal(child.kind, 'child-process');
  assert.equal(child.budget, 'child_processes');
  assert.equal(OWNER_OPERATION_REGISTRY['owner.launch.reuse.1'].args.kill_existing, false);
});

test('bridge passes only reviewed immutable descriptors and exact context to fake production transport', async () => {
  const calls = [];
  const transport = { async executeFixedOperation(id, operation, actualContext) {
    calls.push({ id, operation, actualContext });
    return { exit_code: 0, compiled: true, nested: { value: 1 } };
  }, async getContext() { return context; } };
  const bridge = createOwnerOperationBridge({ transport, expectedContext: context, deadlineMs: 50 });
  const result = await bridge.execute('owner.pine_facade.4');
  assert.deepEqual(result, { exit_code: 0, compiled: true, nested: { value: 1 } });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.nested));
  assert.equal(calls[0].operation, OWNER_OPERATION_REGISTRY['owner.pine_facade.4']);
  assert.deepEqual(calls[0].actualContext, context);
  assert.ok(Object.isFrozen(calls[0].actualContext));
});

test('bridge denies unknown operations, bounds hangs and sanitizes adapter failures', async () => {
  const base = executeFixedOperation => ({ executeFixedOperation, getContext: async () => context });
  const denied = createOwnerOperationBridge({ transport: base(async () => ({})), expectedContext: context, deadlineMs: 50 });
  await assert.rejects(denied.execute('attacker'), error => error.code === 'OWNER_OPERATION_DENIED');
  const failed = createOwnerOperationBridge({ transport: base(async () => { throw new Error('SECRET'); }), expectedContext: context, deadlineMs: 50 });
  await assert.rejects(failed.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_EXECUTION_FAILED' && !error.message.includes('SECRET'));
  const hanging = createOwnerOperationBridge({ transport: base(async () => new Promise(() => {})), expectedContext: context, deadlineMs: 5 });
  await assert.rejects(hanging.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_DEADLINE_EXCEEDED');
  const contextHang = createOwnerOperationBridge({ transport: { getContext: async () => new Promise(() => {}), executeFixedOperation: async () => ({}) }, expectedContext: context, deadlineMs: 5 });
  await assert.rejects(contextHang.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_DEADLINE_EXCEEDED');
});

test('bridge copies outputs and rejects functions, accessors, proxies and cycles', async () => {
  const original = { iterations: 20, mismatches: 0, chart_mutations: 0, disconnects: 1, price_fields_leaked: 0, value: { count: 1 } };
  const bridge = createOwnerOperationBridge({ transport: { executeFixedOperation: async () => original, getContext: async () => context }, expectedContext: context, deadlineMs: 50 });
  const result = await bridge.execute('owner.quote.1');
  assert.notEqual(result, original);
  assert.notEqual(result.value, original.value);
  for (const invalid of [
    { fn() {} },
    Object.defineProperty({}, 'secret', { enumerable: true, get() { return 'SECRET'; } }),
    new Proxy({}, {}),
    (() => { const value = {}; value.self = value; return value; })(),
  ]) {
    const bad = createOwnerOperationBridge({ transport: { executeFixedOperation: async () => invalid, getContext: async () => context }, expectedContext: context, deadlineMs: 50 });
    await assert.rejects(bad.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_RESULT_INVALID');
  }
});

test('bridge fails closed on context drift and result schema drift', async () => {
  let reads = 0;
  const drifting = createOwnerOperationBridge({
    transport: {
      getContext: async () => (++reads === 1 ? context : { ...context, sessionId: 'other' }),
      executeFixedOperation: async () => ({ iterations: 20, mismatches: 0, chart_mutations: 0, disconnects: 1, price_fields_leaked: 0 }),
    }, expectedContext: context, deadlineMs: 50,
  });
  await assert.rejects(drifting.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_CONTEXT_MISMATCH');
  const invalid = createOwnerOperationBridge({ transport: {
    getContext: async () => context,
    executeFixedOperation: async () => ({ iterations: 20 }),
  }, expectedContext: context, deadlineMs: 50 });
  await assert.rejects(invalid.execute('owner.quote.1'), error => error.code === 'OWNER_OPERATION_RESULT_INVALID');
});

test('owner source files have no direct raw external capability', async () => {
  for (const file of ['batch.js', 'quote.js', 'graphics.js', 'launch.js', 'pine_facade.js']) {
    const source = await readFile(new URL(`../src/e2e/cases/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|node:child_process|Runtime\.evaluate|execFile|spawn\s*\(|probeCdpEndpoint/);
  }
});
