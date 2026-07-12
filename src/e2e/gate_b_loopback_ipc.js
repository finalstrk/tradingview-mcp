import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';

const REQUEST_KEYS = Object.freeze([
  'capability_token',
  'case_id',
  'registry_sha256',
  'run_id',
  'sequence',
]);
const RESULT_KEYS = Object.freeze(['code', 'status']);
const ADAPTER_RESULT_KEYS = Object.freeze(['code', 'effect_started', 'status']);
const RESULT_STATUSES = new Set(['success', 'failure', 'unknown']);
const FIXED_ADAPTER_CODES = new Set([
  'CASE_OK',
  'CASE_FAILED',
  'CASE_OUTCOME_UNKNOWN',
]);
const ADAPTER_STATUS_CODE = Object.freeze({
  success: 'CASE_OK',
  failure: 'CASE_FAILED',
  unknown: 'CASE_OUTCOME_UNKNOWN',
});
const FIXED_WIRE_CODES = new Set([
  ...FIXED_ADAPTER_CODES,
  'ADAPTER_OUTCOME_INVALID',
  'ADAPTER_OUTCOME_UNKNOWN',
  'IPC_AUTH_FAILED',
  'IPC_BUDGET_EXCEEDED',
  'IPC_CASE_UNKNOWN',
  'IPC_NON_LOOPBACK',
  'IPC_REGISTRY_DRIFT',
  'IPC_REQUEST_INVALID',
  'IPC_RUN_MISMATCH',
  'IPC_SEQUENCE_GAP',
  'IPC_SEQUENCE_REPLAY',
]);
const MAX_REQUEST_BYTES = 4096;
const BUDGET_KEYS = Object.freeze([
  'capture_count',
  'cdp_protocol_input_count',
  'cdp_protocol_mutation_count',
  'cdp_protocol_read_count',
  'cdp_session_attach_count',
  'cdp_session_detach_count',
  'child_process_count',
  'full_external_gate_invocation_count',
  'logical_operation_count',
  'network_request_count',
]);

export const GATE_B_IPC_CASE_REGISTRY = Object.freeze({
  chart_suite_health_1: Object.freeze({}),
  chart_suite_chart_1: Object.freeze({}),
  chart_suite_data_1: Object.freeze({}),
  chart_suite_pine_1: Object.freeze({}),
  chart_suite_drawing_1: Object.freeze({}),
  chart_suite_ui_1: Object.freeze({}),
  chart_suite_replay_1: Object.freeze({}),
  chart_suite_alerts_1: Object.freeze({}),
  chart_suite_watchlist_1: Object.freeze({}),
  chart_suite_indicators_1: Object.freeze({}),
  chart_suite_batch_1: Object.freeze({}),
  chart_suite_capture_1: Object.freeze({}),
  chart_suite_context_size_1: Object.freeze({}),
  batch_1: Object.freeze({}),
  quote_1: Object.freeze({}),
  quote_2: Object.freeze({}),
  pine_facade_1: Object.freeze({}),
  pine_facade_2: Object.freeze({}),
  pine_facade_3: Object.freeze({}),
  pine_facade_4: Object.freeze({}),
  pine_facade_5: Object.freeze({}),
  graphics_ohlcv_1: Object.freeze({}),
  graphics_primitives_1: Object.freeze({}),
  launch_reuse_1: Object.freeze({}),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export const GATE_B_IPC_CASE_REGISTRY_SHA256 = sha256(canonicalJson(GATE_B_IPC_CASE_REGISTRY));

function fixedResult(status, code) {
  return Object.freeze({ status, code });
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function isLoopbackPeer(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function createBudgetAuthorizedAdapters({ adapters, control } = {}) {
  const names = ['capture', 'input', 'inspectIdentity', 'mutate', 'network', 'read'];
  if (
    !adapters || typeof adapters !== 'object' || Array.isArray(adapters)
    || Object.keys(adapters).sort().some((key, index) => key !== names[index])
    || Object.keys(adapters).length !== names.length
    || names.some(name => typeof adapters[name] !== 'function')
    || !control || typeof control.authorize !== 'function'
  ) throw new TypeError('IPC_ADAPTER_CONFIGURATION_INVALID');
  const invoke = (name, counter, args) => {
    control.authorize(counter, 1);
    return Reflect.apply(adapters[name], adapters, args);
  };
  return Object.freeze({
    inspectIdentity: (...args) => invoke('inspectIdentity', 'cdp_protocol_read_count', args),
    read: (...args) => invoke('read', 'cdp_protocol_read_count', args),
    mutate: (...args) => invoke('mutate', 'cdp_protocol_mutation_count', args),
    input(method, params, ...rest) {
      if (!['insertText', 'dispatchMouseEvent', 'dispatchKeyEvent'].includes(method)) throw new TypeError('IPC_INPUT_CAPABILITY_DENIED');
      return invoke('input', 'cdp_protocol_input_count', [method, params, ...rest]);
    },
    capture(method, params, ...rest) {
      if (method !== 'captureScreenshot') throw new TypeError('IPC_CAPTURE_CAPABILITY_DENIED');
      return invoke('capture', 'capture_count', [method, params, ...rest]);
    },
    network(request, ...rest) {
      control.authorize('network_request_count', 1);
      return Reflect.apply(adapters.network, adapters, [request, ...rest]);
    },
  });
}

function validateConfig({ runId, capabilityToken, budgets, adapter, adapterDeadlineMs }) {
  if (typeof runId !== 'string' || runId.length < 32 || runId.length > 128) throw new TypeError('IPC_CONFIG_INVALID');
  if (typeof capabilityToken !== 'string' || capabilityToken.length < 48 || capabilityToken.length > 256) {
    throw new TypeError('IPC_CONFIG_INVALID');
  }
  if (safeEqual(runId, capabilityToken)) throw new TypeError('IPC_CONFIG_INVALID');
  if (!Number.isInteger(adapterDeadlineMs) || adapterDeadlineMs < 1 || adapterDeadlineMs > 30_000) {
    throw new TypeError('IPC_CONFIG_INVALID');
  }
  if (typeof adapter !== 'function' || !budgets || typeof budgets !== 'object' || Array.isArray(budgets)) {
    throw new TypeError('IPC_CONFIG_INVALID');
  }
  for (const counter of BUDGET_KEYS) {
    if (!Number.isSafeInteger(budgets[counter]) || budgets[counter] < 0) throw new TypeError('IPC_CONFIG_INVALID');
  }
  const budgetKeys = Object.keys(budgets).sort();
  if (budgetKeys.length !== BUDGET_KEYS.length || budgetKeys.some((key, index) => key !== BUDGET_KEYS[index])) {
    throw new TypeError('IPC_CONFIG_INVALID');
  }
}

function exactRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === REQUEST_KEYS.length && keys.every((key, index) => key === REQUEST_KEYS[index]);
}

function validateAdapterResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === ADAPTER_RESULT_KEYS.length
    && keys.every((key, index) => key === ADAPTER_RESULT_KEYS[index])
    && RESULT_STATUSES.has(value.status)
    && typeof value.effect_started === 'boolean'
    && FIXED_ADAPTER_CODES.has(value.code)
    && ADAPTER_STATUS_CODE[value.status] === value.code
    && (value.status !== 'failure' || value.effect_started === false)
    && (value.status !== 'success' || value.effect_started === true);
}

function writeResult(response, result) {
  const bytes = Buffer.from(JSON.stringify(result));
  response.writeHead(200, {
    'content-type': 'application/json',
    'content-length': bytes.length,
    'cache-control': 'no-store',
    connection: 'close',
  });
  response.end(bytes);
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_REQUEST_BYTES) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export async function createGateBLoopbackLedger(config) {
  validateConfig(config || {});
  const { runId, capabilityToken, budgets, adapter, adapterDeadlineMs } = config;
  const counters = { ...Object.fromEntries(Object.keys(budgets).map(key => [key, 0])), outcome_unknown_count: 0 };
  let lastSequence = 0;
  let controlBound = false;
  let dispatchAuthorizedEffects = null;

  const snapshot = () => Object.freeze({ ...counters });
  const control = Object.freeze({
    snapshot,
    authorize(counter, delta = 1) {
      if (!BUDGET_KEYS.includes(counter) || !Number.isSafeInteger(delta) || delta < 1) {
        const error = new Error('IPC_BUDGET_INVALID');
        error.code = 'IPC_BUDGET_INVALID';
        throw error;
      }
      if (counters[counter] + delta > budgets[counter]) {
        const error = new Error('IPC_BUDGET_EXCEEDED');
        error.code = 'IPC_BUDGET_EXCEEDED';
        throw error;
      }
      counters[counter] += delta;
      if (dispatchAuthorizedEffects !== null) dispatchAuthorizedEffects += delta;
    },
  });

  async function dispatchOne(payload, remoteAddress) {
    if (!isLoopbackPeer(remoteAddress)) return fixedResult('failure', 'IPC_NON_LOOPBACK');
    if (!exactRequest(payload)) return fixedResult('failure', 'IPC_REQUEST_INVALID');
    if (!safeEqual(payload.run_id, runId)) return fixedResult('failure', 'IPC_RUN_MISMATCH');
    if (!safeEqual(payload.capability_token, capabilityToken)) return fixedResult('failure', 'IPC_AUTH_FAILED');
    if (payload.registry_sha256 !== GATE_B_IPC_CASE_REGISTRY_SHA256) return fixedResult('failure', 'IPC_REGISTRY_DRIFT');
    if (typeof payload.case_id !== 'string' || !Object.hasOwn(GATE_B_IPC_CASE_REGISTRY, payload.case_id)) {
      return fixedResult('failure', 'IPC_CASE_UNKNOWN');
    }
    if (!Number.isSafeInteger(payload.sequence) || payload.sequence <= lastSequence) {
      return fixedResult('failure', 'IPC_SEQUENCE_REPLAY');
    }
    if (payload.sequence !== lastSequence + 1) return fixedResult('failure', 'IPC_SEQUENCE_GAP');

    // Sequence is reserved before dispatch. Individual effects are authorized
    // synchronously by the reviewed adapter immediately before each action.
    lastSequence = payload.sequence;
    dispatchAuthorizedEffects = 0;
    try {
      let timer;
      const result = await Promise.race([
        Promise.resolve().then(() => adapter(payload.case_id, snapshot(), control)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error('IPC_ADAPTER_DEADLINE');
            error.code = 'IPC_ADAPTER_DEADLINE';
            reject(error);
          }, adapterDeadlineMs);
        }),
      ]).finally(() => clearTimeout(timer));
      if (!validateAdapterResult(result)) {
        counters.outcome_unknown_count += 1;
        return fixedResult('unknown', 'ADAPTER_OUTCOME_INVALID');
      }
      if (result.status === 'failure' && dispatchAuthorizedEffects > 0) {
        counters.outcome_unknown_count += 1;
        return fixedResult('unknown', 'ADAPTER_OUTCOME_INVALID');
      }
      if (result.status === 'unknown') counters.outcome_unknown_count += 1;
      return fixedResult(result.status, result.code);
    } catch (error) {
      if (error?.code === 'IPC_BUDGET_EXCEEDED' && dispatchAuthorizedEffects === 0) {
        return fixedResult('failure', 'IPC_BUDGET_EXCEEDED');
      }
      counters.outcome_unknown_count += 1;
      return fixedResult('unknown', 'ADAPTER_OUTCOME_UNKNOWN');
    } finally {
      dispatchAuthorizedEffects = null;
    }
  }

  let dispatchTail = Promise.resolve();
  function dispatch(payload, remoteAddress) {
    const current = dispatchTail.then(() => dispatchOne(payload, remoteAddress));
    dispatchTail = current.then(() => undefined, () => undefined);
    return current;
  }

  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/dispatch') {
      writeResult(response, fixedResult('failure', 'IPC_REQUEST_INVALID'));
      return;
    }
    const payload = await readJson(request);
    const result = payload === null
      ? fixedResult('failure', 'IPC_REQUEST_INVALID')
      : await dispatch(payload, request.socket.remoteAddress);
    writeResult(response, result);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
    server.close();
    throw new Error('IPC_BIND_FAILED');
  }
  let closed = false;
  return Object.freeze({
    port: address.port,
    snapshot,
    bindControl() {
      if (controlBound) throw new TypeError('IPC_CONTROL_ALREADY_BOUND');
      controlBound = true;
      return control;
    },
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(new Error('IPC_CLOSE_FAILED')) : resolve());
        server.closeAllConnections();
      });
    },
  });
}

export function createGateBLedgerClient({ runId, capabilityToken, port, registrySha256 = GATE_B_IPC_CASE_REGISTRY_SHA256 } = {}) {
  if (typeof runId !== 'string' || typeof capabilityToken !== 'string' || !Number.isSafeInteger(port)) {
    throw new TypeError('IPC_CLIENT_CONFIG_INVALID');
  }
  let sequence = 0;
  return Object.freeze({
    async dispatch(caseId) {
      if (typeof caseId !== 'string' || !Object.hasOwn(GATE_B_IPC_CASE_REGISTRY, caseId)) {
        return fixedResult('failure', 'IPC_CASE_UNKNOWN');
      }
      sequence += 1;
      const payload = {
        run_id: runId,
        capability_token: capabilityToken,
        sequence,
        case_id: caseId,
        registry_sha256: registrySha256,
      };
      const bytes = Buffer.from(JSON.stringify(payload));
      return new Promise(resolve => {
        const request = httpRequest({
          host: '127.0.0.1', port, method: 'POST', path: '/dispatch',
          headers: { 'content-type': 'application/json', 'content-length': bytes.length },
        }, response => {
          const chunks = [];
          let length = 0;
          response.on('data', chunk => {
            length += chunk.length;
            if (length <= MAX_REQUEST_BYTES) chunks.push(chunk);
          });
          response.on('end', () => {
            try {
              if (length > MAX_REQUEST_BYTES) throw new Error();
              const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const exactKeys = result && typeof result === 'object' && !Array.isArray(result)
                && Object.keys(result).sort().every((key, index) => key === RESULT_KEYS[index])
                && Object.keys(result).length === RESULT_KEYS.length;
              resolve(exactKeys && RESULT_STATUSES.has(result.status) && FIXED_WIRE_CODES.has(result.code)
                ? fixedResult(result.status, result.code)
                : fixedResult('unknown', 'IPC_RESPONSE_INVALID'));
            } catch {
              resolve(fixedResult('unknown', 'IPC_RESPONSE_INVALID'));
            }
          });
        });
        request.on('error', () => resolve(fixedResult('unknown', 'IPC_UNAVAILABLE')));
        request.end(bytes);
      });
    },
  });
}
