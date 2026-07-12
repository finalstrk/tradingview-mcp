import { evaluate as defaultEvaluate } from './connection.js';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_STABLE_CHECKS = 2;

export class ChartReadinessError extends Error {
  constructor(message, { code, requested, observed, timeoutMs, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code || 'CHART_READINESS_ERROR';
    this.requested = requested || null;
    this.observed = observed || null;
    if (timeoutMs !== undefined) this.timeout_ms = timeoutMs;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      requested: this.requested,
      observed: this.observed,
      ...(this.timeout_ms === undefined ? {} : { timeout_ms: this.timeout_ms }),
    };
  }
}

export class ChartReadinessTimeoutError extends ChartReadinessError {
  constructor(requested, observed, timeoutMs, cause) {
    const observedLabel = observed
      ? `${observed.symbol || '<empty>'}/${observed.timeframe || '<empty>'}`
      : '<unknown>/<unknown>';
    super(
      `Chart did not reach ${requested.symbol || '<any>'}/${requested.timeframe || '<any>'} within ${timeoutMs} ms; observed ${observedLabel}`,
      {
        code: 'CHART_READINESS_TIMEOUT',
        requested,
        observed,
        timeoutMs,
        cause,
      },
    );
  }
}

export class ChartReadinessAbortError extends ChartReadinessError {
  constructor(requested, observed, cause) {
    super('Chart readiness wait was aborted', {
      code: 'CHART_READINESS_ABORTED',
      requested,
      observed,
      cause,
    });
  }
}

export function normalizeChartSymbol(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeChartTimeframe(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized === 'D') return '1D';
  if (normalized === 'W') return '1W';
  if (normalized === 'M') return '1M';
  return normalized;
}

function normalizeObservedState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const barCount = Number(source.bar_count ?? source.barCount ?? 0);
  return {
    api_available: source.api_available === true,
    symbol: String(source.symbol ?? ''),
    timeframe: String(source.timeframe ?? ''),
    bar_count: Number.isFinite(barCount) && barCount > 0 ? barCount : 0,
    bars_fingerprint: source.bars_fingerprint == null ? null : String(source.bars_fingerprint),
    ...(source.error == null ? {} : { error: String(source.error) }),
  };
}

export function chartStateMatches(state, expectedSymbol = null, expectedTimeframe = null) {
  const observed = normalizeObservedState(state);
  const observedSymbol = normalizeChartSymbol(observed.symbol);
  const observedTimeframe = normalizeChartTimeframe(observed.timeframe);
  const requestedSymbol = normalizeChartSymbol(expectedSymbol);
  const requestedTimeframe = normalizeChartTimeframe(expectedTimeframe);

  if (!observed.api_available || observed.bar_count <= 0) return false;
  // Unknown chart identity is never authoritative, even when a caller omitted
  // one side of the expected state for backward compatibility.
  if (!observedSymbol || !observedTimeframe) return false;
  if (requestedSymbol && observedSymbol !== requestedSymbol) return false;
  if (requestedTimeframe && observedTimeframe !== requestedTimeframe) return false;
  return true;
}

export async function readChartState({
  evaluate = defaultEvaluate,
  signal,
  timeoutMs,
} = {}) {
  const observed = await evaluate(`
    (() => {
      try {
        const chart = window.TradingViewApi?._activeChartWidgetWV?.value?.();
        if (!chart) {
          return { api_available: false, symbol: '', timeframe: '', bar_count: 0 };
        }
        const bars = chart._chartWidget?.model?.()?.mainSeries?.()?.bars?.();
        const rawCount = Number(bars?.size?.() ?? 0);
        const barCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
        let firstIndex = null;
        let lastIndex = null;
        let completedBar = null;
        try {
          firstIndex = bars?.firstIndex?.() ?? null;
          lastIndex = bars?.lastIndex?.() ?? null;
          const completedIndex = lastIndex == null ? null : Math.max(firstIndex ?? lastIndex, lastIndex - 1);
          const completed = completedIndex == null ? null : bars?.valueAt?.(completedIndex);
          completedBar = Array.isArray(completed) ? completed : null;
        } catch {}
        return {
          api_available: true,
          symbol: String(chart.symbol?.() ?? ''),
          timeframe: String(chart.resolution?.() ?? ''),
          bar_count: barCount,
          bars_fingerprint: [barCount, firstIndex, lastIndex, JSON.stringify(completedBar)].join(':'),
        };
      } catch (error) {
        return {
          api_available: false,
          symbol: '',
          timeframe: '',
          bar_count: 0,
          error: String(error?.message ?? error),
        };
      }
    })()
  `, { signal, ...(timeoutMs === undefined ? {} : { timeoutMs }) });
  return normalizeObservedState(observed);
}

function abortableSleep(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason || new Error('aborted'));
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason || new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
  });
}

function requestedState(expectedSymbol, expectedTimeframe) {
  return {
    symbol: normalizeChartSymbol(expectedSymbol),
    timeframe: normalizeChartTimeframe(expectedTimeframe),
  };
}

function isAbortError(error, signal) {
  return signal?.aborted
    || error?.code === 'CDP_OPERATION_ABORTED'
    || error?.code === 'CHART_READINESS_ABORTED'
    || error?.name === 'AbortError';
}

export async function waitForChartReady(
  expectedSymbol = null,
  expectedTimeframe = null,
  timeout = DEFAULT_TIMEOUT_MS,
  options = {},
) {
  const timeoutMs = Number(timeout);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`timeout must be a positive finite number, got: ${timeout}`);
  }
  const pollIntervalMs = Number(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  const stableChecks = Number(options.stableChecks ?? DEFAULT_STABLE_CHECKS);
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new RangeError(`pollIntervalMs must be a positive finite number, got: ${pollIntervalMs}`);
  }
  if (!Number.isInteger(stableChecks) || stableChecks < 1) {
    throw new RangeError(`stableChecks must be a positive integer, got: ${stableChecks}`);
  }

  const evaluate = options.evaluate || defaultEvaluate;
  const now = options.now || Date.now;
  const sleep = options.sleep || abortableSleep;
  const signal = options.signal;
  const requested = requestedState(expectedSymbol, expectedTimeframe);
  const startedAt = now();
  let stableCount = 0;
  let stableFingerprint = null;
  let observed = null;
  let lastError;
  const baselineFingerprint = options.baselineFingerprint == null
    ? null
    : String(options.baselineFingerprint);
  const requireFingerprintChange = options.requireFingerprintChange === true;

  while (now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new ChartReadinessAbortError(requested, observed, signal.reason);
    try {
      observed = await readChartState({
        evaluate,
        signal,
        timeoutMs: Math.max(1, timeoutMs - (now() - startedAt)),
      });
      lastError = undefined;
    } catch (error) {
      if (isAbortError(error, signal)) {
        throw new ChartReadinessAbortError(requested, observed, signal?.reason || error);
      }
      lastError = error;
      observed = normalizeObservedState({
        api_available: false,
        error: error?.message || String(error),
      });
    }

    const observedFingerprint = observed?.bars_fingerprint == null
      ? null
      : String(observed.bars_fingerprint);
    const fingerprintReady = Boolean(observedFingerprint)
      && (!requireFingerprintChange
        || (baselineFingerprint !== null && observedFingerprint !== baselineFingerprint));
    if (chartStateMatches(observed, requested.symbol, requested.timeframe) && fingerprintReady) {
      if (observedFingerprint === stableFingerprint) {
        stableCount += 1;
      } else {
        stableFingerprint = observedFingerprint;
        stableCount = 1;
      }
      if (stableCount >= stableChecks) return observed;
    } else {
      stableCount = 0;
      stableFingerprint = null;
    }

    const remaining = timeoutMs - (now() - startedAt);
    if (remaining <= 0) break;
    try {
      await sleep(Math.min(pollIntervalMs, remaining), signal);
    } catch (error) {
      throw new ChartReadinessAbortError(requested, observed, signal?.reason || error);
    }
  }

  throw new ChartReadinessTimeoutError(requested, observed, timeoutMs, lastError);
}
