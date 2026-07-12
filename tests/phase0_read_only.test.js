import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Phase0ReadOnlyError,
  createPhase0ReadOnlyPlan,
  runPhase0ReadOnly,
} from '../src/e2e/phase0_read_only.js';

const CONTEXT = Object.freeze({
  targetId: 'SECRET_TARGET',
  sessionId: 'SECRET_SESSION',
  executionContextId: 9,
});

function transportFor(value, overrides = {}) {
  const calls = [];
  return {
    calls,
    async getContext() { return { ...CONTEXT }; },
    async call(method, params, context) {
      calls.push({ method, params, context });
      return { result: { value } };
    },
    async releaseObject() {},
    mutate() { throw new Error('mutation capability must not be reached'); },
    request() { throw new Error('network capability must not be reached'); },
    dispatchInput() { throw new Error('Input capability must not be reached'); },
    reload() { throw new Error('Page capability must not be reached'); },
    openTab() { throw new Error('tab capability must not be reached'); },
    spawn() { throw new Error('process capability must not be reached'); },
    ...overrides,
  };
}

function target(transport) {
  return { transport, expectedContext: CONTEXT };
}

function assertCode(code) {
  return error => {
    assert.ok(error instanceof Phase0ReadOnlyError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal('cause' in error, false);
    assert.equal(JSON.stringify(error).includes('SECRET'), false);
    return true;
  };
}

describe('Phase 0b read-only planner and runner', () => {
  it('runs one fixed read per explicit target and emits only the fixed safe schema', async () => {
    const first = transportFor({
      readable: true,
      state: 'known',
      baseline_comparable: true,
      code: 'PHASE0_STATE_READ',
      counts: { studies: 8, drawings: 0 },
    });
    const second = transportFor({
      readable: false,
      state: 'unknown',
      baseline_comparable: false,
      code: 'PHASE0_STATE_UNAVAILABLE',
      counts: {},
    });
    const plan = createPhase0ReadOnlyPlan({
      targets: [target(first), target(second)],
      deadlineMs: 50,
    });

    const result = await runPhase0ReadOnly(plan);

    assert.deepEqual(result, {
      ok: true,
      code: 'PHASE0_READ_ONLY_COMPLETE',
      counts: { targets: 2, readable: 1, known: 1, baseline_comparable: 1, cdp_reads: 2 },
      snapshots: [
        {
          readable: true,
          state: 'known',
          baseline_comparable: true,
          code: 'PHASE0_STATE_READ',
          counts: { drawings: 0, studies: 8 },
        },
        {
          readable: false,
          state: 'unknown',
          baseline_comparable: false,
          code: 'PHASE0_STATE_UNAVAILABLE',
          counts: {},
        },
      ],
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.snapshots), true);
    assert.equal(Object.isFrozen(result.snapshots[0].counts), true);
    for (const current of [first, second]) {
      assert.equal(current.calls.length, 1);
      assert.equal(current.calls[0].method, 'Runtime.evaluate');
      assert.equal(current.calls[0].params.returnByValue, true);
      assert.equal(current.calls[0].params.awaitPromise, false);
    }
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('SECRET_TARGET'), false);
    assert.equal(serialized.includes('SECRET_SESSION'), false);
    assert.equal(serialized.includes('expression'), false);
  });

  it('does not expose target identity or transports through the opaque plan', () => {
    const transport = transportFor({});
    const plan = createPhase0ReadOnlyPlan({ targets: [target(transport)], deadlineMs: 50 });

    assert.deepEqual(Reflect.ownKeys(plan), []);
    assert.equal(JSON.stringify(plan), '{}');
    assert.equal(JSON.stringify(plan).includes('SECRET'), false);
  });

  it('rejects unknown configuration and capability requests before any read', () => {
    const transport = transportFor({});
    assert.throws(
      () => createPhase0ReadOnlyPlan({ targets: [target(transport)], deadlineMs: 50, network: true }),
      assertCode('PHASE0_INVALID_CONFIGURATION'),
    );
    for (const forbidden of ['mutation', 'network', 'keyboard', 'input', 'page', 'tab', 'process']) {
      assert.throws(
        () => createPhase0ReadOnlyPlan({
          targets: [{ ...target(transport), capabilities: [forbidden] }],
          deadlineMs: 50,
        }),
        assertCode('PHASE0_CAPABILITY_DENIED'),
      );
    }
    assert.equal(transport.calls.length, 0);
  });

  it('fails closed without returning raw source, identity, errors, or unknown fields', async () => {
    const sentinel = 'SECRET_SOURCE_IDENTITY';
    const malicious = transportFor({
      readable: true,
      state: 'known',
      baseline_comparable: true,
      code: 'PHASE0_STATE_READ',
      counts: { studies: 1 },
      source: sentinel,
    });
    const plan = createPhase0ReadOnlyPlan({ targets: [target(malicious)], deadlineMs: 50 });

    await assert.rejects(runPhase0ReadOnly(plan), assertCode('PHASE0_UNSAFE_SNAPSHOT'));
  });

  it('fails closed on accessors, proxies, invalid enums, and unsafe counts', async () => {
    const samples = [
      new Proxy({}, {}),
      Object.defineProperty({}, 'readable', { enumerable: true, get() { return true; } }),
      { readable: true, state: 'maybe', baseline_comparable: false, code: 'PHASE0_STATE_READ', counts: {} },
      { readable: true, state: 'known', baseline_comparable: false, code: 'RAW_SECRET', counts: {} },
      { readable: true, state: 'known', baseline_comparable: false, code: 'PHASE0_STATE_READ', counts: { x: -1 } },
      { readable: true, state: 'known', baseline_comparable: false, code: 'PHASE0_STATE_READ', counts: { source: 1 } },
    ];

    for (const sample of samples) {
      const transport = transportFor(sample);
      const plan = createPhase0ReadOnlyPlan({ targets: [target(transport)], deadlineMs: 50 });
      await assert.rejects(runPhase0ReadOnly(plan), assertCode('PHASE0_UNSAFE_SNAPSHOT'));
    }
  });

  it('degrades transport failures to an explicit unknown snapshot and performs no retry', async () => {
    let attempts = 0;
    const transport = transportFor({}, {
      async call() {
        attempts += 1;
        throw new Error('SECRET transport failure');
      },
    });
    const plan = createPhase0ReadOnlyPlan({ targets: [target(transport)], deadlineMs: 50 });

    assert.deepEqual(await runPhase0ReadOnly(plan), {
      ok: true,
      code: 'PHASE0_READ_ONLY_COMPLETE',
      counts: { targets: 1, readable: 0, known: 0, baseline_comparable: 0, cdp_reads: 1 },
      snapshots: [{
        readable: false,
        state: 'unknown',
        baseline_comparable: false,
        code: 'PHASE0_STATE_UNAVAILABLE',
        counts: {},
      }],
    });
    assert.equal(attempts, 1);
  });

  it('rejects plan reuse so a target cannot be read twice accidentally', async () => {
    const transport = transportFor({
      readable: true,
      state: 'known',
      baseline_comparable: false,
      code: 'PHASE0_STATE_READ',
      counts: {},
    });
    const plan = createPhase0ReadOnlyPlan({ targets: [target(transport)], deadlineMs: 50 });

    await runPhase0ReadOnly(plan);
    await assert.rejects(runPhase0ReadOnly(plan), assertCode('PHASE0_PLAN_ALREADY_USED'));
    assert.equal(transport.calls.length, 1);
  });
});
