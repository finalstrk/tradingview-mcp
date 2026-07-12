import { types as utilTypes } from 'node:util';
import { createCdpReadAdapter } from './cdp_read_adapter.js';

const PLAN_STATE = new WeakMap();
const MAX_TARGETS = 32;
const MAX_COUNT = 1_000_000;
const ALLOWED_CODES = new Set([
  'PHASE0_STATE_READ',
  'PHASE0_STATE_UNAVAILABLE',
]);
const ALLOWED_COUNT_KEYS = new Set([
  'drawings',
  'editors',
  'panels',
  'replays',
  'studies',
]);
const FORBIDDEN_CAPABILITIES = new Set([
  'mutation',
  'network',
  'keyboard',
  'input',
  'page',
  'tab',
  'process',
]);

// This is the only expression the Phase 0b runner can issue. It projects
// bounded counts from the already-open chart without mutating page state, and
// the runner independently validates the result before exposing it.
const FIXED_SNAPSHOT_EXPRESSION = `(() => {
  const unavailable = () => ({
    readable: false,
    state: 'unknown',
    baseline_comparable: false,
    code: 'PHASE0_STATE_UNAVAILABLE',
    counts: {},
  });
  try {
    const chart = globalThis.TradingViewApi?._activeChartWidgetWV?.value?.();
    const model = chart?._chartWidget?.model?.();
    if (!model) return unavailable();
    const counts = {};
    const collect = (key, operation) => {
      try {
        const value = operation();
        const count = Array.isArray(value)
          ? value.length
          : Number.isSafeInteger(value?.length)
            ? value.length
            : Number.isSafeInteger(value?.size)
              ? value.size
              : undefined;
        if (Number.isSafeInteger(count) && count >= 0 && count <= 1000000) counts[key] = count;
      } catch {}
    };
    collect('studies', () => model.studies?.());
    collect('drawings', () => model.allShapes?.());
    collect('panels', () => model.panes?.());
    return {
      readable: true,
      state: 'known',
      baseline_comparable: true,
      code: 'PHASE0_STATE_READ',
      counts,
    };
  } catch {
    return unavailable();
  }
})()`;
const FIXED_READ_PARAMS = Object.freeze({
  expression: FIXED_SNAPSHOT_EXPRESSION,
  returnByValue: true,
  awaitPromise: false,
});

export class Phase0ReadOnlyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'Phase0ReadOnlyError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

function fail(code) {
  return new Phase0ReadOnlyError(code);
}

function plainDataObject(value) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(value).every(key => (
      typeof key === 'string'
      && descriptors[key]?.enumerable === true
      && Object.hasOwn(descriptors[key], 'value')
    ));
  } catch {
    return false;
  }
}

function exactKeys(value, expected) {
  if (!plainDataObject(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function copyContext(context) {
  if (!exactKeys(context, ['executionContextId', 'sessionId', 'targetId'])) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  const { targetId, sessionId, executionContextId } = context;
  if (
    typeof targetId !== 'string'
    || targetId.length === 0
    || targetId.length > 256
    || typeof sessionId !== 'string'
    || sessionId.length === 0
    || sessionId.length > 256
    || !Number.isSafeInteger(executionContextId)
    || executionContextId < 0
  ) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  return Object.freeze({ targetId, sessionId, executionContextId });
}

function normalizeTarget(value) {
  if (!plainDataObject(value)) throw fail('PHASE0_INVALID_CONFIGURATION');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.hasOwn(descriptors, 'capabilities')) {
    const requested = descriptors.capabilities.value;
    if (
      Array.isArray(requested)
      && requested.some(capability => FORBIDDEN_CAPABILITIES.has(capability))
    ) {
      throw fail('PHASE0_CAPABILITY_DENIED');
    }
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  if (!exactKeys(value, ['expectedContext', 'transport'])) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  const transport = descriptors.transport.value;
  if (!transport || (typeof transport !== 'object' && typeof transport !== 'function')) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  return Object.freeze({
    transport,
    expectedContext: copyContext(descriptors.expectedContext.value),
  });
}

/**
 * Build an opaque, single-use Phase 0b plan for an explicit target set.
 * Target identities and transports are retained only in module-private state.
 */
export function createPhase0ReadOnlyPlan(configuration) {
  if (!exactKeys(configuration, ['deadlineMs', 'targets'])) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }
  const { targets, deadlineMs } = configuration;
  if (
    !Array.isArray(targets)
    || targets.length < 1
    || targets.length > MAX_TARGETS
    || !Number.isInteger(deadlineMs)
    || deadlineMs < 1
    || deadlineMs > 30_000
  ) {
    throw fail('PHASE0_INVALID_CONFIGURATION');
  }

  const normalizedTargets = targets.map(normalizeTarget);
  const plan = Object.freeze(Object.create(null));
  PLAN_STATE.set(plan, {
    used: false,
    deadlineMs,
    targets: normalizedTargets,
  });
  return plan;
}

function sanitizeCounts(value) {
  if (!plainDataObject(value)) throw fail('PHASE0_UNSAFE_SNAPSHOT');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  if (keys.length > ALLOWED_COUNT_KEYS.size) throw fail('PHASE0_UNSAFE_SNAPSHOT');
  const copy = {};
  for (const key of keys) {
    const count = descriptors[key].value;
    if (
      !ALLOWED_COUNT_KEYS.has(key)
      || !Number.isSafeInteger(count)
      || count < 0
      || count > MAX_COUNT
    ) {
      throw fail('PHASE0_UNSAFE_SNAPSHOT');
    }
    copy[key] = count;
  }
  return Object.freeze(copy);
}

function sanitizeSnapshot(value) {
  if (!exactKeys(value, ['baseline_comparable', 'code', 'counts', 'readable', 'state'])) {
    throw fail('PHASE0_UNSAFE_SNAPSHOT');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const readable = descriptors.readable.value;
  const state = descriptors.state.value;
  const baselineComparable = descriptors.baseline_comparable.value;
  const code = descriptors.code.value;
  if (
    typeof readable !== 'boolean'
    || (state !== 'known' && state !== 'unknown')
    || typeof baselineComparable !== 'boolean'
    || !ALLOWED_CODES.has(code)
    || (state === 'unknown' && baselineComparable)
    || (!readable && (state !== 'unknown' || code !== 'PHASE0_STATE_UNAVAILABLE'))
  ) {
    throw fail('PHASE0_UNSAFE_SNAPSHOT');
  }
  return Object.freeze({
    readable,
    state,
    baseline_comparable: baselineComparable,
    code,
    counts: sanitizeCounts(descriptors.counts.value),
  });
}

function extractSnapshot(response) {
  if (!exactKeys(response, ['result'])) throw fail('PHASE0_UNSAFE_SNAPSHOT');
  const result = Object.getOwnPropertyDescriptor(response, 'result').value;
  if (!plainDataObject(result)) throw fail('PHASE0_UNSAFE_SNAPSHOT');
  const descriptors = Object.getOwnPropertyDescriptors(result);
  const keys = Object.keys(descriptors);
  if (!keys.includes('value')) throw fail('PHASE0_UNSAFE_SNAPSHOT');
  if (keys.some(key => key !== 'value' && key !== 'objectId')) {
    throw fail('PHASE0_UNSAFE_SNAPSHOT');
  }
  return sanitizeSnapshot(descriptors.value.value);
}

function unavailableSnapshot() {
  return Object.freeze({
    readable: false,
    state: 'unknown',
    baseline_comparable: false,
    code: 'PHASE0_STATE_UNAVAILABLE',
    counts: Object.freeze({}),
  });
}

/** Run an opaque plan once, issuing only createCdpReadAdapter().read(). */
export async function runPhase0ReadOnly(plan) {
  const state = PLAN_STATE.get(plan);
  if (!state) throw fail('PHASE0_INVALID_PLAN');
  if (state.used) throw fail('PHASE0_PLAN_ALREADY_USED');
  state.used = true;

  const snapshots = [];
  for (const target of state.targets) {
    try {
      const readAdapter = createCdpReadAdapter({
        transport: target.transport,
        expectedContext: target.expectedContext,
        deadlineMs: state.deadlineMs,
      });
      const response = await readAdapter.read('Runtime.evaluate', FIXED_READ_PARAMS);
      snapshots.push(extractSnapshot(response));
    } catch (error) {
      if (error instanceof Phase0ReadOnlyError) throw error;
      snapshots.push(unavailableSnapshot());
    }
  }

  const frozenSnapshots = Object.freeze(snapshots);
  const counts = Object.freeze({
    targets: frozenSnapshots.length,
    readable: frozenSnapshots.filter(snapshot => snapshot.readable).length,
    known: frozenSnapshots.filter(snapshot => snapshot.state === 'known').length,
    baseline_comparable: frozenSnapshots.filter(snapshot => snapshot.baseline_comparable).length,
    cdp_reads: frozenSnapshots.length,
  });
  return Object.freeze({
    ok: true,
    code: 'PHASE0_READ_ONLY_COMPLETE',
    counts,
    snapshots: frozenSnapshots,
  });
}
