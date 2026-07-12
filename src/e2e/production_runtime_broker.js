import { assembleProductionRuntimeBroker } from './production_runtime_broker_core.js';
import { FIXED_PRODUCTION_TRANSPORT_CONSTRUCTORS } from './production_runtime_transports.js';

/** Production entry point. Transport constructors are fixed by module import. */
export function createProductionRuntimeBroker(configuration) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)
    || Object.keys(configuration).sort().join(',') !== 'approvalEnvelope,repositoryRoot,target'
    || typeof configuration.repositoryRoot !== 'string' || !configuration.approvalEnvelope) {
    throw new TypeError('RUNTIME_BROKER_CONFIGURATION_INVALID');
  }
  const envelope = configuration.approvalEnvelope;
  const transportContext = Object.freeze({
    repositoryRoot: configuration.repositoryRoot,
    sessionPolicy: envelope.session_policy,
    targetContext: envelope.target_context,
    targetPolicy: envelope.target_policy,
    baselineArtifactSha256: envelope.baseline_artifact_sha256,
    baselineRepositoryCommit: envelope.baseline_repository_commit,
    baselineModulePath: envelope.baseline_module_path,
    baselineExecutorArtifactSha256: envelope.baseline_executor_artifact_sha256,
    baselineExecutorRepositoryCommit: envelope.baseline_executor_repository_commit,
    baselineExecutorModulePath: envelope.baseline_executor_module_path,
    candidateArtifactSha256: envelope.candidate_artifact_sha256,
    candidateRepositoryCommit: envelope.candidate_repository_commit,
    candidateModulePath: envelope.candidate_module_path,
    candidateExecutorArtifactSha256: envelope.candidate_executor_artifact_sha256,
    candidateExecutorModulePath: envelope.candidate_executor_module_path,
    benchmarkWorkloadSha256: envelope.benchmark_workload_sha256,
  });
  return assembleProductionRuntimeBroker({
    deadlineMs: 30_000,
    target: configuration.target,
    transportContext,
  }, FIXED_PRODUCTION_TRANSPORT_CONSTRUCTORS);
}
