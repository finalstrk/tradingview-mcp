import CDP from 'chrome-remote-interface';

const CDP_HOST = 'localhost';
const CDP_PORT = 9222;
const MAX_RETRIES = 5;
const BASE_DELAY = 500;
const DEFAULT_OPERATION_TIMEOUT_MS = 15000;
const MAX_OPERATION_TIMEOUT_MS = 30000;

// Known direct API paths discovered via live probing (see PROBE_RESULTS.md)
const KNOWN_PATHS = {
  chartApi: 'window.TradingViewApi._activeChartWidgetWV.value()',
  chartWidgetCollection: 'window.TradingViewApi._chartWidgetCollection',
  bottomWidgetBar: 'window.TradingView.bottomWidgetBar',
  replayApi: 'window.TradingViewApi._replayApi',
  alertService: 'window.TradingViewApi._alertService',
  chartApiInstance: 'window.ChartApiInstance',
  mainSeriesBars: 'window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars()',
  // Phase 1: Strategy data — model().dataSources() → find strategy → .performance().value(), .ordersData(), .reportData()
  strategyStudy: 'chart._chartWidget.model().model().dataSources()',
  // Phase 2: Layouts — getSavedCharts(cb), loadChartFromServer(id)
  layoutManager: 'window.TradingViewApi.getSavedCharts',
  // Phase 5: Symbol search — searchSymbols(query) returns Promise
  symbolSearchApi: 'window.TradingViewApi.searchSymbols',
  // Phase 6: Pine scripts — REST API at pine-facade.tradingview.com/pine-facade/list/?filter=saved
  pineFacadeApi: 'https://pine-facade.tradingview.com/pine-facade',
};

export { KNOWN_PATHS };

/**
 * Sanitize a string for safe interpolation into JavaScript code evaluated via CDP.
 * Uses JSON.stringify to produce a properly escaped JS string literal (with quotes).
 * Prevents injection via quotes, backticks, template literals, or control chars.
 */
export function safeString(str) {
  return JSON.stringify(String(str));
}

/**
 * Validate that a value is a finite number. Throws if NaN, Infinity, or non-numeric.
 * Prevents corrupt values from reaching TradingView APIs that persist to cloud state.
 */
export function requireFinite(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number, got: ${value}`);
  return n;
}

export class CdpOperationError extends Error {
  constructor(message, { code, operation, timeoutMs, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.ambiguous = true;
    this.retryable = false;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      operation: this.operation,
      timeout_ms: this.timeoutMs,
      ambiguous: this.ambiguous,
      retryable: this.retryable,
    };
  }
}

export class CdpDeadlineError extends CdpOperationError {
  constructor(operation, timeoutMs) {
    super(`${operation} exceeded its ${timeoutMs} ms deadline`, {
      code: 'CDP_DEADLINE_EXCEEDED',
      operation,
      timeoutMs,
    });
  }
}

export class CdpAbortError extends CdpOperationError {
  constructor(operation, cause) {
    super(`${operation} was aborted`, {
      code: 'CDP_OPERATION_ABORTED',
      operation,
      cause,
    });
  }
}

class StaleConnectionError extends Error {}

function normalizeTimeout(options, defaultTimeoutMs, maxTimeoutMs) {
  let timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  timeoutMs = Number(timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`timeoutMs must be a positive finite number, got: ${timeoutMs}`);
  }
  if (options.deadline !== undefined) {
    const deadline = options.deadline instanceof Date
      ? options.deadline.getTime()
      : Number(options.deadline);
    if (!Number.isFinite(deadline)) throw new TypeError('deadline must be a Date or epoch milliseconds');
    const remaining = Math.max(0, deadline - Date.now());
    timeoutMs = Math.min(timeoutMs, remaining);
  }
  return Math.min(timeoutMs, maxTimeoutMs);
}

function boundedOperation(operation, {
  operationName,
  timeoutMs,
  errorTimeoutMs = timeoutMs,
  signal,
  setTimeoutFn,
  clearTimeoutFn,
  onStop,
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const cleanup = () => {
      if (timer !== undefined) clearTimeoutFn(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const stop = error => {
      try { onStop?.(error); } catch {}
      settle(reject, error);
    };
    const onAbort = () => stop(new CdpAbortError(operationName, signal.reason));

    if (signal?.aborted) {
      stop(new CdpAbortError(operationName, signal.reason));
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeoutFn(() => stop(new CdpDeadlineError(operationName, errorTimeoutMs)), timeoutMs);

    Promise.resolve()
      .then(operation)
      .then(value => settle(resolve, value), error => settle(reject, error));
  });
}

function abortableSleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let timer;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    signal?.addEventListener('abort', finish, { once: true });
    timer = setTimeout(finish, ms);
  });
}

export function createConnectionManager({
  cdpFactory = CDP,
  fetchFn = (...args) => globalThis.fetch(...args),
  sleep = abortableSleep,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  host = CDP_HOST,
  port = CDP_PORT,
  maxRetries = MAX_RETRIES,
  baseDelay = BASE_DELAY,
  defaultTimeoutMs = DEFAULT_OPERATION_TIMEOUT_MS,
  maxTimeoutMs = MAX_OPERATION_TIMEOUT_MS,
} = {}) {
  let client = null;
  let targetInfo = null;
  let publishedGeneration = 0;
  let generation = 0;
  let connectionAttempt = null;
  const closedClients = new WeakSet();
  const disconnectHandlers = new WeakMap();

  const createOperationContext = (options, operationName) => {
    const timeoutMs = normalizeTimeout(options, defaultTimeoutMs, maxTimeoutMs);
    return {
      operationName,
      timeoutMs,
      deadlineAt: Date.now() + timeoutMs,
      signal: options.signal,
    };
  };

  const runWithinDeadline = (operation, context, onStop) => {
    if (context.signal?.aborted) {
      const error = new CdpAbortError(context.operationName, context.signal.reason);
      try { onStop?.(error); } catch {}
      return Promise.reject(error);
    }
    const remainingMs = context.deadlineAt - Date.now();
    if (remainingMs <= 0) {
      const error = new CdpDeadlineError(context.operationName, context.timeoutMs);
      try { onStop?.(error); } catch {}
      return Promise.reject(error);
    }
    return boundedOperation(operation, {
      operationName: context.operationName,
      timeoutMs: remainingMs,
      errorTimeoutMs: context.timeoutMs,
      signal: context.signal,
      setTimeoutFn,
      clearTimeoutFn,
      onStop,
    });
  };

  const detachDisconnect = candidate => {
    const handler = disconnectHandlers.get(candidate);
    if (!handler) return;
    candidate.removeListener?.('disconnect', handler);
    disconnectHandlers.delete(candidate);
  };

  const closeOnce = async candidate => {
    if (!candidate || closedClients.has(candidate)) return;
    closedClients.add(candidate);
    detachDisconnect(candidate);
    try { await candidate.close?.(); } catch {}
  };

  const clearPublished = (candidate, candidateGeneration) => {
    if (client !== candidate || publishedGeneration !== candidateGeneration) return false;
    client = null;
    targetInfo = null;
    publishedGeneration = 0;
    return true;
  };

  const invalidate = (candidate, candidateGeneration) => {
    clearPublished(candidate, candidateGeneration);
    return closeOnce(candidate);
  };

  const invokeCdpCommand = (candidate, domainName, methodName, params) => {
    const domain = candidate?.[domainName];
    const command = domain?.[methodName];
    if (typeof command !== 'function') {
      throw new TypeError(`CDP command ${domainName}.${methodName} is not available`);
    }
    return params === undefined
      ? command.call(domain)
      : command.call(domain, params);
  };

  const runInitializationCommand = (candidate, connectionState, domainName, methodName) => {
    const operationName = `${domainName}.${methodName}`;
    const context = {
      operationName,
      timeoutMs: defaultTimeoutMs,
      deadlineAt: Date.now() + defaultTimeoutMs,
      signal: connectionState.controller.signal,
    };
    return runWithinDeadline(
      () => invokeCdpCommand(candidate, domainName, methodName),
      context,
      () => void closeOnce(candidate),
    );
  };

  const isAttemptCurrent = attempt => !attempt.abandoned && attempt.generation === generation;

  const abandonAttemptIfUnused = attempt => {
    if (attempt.done || attempt.abandoned || attempt.waiters !== 0 || connectionAttempt !== attempt) return;
    attempt.abandoned = true;
    connectionAttempt = null;
    generation += 1;
    attempt.controller.abort(new Error('CDP connection attempt abandoned'));
    void invalidate(attempt.candidate, attempt.generation);
  };

  const attachDisconnect = (candidate, candidateGeneration, lifecycle) => {
    const handler = () => {
      lifecycle.disconnected = true;
      clearPublished(candidate, candidateGeneration);
      void closeOnce(candidate);
    };
    disconnectHandlers.set(candidate, handler);
    candidate.once?.('disconnect', handler);
  };

  const findChartTarget = async attempt => {
    const response = await fetchFn(`http://${host}:${port}/json/list`, {
      signal: attempt.controller.signal,
    });
    if (response && 'ok' in response && !response.ok) {
      throw new Error(`CDP target discovery returned HTTP ${response.status}`);
    }
    const targets = await response.json();
    if (!Array.isArray(targets)) throw new Error('CDP target discovery returned unexpected data');
    return targets.find(target => target.type === 'page' && /tradingview\.com\/chart/i.test(target.url))
      || targets.find(target => target.type === 'page' && /tradingview/i.test(target.url))
      || null;
  };

  const establishConnection = async connectionState => {
    const candidateGeneration = connectionState.generation;
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      let candidate;
      try {
        if (!isAttemptCurrent(connectionState)) throw new StaleConnectionError('Connection attempt is stale');
        const target = await findChartTarget(connectionState);
        if (!target) throw new Error('No TradingView chart target found. Is TradingView open with a chart?');
        if (!isAttemptCurrent(connectionState)) throw new StaleConnectionError('Connection attempt is stale');

        candidate = await cdpFactory({ host, port, target: target.id });
        connectionState.candidate = candidate;
        if (!isAttemptCurrent(connectionState)) throw new StaleConnectionError('Connection attempt is stale');
        const lifecycle = { disconnected: false };
        attachDisconnect(candidate, candidateGeneration, lifecycle);

        await runInitializationCommand(candidate, connectionState, 'Runtime', 'enable');
        await runInitializationCommand(candidate, connectionState, 'Page', 'enable');
        await runInitializationCommand(candidate, connectionState, 'DOM', 'enable');

        if (lifecycle.disconnected) throw new Error('CDP client disconnected during initialization');
        if (!isAttemptCurrent(connectionState)) throw new StaleConnectionError('Connection attempt is stale');

        client = candidate;
        targetInfo = target;
        publishedGeneration = candidateGeneration;
        return candidate;
      } catch (error) {
        if (candidate) await closeOnce(candidate);
        if (connectionState.candidate === candidate) connectionState.candidate = null;
        if (error instanceof StaleConnectionError || !isAttemptCurrent(connectionState)) throw error;
        lastError = error;
        if (attempt + 1 < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
          await sleep(delay, connectionState.controller.signal);
        }
      }
    }
    throw new Error(`CDP connection failed after ${maxRetries} attempts: ${lastError?.message}`, { cause: lastError });
  };

  const startConnectionAttempt = () => {
    const attempt = {
      generation: ++generation,
      waiters: 0,
      candidate: null,
      abandoned: false,
      done: false,
      controller: new AbortController(),
      promise: null,
    };
    attempt.promise = establishConnection(attempt);
    connectionAttempt = attempt;
    const finish = () => {
      attempt.done = true;
      if (connectionAttempt === attempt) connectionAttempt = null;
    };
    attempt.promise.then(finish, finish);
    return attempt;
  };

  const waitForConnection = async (attempt, context) => {
    attempt.waiters += 1;
    try {
      return await runWithinDeadline(() => attempt.promise, context);
    } finally {
      attempt.waiters -= 1;
      abandonAttemptIfUnused(attempt);
    }
  };

  const getClientWithContext = context => {
    if (context.signal?.aborted) {
      return Promise.reject(new CdpAbortError(context.operationName, context.signal.reason));
    }
    if (context.deadlineAt <= Date.now()) {
      return Promise.reject(new CdpDeadlineError(context.operationName, context.timeoutMs));
    }
    if (client) return Promise.resolve(client);
    const attempt = connectionAttempt || startConnectionAttempt();
    return waitForConnection(attempt, context);
  };

  const getClient = (options = {}) => {
    const context = createOperationContext(options, 'CDP.connect');
    return getClientWithContext(context);
  };

  const stopOperation = (candidate, candidateGeneration, cancelExpression) => {
    if (cancelExpression) {
      try {
        Promise.resolve(candidate.Runtime.evaluate({
          expression: cancelExpression,
          returnByValue: true,
        })).catch(() => {});
      } catch {}
    }
    void invalidate(candidate, candidateGeneration);
  };

  /**
   * Send one raw CDP command under the same bounded lifecycle as evaluate().
   * A command is never replayed: timeout, abort, or transport failure invalidates
   * the client because the remote mutation outcome may be ambiguous.
   */
  const sendCdpCommand = async (domainName, methodName, params = {}, options = {}) => {
    if (typeof domainName !== 'string' || domainName.length === 0) {
      throw new TypeError('domainName must be a non-empty string');
    }
    if (typeof methodName !== 'string' || methodName.length === 0) {
      throw new TypeError('methodName must be a non-empty string');
    }
    const operationName = `${domainName}.${methodName}`;
    const context = createOperationContext(options, operationName);
    const candidate = await getClientWithContext(context);
    const candidateGeneration = publishedGeneration;

    try {
      return await runWithinDeadline(
        () => invokeCdpCommand(candidate, domainName, methodName, params),
        context,
        () => void invalidate(candidate, candidateGeneration),
      );
    } catch (error) {
      if (!(error instanceof CdpOperationError)) {
        void invalidate(candidate, candidateGeneration);
      }
      throw error;
    }
  };

  const evaluate = async (expression, options = {}) => {
    const context = createOperationContext(options, 'Runtime.evaluate');
    const candidate = await getClientWithContext(context);
    const candidateGeneration = publishedGeneration;
    const {
      timeoutMs: _timeoutMs,
      deadline: _deadline,
      signal,
      cancelExpression,
      ...cdpOptions
    } = options;

    let result;
    try {
      result = await runWithinDeadline(
        () => candidate.Runtime.evaluate({
          expression,
          returnByValue: true,
          awaitPromise: cdpOptions.awaitPromise ?? false,
          ...cdpOptions,
        }),
        context,
        () => stopOperation(candidate, candidateGeneration, cancelExpression),
      );
    } catch (error) {
      if (!(error instanceof CdpOperationError)) {
        void invalidate(candidate, candidateGeneration);
      }
      throw error;
    }

    if (result.exceptionDetails) {
      const message = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || 'Unknown evaluation error';
      throw new Error(`JS evaluation error: ${message}`);
    }
    return result.result?.value;
  };

  const evaluateAsync = (expression, options = {}) => evaluate(expression, {
    ...options,
    awaitPromise: true,
  });

  const checkClientHealth = async (options = {}) => {
    const context = createOperationContext(options, 'Runtime.evaluate');
    const candidate = await getClientWithContext(context);
    const candidateGeneration = publishedGeneration;
    try {
      await runWithinDeadline(
        () => candidate.Runtime.evaluate({ expression: '1', returnByValue: true }),
        context,
        () => void invalidate(candidate, candidateGeneration),
      );
      return true;
    } catch (error) {
      void invalidate(candidate, candidateGeneration);
      throw error;
    }
  };

  const getTargetInfo = async (options = {}) => {
    if (!targetInfo) await getClient(options);
    return targetInfo;
  };

  const verifyAndReturn = async (path, name, options = {}) => {
    const exists = await evaluate(
      `typeof (${path}) !== 'undefined' && (${path}) !== null`,
      options,
    );
    if (!exists) {
      throw new Error(`${name} not available at ${path}`);
    }
    return path;
  };

  const getChartApi = (options = {}) => verifyAndReturn(KNOWN_PATHS.chartApi, 'Chart API', options);
  const getChartCollection = (options = {}) => verifyAndReturn(
    KNOWN_PATHS.chartWidgetCollection,
    'Chart Widget Collection',
    options,
  );
  const getBottomBar = (options = {}) => verifyAndReturn(KNOWN_PATHS.bottomWidgetBar, 'Bottom Widget Bar', options);
  const getReplayApi = (options = {}) => verifyAndReturn(KNOWN_PATHS.replayApi, 'Replay API', options);
  const getMainSeriesBars = (options = {}) => verifyAndReturn(KNOWN_PATHS.mainSeriesBars, 'Main Series Bars', options);

  const disconnect = async () => {
    const attempt = connectionAttempt;
    if (attempt) {
      attempt.abandoned = true;
      attempt.controller.abort(new Error('CDP connection disconnected'));
      connectionAttempt = null;
    }
    generation += 1;
    const current = client;
    client = null;
    targetInfo = null;
    publishedGeneration = 0;
    await Promise.all([
      closeOnce(current),
      closeOnce(attempt?.candidate),
    ]);
  };

  return {
    getClient,
    connect: getClient,
    getTargetInfo,
    evaluate,
    evaluateAsync,
    sendCdpCommand,
    checkClientHealth,
    getChartApi,
    getChartCollection,
    getBottomBar,
    getReplayApi,
    getMainSeriesBars,
    disconnect,
  };
}

const defaultManager = createConnectionManager();

export function getClient(options = {}) {
  return defaultManager.getClient(options);
}

export function connect(options = {}) {
  return defaultManager.connect(options);
}

export function getTargetInfo(options = {}) {
  return defaultManager.getTargetInfo(options);
}

export function evaluate(expression, options = {}) {
  return defaultManager.evaluate(expression, options);
}

export function evaluateAsync(expression, options = {}) {
  return defaultManager.evaluateAsync(expression, options);
}

export function sendCdpCommand(domainName, methodName, params = {}, options = {}) {
  return defaultManager.sendCdpCommand(domainName, methodName, params, options);
}

export function checkClientHealth(options = {}) {
  return defaultManager.checkClientHealth(options);
}

export function disconnect() {
  return defaultManager.disconnect();
}

// --- Direct API path helpers ---
// Each returns the STRING expression path after verifying it exists.
// Options are forwarded so discovery shares the caller's deadline/AbortSignal.

export async function getChartApi(options = {}) {
  return defaultManager.getChartApi(options);
}

export async function getChartCollection(options = {}) {
  return defaultManager.getChartCollection(options);
}

export async function getBottomBar(options = {}) {
  return defaultManager.getBottomBar(options);
}

export async function getReplayApi(options = {}) {
  return defaultManager.getReplayApi(options);
}

export async function getMainSeriesBars(options = {}) {
  return defaultManager.getMainSeriesBars(options);
}
