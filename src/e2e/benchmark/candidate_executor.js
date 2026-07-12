export const executorId = 'tradingview-ready-state-reused-session-v1';

const REQUIRED_METHODS = Object.freeze([
  'close',
  'evaluateReadyStateLength',
  'open',
  'release',
  'verify',
]);

function requireCapability(capability) {
  if (!capability || typeof capability !== 'object'
    || REQUIRED_METHODS.some(method => typeof capability[method] !== 'function')) {
    throw new TypeError('CANDIDATE_EXECUTOR_CAPABILITY_INVALID');
  }
  return capability;
}

export function create(capability, sampleCount = 30) {
  const fixed = requireCapability(capability);
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 30) {
    throw new TypeError('CANDIDATE_EXECUTOR_SAMPLE_COUNT_INVALID');
  }
  let open = false;
  let restored = false;

  return Object.freeze({
    async execute(index) {
      if (restored || !Number.isSafeInteger(index) || index < 0 || index >= sampleCount) {
        throw new TypeError('CANDIDATE_EXECUTOR_INVOCATION_INVALID');
      }
      let remoteObjectId;
      try {
        if (!open) { await fixed.open(); open = true; }
        await fixed.verify();
        const evaluated = await fixed.evaluateReadyStateLength();
        if (!evaluated || typeof evaluated !== 'object'
          || typeof evaluated.objectId !== 'string' || evaluated.objectId.length === 0
          || !Number.isSafeInteger(evaluated.value) || evaluated.value < 0) {
          throw new TypeError('CANDIDATE_EXECUTOR_RESULT_INVALID');
        }
        remoteObjectId = evaluated.objectId;
        await fixed.release(remoteObjectId);
        remoteObjectId = undefined;
        await fixed.verify();
        if (index === sampleCount - 1) { await fixed.close(); open = false; }
        return evaluated.value;
      } catch (error) {
        if (remoteObjectId !== undefined) { try { await fixed.release(remoteObjectId); } catch {} }
        if (open) { try { await fixed.close(); } catch {} open = false; }
        throw error;
      }
    },
    async restore() {
      restored = true;
      if (open) { await fixed.close(); open = false; }
      return true;
    },
  });
}
