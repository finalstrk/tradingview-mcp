import { randomBytes } from 'node:crypto';
import { createOwnerOperationBridge, OWNER_OPERATION_REGISTRY } from './owner_operation_registry.js';
import { createChartSuiteCaseOwner } from './cases/chart_suite.js';
import { createBatchCaseOwner } from './cases/batch.js';
import { createQuoteCaseOwner } from './cases/quote.js';
import { createPineFacadeCaseOwner } from './cases/pine_facade.js';
import { createGraphicsCaseOwner } from './cases/graphics.js';
import { createLaunchCaseOwner } from './cases/launch.js';

const ORDERED_CASE_IDS = Object.freeze([
  'chart_suite_health_1', 'chart_suite_chart_1', 'chart_suite_data_1', 'chart_suite_pine_1',
  'chart_suite_drawing_1', 'chart_suite_ui_1', 'chart_suite_replay_1', 'chart_suite_alerts_1',
  'chart_suite_watchlist_1', 'chart_suite_indicators_1', 'chart_suite_batch_1',
  'chart_suite_capture_1', 'chart_suite_context_size_1', 'batch_1', 'quote_1', 'quote_2',
  'pine_facade_1', 'pine_facade_2', 'pine_facade_3', 'pine_facade_4', 'pine_facade_5',
  'graphics_ohlcv_1', 'graphics_primitives_1', 'launch_reuse_1',
]);
const CHART_IDS = new Set(ORDERED_CASE_IDS.slice(0, 13));
const GROUPS = Object.freeze([
  Object.freeze({ ids: Object.freeze([...ORDERED_CASE_IDS.slice(0, 13)]), kind: 'chart' }),
  Object.freeze({ ids: Object.freeze(['batch_1']), kind: 'batch' }),
  Object.freeze({ ids: Object.freeze(['quote_1', 'quote_2']), kind: 'quote' }),
  Object.freeze({ ids: Object.freeze([...ORDERED_CASE_IDS.slice(16, 21)]), kind: 'pine' }),
  Object.freeze({ ids: Object.freeze(['graphics_ohlcv_1', 'graphics_primitives_1']), kind: 'graphics' }),
  Object.freeze({ ids: Object.freeze(['launch_reuse_1']), kind: 'launch' }),
]);
const RUNTIME_KEYS = Object.freeze([
  'artifactSink', 'benchmarkAdapters', 'benchmarkOperations', 'guardOperations',
  'ownerTransport', 'reviewedAdapters',
]);
const BROKER_KEYS = Object.freeze(['createBoundSession', 'measureLiveBindings', 'measureStaticBindings']);

function exactFunctions(value, names) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...names].sort().join(',')
    && names.every(name => typeof value[name] === 'function');
}

function validRuntime(runtime) {
  return runtime && typeof runtime === 'object' && !Array.isArray(runtime)
    && Object.keys(runtime).sort().join(',') === RUNTIME_KEYS.join(',')
    && exactFunctions(runtime.reviewedAdapters, ['capture', 'input', 'inspectIdentity', 'mutate', 'network', 'read'])
    && exactFunctions(runtime.ownerTransport, ['executeFixedOperation', 'getContext'])
    && exactFunctions(runtime.guardOperations, [
      'captureInventory', 'cleanupCreated', 'countCreated', 'countOwnerlessMutations',
      'inspectPineSignals', 'inspectReplay', 'inventoriesEqual', 'restoreInventory',
    ])
    && exactFunctions(runtime.benchmarkAdapters.read, ['read'])
    && exactFunctions(runtime.benchmarkAdapters.mutate, ['mutate'])
    && exactFunctions(runtime.benchmarkAdapters.pine, ['request'])
    && exactFunctions(runtime.benchmarkOperations, ['executeSample', 'readProvenance', 'restore'])
    && exactFunctions(runtime.artifactSink, ['write']);
}

function targetFrom(envelope) {
  return Object.freeze({
    targetId: envelope.target_context.target_id,
    sessionId: envelope.session_policy,
    executionContextId: envelope.target_context.execution_context_id,
  });
}

function caseDefinitions() {
  return ORDERED_CASE_IDS.map(id => Object.freeze({
    id,
    surface: id.startsWith('pine_facade_') || id === 'chart_suite_pine_1' ? 'pine' : 'chart',
    mutation: CHART_IDS.has(id),
    requiresPineSignal: id === 'chart_suite_pine_1',
  }));
}

function ownerFor(caseId, control, runtime, target, chartContext) {
  const reviewedAdapters = Object.freeze({
    ...runtime.reviewedAdapters,
    async inspectIdentity(...args) {
      await Reflect.apply(runtime.reviewedAdapters.inspectIdentity, runtime.reviewedAdapters, args);
      return chartContext;
    },
  });
  if (CHART_IDS.has(caseId)) {
    return createChartSuiteCaseOwner({ approvedContext: chartContext, reviewedAdapters, deadlineMs: 15_000 });
  }
  const transport = Object.freeze({
    getContext: (...args) => Reflect.apply(runtime.ownerTransport.getContext, runtime.ownerTransport, args),
    executeFixedOperation(operationId, operation, context) {
      const fixed = OWNER_OPERATION_REGISTRY[operationId];
      if (fixed !== operation) throw new TypeError('OWNER_OPERATION_DENIED');
      return Reflect.apply(runtime.ownerTransport.executeFixedOperation, runtime.ownerTransport, [operationId, operation, context]);
    },
  });
  const operationBridge = createOwnerOperationBridge({ transport, expectedContext: target, deadlineMs: 15_000 });
  if (caseId === 'batch_1') return createBatchCaseOwner({ operationBridge });
  if (caseId.startsWith('quote_')) return createQuoteCaseOwner({ operationBridge });
  if (caseId.startsWith('pine_facade_')) return createPineFacadeCaseOwner({ operationBridge });
  if (caseId.startsWith('graphics_')) return createGraphicsCaseOwner({ operationBridge });
  return createLaunchCaseOwner({ operationBridge });
}

export async function createFixedReviewedGateBLiveConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'approvalEnvelope,approvalFilePath,repositoryRoot'
    || typeof input.approvalFilePath !== 'string' || !input.approvalEnvelope
    || typeof input.repositoryRoot !== 'string') return null;
  const { createProductionRuntimeBroker } = await import('./production_live_runtime.js');
  const target = targetFrom(input.approvalEnvelope);
  const chartContext = Object.freeze({
    targetId: target.targetId,
    sessionId: input.approvalEnvelope.session_policy,
    frameId: input.approvalEnvelope.target_context.frame_id,
    loaderId: input.approvalEnvelope.target_context.loader_id,
    uniqueContextId: input.approvalEnvelope.target_context.unique_context_id,
  });
  const broker = await createProductionRuntimeBroker(Object.freeze({
    approvalEnvelope: input.approvalEnvelope,
    repositoryRoot: input.repositoryRoot,
    target,
  }));
  if (!broker || typeof broker !== 'object' || Array.isArray(broker)
    || Object.keys(broker).sort().join(',') !== BROKER_KEYS.join(',')
    || typeof broker.measureStaticBindings !== 'function' || typeof broker.measureLiveBindings !== 'function'
    || typeof broker.createBoundSession !== 'function') return null;
  const provenance = Object.freeze({
    baseline_artifact_sha256: input.approvalEnvelope.baseline_artifact_sha256,
    baseline_module_path: input.approvalEnvelope.baseline_module_path,
    baseline_executor_artifact_sha256: input.approvalEnvelope.baseline_executor_artifact_sha256,
    baseline_executor_module_path: input.approvalEnvelope.baseline_executor_module_path,
    baseline_executor_repository_commit: input.approvalEnvelope.baseline_executor_repository_commit,
    baseline_repository_commit: input.approvalEnvelope.baseline_repository_commit,
    benchmark_workload_sha256: input.approvalEnvelope.benchmark_workload_sha256,
    envelope_sha256: input.approvalEnvelope.envelope_sha256,
    candidate_artifact_sha256: input.approvalEnvelope.candidate_artifact_sha256,
    candidate_module_path: input.approvalEnvelope.candidate_module_path,
    candidate_executor_artifact_sha256: input.approvalEnvelope.candidate_executor_artifact_sha256,
    candidate_executor_module_path: input.approvalEnvelope.candidate_executor_module_path,
    candidate_repository_commit: input.approvalEnvelope.candidate_repository_commit,
    repository_head: input.approvalEnvelope.repository_head,
    working_tree_diff_sha256: input.approvalEnvelope.working_tree_diff_sha256,
    test_manifest_sha256: input.approvalEnvelope.test_manifest_sha256,
    build_sha256: input.approvalEnvelope.build_sha256,
    workload_sha256: input.approvalEnvelope.workload_sha256,
    target,
  });
  return Object.freeze({
    approvalFilePath: input.approvalFilePath,
    expectedEnvelopeSha256: input.approvalEnvelope.envelope_sha256,
    repositoryRoot: input.repositoryRoot,
    measureStaticBindings: broker.measureStaticBindings,
    stateMachineConfiguration: Object.freeze({
      runId: `run-${randomBytes(24).toString('hex')}`,
      capabilityToken: `cap-${randomBytes(32).toString('hex')}`,
      target,
      cases: Object.freeze(caseDefinitions()),
      adapterDeadlineMs: 30_000,
      createBoundSession: broker.createBoundSession,
      measureLiveBindings: broker.measureLiveBindings,
      async dispatchOwner(session, caseId, _snapshot, control) {
        if (!ORDERED_CASE_IDS.includes(caseId)) return Object.freeze({ status: 'failure', code: 'CASE_FAILED', effect_started: false });
        if (!validRuntime(session)) return Object.freeze({ status: 'failure', code: 'CASE_FAILED', effect_started: false });
        const result = await ownerFor(caseId, control, session, target, chartContext).run(caseId);
        return Object.freeze({
          status: result.status === 'success' ? 'success' : 'unknown',
          code: result.status === 'success' ? 'CASE_OK' : 'CASE_OUTCOME_UNKNOWN',
          effect_started: true,
        });
      },
      runChildCase(client, definition) {
        const group = GROUPS.find(candidate => candidate.ids.includes(definition.id));
        if (!group) throw new TypeError('GATE_B_CHILD_CASE_DENIED');
        return client.dispatch(definition.id);
      },
      benchmarkApproval: provenance,
    }),
  });
}
