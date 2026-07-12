/**
 * Fail-closed, state-aware batch execution.
 */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluate as defaultEvaluate,
  evaluateAsync as defaultEvaluateAsync,
  getChartApi as defaultGetChartApi,
  getChartCollection as defaultGetChartCollection,
  sendCdpCommand as defaultSendCdpCommand,
  safeString,
} from '../connection.js';
import {
  chartStateMatches,
  normalizeChartSymbol,
  normalizeChartTimeframe,
  readChartState as defaultReadChartState,
  waitForChartReady as defaultWaitForChartReady,
} from '../wait.js';
import { getStrategyResults as defaultGetStrategyResults } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(dirname(dirname(__dirname)), 'screenshots');
const VALID_ACTIONS = new Set(['screenshot', 'get_ohlcv', 'get_strategy_results']);
const DEFAULT_READINESS_TIMEOUT_MS = 15000;
const DEFAULT_RESTORATION_TIMEOUT_MS = 15000;
const MAX_OHLCV_BARS = 500;

export class BatchError extends Error {
  constructor(code, message, { requested, observed, cause, ambiguous } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    if (requested !== undefined) this.requested = requested;
    if (observed !== undefined) this.observed = observed;
    if (ambiguous !== undefined) this.ambiguous = ambiguous;
  }
}

function defaultSleep(milliseconds, signal) {
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

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function fingerprint(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function requestedState(symbol, timeframe) {
  return {
    symbol: normalizeChartSymbol(symbol),
    timeframe: normalizeChartTimeframe(timeframe),
  };
}

function observedState(value) {
  if (!value || typeof value !== 'object') return null;
  const barCount = Number(value.bar_count ?? value.barCount ?? 0);
  return {
    symbol: normalizeChartSymbol(value.symbol),
    timeframe: normalizeChartTimeframe(value.timeframe),
    bar_count: Number.isFinite(barCount) && barCount > 0 ? barCount : 0,
  };
}

function barsFingerprint(value) {
  return value?.bars_fingerprint == null ? null : String(value.bars_fingerprint);
}

function chartIdentityMatches(value, requested) {
  return normalizeChartSymbol(value?.symbol) === requested.symbol
    && normalizeChartTimeframe(value?.timeframe) === requested.timeframe;
}

function assertReadinessResult(value, requested) {
  if (value === false || value == null) {
    throw new BatchError('CHART_READINESS_FAILED', 'Chart readiness returned a false or empty result', {
      requested,
    });
  }
  if (typeof value !== 'object') return value;
  if (value.success === false || Object.prototype.hasOwnProperty.call(value, 'error')) {
    throw new BatchError(
      'CHART_READINESS_FAILED',
      typeof value.error === 'string' && value.error ? value.error : 'Chart readiness returned an error result',
      { requested, observed: observedState(value) },
    );
  }
  if (Object.prototype.hasOwnProperty.call(value, 'api_available')
    && !chartStateMatches(value, requested.symbol, requested.timeframe)) {
    throw new BatchError('CHART_READINESS_FAILED', 'Chart readiness returned a mismatched state', {
      requested,
      observed: observedState(value),
    });
  }
  return value;
}

function serializeError(error, fallbackCode = 'BATCH_ROW_FAILED') {
  const source = error && typeof error === 'object' ? error : new Error(String(error));
  return {
    name: source.name || 'Error',
    code: source.code || fallbackCode,
    message: source.message || String(error),
    ...(source.requested === undefined ? {} : { requested: source.requested }),
    ...(source.observed === undefined ? {} : { observed: source.observed }),
    ...(source.ambiguous === undefined ? {} : { ambiguous: source.ambiguous }),
  };
}

function isCancellation(error, signal) {
  return signal?.aborted
    || error?.code === 'CHART_READINESS_ABORTED'
    || error?.code === 'CDP_OPERATION_ABORTED'
    || error?.name === 'AbortError';
}

function assertActionResult(value) {
  if (value === false) {
    throw new BatchError('BATCH_ACTION_SOFT_FAILURE', 'Action returned false');
  }
  if (value == null) {
    throw new BatchError('BATCH_ACTION_SOFT_FAILURE', 'Action returned no result');
  }
  if (typeof value === 'object' && value.success === false) {
    throw new BatchError(
      'BATCH_ACTION_SOFT_FAILURE',
      typeof value.error === 'string' && value.error ? value.error : 'Action returned success: false',
    );
  }
  if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'error')) {
    throw new BatchError(
      'BATCH_ACTION_SOFT_FAILURE',
      typeof value.error === 'string' && value.error ? value.error : 'Action returned an error result',
    );
  }
  return value;
}

function resolveDependencies(dependencies = {}) {
  return {
    evaluate: dependencies.evaluate || defaultEvaluate,
    evaluateAsync: dependencies.evaluateAsync || defaultEvaluateAsync,
    sendCdpCommand: dependencies.sendCdpCommand || defaultSendCdpCommand,
    getChartApi: dependencies.getChartApi || defaultGetChartApi,
    getChartCollection: dependencies.getChartCollection || defaultGetChartCollection,
    waitForChartReady: dependencies.waitForChartReady || defaultWaitForChartReady,
    readChartState: dependencies.readChartState || defaultReadChartState,
    getStrategyResults: dependencies.getStrategyResults || defaultGetStrategyResults,
    setSymbol: typeof dependencies.setSymbol === 'function' ? dependencies.setSymbol : null,
    setTimeframe: typeof dependencies.setTimeframe === 'function' ? dependencies.setTimeframe : null,
    executeAction: typeof dependencies.executeAction === 'function' ? dependencies.executeAction : null,
    sleep: dependencies.sleep || defaultSleep,
    now: dependencies.now || Date.now,
    readinessTimeoutMs: Number(dependencies.readinessTimeoutMs || DEFAULT_READINESS_TIMEOUT_MS),
    restorationTimeoutMs: Number(dependencies.restorationTimeoutMs ?? DEFAULT_RESTORATION_TIMEOUT_MS),
  };
}

async function setChartSymbol(deps, paths, symbol, signal, phase = 'execution') {
  if (deps.setSymbol) return deps.setSymbol(symbol, { ...paths, signal, phase });
  const path = paths.apiPath || paths.collectionPath;
  const marker = phase === 'restoration' ? '/* batch-restoration */ ' : '';
  return deps.evaluate(`${marker}${path}.setSymbol(${safeString(symbol)})`, { signal });
}

async function setChartTimeframe(deps, paths, timeframe, signal, phase = 'execution') {
  if (deps.setTimeframe) return deps.setTimeframe(timeframe, { ...paths, signal, phase });
  const path = paths.apiPath || paths.collectionPath;
  const marker = phase === 'restoration' ? '/* batch-restoration */ ' : '';
  return deps.evaluate(`${marker}${path}.setResolution(${safeString(timeframe)})`, { signal });
}

async function takeScreenshot({ deps, symbol, timeframe, signal }) {
  if (signal?.aborted) throw signal.reason || new Error('aborted');
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const { data } = await deps.sendCdpCommand(
    'Page',
    'captureScreenshot',
    { format: 'png' },
    { signal },
  );
  if (signal?.aborted) throw signal.reason || new Error('aborted');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `batch_${symbol}_${timeframe}_${timestamp}`.replace(/[\/\\]/g, '_') + '.png';
  const filePath = join(SCREENSHOT_DIR, filename);
  writeFileSync(filePath, Buffer.from(data, 'base64'));
  return { success: true, file_path: filePath };
}

async function getOhlcv({ deps, apiPath, count, signal }) {
  const numericCount = Number(count ?? 100);
  const limit = Math.max(1, Math.min(Number.isFinite(numericCount) ? Math.trunc(numericCount) : 100, MAX_OHLCV_BARS));
  const result = await deps.evaluate(`
    (() => {
      const bars = ${apiPath}._chartWidget.model().mainSeries().bars();
      if (!bars || typeof bars.lastIndex !== 'function') {
        return { error: 'Authoritative OHLCV bars API is unavailable' };
      }
      const end = bars.lastIndex();
      const first = bars.firstIndex();
      const start = Math.max(first, end - ${limit} + 1);
      const values = [];
      for (let index = start; index <= end; index += 1) {
        const bar = bars.valueAt(index);
        if (bar) values.push(bar);
      }
      if (values.length === 0) return { error: 'No authoritative OHLCV bars are loaded' };
      const completedIndex = Math.max(first, end - 1);
      const completedBar = bars.valueAt(completedIndex) || null;
      return {
        success: true,
        bar_count: values.length,
        last_bar: values[values.length - 1] || null,
        bars_fingerprint: [bars.size(), first, end, JSON.stringify(completedBar)].join(':'),
      };
    })()
  `, { signal });
  return assertActionResult(result);
}

async function readStrategySnapshot(deps, signal) {
  const value = assertActionResult(await deps.getStrategyResults({
    _deps: {
      evaluate: (expression, options = {}) => deps.evaluate(expression, { ...options, signal }),
    },
    signal,
  }));
  return { value, fingerprint: fingerprint(value) };
}

async function getStableStrategyResult({
  deps,
  requested,
  signal,
  baselineStrategyFingerprint,
  requireStrategyChange,
  expectedBarsFingerprint,
}) {
  const startedAt = deps.now();
  let candidate = null;
  let lastObserved = null;
  while (deps.now() - startedAt < deps.readinessTimeoutMs) {
    if (signal?.aborted) throw signal.reason || new Error('aborted');
    const snapshot = await readStrategySnapshot(deps, signal);
    const changed = !requireStrategyChange
      || (baselineStrategyFingerprint && snapshot.fingerprint !== baselineStrategyFingerprint);
    if (changed && candidate?.fingerprint === snapshot.fingerprint) {
      return {
        value: { ...snapshot.value, fingerprint: snapshot.fingerprint },
        strategyFingerprint: candidate.fingerprint,
        strategyOracleFingerprint: snapshot.fingerprint,
      };
    }
    candidate = changed ? snapshot : null;

    lastObserved = await deps.readChartState({ evaluate: deps.evaluate, signal });
    if (!chartStateMatches(lastObserved, requested.symbol, requested.timeframe)
      || barsFingerprint(lastObserved) !== expectedBarsFingerprint) {
      throw new BatchError('CHART_STATE_MISMATCH', 'Chart state changed while verifying strategy stability', {
        requested,
        observed: observedState(lastObserved),
      });
    }
    const elapsed = deps.now() - startedAt;
    if (elapsed >= deps.readinessTimeoutMs) break;
    await deps.sleep(Math.min(100, deps.readinessTimeoutMs - elapsed), signal);
  }
  throw new BatchError(
    'STRATEGY_FINGERPRINT_UNSTABLE',
    'Strategy result did not reach a changed, stable fingerprint before the deadline',
    { requested, observed: observedState(lastObserved) },
  );
}

async function executeDefaultAction(context) {
  if (context.action === 'screenshot') {
    return { value: await takeScreenshot(context), strategyFingerprint: null };
  }
  if (context.action === 'get_ohlcv') {
    return {
      value: await getOhlcv({
        deps: context.deps,
        apiPath: context.apiPath,
        count: context.ohlcvCount,
        signal: context.signal,
      }),
      strategyFingerprint: null,
    };
  }
  if (context.action === 'get_strategy_results') {
    return getStableStrategyResult(context);
  }
  throw new BatchError('BATCH_UNKNOWN_ACTION', `Unknown batch action: ${context.action}`);
}

function buildPlan(symbols, timeframes) {
  const normalizedSymbols = Array.isArray(symbols) ? Array.from(symbols, normalizeChartSymbol) : [];
  const normalizedTimeframes = timeframes === undefined
    ? [null]
    : (Array.isArray(timeframes) ? Array.from(timeframes, normalizeChartTimeframe) : []);
  const plan = [];
  for (const symbol of normalizedSymbols) {
    for (const timeframe of normalizedTimeframes) {
      plan.push({ index: plan.length, symbol, timeframe });
    }
  }
  return { normalizedSymbols, normalizedTimeframes, plan };
}

function validateBatchInput(symbols, timeframes, normalizedSymbols, normalizedTimeframes) {
  const issues = [];
  if (!Array.isArray(symbols) || symbols.length === 0) {
    issues.push('symbols must be a non-empty array');
  } else {
    normalizedSymbols.forEach((symbol, index) => {
      if (!symbol) issues.push(`symbols[${index}] is empty after normalization`);
    });
  }

  if (timeframes !== undefined) {
    if (!Array.isArray(timeframes) || timeframes.length === 0) {
      issues.push('timeframes must be a non-empty array when provided');
    } else {
      normalizedTimeframes.forEach((timeframe, index) => {
        if (!timeframe) issues.push(`timeframes[${index}] is empty after normalization`);
      });
    }
  }

  if (issues.length === 0) return null;
  return new BatchError('BATCH_INVALID_INPUT', `Invalid batch input: ${issues.join('; ')}`);
}

function failedRow(item, error, observed = null, durationMs = 0, actionStarted = false) {
  return {
    symbol: item.symbol,
    timeframe: item.timeframe,
    requested: requestedState(item.symbol, item.timeframe),
    observed: observedState(observed || error?.observed),
    success: false,
    action_started: actionStarted,
    oracle_verified: false,
    ...(error?.ambiguous === true ? { ambiguous: true } : {}),
    duration_ms: Math.max(0, Number(durationMs) || 0),
    error: serializeError(error),
  };
}

function restorationNotRequired() {
  return {
    required: false,
    attempted: false,
    success: true,
    reason: 'mutation_not_started',
  };
}

function finalize(plan, results, cancelled) {
  const successful = results.filter(row => row.success).length;
  const failed = results.length - successful;
  const unstarted = plan.length - results.length;
  const next = unstarted > 0 ? plan[results.length] : null;
  return {
    success: !cancelled && failed === 0 && unstarted === 0,
    cancelled,
    total_iterations: plan.length,
    completed: results.length,
    successful,
    failed,
    unstarted,
    resume_from: next ? { index: next.index, symbol: next.symbol, timeframe: next.timeframe } : null,
    results,
    restoration: restorationNotRequired(),
  };
}

function failEntirePlan(plan, error) {
  const results = plan.map(item => failedRow(item, error));
  return finalize(plan, results, false);
}

function failInvalidInput(plan, error) {
  const outcome = failEntirePlan(plan, error);
  outcome.success = false;
  outcome.error = serializeError(error);
  return outcome;
}

async function restoreInitialChart(deps, paths, initialState) {
  const requested = requestedState(initialState.symbol, initialState.timeframe);
  const configuredTimeout = Number(deps.restorationTimeoutMs);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_RESTORATION_TIMEOUT_MS;
  const controller = new AbortController();
  let timer;
  let lastObserved = null;

  const operation = async () => {
    let before = null;
    try {
      before = await deps.readChartState({
        evaluate: deps.evaluate,
        signal: controller.signal,
        timeoutMs,
      });
    } catch (error) {
      if (controller.signal.aborted) throw error;
    }
    const baselineFingerprint = barsFingerprint(before);
    const requireFingerprintChange = Boolean(
      baselineFingerprint && !chartIdentityMatches(before, requested),
    );

    const symbolChanged = normalizeChartSymbol(before?.symbol) !== requested.symbol;
    const timeframeChanged = normalizeChartTimeframe(before?.timeframe) !== requested.timeframe;

    if (symbolChanged) {
      await setChartSymbol(deps, paths, requested.symbol, controller.signal, 'restoration');
    }
    if (timeframeChanged) {
      await setChartTimeframe(deps, paths, requested.timeframe, controller.signal, 'restoration');
    }
    const ready = await deps.waitForChartReady(
      requested.symbol,
      requested.timeframe,
      timeoutMs,
      {
        evaluate: deps.evaluate,
        signal: controller.signal,
        baselineFingerprint,
        requireFingerprintChange,
      },
    );
    assertReadinessResult(ready, requested);
    const readyFingerprint = barsFingerprint(ready);
    if (!readyFingerprint) {
      throw new BatchError('CHART_RESTORATION_FAILED', 'Restoration readiness returned no bars fingerprint', {
        requested,
      });
    }
    lastObserved = await deps.readChartState({
      evaluate: deps.evaluate,
      signal: controller.signal,
      timeoutMs,
    });
    if (!chartStateMatches(lastObserved, requested.symbol, requested.timeframe)
      || barsFingerprint(lastObserved) !== readyFingerprint) {
      throw new BatchError('CHART_RESTORATION_FAILED', 'Restored chart state did not remain authoritative and stable', {
        requested,
        observed: observedState(lastObserved),
      });
    }
    return {
      required: true,
      attempted: true,
      success: true,
      requested,
      observed: observedState(lastObserved),
      bars_fingerprint: readyFingerprint,
    };
  };

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new BatchError(
        'CHART_RESTORATION_TIMEOUT',
        `Chart restoration exceeded ${timeoutMs} ms`,
        { requested, observed: observedState(lastObserved) },
      );
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeout]);
  } catch (error) {
    const structured = error?.code?.startsWith?.('CHART_RESTORATION_')
      ? error
      : new BatchError('CHART_RESTORATION_FAILED', error?.message || String(error), {
        requested,
        observed: observedState(lastObserved || error?.observed),
        cause: error,
      });
    return {
      required: true,
      attempted: true,
      success: false,
      requested,
      observed: observedState(lastObserved || structured.observed),
      error: serializeError(structured),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function batchRun({
  symbols,
  timeframes,
  action,
  delay_ms,
  ohlcv_count,
  signal,
  _deps,
} = {}) {
  const deps = resolveDependencies(_deps);
  const delayMs = Number(delay_ms ?? 0);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError(`delay_ms must be a finite non-negative number, got: ${delay_ms}`);
  }

  let { normalizedSymbols, normalizedTimeframes, plan } = buildPlan(symbols, timeframes);
  const inputError = validateBatchInput(
    symbols,
    timeframes,
    normalizedSymbols,
    normalizedTimeframes,
  );
  if (inputError) return failInvalidInput(plan, inputError);
  if (!VALID_ACTIONS.has(action)) {
    return failEntirePlan(
      plan,
      new BatchError('BATCH_UNKNOWN_ACTION', `Unknown batch action: ${action}`),
    );
  }
  if (signal?.aborted) return finalize(plan, [], true);

  let apiPath;
  let collectionPath;
  const apiErrors = [];
  try { apiPath = await deps.getChartApi({ signal }); } catch (error) { apiErrors.push(error); }
  try { collectionPath = await deps.getChartCollection({ signal }); } catch (error) { apiErrors.push(error); }
  if (signal?.aborted) return finalize(plan, [], true);
  if ((!apiPath && !collectionPath) || (action !== 'screenshot' && !apiPath)) {
    const detail = apiErrors.map(error => error?.message).filter(Boolean).join('; ');
    return failEntirePlan(
      plan,
      new BatchError(
        'CHART_API_UNAVAILABLE',
        detail ? `Chart API unavailable: ${detail}` : 'Chart API unavailable',
      ),
    );
  }

  let currentState;
  try {
    currentState = await deps.readChartState({ evaluate: deps.evaluate, signal });
  } catch (error) {
    if (isCancellation(error, signal)) return finalize(plan, [], true);
    return failEntirePlan(
      plan,
      new BatchError('CHART_STATE_UNAVAILABLE', 'Could not read the initial chart state', { cause: error }),
    );
  }
  if (signal?.aborted) return finalize(plan, [], true);
  if (!chartStateMatches(currentState) || !barsFingerprint(currentState)) {
    return failEntirePlan(
      plan,
      new BatchError('CHART_STATE_UNAVAILABLE', 'Initial authoritative chart state or bars fingerprint is unavailable'),
    );
  }
  const initialState = { ...currentState };

  // When timeframes were omitted, freeze the current authoritative timeframe as
  // the requested state. This avoids treating an unknown observed timeframe as success.
  if (timeframes === undefined) {
    const frozenTimeframe = normalizeChartTimeframe(currentState?.timeframe);
    if (!frozenTimeframe) {
      return failEntirePlan(
        plan,
        new BatchError('CHART_STATE_UNAVAILABLE', 'Initial authoritative timeframe is empty or unknown'),
      );
    }
    normalizedTimeframes = [frozenTimeframe];
    ({ plan } = buildPlan(normalizedSymbols, normalizedTimeframes));
  }

  const paths = { apiPath, collectionPath };
  const results = [];
  let cancelled = false;
  let activePlannedSymbol = null;
  let symbolSetterSatisfied = false;
  let mutationStarted = false;

  outer: for (const item of plan) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    if (item.symbol !== activePlannedSymbol) {
      activePlannedSymbol = item.symbol;
      symbolSetterSatisfied = false;
    }
    const startedAt = deps.now();
    const requested = requestedState(item.symbol, item.timeframe);
    let observed = null;
    let actionStarted = false;
    try {
      if (!currentState) {
        currentState = await deps.readChartState({ evaluate: deps.evaluate, signal });
      }
      if (!chartStateMatches(currentState) || !barsFingerprint(currentState)) {
        throw new BatchError('CHART_STATE_UNAVAILABLE', 'Pre-mutation chart state or bars fingerprint is unavailable', {
          requested,
          observed: observedState(currentState),
        });
      }
      const baselineFingerprint = barsFingerprint(currentState);
      const symbolChanged = normalizeChartSymbol(currentState.symbol) !== requested.symbol;
      const timeframeChanged = normalizeChartTimeframe(currentState.timeframe) !== requested.timeframe;
      const mutationRequired = symbolChanged || timeframeChanged;
      let baselineStrategyFingerprint = null;
      if (action === 'get_strategy_results' && mutationRequired) {
        baselineStrategyFingerprint = (await readStrategySnapshot(deps, signal)).fingerprint;
      }

      if (!symbolSetterSatisfied) {
        if (symbolChanged) {
          mutationStarted = true;
          await setChartSymbol(deps, paths, item.symbol, signal);
        }
        symbolSetterSatisfied = true;
      }
      if (timeframeChanged) {
        mutationStarted = true;
        await setChartTimeframe(deps, paths, item.timeframe, signal);
      }

      const readiness = await deps.waitForChartReady(item.symbol, item.timeframe, deps.readinessTimeoutMs, {
        evaluate: deps.evaluate,
        signal,
        baselineFingerprint,
        requireFingerprintChange: mutationRequired,
      });
      assertReadinessResult(readiness, requested);
      const readyFingerprint = barsFingerprint(readiness);
      if (!readyFingerprint) {
        throw new BatchError('CHART_READINESS_FAILED', 'Chart readiness returned no bars fingerprint', { requested });
      }

      if (delayMs > 0) await deps.sleep(delayMs, signal);
      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      observed = await deps.readChartState({ evaluate: deps.evaluate, signal });
      if (!chartStateMatches(observed, requested.symbol, requested.timeframe)
        || barsFingerprint(observed) !== readyFingerprint) {
        throw new BatchError(
          'CHART_STATE_MISMATCH',
          'Immediate pre-action chart state or bars fingerprint does not match readiness',
          { requested, observed: observedState(observed) },
        );
      }
      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      actionStarted = true;
      const context = {
        deps,
        action,
        symbol: item.symbol,
        timeframe: item.timeframe,
        requested,
        observed: observedState(observed),
        expectedBarsFingerprint: readyFingerprint,
        baselineStrategyFingerprint,
        requireStrategyChange: mutationRequired,
        apiPath,
        collectionPath,
        ohlcvCount: ohlcv_count,
        signal,
      };
      const executed = deps.executeAction
        ? { value: await deps.executeAction(context), strategyFingerprint: null, strategyOracleFingerprint: null }
        : await executeDefaultAction(context);
      const value = assertActionResult(executed.value);
      if (signal?.aborted) {
        throw new BatchError(
          'BATCH_ACTION_CANCELLED_AMBIGUOUS',
          'Action completed after cancellation but its post-action oracle was not verified',
          {
            requested,
            observed: observedState(observed),
            cause: signal.reason,
            ambiguous: true,
          },
        );
      }

      const oracle = await deps.readChartState({ evaluate: deps.evaluate, signal });
      if (signal?.aborted) {
        throw new BatchError(
          'BATCH_ACTION_CANCELLED_AMBIGUOUS',
          'Post-action oracle resolved after cancellation; action outcome is ambiguous',
          {
            requested,
            observed: observedState(oracle),
            cause: signal.reason,
            ambiguous: true,
          },
        );
      }
      const oracleVerified = chartStateMatches(oracle, requested.symbol, requested.timeframe)
        && barsFingerprint(oracle) === readyFingerprint;
      if (!oracleVerified) {
        throw new BatchError('CHART_STATE_MISMATCH', 'Delayed post-action chart oracle changed', {
          requested,
          observed: observedState(oracle),
        });
      }
      if (action === 'get_ohlcv' && value?.bars_fingerprint
        && value.bars_fingerprint !== barsFingerprint(oracle)) {
        throw new BatchError(
          'BATCH_RESULT_FINGERPRINT_MISMATCH',
          'OHLCV result fingerprint does not match the delayed chart oracle',
          { requested, observed: observedState(oracle) },
        );
      }

      results.push({
        symbol: item.symbol,
        timeframe: item.timeframe,
        requested,
        observed: observedState(observed),
        success: true,
        action_started: true,
        duration_ms: Math.max(0, deps.now() - startedAt),
        bars_fingerprint: readyFingerprint,
        bars_oracle_fingerprint: barsFingerprint(oracle),
        oracle_verified: oracleVerified,
        ...(executed.strategyFingerprint ? { strategy_fingerprint: executed.strategyFingerprint } : {}),
        ...(executed.strategyOracleFingerprint
          ? { strategy_oracle_fingerprint: executed.strategyOracleFingerprint }
          : {}),
        result: value,
      });
      currentState = oracle;
      if (signal?.aborted) {
        cancelled = true;
        break;
      }
    } catch (error) {
      if (isCancellation(error, signal)) {
        cancelled = true;
        if (actionStarted) {
          const ambiguousError = error?.ambiguous === true
            ? error
            : new BatchError(
              'BATCH_ACTION_CANCELLED_AMBIGUOUS',
              error?.message || 'Action was interrupted after it started; outcome is ambiguous',
              {
                requested,
                observed: observedState(observed || error?.observed),
                cause: error,
                ambiguous: true,
              },
            );
          results.push(failedRow(item, ambiguousError, observed, deps.now() - startedAt, true));
        }
        currentState = null;
        break outer;
      }
      const fallbackError = error?.code
        ? error
        : new BatchError(
          actionStarted ? 'BATCH_ACTION_FAILED' : 'CHART_READINESS_FAILED',
          error?.message || String(error),
          { requested, observed: observedState(observed || error?.observed), cause: error },
        );
      results.push(failedRow(item, fallbackError, observed, deps.now() - startedAt, actionStarted));
      currentState = null;
    }
  }

  const outcome = finalize(plan, results, cancelled);
  if (mutationStarted) {
    outcome.restoration = await restoreInitialChart(deps, paths, initialState);
    if (!outcome.restoration.success) {
      outcome.success = false;
      outcome.error = outcome.restoration.error;
    }
  }
  return outcome;
}
