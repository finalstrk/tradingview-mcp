#!/usr/bin/env node

import CDP from 'chrome-remote-interface';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const HOST = 'localhost';
const PORT = 9222;
const SYMBOLS = ['FX:USDJPY', 'FX:EURUSD', 'FX:GBPUSD', 'FX:AUDUSD'];
const TIMEFRAMES = ['5', '15'];
const DEFAULT_RUNS = 10;
const LEGACY_DELAY_MS = 2000;
const LEGACY_READY_TIMEOUT_MS = 1000;
const OPERATION_TIMEOUT_MS = 15000;
const READY_TIMEOUT_MS = 20000;
const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';
const CHART_COLLECTION = 'window.TradingViewApi._chartWidgetCollection';

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    if (!argument.startsWith('--')) continue;
    const [key, ...rest] = argument.slice(2).split('=');
    values[key] = rest.length > 0 ? rest.join('=') : true;
  }
  return {
    phase: values.phase || 'before',
    targetId: values['target-id'] || process.env.TV_BENCH_TARGET_ID || '',
    runs: Number(values.runs || DEFAULT_RUNS),
    legacyDelayMs: Number(values['legacy-delay-ms'] ?? LEGACY_DELAY_MS),
    legacyReadyTimeoutMs: Number(values['legacy-ready-timeout-ms'] ?? LEGACY_READY_TIMEOUT_MS),
  };
}

function assertOptions({ phase, targetId, runs, legacyDelayMs, legacyReadyTimeoutMs }) {
  if (!['before', 'after'].includes(phase)) {
    throw new Error('--phase must be before or after');
  }
  if (!targetId) {
    throw new Error('--target-id is required; select a probed existing target with a non-zero authoritative bar count');
  }
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
  if (!Number.isFinite(legacyDelayMs) || legacyDelayMs < 0) {
    throw new Error('--legacy-delay-ms must be a finite non-negative number');
  }
  if (!Number.isFinite(legacyReadyTimeoutMs) || legacyReadyTimeoutMs <= 0) {
    throw new Error('--legacy-ready-timeout-ms must be a finite positive number');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withDeadline(operation, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSymbol(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeTimeframe(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized === 'D') return '1D';
  if (normalized === 'W') return '1W';
  return normalized;
}

function matches(state, symbol, timeframe) {
  const apiAvailable = state?.api_available === undefined
    ? Boolean(state?.symbol && state?.timeframe && Number(state?.bar_count) > 0)
    : state.api_available;
  return Boolean(
    apiAvailable
      && Number(state.bar_count) > 0
      && normalizeSymbol(state.symbol)
      && normalizeTimeframe(state.timeframe)
      && normalizeSymbol(state.symbol) === normalizeSymbol(symbol)
      && normalizeTimeframe(state.timeframe) === normalizeTimeframe(timeframe),
  );
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function fingerprint(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

async function evaluate(client, expression, { awaitPromise = false, timeoutMs = OPERATION_TIMEOUT_MS } = {}) {
  const response = await withDeadline(
    () => client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise }),
    timeoutMs,
    'Runtime.evaluate',
  );
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || 'Runtime.evaluate failed';
    throw new Error(detail);
  }
  return response.result?.value;
}

async function readChartState(client) {
  return evaluate(client, `(() => {
    try {
      const chart = window.TradingViewApi?._activeChartWidgetWV?.value?.();
      if (!chart) return { api_available: false, symbol: '', timeframe: '', bar_count: 0 };
      const bars = chart._chartWidget?.model?.()?.mainSeries?.()?.bars?.();
      const barCount = Number(bars?.size?.() ?? 0);
      const first = bars?.firstIndex?.() ?? null;
      const last = bars?.lastIndex?.() ?? null;
      const completedIndex = last == null ? null : Math.max(first ?? last, last - 1);
      const completedBar = completedIndex == null ? null : bars?.valueAt?.(completedIndex);
      return {
        api_available: true,
        symbol: String(chart.symbol?.() ?? ''),
        timeframe: String(chart.resolution?.() ?? ''),
        bar_count: Number.isFinite(barCount) ? barCount : 0,
        bars_fingerprint: [barCount, first, last, JSON.stringify(completedBar || null)].join(':'),
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
  })()`);
}

async function readBuild(client) {
  return evaluate(client, `(() => ({
    href: location.href,
    user_agent: navigator.userAgent,
    app_version: String(
      window.TradingView?.version
      ?? window.__BUILD_VERSION__
      ?? document.querySelector('meta[name="version"]')?.content
      ?? 'unknown'
    ),
  }))()`);
}

async function setSymbol(client, symbol) {
  return evaluate(client, `(() => {
    const chart = ${CHART_API};
    if (!chart) throw new Error('active chart API unavailable');
    chart.setSymbol(${JSON.stringify(symbol)});
    return true;
  })()`);
}

async function setTimeframe(client, timeframe) {
  return evaluate(client, `(() => {
    const chart = ${CHART_API};
    if (!chart) throw new Error('active chart API unavailable');
    chart.setResolution(${JSON.stringify(timeframe)});
    return true;
  })()`);
}

async function waitForExactState(client, symbol, timeframe, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let observed;
  let stable = 0;
  while (Date.now() < deadline) {
    observed = await readChartState(client);
    if (matches(observed, symbol, timeframe)) {
      stable += 1;
      if (stable >= 2) return observed;
    } else {
      stable = 0;
    }
    await sleep(100);
  }
  throw new Error(`exact chart readiness timeout: requested=${symbol}/${timeframe}, observed=${observed?.symbol || '<empty>'}/${observed?.timeframe || '<empty>'}`);
}

// Deliberately mirrors the pre-P1-02 broad DOM readiness contract.
async function waitLegacy(client, expectedSymbol, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastBarCount = -1;
  let stableCount = 0;
  while (Date.now() < deadline) {
    const state = await evaluate(client, `(() => {
      const spinner = document.querySelector('[class*="loader"]')
        || document.querySelector('[class*="loading"]')
        || document.querySelector('[data-name="loading"]');
      const symbolElement = document.querySelector('[data-name="legend-source-title"]')
        || document.querySelector('[class*="title"] [class*="apply-common-tooltip"]');
      return {
        isLoading: Boolean(spinner && spinner.offsetParent !== null),
        barCount: document.querySelectorAll('[class*="bar"]').length,
        currentSymbol: symbolElement ? symbolElement.textContent.trim() : '',
      };
    })()`);
    if (!state || state.isLoading) {
      stableCount = 0;
      await sleep(200);
      continue;
    }
    if (expectedSymbol && state.currentSymbol
      && !state.currentSymbol.toUpperCase().includes(expectedSymbol.toUpperCase())) {
      stableCount = 0;
      await sleep(200);
      continue;
    }
    stableCount = state.barCount === lastBarCount && state.barCount > 0 ? stableCount + 1 : 0;
    lastBarCount = state.barCount;
    if (stableCount >= 2) return true;
    await sleep(200);
  }
  return false;
}

async function readOhlcv(client, limit = 10) {
  return evaluate(client, `(() => {
    const bars = ${CHART_API}._chartWidget.model().mainSeries().bars();
    if (!bars || typeof bars.lastIndex !== 'function') {
      throw new Error('authoritative bars API unavailable');
    }
    const end = bars.lastIndex();
    const first = bars.firstIndex();
    const start = Math.max(first, end - ${limit} + 1);
    const result = [];
    for (let index = start; index <= end; index += 1) {
      const value = bars.valueAt(index);
      if (value) result.push(value);
    }
    const completedIndex = Math.max(first, end - 1);
    const completedBar = bars.valueAt(completedIndex) || null;
    return {
      bar_count: result.length,
      last_bar: result.at(-1) || null,
      bars_fingerprint: [bars.size(), first, end, JSON.stringify(completedBar)].join(':'),
    };
  })()`);
}

function strategyFixture(state) {
  const fingerprint = `${normalizeSymbol(state.symbol)}@${normalizeTimeframe(state.timeframe)}:fixture-v1`;
  return {
    success: true,
    source: 'deterministic-stateful-benchmark-fixture',
    metric_count: 1,
    metrics: { net_profit: fingerprint.length },
    fingerprint,
  };
}

async function runLegacyAction(client, action, legacyDelayMs, legacyReadyTimeoutMs) {
  const durations = [];
  const rows = [];
  let postReadinessFailureActions = 0;
  let symbolChanges = 0;
  let timeframeChanges = 0;
  for (let run = 0; run < DEFAULT_RUNS; run += 1) {
    for (const symbol of SYMBOLS) {
      for (const timeframe of TIMEFRAMES) {
        const startedAt = performance.now();
        await setSymbol(client, symbol);
        symbolChanges += 1;
        await setTimeframe(client, timeframe);
        timeframeChanges += 1;
        const ready = await waitLegacy(client, symbol, legacyReadyTimeoutMs);
        if (!ready) postReadinessFailureActions += 1;
        await sleep(legacyDelayMs);
        const observed = await readChartState(client);
        const result = action === 'get_ohlcv'
          ? await readOhlcv(client)
          : strategyFixture(observed);
        const delayedOracleState = await readChartState(client);
        const delayedOracle = action === 'get_ohlcv'
          ? delayedOracleState.bars_fingerprint
          : strategyFixture(delayedOracleState).fingerprint;
        const actualFingerprint = action === 'get_ohlcv'
          ? result.bars_fingerprint
          : result.fingerprint;
        const durationMs = performance.now() - startedAt;
        durations.push(durationMs);
        rows.push({
          run,
          requested: { symbol, timeframe },
          observed: { symbol: observed.symbol, timeframe: observed.timeframe },
          exact: matches(observed, symbol, timeframe),
          ready,
          success: result?.success !== false && !result?.error,
          duration_ms: Number(durationMs.toFixed(2)),
          fingerprint: result?.fingerprint || null,
          actual_result_fingerprint: actualFingerprint,
          delayed_oracle_fingerprint: delayedOracle,
          oracle_match: actualFingerprint === delayedOracle,
        });
      }
    }
  }
  return { durations, rows, postReadinessFailureActions, symbolChanges, timeframeChanges };
}

async function runBefore(client, { legacyDelayMs, legacyReadyTimeoutMs }) {
  // The fixed fixture is ten runs. Reject a mismatched CLI count instead of silently
  // producing a result that cannot be compared with the acceptance threshold.
  const ohlcv = await runLegacyAction(client, 'get_ohlcv', legacyDelayMs, legacyReadyTimeoutMs);
  const strategy = await runLegacyAction(client, 'get_strategy_results', legacyDelayMs, legacyReadyTimeoutMs);
  return { ohlcv, strategy };
}

async function runCandidateAction(client, action, runs) {
  const { batchRun } = await import('../src/core/batch.js');
  const durations = [];
  const rows = [];
  let postReadinessFailureActions = 0;
  let symbolChanges = 0;
  let timeframeChanges = 0;
  let restorationSymbolChanges = 0;
  let restorationTimeframeChanges = 0;
  let sutRestorationChecks = 0;
  const phaseInitialState = await readChartState(client);
  const trackedEvaluate = (expression, options = {}) => {
    const restoration = expression.includes('batch-restoration');
    if (/\.setSymbol\(/.test(expression)) {
      if (restoration) restorationSymbolChanges += 1;
      else symbolChanges += 1;
    }
    if (/\.setResolution\(/.test(expression)) {
      if (restoration) restorationTimeframeChanges += 1;
      else timeframeChanges += 1;
    }
    return evaluate(client, expression, {
      awaitPromise: false,
      timeoutMs: options.timeoutMs || OPERATION_TIMEOUT_MS,
    });
  };
  const dependencies = {
    evaluate: trackedEvaluate,
    evaluateAsync: (expression, options = {}) => evaluate(client, expression, {
      awaitPromise: true,
      timeoutMs: options.timeoutMs || OPERATION_TIMEOUT_MS,
    }),
    getClient: async () => client,
    getChartApi: async () => CHART_API,
    getChartCollection: async () => CHART_COLLECTION,
    getStrategyResults: async () => {
      const state = await readChartState(client);
      return strategyFixture(state);
    },
  };

  for (let run = 0; run < runs; run += 1) {
    const result = await batchRun({
      symbols: SYMBOLS,
      timeframes: TIMEFRAMES,
      action,
      delay_ms: 0,
      ohlcv_count: 10,
      _deps: dependencies,
    });
    if (!result.restoration?.success) {
      throw new Error(`SUT restoration failed before safety net: ${JSON.stringify(result.restoration)}`);
    }
    const sutState = await readChartState(client);
    if (!matches(sutState, phaseInitialState.symbol, phaseInitialState.timeframe)) {
      throw new Error(`SUT did not restore its own initial state: ${JSON.stringify(sutState)}`);
    }
    sutRestorationChecks += 1;
    for (const row of result.results || []) {
      const duration = Number(row.duration_ms || 0);
      durations.push(duration);
      const fixtureOracle = action === 'get_strategy_results'
        ? fingerprint(strategyFixture(row.requested))
        : null;
      const actualFingerprint = action === 'get_strategy_results'
        ? row.strategy_fingerprint
        : row.result?.bars_fingerprint;
      const delayedOracle = action === 'get_strategy_results'
        ? row.strategy_oracle_fingerprint
        : row.bars_oracle_fingerprint;
      rows.push({
        ...row,
        run,
        fixture_fingerprint: action === 'get_strategy_results'
          ? strategyFixture(row.requested).fingerprint
          : null,
        actual_result_fingerprint: actualFingerprint || null,
        delayed_oracle_fingerprint: delayedOracle || null,
        fixture_oracle_fingerprint: fixtureOracle,
        oracle_match: Boolean(actualFingerprint)
          && actualFingerprint === delayedOracle
          && (fixtureOracle === null || actualFingerprint === fixtureOracle),
      });
      if (row.action_started_after_readiness_failure) postReadinessFailureActions += 1;
    }
  }
  return {
    durations,
    rows,
    postReadinessFailureActions,
    symbolChanges,
    timeframeChanges,
    restorationSymbolChanges,
    restorationTimeframeChanges,
    sutRestorationChecks,
  };
}

async function runAfter(client, { runs }) {
  const ohlcv = await runCandidateAction(client, 'get_ohlcv', runs);
  const strategy = await runCandidateAction(client, 'get_strategy_results', runs);
  return { ohlcv, strategy };
}

function summarize(measurement) {
  const stale = measurement.rows.filter(row => {
    const identityMismatch = typeof row.exact === 'boolean'
      ? !row.exact
      : !matches(row.observed, row.requested?.symbol, row.requested?.timeframe);
    return identityMismatch || row.oracle_match !== true;
  }).length;
  const failures = measurement.rows.filter(row => row.success === false).length;
  const oracleCompared = measurement.rows.filter(row => row.actual_result_fingerprint && row.delayed_oracle_fingerprint);
  const oracleMatches = oracleCompared.filter(row => row.oracle_match === true).length;
  return {
    result_count: measurement.rows.length,
    p50_ms: percentile(measurement.durations, 50),
    p95_ms: percentile(measurement.durations, 95),
    max_ms: percentile(measurement.durations, 100),
    stale_or_mislabeled: stale,
    failed: failures,
    post_readiness_failure_actions: measurement.postReadinessFailureActions,
    symbol_changes: measurement.symbolChanges,
    symbol_changes_per_run: measurement.symbolChanges / DEFAULT_RUNS,
    timeframe_changes: measurement.timeframeChanges,
    restoration_symbol_changes: measurement.restorationSymbolChanges || 0,
    restoration_timeframe_changes: measurement.restorationTimeframeChanges || 0,
    sut_restoration_checks: measurement.sutRestorationChecks || 0,
    delayed_oracle_compared: oracleCompared.length,
    delayed_oracle_matches: oracleMatches,
    delayed_oracle_mismatches: oracleCompared.length - oracleMatches,
    fingerprint_success: oracleMatches,
    sample_first: measurement.rows[0] || null,
    sample_last: measurement.rows.at(-1) || null,
  };
}

async function restoreChart(client, initialState) {
  if (!initialState?.api_available || !initialState.symbol || !initialState.timeframe) {
    throw new Error('cannot restore an initially unknown chart state');
  }
  await setSymbol(client, initialState.symbol);
  await setTimeframe(client, initialState.timeframe);
  return waitForExactState(client, initialState.symbol, initialState.timeframe);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOptions(options);
  if (options.runs !== DEFAULT_RUNS) {
    throw new Error(`acceptance benchmark requires exactly ${DEFAULT_RUNS} runs`);
  }

  const targetsBefore = await CDP.List({ host: HOST, port: PORT });
  const target = targetsBefore.find(candidate => candidate.id === options.targetId);
  if (!target || target.type !== 'page') {
    throw new Error(`existing page target not found: ${options.targetId}`);
  }
  const versionBefore = await CDP.Version({ host: HOST, port: PORT });
  let client;
  let initialState;
  let restoredState;
  let build;
  let measurements;
  let measurementError;
  let sutRestoredBeforeSafetyNet = false;
  let safetyNetUsed = false;
  try {
    client = await withDeadline(
      () => CDP({ host: HOST, port: PORT, target: options.targetId }),
      5000,
      'attach existing target',
    );
    await client.Runtime.enable();
    initialState = await readChartState(client);
    if (!initialState.api_available || initialState.bar_count <= 0) {
      throw new Error(`selected target is not healthy: ${JSON.stringify(initialState)}`);
    }
    build = await readBuild(client);
    try {
      measurements = options.phase === 'before'
        ? await runBefore(client, options)
        : await runAfter(client, options);
      if (options.phase === 'after') {
        restoredState = await readChartState(client);
        if (!matches(restoredState, initialState.symbol, initialState.timeframe)) {
          throw new Error(`SUT final state mismatch before safety net: ${JSON.stringify(restoredState)}`);
        }
        sutRestoredBeforeSafetyNet = true;
      }
    } catch (error) {
      measurementError = error;
    } finally {
      if (!sutRestoredBeforeSafetyNet) {
        safetyNetUsed = true;
        restoredState = await restoreChart(client, initialState);
      }
    }
  } finally {
    // CDP close detaches this debugger session. It does not close the target/tab.
    await client?.close().catch(() => {});
  }

  const targetsAfter = await CDP.List({ host: HOST, port: PORT });
  const versionAfter = await CDP.Version({ host: HOST, port: PORT });
  const idsBefore = targetsBefore.map(candidate => candidate.id).sort();
  const idsAfter = targetsAfter.map(candidate => candidate.id).sort();
  const targetSetUnchanged = JSON.stringify(idsBefore) === JSON.stringify(idsAfter);
  const chartIds = targets => targets
    .filter(candidate => candidate.type === 'page' && /^https:\/\/[^/]*tradingview\.com\/chart\//.test(candidate.url))
    .map(candidate => candidate.id)
    .sort();
  const chartTargetSetUnchanged = JSON.stringify(chartIds(targetsBefore)) === JSON.stringify(chartIds(targetsAfter));
  const restored = matches(restoredState, initialState.symbol, initialState.timeframe);
  const lifecycleUnchanged = versionBefore.webSocketDebuggerUrl === versionAfter.webSocketDebuggerUrl
    && chartTargetSetUnchanged
    && targetsAfter.some(candidate => candidate.id === options.targetId);

  const output = {
    benchmark: 'P1-02 batch state machine',
    phase: options.phase,
    fixture: { symbols: SYMBOLS, timeframes: TIMEFRAMES, runs: options.runs },
    legacy_delay_ms: options.phase === 'before' ? options.legacyDelayMs : null,
    legacy_readiness_timeout_ms: options.phase === 'before' ? options.legacyReadyTimeoutMs : null,
    target: {
      id: target.id,
      title: target.title,
      url: target.url,
      selected_explicitly: true,
      initial_state: initialState,
      restored_state: restoredState,
      restored,
      sut_restored_before_safety_net: sutRestoredBeforeSafetyNet,
      safety_net_used: safetyNetUsed,
    },
    build,
    lifecycle: {
      browser_before: versionBefore.Browser,
      browser_after: versionAfter.Browser,
      target_count_before: targetsBefore.length,
      target_count_after: targetsAfter.length,
      target_set_unchanged: targetSetUnchanged,
      chart_target_set_unchanged: chartTargetSetUnchanged,
      process_tab_session_unchanged: lifecycleUnchanged,
    },
    ohlcv: measurements ? summarize(measurements.ohlcv) : null,
    strategy: measurements ? summarize(measurements.strategy) : null,
  };
  console.log(JSON.stringify(output, null, 2));

  if (measurementError) throw measurementError;
  if (!restored) throw new Error('target state restoration failed');
  if (!lifecycleUnchanged) throw new Error('target/process/tab/session lifecycle changed during benchmark');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
