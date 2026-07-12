import { types as utilTypes } from 'node:util';

const IDENTIFIER_LIMIT = 256;
const MIN_DEADLINE_MS = 1;
const MAX_DEADLINE_MS = 30_000;

export class AdapterError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AdapterError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

export function fail(code) {
  return new AdapterError(code);
}

function validIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= IDENTIFIER_LIMIT;
}

export function normalizeOptions(options) {
  if (!options || typeof options !== 'object') throw fail('E2E_ADAPTER_INVALID_CONFIGURATION');
  const { transport, expectedContext, deadlineMs } = options;
  if (!transport || typeof transport !== 'object') throw fail('E2E_ADAPTER_INVALID_CONFIGURATION');
  if (
    !expectedContext
    || typeof expectedContext !== 'object'
    || !validIdentifier(expectedContext.targetId)
    || !validIdentifier(expectedContext.sessionId)
    || !Number.isSafeInteger(expectedContext.executionContextId)
    || expectedContext.executionContextId < 0
  ) {
    throw fail('E2E_ADAPTER_INVALID_CONFIGURATION');
  }
  if (!Number.isInteger(deadlineMs) || deadlineMs < MIN_DEADLINE_MS || deadlineMs > MAX_DEADLINE_MS) {
    throw fail('E2E_ADAPTER_INVALID_CONFIGURATION');
  }
  return Object.freeze({
    transport,
    expectedContext: Object.freeze({ ...expectedContext }),
    deadlineMs,
  });
}

export function assertSafeArgument(value) {
  const seen = new Set();
  let nodes = 0;
  let stringUnits = 0;

  function inspect(current, depth) {
    if (current === null || typeof current === 'boolean') return true;
    if (typeof current === 'number') return Number.isFinite(current);
    if (typeof current === 'string') {
      stringUnits += current.length;
      return stringUnits <= 1_100_000;
    }
    if (typeof current !== 'object' || utilTypes.isProxy(current)) return false;
    if (seen.has(current) || depth > 8 || ++nodes > 2_048) return false;
    seen.add(current);

    const prototype = Object.getPrototypeOf(current);
    if (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null) return false;
    let keys;
    let descriptors;
    try {
      keys = Reflect.ownKeys(current);
      descriptors = Object.getOwnPropertyDescriptors(current);
    } catch {
      return false;
    }
    if (keys.length > 2_048 || keys.some(key => typeof key !== 'string')) return false;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      if (!inspect(descriptor.value, depth + 1)) return false;
    }
    return true;
  }

  if (!inspect(value, 0)) throw fail('E2E_ADAPTER_INVALID_ARGUMENT');
}

export function matchesContext(actual, expected) {
  return Boolean(
    actual
    && typeof actual === 'object'
    && actual.targetId === expected.targetId
    && actual.sessionId === expected.sessionId
    && actual.executionContextId === expected.executionContextId
  );
}

function getCapability(transport, name) {
  let method;
  try {
    method = transport[name];
  } catch {
    throw fail('E2E_ADAPTER_CAPABILITY_UNAVAILABLE');
  }
  if (typeof method !== 'function') throw fail('E2E_ADAPTER_CAPABILITY_UNAVAILABLE');
  return method;
}

export function remaining(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

export async function bounded(operation, deadlineAt, onLateResolution) {
  const available = remaining(deadlineAt);
  if (available <= 0) throw fail('E2E_ADAPTER_DEADLINE_EXCEEDED');

  let timer;
  let timedOut = false;
  const promise = Promise.resolve().then(operation);
  promise.then(
    value => {
      if (timedOut && typeof onLateResolution === 'function') {
        Promise.resolve(onLateResolution(value)).catch(() => {});
      }
    },
    () => {},
  );

  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(fail('E2E_ADAPTER_DEADLINE_EXCEEDED'));
        }, available);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readContext(options, deadlineAt) {
  const getContext = getCapability(options.transport, 'getContext');
  let actual;
  try {
    actual = await bounded(() => Reflect.apply(getContext, options.transport, []), deadlineAt);
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw fail('E2E_ADAPTER_CONTEXT_UNAVAILABLE');
  }
  if (!matchesContext(actual, options.expectedContext)) {
    throw fail('E2E_ADAPTER_CONTEXT_MISMATCH');
  }
}

export function collectRemoteObjectIds(value) {
  const ids = new Set();
  const seen = new Set();
  const queue = [value];
  let inspected = 0;
  while (queue.length > 0 && inspected < 128) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    inspected += 1;
    if (validIdentifier(current.objectId)) ids.add(current.objectId);
    for (const item of Object.values(current)) queue.push(item);
  }
  return [...ids];
}

export async function releaseRemoteObjects(transport, value, deadlineAt, { bestEffort = false } = {}) {
  const ids = collectRemoteObjectIds(value);
  if (ids.length === 0) return;
  let releaseObject;
  try {
    releaseObject = getCapability(transport, 'releaseObject');
  } catch (error) {
    if (bestEffort) return;
    throw error;
  }
  try {
    for (const objectId of ids) {
      await bounded(() => Reflect.apply(releaseObject, transport, [objectId]), deadlineAt);
    }
  } catch (error) {
    if (bestEffort) return;
    if (error instanceof AdapterError) throw error;
    throw fail('E2E_ADAPTER_RELEASE_FAILED');
  }
}

export async function executeTransportCall(options, capability, args, releaseObjects = true) {
  const deadlineAt = Date.now() + options.deadlineMs;
  await readContext(options, deadlineAt);
  const transportMethod = getCapability(options.transport, capability);

  let result;
  try {
    result = await bounded(
      () => Reflect.apply(transportMethod, options.transport, args),
      deadlineAt,
      releaseObjects
        ? value => releaseRemoteObjects(options.transport, value, Date.now() + options.deadlineMs, { bestEffort: true })
        : undefined,
    );
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw fail('E2E_ADAPTER_TRANSPORT_FAILED');
  }

  try {
    if (releaseObjects) await releaseRemoteObjects(options.transport, result, deadlineAt);
    await readContext(options, deadlineAt);
    return result;
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    throw fail('E2E_ADAPTER_TRANSPORT_FAILED');
  }
}
