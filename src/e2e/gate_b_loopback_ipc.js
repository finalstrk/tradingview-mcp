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
  'ADAPTER_FAILURE',
  'ADAPTER_OUTCOME_INVALID',
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
  'ctrl_s_chord_count',
  'full_external_gate_invocation_count',
  'harness_initiated_network_count',
  'key_event_count',
  'page_reload_count',
  'pine_facade_post_count',
  'tab_close_count',
  'tab_create_count',
  'tradingview_process_kill_count',
  'tradingview_process_start_count',
]);

export const GATE_B_IPC_CASE_REGISTRY = Object.freeze({
  ctrl_s: Object.freeze({ ctrl_s_chord_count: 1, key_event_count: 2 }),
  page_reload: Object.freeze({ page_reload_count: 1 }),
  pine_facade_1: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
  pine_facade_2: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
  pine_facade_3: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
  pine_facade_4: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
  pine_facade_5: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
  pine_facade_6: Object.freeze({ pine_facade_post_count: 1, harness_initiated_network_count: 1 }),
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

function validateConfig({ runId, capabilityToken, budgets, adapter }) {
  if (typeof runId !== 'string' || runId.length < 32 || runId.length > 128) throw new TypeError('IPC_CONFIG_INVALID');
  if (typeof capabilityToken !== 'string' || capabilityToken.length < 48 || capabilityToken.length > 256) {
    throw new TypeError('IPC_CONFIG_INVALID');
  }
  if (safeEqual(runId, capabilityToken)) throw new TypeError('IPC_CONFIG_INVALID');
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
  return keys.length === RESULT_KEYS.length
    && keys.every((key, index) => key === RESULT_KEYS[index])
    && RESULT_STATUSES.has(value.status)
    && FIXED_ADAPTER_CODES.has(value.code)
    && ADAPTER_STATUS_CODE[value.status] === value.code;
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
  const { runId, capabilityToken, budgets, adapter } = config;
  const counters = { ...Object.fromEntries(Object.keys(budgets).map(key => [key, 0])), outcome_unknown_count: 0 };
  let lastSequence = 0;

  const snapshot = () => Object.freeze({ ...counters });

  async function dispatch(payload, remoteAddress) {
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

    const deltas = GATE_B_IPC_CASE_REGISTRY[payload.case_id];
    for (const [counter, delta] of Object.entries(deltas)) {
      if (counters[counter] + delta > budgets[counter]) return fixedResult('failure', 'IPC_BUDGET_EXCEEDED');
    }

    // Sequence and budget are reserved synchronously before adapter dispatch.
    lastSequence = payload.sequence;
    for (const [counter, delta] of Object.entries(deltas)) counters[counter] += delta;
    try {
      const result = await adapter(payload.case_id, snapshot());
      if (!validateAdapterResult(result)) {
        counters.outcome_unknown_count += 1;
        return fixedResult('unknown', 'ADAPTER_OUTCOME_INVALID');
      }
      if (result.status === 'unknown') counters.outcome_unknown_count += 1;
      return fixedResult(result.status, result.code);
    } catch {
      return fixedResult('failure', 'ADAPTER_FAILURE');
    }
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
