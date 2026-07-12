import { types as utilTypes } from 'node:util';

import { CHART_OPERATION_REGISTRY } from './chart_operation_registry.js';
import { OWNER_OPERATION_REGISTRY } from './owner_operation_registry.js';

const CONSTRUCTOR_KEYS = Object.freeze([
  'createArtifactTransport', 'createBenchmarkTransport', 'createChartTransport',
  'createGuardTransport', 'createMeasurementTransport', 'createOwnerTransport',
]);
const TARGET_KEYS = Object.freeze(['executionContextId', 'sessionId', 'targetId']);
const PROVENANCE_KEYS = Object.freeze([
  'baseline_artifact_sha256', 'baseline_executor_artifact_sha256', 'baseline_executor_module_path',
  'baseline_executor_repository_commit', 'baseline_module_path', 'baseline_repository_commit',
  'benchmark_workload_sha256', 'build_sha256', 'candidate_artifact_sha256',
  'candidate_executor_artifact_sha256', 'candidate_executor_module_path', 'candidate_module_path',
  'candidate_repository_commit', 'envelope_sha256', 'repository_head', 'target',
  'test_manifest_sha256', 'working_tree_diff_sha256', 'workload_sha256',
]);
const GUARD_BUDGET = Object.freeze({
  captureInventory: 'cdp_protocol_read_count', inspectReplay: 'cdp_protocol_read_count', inspectPineSignals: 'cdp_protocol_read_count',
  cleanupCreated: 'cdp_protocol_mutation_count', restoreInventory: 'cdp_protocol_mutation_count', countCreated: 'cdp_protocol_read_count',
  countOwnerlessMutations: 'cdp_protocol_read_count', inventoriesEqual: 'cdp_protocol_read_count',
});
const DEADLINE = Symbol('deadline');

export class ProductionRuntimeBrokerError extends Error {
  constructor(code) { super(code); this.name = 'ProductionRuntimeBrokerError'; this.code = code; }
  toJSON() { return { name: this.name, code: this.code, message: this.message }; }
}
const fail = code => new ProductionRuntimeBrokerError(code);

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(descriptors).every(key => typeof key === 'string'
      && descriptors[key].enumerable && Object.hasOwn(descriptors[key], 'value'));
  } catch { return false; }
}

function exact(value, keys) {
  if (!plain(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function normalizeTarget(value) {
  if (!exact(value, TARGET_KEYS)
    || typeof value.targetId !== 'string' || value.targetId.length < 1
    || typeof value.sessionId !== 'string' || value.sessionId.length < 1
    || !Number.isSafeInteger(value.executionContextId) || value.executionContextId < 0) throw fail('RUNTIME_BROKER_CONFIGURATION_INVALID');
  return Object.freeze({ targetId: value.targetId, sessionId: value.sessionId, executionContextId: value.executionContextId });
}

function sameTarget(value, expected) {
  return exact(value, TARGET_KEYS) && TARGET_KEYS.every(key => value[key] === expected[key]);
}

function safeCopy(value, code = 'RUNTIME_BROKER_RESULT_INVALID') {
  const seen = new Set(); let nodes = 0; let units = 0;
  function visit(current, depth) {
    if (current === null || typeof current === 'boolean' || typeof current === 'undefined') return current;
    if (typeof current === 'number') { if (!Number.isFinite(current)) throw fail(code); return current; }
    if (typeof current === 'string') { units += current.length; if (units > 1_100_000) throw fail(code); return current; }
    if (typeof current !== 'object' || utilTypes.isProxy(current) || seen.has(current) || depth > 8 || ++nodes > 2048) throw fail(code);
    seen.add(current);
    const array = Array.isArray(current);
    if (!array && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) throw fail(code);
    const descriptors = Object.getOwnPropertyDescriptors(current);
    const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
    if (keys.some(key => typeof key !== 'string' || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value'))
      || (array && (keys.length !== current.length || keys.some((key, index) => key !== String(index))))) throw fail(code);
    const output = array ? [] : {};
    for (const key of keys) output[key] = visit(descriptors[key].value, depth + 1);
    return Object.freeze(output);
  }
  return visit(value, 0);
}

async function bounded(callback, deadlineMs) {
  let timer;
  const pending = Promise.resolve().then(callback);
  pending.catch(() => {});
  try {
    const result = await Promise.race([pending, new Promise(resolve => { timer = setTimeout(() => resolve(DEADLINE), deadlineMs); })]);
    if (result === DEADLINE) throw fail('RUNTIME_BROKER_DEADLINE_EXCEEDED');
    return result;
  } finally { clearTimeout(timer); }
}

function matchesTemplate(template, actual) {
  if (template && typeof template === 'object' && !Array.isArray(template)
    && Object.keys(template).length === 1 && Object.hasOwn(template, '$argument')) return true;
  if (Array.isArray(template)) return Array.isArray(actual) && template.length === actual.length
    && template.every((value, index) => matchesTemplate(value, actual[index]));
  if (template && typeof template === 'object') return plain(actual)
    && Object.keys(template).sort().join(',') === Object.keys(actual).sort().join(',')
    && Object.keys(template).every(key => matchesTemplate(template[key], actual[key]));
  return Object.is(template, actual);
}

function chartDescriptor(kind, method, payload) {
  if (!plain(payload)) return null;
  for (const operation of Object.values(CHART_OPERATION_REGISTRY)) {
    if (operation.kind !== kind || operation.method !== method) continue;
    if (kind === 'read' || kind === 'mutation') {
      const { argument_names: names, ...fixed } = operation.params;
      if (!Array.isArray(payload.arguments) || payload.arguments.length !== names.length) continue;
      const { arguments: supplied, ...actualFixed } = payload;
      if (!matchesTemplate(fixed, actualFixed)) continue;
      if (supplied.every(value => exact(value, ['value']))) return operation;
    } else if (matchesTemplate(operation.params.request, payload)) return operation;
  }
  return null;
}

function validateConstructors(value) {
  if (!exact(value, CONSTRUCTOR_KEYS) || CONSTRUCTOR_KEYS.some(key => typeof value[key] !== 'function') || !Object.isFrozen(value)) {
    throw fail('RUNTIME_BROKER_CONSTRUCTORS_INVALID');
  }
}

function validateTransport(value, methods) {
  if (!exact(value, [...methods, 'identity'].sort()) || [...methods, 'identity'].some(key => typeof value[key] !== 'function') || !Object.isFrozen(value)) {
    throw fail('RUNTIME_BROKER_TRANSPORT_INVALID');
  }
  return value;
}

/**
 * Creates the production broker around a single fixed set of reviewed transport
 * constructors. Callers cannot inject expressions, endpoints, operation
 * functions, or transports after construction. The resulting broker is bound
 * exactly once to the coordinator-owned IPC control.
 */
export async function assembleProductionRuntimeBroker(configuration, fixedTransportConstructors) {
  if (!exact(configuration, ['deadlineMs', 'target', 'transportContext'])
    || !Number.isInteger(configuration.deadlineMs) || configuration.deadlineMs < 1 || configuration.deadlineMs > 30_000
  ) throw fail('RUNTIME_BROKER_CONFIGURATION_INVALID');
  validateConstructors(fixedTransportConstructors);
  const target = normalizeTarget(configuration.target);
  const constructorInput = Object.freeze({ target, transportContext: safeCopy(configuration.transportContext, 'RUNTIME_BROKER_CONFIGURATION_INVALID') });
  const [chart, owner, guard, benchmark, artifact, measurement] = await Promise.all([
    fixedTransportConstructors.createChartTransport(constructorInput), fixedTransportConstructors.createOwnerTransport(constructorInput),
    fixedTransportConstructors.createGuardTransport(constructorInput), fixedTransportConstructors.createBenchmarkTransport(constructorInput),
    fixedTransportConstructors.createArtifactTransport(constructorInput), fixedTransportConstructors.createMeasurementTransport(constructorInput),
  ]);
  validateTransport(chart, ['execute']); validateTransport(owner, ['execute']); validateTransport(guard, ['execute']);
  validateTransport(benchmark, ['executeSample', 'restore']); validateTransport(artifact, ['write']); validateTransport(measurement, ['measureLiveBindings', 'measureStaticBindings']);
  const { deadlineMs } = configuration;
  let bound = false;
  let measuredStaticBindings = null;
  let measuredLiveBindings = null;
  let boundProvenance = null;
  const ownerIdentities = new WeakMap();

  function verifyOwnerIdentity(transport, actual) {
    if (!exact(actual, TARGET_KEYS)
      || actual.targetId !== target.targetId
      || actual.executionContextId !== target.executionContextId
      || typeof actual.sessionId !== 'string' || actual.sessionId.length < 1
      || actual.sessionId === target.sessionId) throw fail('RUNTIME_BROKER_CONTEXT_MISMATCH');
    const baseline = ownerIdentities.get(transport);
    if (baseline && !sameTarget(actual, baseline)) throw fail('RUNTIME_BROKER_CONTEXT_MISMATCH');
    if (!baseline) ownerIdentities.set(transport, Object.freeze({ ...actual }));
  }

  async function identityChecked(transport, callback, control = null) {
    try {
      const before = await bounded(() => Reflect.apply(transport.identity, transport, [control]), deadlineMs);
      verifyOwnerIdentity(transport, before);
      const result = await bounded(callback, deadlineMs);
      const after = await bounded(() => Reflect.apply(transport.identity, transport, [control]), deadlineMs);
      verifyOwnerIdentity(transport, after);
      return safeCopy(result);
    } catch (error) {
      if (error instanceof ProductionRuntimeBrokerError) throw error;
      throw fail(error?.code === 'IPC_BUDGET_EXCEEDED' ? 'RUNTIME_BROKER_BUDGET_EXCEEDED' : 'RUNTIME_BROKER_OPERATION_FAILED');
    }
  }

  return Object.freeze({
    async measureStaticBindings() {
      measuredStaticBindings = safeCopy(await Reflect.apply(measurement.measureStaticBindings, measurement, []));
      return measuredStaticBindings;
    },
    async measureLiveBindings(control) {
      if (!exact(control, ['authorize', 'snapshot']) || typeof control.authorize !== 'function'
        || typeof control.snapshot !== 'function' || !Object.isFrozen(control)) throw fail('RUNTIME_BROKER_CONTROL_INVALID');
      measuredLiveBindings = await identityChecked(measurement, () => Reflect.apply(measurement.measureLiveBindings, measurement, [control]), control);
      return measuredLiveBindings;
    },
    createBoundSession(control, authoritativeBindings) {
      if (bound) throw fail('RUNTIME_BROKER_ALREADY_BOUND');
      if (!exact(control, ['authorize', 'snapshot']) || typeof control.authorize !== 'function'
        || typeof control.snapshot !== 'function' || !Object.isFrozen(control)) throw fail('RUNTIME_BROKER_CONTROL_INVALID');
      if (!Object.isSealed(authoritativeBindings) || !exact(authoritativeBindings, PROVENANCE_KEYS)
        || !sameTarget(authoritativeBindings.target, target) || !measuredStaticBindings || !measuredLiveBindings
        || authoritativeBindings.repository_head !== measuredStaticBindings.repository_head
        || authoritativeBindings.working_tree_diff_sha256 !== measuredStaticBindings.working_tree_diff_sha256
        || authoritativeBindings.test_manifest_sha256 !== measuredStaticBindings.test_manifest_sha256
        || authoritativeBindings.build_sha256 !== measuredLiveBindings.build_sha256) {
        throw fail('RUNTIME_BROKER_AUTHORITY_INVALID');
      }
      boundProvenance = safeCopy(authoritativeBindings, 'RUNTIME_BROKER_AUTHORITY_INVALID');
      bound = true;
      const invoke = async (transport, counters, callback) => {
        let callbackError;
        let result;
        try {
          const before = await bounded(() => Reflect.apply(transport.identity, transport, [control]), deadlineMs);
          verifyOwnerIdentity(transport, before);
          result = await bounded(() => callback(control, counters), deadlineMs);
        } catch (error) {
          callbackError = error;
        } finally {
          try {
            const after = await bounded(() => Reflect.apply(transport.identity, transport, [control]), deadlineMs);
            verifyOwnerIdentity(transport, after);
          } catch (cleanupError) {
            if (!callbackError) callbackError = cleanupError;
          }
        }
        if (callbackError instanceof ProductionRuntimeBrokerError) throw callbackError;
        if (callbackError?.code === 'IPC_BUDGET_EXCEEDED') throw fail('RUNTIME_BROKER_BUDGET_EXCEEDED');
        if (callbackError) throw fail('RUNTIME_BROKER_OPERATION_FAILED');
        return safeCopy(result);
      };
      const direct = async callback => {
        try { return safeCopy(await bounded(callback, deadlineMs)); }
        catch (error) {
          if (error instanceof ProductionRuntimeBrokerError) throw error;
          if (error?.code === 'IPC_BUDGET_EXCEEDED') throw fail('RUNTIME_BROKER_BUDGET_EXCEEDED');
          throw fail('RUNTIME_BROKER_OPERATION_FAILED');
        }
      };
      const chartCall = (kind, method, payload) => {
        const operation = chartDescriptor(kind, method, payload);
        if (!operation) throw fail('RUNTIME_BROKER_OPERATION_DENIED');
        const counters = kind === 'network'
          ? [operation.budget_key, 'harness_initiated_network_count']
          : kind === 'input' && operation.budget_key === 'ctrl_s_chord_count'
            ? ['key_event_count', 'ctrl_s_chord_count'] : operation.budget_key;
        return invoke(chart, counters, (actualControl, actualCounters) => Reflect.apply(chart.execute, chart, [kind, method, safeCopy(payload), target, actualControl, actualCounters]));
      };
      const reviewedAdapters = Object.freeze({
        inspectIdentity: () => invoke(chart, 'cdp_protocol_read_count', async () => target),
        read: (method, params) => chartCall('read', method, params),
        mutate: (method, params) => chartCall('mutation', method, params),
        input: (method, params) => chartCall('input', method, params),
        capture: (method, params) => chartCall('capture', method, params),
        network: request => chartCall('network', 'POST', request),
      });
      const ownerTransport = Object.freeze({
        getContext: () => invoke(owner, 'cdp_protocol_read_count', async () => target),
        executeFixedOperation(operationId, operation, actualTarget) {
          const fixed = OWNER_OPERATION_REGISTRY[operationId];
          if (!fixed || fixed !== operation || !sameTarget(actualTarget, target)) throw fail('RUNTIME_BROKER_OPERATION_DENIED');
          const counters = fixed.kind === 'cdp' ? ['logical_operation_count', 'cdp_protocol_read_count']
            : fixed.kind === 'network' ? (operationId.startsWith('owner.pine_facade.')
              ? ['logical_operation_count', 'network_request_count']
              : ['logical_operation_count', 'network_request_count'])
              : ['logical_operation_count', 'child_process_count'];
          return invoke(owner, counters, (actualControl, actualCounters) => Reflect.apply(owner.execute, owner, [operationId, fixed, target, actualControl, actualCounters]));
        },
      });
      const guardOperations = Object.freeze(Object.fromEntries(Object.entries(GUARD_BUDGET).map(([name, counter]) => [name, (...args) => {
        const targetArgument = args.find(value => sameTarget(value, target));
        if (!targetArgument && name !== 'inventoriesEqual') throw fail('RUNTIME_BROKER_CONTEXT_MISMATCH');
        return invoke(guard, counter, (actualControl, actualCounters) => Reflect.apply(guard.execute, guard, [name, safeCopy(args), target, actualControl, actualCounters]));
      }])));
      const benchmarkAdapters = Object.freeze({
        read: Object.freeze({ read: (method, params) => reviewedAdapters.read(method, params) }),
        mutate: Object.freeze({ mutate: (method, params) => reviewedAdapters.mutate(method, params) }),
        pine: Object.freeze({ request: request => reviewedAdapters.network(request) }),
      });
      const benchmarkOperations = Object.freeze({
        readProvenance: () => invoke(measurement, 'cdp_protocol_read_count', async () => boundProvenance),
        executeSample(sample) {
          if (!exact(sample, ['adapters', 'index', 'phase'])
            || sample.adapters?.read !== benchmarkAdapters.read
            || sample.adapters?.mutate !== benchmarkAdapters.mutate
            || sample.adapters?.pine !== benchmarkAdapters.pine
            || !['before', 'after'].includes(sample.phase) || !Number.isSafeInteger(sample.index) || sample.index < 0) {
            throw fail('RUNTIME_BROKER_OPERATION_DENIED');
          }
          const fixedSample = Object.freeze({ phase: sample.phase, index: sample.index });
          return direct(() => Reflect.apply(benchmark.executeSample, benchmark, [fixedSample, target, boundProvenance, control]));
        },
        restore: () => direct(() => Reflect.apply(benchmark.restore, benchmark, [target, boundProvenance, control])),
      });
      const artifactSink = Object.freeze({
        write: value => invoke(artifact, 'capture_count', (actualControl, actualCounters) => Reflect.apply(artifact.write, artifact, [safeCopy(value), boundProvenance, actualControl, actualCounters])),
      });
      return Object.freeze({ artifactSink, benchmarkAdapters, benchmarkOperations, guardOperations, ownerTransport, reviewedAdapters });
    },
  });
}
