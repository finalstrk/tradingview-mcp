import { types as utilTypes } from 'node:util';

const HEX_SHA256 = /^[a-f0-9]{64}$/;
const HEX_GIT_SHA1 = /^[a-f0-9]{40}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROVENANCE_KEYS = Object.freeze([
  'baseline_artifact_sha256',
  'baseline_executor_artifact_sha256',
  'baseline_executor_module_path',
  'baseline_executor_repository_commit',
  'baseline_module_path',
  'baseline_repository_commit',
  'benchmark_workload_sha256',
  'envelope_sha256',
  'repository_head',
  'working_tree_diff_sha256',
  'test_manifest_sha256',
  'build_sha256',
  'candidate_artifact_sha256',
  'candidate_executor_artifact_sha256',
  'candidate_executor_module_path',
  'candidate_module_path',
  'candidate_repository_commit',
  'workload_sha256',
  'target',
]);
const TARGET_KEYS = Object.freeze(['targetId', 'sessionId', 'executionContextId']);
const OPERATION_KEYS = Object.freeze(['readProvenance', 'executeSample', 'restore', 'readLedger']);
const ADAPTER_KEYS = Object.freeze(['read', 'mutate', 'pine']);
const LEDGER_KEYS = Object.freeze([
  'restorePassed', 'budgetPassed', 'unknownCount', 'directActionCount',
]);

export class BenchmarkRunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BenchmarkRunnerError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

function fail(code = 'BENCHMARK_INVALID_CONFIGURATION') {
  return new BenchmarkRunnerError(code);
}

function plainData(value) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(value).every(key => (
      typeof key === 'string'
      && descriptors[key]?.enumerable === true
      && Object.hasOwn(descriptors[key], 'value')
    ));
  } catch {
    return false;
  }
}

function exactKeys(value, expected) {
  if (!plainData(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function normalizeTarget(value) {
  if (!exactKeys(value, TARGET_KEYS)) throw fail();
  if (
    !IDENTIFIER.test(value.targetId)
    || !IDENTIFIER.test(value.sessionId)
    || !Number.isSafeInteger(value.executionContextId)
    || value.executionContextId < 0
  ) throw fail();
  return Object.freeze({
    targetId: value.targetId,
    sessionId: value.sessionId,
    executionContextId: value.executionContextId,
  });
}

function normalizeProvenance(value) {
  if (!exactKeys(value, PROVENANCE_KEYS)) throw fail();
  if (!HEX_GIT_SHA1.test(value.repository_head)) throw fail();
  if (!HEX_GIT_SHA1.test(value.baseline_repository_commit)
    || !HEX_GIT_SHA1.test(value.baseline_executor_repository_commit)
    || !HEX_GIT_SHA1.test(value.candidate_repository_commit)
    || value.baseline_repository_commit === value.candidate_repository_commit
    || value.baseline_module_path !== 'src/e2e/benchmark/baseline_workload.js'
    || value.baseline_executor_module_path !== 'src/e2e/benchmark/baseline_executor.js'
    || value.candidate_executor_module_path !== 'src/e2e/benchmark/candidate_executor.js'
    || value.candidate_module_path !== 'src/e2e/benchmark/candidate_workload.js') throw fail();
  for (const key of [
    'baseline_artifact_sha256',
    'baseline_executor_artifact_sha256',
    'benchmark_workload_sha256',
    'envelope_sha256',
    'working_tree_diff_sha256',
    'test_manifest_sha256',
    'build_sha256',
    'candidate_artifact_sha256',
    'candidate_executor_artifact_sha256',
    'workload_sha256',
  ]) {
    if (!HEX_SHA256.test(value[key])) throw fail();
  }
  if (value.baseline_artifact_sha256 === value.candidate_artifact_sha256) throw fail();
  if (value.baseline_executor_artifact_sha256 === value.candidate_executor_artifact_sha256) throw fail();
  return Object.freeze({
    baseline_artifact_sha256: value.baseline_artifact_sha256,
    baseline_executor_artifact_sha256: value.baseline_executor_artifact_sha256,
    baseline_executor_module_path: value.baseline_executor_module_path,
    baseline_executor_repository_commit: value.baseline_executor_repository_commit,
    baseline_module_path: value.baseline_module_path,
    baseline_repository_commit: value.baseline_repository_commit,
    benchmark_workload_sha256: value.benchmark_workload_sha256,
    envelope_sha256: value.envelope_sha256,
    repository_head: value.repository_head,
    working_tree_diff_sha256: value.working_tree_diff_sha256,
    test_manifest_sha256: value.test_manifest_sha256,
    build_sha256: value.build_sha256,
    candidate_artifact_sha256: value.candidate_artifact_sha256,
    candidate_executor_artifact_sha256: value.candidate_executor_artifact_sha256,
    candidate_executor_module_path: value.candidate_executor_module_path,
    candidate_module_path: value.candidate_module_path,
    candidate_repository_commit: value.candidate_repository_commit,
    workload_sha256: value.workload_sha256,
    target: normalizeTarget(value.target),
  });
}

function sameProvenance(actual, expected) {
  try {
    const normalized = normalizeProvenance(actual);
    return PROVENANCE_KEYS.filter(key => key !== 'target').every(key => normalized[key] === expected[key])
      && TARGET_KEYS.every(key => normalized.target[key] === expected.target[key]);
  } catch {
    return false;
  }
}

function normalizeAdapters(value) {
  if (!exactKeys(value, ADAPTER_KEYS)) throw fail();
  if (
    !exactKeys(value.read, ['read']) || typeof value.read.read !== 'function'
    || !exactKeys(value.mutate, ['mutate']) || typeof value.mutate.mutate !== 'function'
    || !exactKeys(value.pine, ['request']) || typeof value.pine.request !== 'function'
  ) throw fail();
  return Object.freeze({ read: value.read, mutate: value.mutate, pine: value.pine });
}

function normalizeOperations(value) {
  if (!exactKeys(value, OPERATION_KEYS)) throw fail();
  if (OPERATION_KEYS.some(key => typeof value[key] !== 'function')) throw fail();
  return value;
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function seededRandom(seed) {
  let state = Number.parseInt(seed.slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function bootstrapCi95(deltas, seed) {
  const random = seededRandom(seed);
  const medians = [];
  for (let iteration = 0; iteration < 2_000; iteration += 1) {
    const resample = [];
    for (let index = 0; index < deltas.length; index += 1) {
      resample.push(deltas[Math.floor(random() * deltas.length)]);
    }
    medians.push(percentile(resample, 0.5));
  }
  return Object.freeze({ lower: percentile(medians, 0.025), upper: percentile(medians, 0.975) });
}

function failure(code) {
  return Object.freeze({ status: 'failure', code });
}

function validLedger(value) {
  return exactKeys(value, LEDGER_KEYS)
    && value.restorePassed === true
    && value.budgetPassed === true
    && value.unknownCount === 0
    && value.directActionCount === 0;
}

/**
 * Construct a one-shot paired benchmark. The runner owns no transport and can
 * execute only through the three already-guarded adapter surfaces supplied by
 * its caller. Raw samples leave the runner solely through artifactSink.
 */
export function createApprovalBoundBenchmarkRunner(configuration) {
  if (!exactKeys(configuration, ['approval', 'sampleCount', 'adapters', 'operations', 'artifactSink'])) {
    throw fail();
  }
  const approval = normalizeProvenance(configuration.approval);
  const adapters = normalizeAdapters(configuration.adapters);
  const operations = normalizeOperations(configuration.operations);
  const { artifactSink, sampleCount } = configuration;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 30 || sampleCount > 10_000) throw fail();
  if (!exactKeys(artifactSink, ['write']) || typeof artifactSink.write !== 'function') throw fail();

  let used = false;
  return Object.freeze({
    approval,
    async run() {
      if (used) throw fail('BENCHMARK_ALREADY_USED');
      used = true;
      const before = [];
      const after = [];
      let resultCode = null;
      let restored = false;

      try {
        const initial = await operations.readProvenance();
        if (!sameProvenance(initial, approval)) resultCode = 'BENCHMARK_PROVENANCE_MISMATCH';

        for (let index = 0; resultCode === null && index < sampleCount; index += 1) {
          for (const phase of ['before', 'after']) {
            const current = await operations.readProvenance();
            if (!sameProvenance(current, approval)) {
              resultCode = 'BENCHMARK_PROVENANCE_MISMATCH';
              break;
            }
            let sample;
            try {
              sample = await operations.executeSample(Object.freeze({ phase, index, adapters }));
            } catch {
              resultCode = 'BENCHMARK_ACTION_FAILED';
              break;
            }
            if (!Number.isFinite(sample) || sample < 0) {
              resultCode = 'BENCHMARK_SAMPLE_INVALID';
              break;
            }
            const postAction = await operations.readProvenance();
            if (!sameProvenance(postAction, approval)) {
              resultCode = 'BENCHMARK_PROVENANCE_MISMATCH';
              break;
            }
            (phase === 'before' ? before : after).push(sample);
          }
        }
      } catch {
        resultCode = 'BENCHMARK_PROVENANCE_MISMATCH';
      } finally {
        try {
          restored = await operations.restore() === true;
        } catch {
          restored = false;
        }
      }

      if (!restored) return failure('BENCHMARK_RESTORE_FAILED');
      let ledger;
      try {
        ledger = await operations.readLedger();
      } catch {
        return failure('BENCHMARK_LEDGER_REJECTED');
      }
      if (!validLedger(ledger)) return failure('BENCHMARK_LEDGER_REJECTED');
      if (resultCode !== null) return failure(resultCode);
      if (before.length !== sampleCount || after.length !== sampleCount) {
        return failure('BENCHMARK_SAMPLE_COUNT_MISMATCH');
      }

      const deltas = after.map((sample, index) => sample - before[index]);
      let artifactReceipt;
      try {
        const bindings = Object.freeze({
          baseline_artifact_sha256: approval.baseline_artifact_sha256,
          baseline_executor_artifact_sha256: approval.baseline_executor_artifact_sha256,
          baseline_executor_module_path: approval.baseline_executor_module_path,
          baseline_executor_repository_commit: approval.baseline_executor_repository_commit,
          baseline_module_path: approval.baseline_module_path,
          baseline_repository_commit: approval.baseline_repository_commit,
          benchmark_workload_sha256: approval.benchmark_workload_sha256,
          envelope_sha256: approval.envelope_sha256,
          repository_head: approval.repository_head,
          working_tree_diff_sha256: approval.working_tree_diff_sha256,
          test_manifest_sha256: approval.test_manifest_sha256,
          build_sha256: approval.build_sha256,
          candidate_artifact_sha256: approval.candidate_artifact_sha256,
          candidate_executor_artifact_sha256: approval.candidate_executor_artifact_sha256,
          candidate_executor_module_path: approval.candidate_executor_module_path,
          candidate_module_path: approval.candidate_module_path,
          candidate_repository_commit: approval.candidate_repository_commit,
          workload_sha256: approval.workload_sha256,
        });
        artifactReceipt = await artifactSink.write(Object.freeze({
          schema: 'tradingview-mcp.benchmark-raw.v1',
          bindings,
          before_samples: Object.freeze([...before]),
          after_samples: Object.freeze([...after]),
        }));
      } catch {
        return failure('BENCHMARK_ARTIFACT_FAILED');
      }
      if (!exactKeys(artifactReceipt, ['artifactId']) || !IDENTIFIER.test(artifactReceipt.artifactId)) {
        return failure('BENCHMARK_ARTIFACT_FAILED');
      }

      return Object.freeze({
        status: 'success',
        code: 'BENCHMARK_OK',
        sample_count: sampleCount,
        before: Object.freeze({ p50: percentile(before, 0.5), p95: percentile(before, 0.95) }),
        after: Object.freeze({ p50: percentile(after, 0.5), p95: percentile(after, 0.95) }),
        paired_delta: Object.freeze({
          p50: percentile(deltas, 0.5),
          p95: percentile(deltas, 0.95),
          bootstrap_ci95: bootstrapCi95(deltas, approval.workload_sha256),
        }),
        artifact_id: artifactReceipt.artifactId,
      });
    },
  });
}
