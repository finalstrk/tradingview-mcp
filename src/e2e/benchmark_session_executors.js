export function createBenchmarkSessionExecutors({ legacy, candidate, sampleCount = 30 } = {}) {
  if (!legacy || !candidate || legacy === candidate
    || typeof legacy.runOne !== 'function'
    || typeof candidate.open !== 'function' || typeof candidate.verify !== 'function' || typeof candidate.close !== 'function'
    || legacy.runOne === candidate.open || !Number.isSafeInteger(sampleCount) || sampleCount < 30) {
    throw new TypeError('BENCHMARK_EXECUTOR_CONFIGURATION_INVALID');
  }
  let candidateOpen = false;
  let restored = false;
  return Object.freeze({
    async execute(phase, index, task) {
      if (restored || !['before', 'after'].includes(phase) || !Number.isSafeInteger(index)
        || index < 0 || index >= sampleCount || typeof task !== 'function') throw new TypeError('BENCHMARK_EXECUTOR_INVOCATION_INVALID');
      if (phase === 'before') return legacy.runOne(task);
      try {
        if (!candidateOpen) { await candidate.open(); candidateOpen = true; }
        await candidate.verify();
        const value = await task();
        await candidate.verify();
        if (index === sampleCount - 1) { await candidate.close(); candidateOpen = false; }
        return value;
      } catch (error) {
        if (candidateOpen) { try { await candidate.close(); } catch {} candidateOpen = false; }
        throw error;
      }
    },
    async restore() {
      restored = true;
      if (candidateOpen) { await candidate.close(); candidateOpen = false; }
      return true;
    },
  });
}
