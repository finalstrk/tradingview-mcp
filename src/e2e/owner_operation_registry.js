import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';

const freeze = value => Object.freeze(value);
const REQUIRED = freeze({
  batch_report: freeze({ initial: 'object', restored: 'object', result: 'object', before_chart_ids: 'array', after_chart_ids: 'array', target_preserved: 'boolean' }),
  quote_report: freeze({ iterations: 'number', mismatches: 'number', chart_mutations: 'number', disconnects: 'number', price_fields_leaked: 'number' }),
  graphics_ohlcv_report: freeze({ target_preserved: 'boolean', chart_state_preserved: 'boolean', disconnects: 'number', summary_matches_live: 'boolean', summary: 'object' }),
  graphics_primitives_report: freeze({ target_preserved: 'boolean', chart_state_preserved: 'boolean', disconnects: 'number', lines: 'object', verbose_lines: 'object', labels: 'object', verbose_labels: 'object', boxes: 'object', verbose_boxes: 'object', tables: 'object' }),
  launch_report: freeze({ success: 'boolean', cdp_ready: 'boolean', reused: 'boolean', old_process_killed: 'boolean', browser: 'string', web_socket_debugger_url: 'string', before: 'object', after: 'object' }),
  pine_response: freeze({}),
  pine_cli_result: freeze({ exit_code: 'number', compiled: 'boolean' }),
});
const op = (kind, budget, method, args, resultSchema) => freeze({
  kind, budget, method, args: freeze(args),
  result_schema: freeze({ type: resultSchema.type, required: REQUIRED[resultSchema.type] }),
  context_policy: freeze({ pre: 'exact', post: 'exact' }),
});

const PINE_ENDPOINT = 'https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000';
const PINE_VALID = '//@version=6\nindicator("API Test", overlay=true)\nplot(close, "Close", color=color.blue)';
const PINE_INVALID = '//@version=6\nindicator("Bad")\nthis_function_does_not_exist()';
const CLI_VALID = '//@version=6\nindicator("test")\nplot(close)';
const CLI_INVALID = '//@version=6\nindicator("test")\nplot(nonexistent_var)';

export const OWNER_OPERATION_REGISTRY = freeze({
  'owner.batch.1': op('cdp', 'cdp_calls', 'batch.fixed_four_row_restore', freeze({ target: 'approved', symbols: freeze(['FX:USDJPY', 'FX:EURUSD']), timeframes: freeze(['5', '15']), count: 10 }), freeze({ type: 'batch_report' })),
  'owner.quote.1': op('cdp', 'cdp_calls', 'quote.fixed_mismatch_20', freeze({ iterations: 20 }), freeze({ type: 'quote_report' })),
  'owner.quote.2': op('cdp', 'cdp_calls', 'quote.fixed_match_20', freeze({ iterations: 20 }), freeze({ type: 'quote_report' })),
  'owner.graphics.ohlcv.1': op('cdp', 'cdp_calls', 'graphics.fixed_ohlcv', freeze({ count: 5 }), freeze({ type: 'graphics_ohlcv_report' })),
  'owner.graphics.primitives.1': op('cdp', 'cdp_calls', 'graphics.fixed_primitives', freeze({ max_labels: 50 }), freeze({ type: 'graphics_primitives_report' })),
  'owner.launch.reuse.1': op('network', 'network_requests', 'launch.fixed_reuse_probe', freeze({ port: 9222, timeout_ms: 1500, kill_existing: false, overall_timeout_ms: 3000 }), freeze({ type: 'launch_report' })),
  'owner.pine_facade.1': op('network', 'network_requests', 'pine_facade.fixed_request', freeze({ url: PINE_ENDPOINT, method: 'POST', source: PINE_VALID }), freeze({ type: 'pine_response' })),
  'owner.pine_facade.2': op('network', 'network_requests', 'pine_facade.fixed_request', freeze({ url: PINE_ENDPOINT, method: 'POST', source: PINE_INVALID }), freeze({ type: 'pine_response' })),
  'owner.pine_facade.3': op('network', 'network_requests', 'pine_facade.fixed_request', freeze({ url: PINE_ENDPOINT, method: 'POST', source: '' }), freeze({ type: 'pine_response' })),
  'owner.pine_facade.4': op('child-process', 'child_processes', 'pine_cli.fixed_check', freeze({ argv: freeze(['pine', 'check']), stdin: CLI_VALID, parameter0: 'node' }), freeze({ type: 'pine_cli_result' })),
  'owner.pine_facade.5': op('child-process', 'child_processes', 'pine_cli.fixed_check', freeze({ argv: freeze(['pine', 'check']), stdin: CLI_INVALID, parameter0: 'node' }), freeze({ type: 'pine_cli_result' })),
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const OWNER_OPERATION_REGISTRY_SHA256 = createHash('sha256').update(canonical(OWNER_OPERATION_REGISTRY)).digest('hex');

class OwnerOperationError extends Error {
  constructor(code) { super(code); this.name = 'OwnerOperationError'; this.code = code; }
}
const fail = code => new OwnerOperationError(code);

function safeResult(value) {
  const seen = new Set();
  let nodes = 0;
  let units = 0;
  function visit(current, depth) {
    if (current === null || typeof current === 'boolean') return current;
    if (typeof current === 'number') { if (!Number.isFinite(current)) throw fail('OWNER_OPERATION_RESULT_INVALID'); return current; }
    if (typeof current === 'string') { units += current.length; if (units > 1_100_000) throw fail('OWNER_OPERATION_RESULT_INVALID'); return current; }
    if (typeof current !== 'object' || utilTypes.isProxy(current) || seen.has(current) || depth > 8 || ++nodes > 2048) throw fail('OWNER_OPERATION_RESULT_INVALID');
    seen.add(current);
    const array = Array.isArray(current);
    if (!array && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) throw fail('OWNER_OPERATION_RESULT_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(current);
    const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
    if (keys.some(key => typeof key !== 'string' || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw fail('OWNER_OPERATION_RESULT_INVALID');
    const output = array ? [] : {};
    for (const key of keys) output[key] = visit(descriptors[key].value, depth + 1);
    return freeze(output);
  }
  return visit(value, 0);
}

function matchesContext(actual, expected) {
  return Boolean(actual && typeof actual === 'object'
    && actual.targetId === expected.targetId
    && actual.sessionId === expected.sessionId
    && actual.executionContextId === expected.executionContextId);
}

function validateResult(value, schema) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('OWNER_OPERATION_RESULT_INVALID');
  for (const [key, type] of Object.entries(schema.required)) {
    if (!Object.hasOwn(value, key)) throw fail('OWNER_OPERATION_RESULT_INVALID');
    if (type === 'array' ? !Array.isArray(value[key]) : typeof value[key] !== type || value[key] === null) {
      throw fail('OWNER_OPERATION_RESULT_INVALID');
    }
  }
  return value;
}

export function createOwnerOperationBridge({ transport, expectedContext, deadlineMs = 15_000 } = {}) {
  let contextKeys = [];
  try { contextKeys = expectedContext && typeof expectedContext === 'object' && !utilTypes.isProxy(expectedContext) ? Object.keys(expectedContext).sort() : []; } catch {}
  if (!transport || typeof transport.executeFixedOperation !== 'function' || typeof transport.getContext !== 'function'
    || !expectedContext || typeof expectedContext !== 'object'
    || contextKeys.length !== 3 || contextKeys[0] !== 'executionContextId' || contextKeys[1] !== 'sessionId' || contextKeys[2] !== 'targetId'
    || typeof expectedContext.targetId !== 'string' || expectedContext.targetId.length === 0
    || typeof expectedContext.sessionId !== 'string' || expectedContext.sessionId.length === 0
    || !Number.isSafeInteger(expectedContext.executionContextId) || expectedContext.executionContextId < 0
    || !Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000) throw fail('OWNER_OPERATION_CONFIGURATION_INVALID');
  const fixedContext = freeze({
    targetId: expectedContext.targetId,
    sessionId: expectedContext.sessionId,
    executionContextId: expectedContext.executionContextId,
  });
  return freeze({
    async execute(operationId) {
      const operation = OWNER_OPERATION_REGISTRY[operationId];
      if (!operation) throw fail('OWNER_OPERATION_DENIED');
      const deadlineAt = Date.now() + deadlineMs;
      const withinDeadline = async callback => {
        const remaining = deadlineAt - Date.now();
        if (remaining <= 0) throw fail('OWNER_OPERATION_DEADLINE_EXCEEDED');
        let timer;
        try {
          return await Promise.race([
            Promise.resolve().then(callback),
            new Promise((_, reject) => { timer = setTimeout(() => reject(fail('OWNER_OPERATION_DEADLINE_EXCEEDED')), remaining); }),
          ]);
        } finally { clearTimeout(timer); }
      };
      try {
        const before = await withinDeadline(() => Reflect.apply(transport.getContext, transport, []));
        if (!matchesContext(before, fixedContext)) throw fail('OWNER_OPERATION_CONTEXT_MISMATCH');
        const result = await withinDeadline(() => Reflect.apply(transport.executeFixedOperation, transport, [operationId, operation, fixedContext]));
        const after = await withinDeadline(() => Reflect.apply(transport.getContext, transport, []));
        if (!matchesContext(after, fixedContext)) throw fail('OWNER_OPERATION_CONTEXT_MISMATCH');
        return validateResult(safeResult(result), operation.result_schema);
      } catch (error) {
        if (error instanceof OwnerOperationError) throw error;
        throw fail('OWNER_OPERATION_EXECUTION_FAILED');
      }
    },
  });
}
