import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants as FS_CONSTANTS } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPhase0ReadOnlyPlan, runPhase0ReadOnly } from '../src/e2e/phase0_read_only.js';
import {
  GATE_B_IPC_CASE_REGISTRY_SHA256,
  createGateBLedgerClient,
  createGateBLoopbackLedger,
} from '../src/e2e/gate_b_loopback_ipc.js';
import { createGuardedE2EHarness } from '../src/e2e/guarded_harness.js';
import { createApprovalBoundBenchmarkRunner } from '../src/e2e/benchmark_runner.js';
import { CHART_OPERATION_REGISTRY_SHA256 } from '../src/e2e/chart_operation_registry.js';
import { OWNER_OPERATION_REGISTRY_SHA256 } from '../src/e2e/owner_operation_registry.js';
import {
  BASELINE_ARTIFACT_SHA256,
  BASELINE_EXECUTOR_ARTIFACT_SHA256,
  BASELINE_EXECUTOR_MODULE_PATH,
  BASELINE_EXECUTOR_REPOSITORY_COMMIT,
  BASELINE_MODULE_PATH,
  BASELINE_REPOSITORY_COMMIT,
  BENCHMARK_WORKLOAD_SHA256,
  CANDIDATE_ARTIFACT_SHA256,
  CANDIDATE_EXECUTOR_ARTIFACT_SHA256,
  CANDIDATE_EXECUTOR_MODULE_PATH,
  CANDIDATE_MODULE_PATH,
  PRODUCTION_PROTOCOL_INVENTORY,
} from '../src/e2e/production_runtime_transports.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);
const OFFLINE_GUARD = join(TEST_DIR, 'offline_network_guard.js');

export const COORDINATOR_SAFE_STOP_CODE = 'OFFLINE_APPROVAL_REQUIRED';
export const GATE_B_SCHEMA_VERSION = 5;
export const COORDINATOR_VERSION = 'gate-b-production-v5';
export const GATE_B_COMMAND = 'npm test';
const MAIN_LIVE_AUTHORITY = Symbol('gate-b-main-live-authority');
const AUTHORITATIVE_BINDINGS = new WeakSet();

export const GATE_B_BUDGETS = Object.freeze({
  ...PRODUCTION_PROTOCOL_INVENTORY,
  full_external_gate_invocation_count: 1,
});

export const LIVE_CASE_REGISTRY = Object.freeze({
  batch_1: Object.freeze({ file: 'tests/batch_e2e.test.js' }),
  quote_1: Object.freeze({ file: 'tests/quote_e2e.test.js' }),
  quote_2: Object.freeze({ file: 'tests/quote_e2e.test.js' }),
  pine_facade_1: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  pine_facade_2: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  pine_facade_3: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  pine_facade_4: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  pine_facade_5: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  graphics_ohlcv_1: Object.freeze({ file: 'tests/graphics_e2e.test.js' }),
  graphics_primitives_1: Object.freeze({ file: 'tests/graphics_e2e.test.js' }),
  launch_reuse_1: Object.freeze({ file: 'tests/launch_e2e.test.js' }),
  chart_suite_health_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_chart_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_data_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_pine_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_drawing_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_ui_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_replay_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_alerts_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_watchlist_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_indicators_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_batch_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_capture_1: Object.freeze({ file: 'tests/e2e.test.js' }),
  chart_suite_context_size_1: Object.freeze({ file: 'tests/e2e.test.js' }),
});

export const GATE_B_ORDERED_CASE_IDS = Object.freeze([
  'chart_suite_health_1', 'chart_suite_chart_1', 'chart_suite_data_1', 'chart_suite_pine_1',
  'chart_suite_drawing_1', 'chart_suite_ui_1', 'chart_suite_replay_1', 'chart_suite_alerts_1',
  'chart_suite_watchlist_1', 'chart_suite_indicators_1', 'chart_suite_batch_1',
  'chart_suite_capture_1', 'chart_suite_context_size_1', 'batch_1', 'quote_1', 'quote_2',
  'pine_facade_1', 'pine_facade_2', 'pine_facade_3', 'pine_facade_4', 'pine_facade_5',
  'graphics_ohlcv_1', 'graphics_primitives_1', 'launch_reuse_1',
]);
export const GATE_B_CHILD_MANIFEST = Object.freeze([
  Object.freeze({ file: 'tests/e2e.test.js', case_ids: Object.freeze([...GATE_B_ORDERED_CASE_IDS.slice(0, 13)]) }),
  Object.freeze({ file: 'tests/batch_e2e.test.js', case_ids: Object.freeze(['batch_1']) }),
  Object.freeze({ file: 'tests/quote_e2e.test.js', case_ids: Object.freeze(['quote_1', 'quote_2']) }),
  Object.freeze({ file: 'tests/pine_facade_e2e.test.js', case_ids: Object.freeze([...GATE_B_ORDERED_CASE_IDS.slice(16, 21)]) }),
  Object.freeze({ file: 'tests/graphics_e2e.test.js', case_ids: Object.freeze(['graphics_ohlcv_1', 'graphics_primitives_1']) }),
  Object.freeze({ file: 'tests/launch_e2e.test.js', case_ids: Object.freeze(['launch_reuse_1']) }),
]);

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const HEX_GIT_SHA1 = /^[0-9a-f]{40}$/;
const HEX_TARGET_ID = /^[0-9a-fA-F]{32}$/;
const GATE_B_ENVELOPE_KEYS = Object.freeze([
  'approval_nonce_sha256',
  'baseline_artifact_sha256',
  'baseline_executor_artifact_sha256',
  'baseline_executor_module_path',
  'baseline_executor_repository_commit',
  'baseline_module_path',
  'baseline_repository_commit',
  'benchmark_config_sha256',
  'benchmark_workload_sha256',
  'build_sha256',
  'candidate_artifact_sha256',
  'candidate_executor_artifact_sha256',
  'candidate_executor_module_path',
  'candidate_module_path',
  'candidate_repository_commit',
  'chart_operation_registry_sha256',
  'child_manifest_sha256',
  'coordinator_version',
  'envelope_sha256',
  'execution_case_set_sha256',
  'expires_at',
  'external_action_budgets',
  'full_command',
  'ipc_case_registry_sha256',
  'issued_at',
  'live_adapter_dispatch',
  'live_case_registry_sha256',
  'owner_operation_registry_sha256',
  'repository_head',
  'schema_version',
  'session_policy',
  'target_context',
  'target_policy',
  'test_manifest_sha256',
  'working_tree_diff_sha256',
  'workload_sha256',
]);

export class GateBError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GateBError';
    this.code = code;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

export function digestJson(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

export function gateBInventoryIsExact(snapshot, budgets = GATE_B_BUDGETS) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || !budgets || typeof budgets !== 'object' || Array.isArray(budgets)) return false;
  const expectedKeys = [...Object.keys(budgets), 'outcome_unknown_count'].sort();
  const actualKeys = Object.keys(snapshot).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && snapshot.outcome_unknown_count === 0
    && Object.entries(budgets).every(([key, ceiling]) => snapshot[key] === ceiling);
}

function sealAuthoritativeBindings(envelope, measured) {
  const target = Object.freeze({
    targetId: measured.target_context.target_id,
    sessionId: envelope.session_policy,
    executionContextId: measured.target_context.execution_context_id,
  });
  const value = Object.seal({
    baseline_artifact_sha256: envelope.baseline_artifact_sha256,
    baseline_executor_artifact_sha256: envelope.baseline_executor_artifact_sha256,
    baseline_executor_module_path: envelope.baseline_executor_module_path,
    baseline_executor_repository_commit: envelope.baseline_executor_repository_commit,
    baseline_module_path: envelope.baseline_module_path,
    baseline_repository_commit: envelope.baseline_repository_commit,
    benchmark_workload_sha256: envelope.benchmark_workload_sha256,
    build_sha256: measured.build_sha256,
    candidate_artifact_sha256: envelope.candidate_artifact_sha256,
    candidate_executor_artifact_sha256: envelope.candidate_executor_artifact_sha256,
    candidate_executor_module_path: envelope.candidate_executor_module_path,
    candidate_module_path: envelope.candidate_module_path,
    candidate_repository_commit: envelope.candidate_repository_commit,
    envelope_sha256: envelope.envelope_sha256,
    repository_head: measured.repository_head,
    target,
    test_manifest_sha256: measured.test_manifest_sha256,
    working_tree_diff_sha256: measured.working_tree_diff_sha256,
    workload_sha256: envelope.workload_sha256,
  });
  AUTHORITATIVE_BINDINGS.add(value);
  return value;
}

export const LIVE_CASE_REGISTRY_SHA256 = digestJson(LIVE_CASE_REGISTRY);
export const GATE_B_EXECUTION_CASE_SET_SHA256 = digestJson(GATE_B_ORDERED_CASE_IDS);
export const GATE_B_CHILD_MANIFEST_SHA256 = digestJson(GATE_B_CHILD_MANIFEST);
export const GATE_B_BENCHMARK_CONFIGURATION = Object.freeze({
  sample_count: 30,
  pairing: 'interleaved_before_after',
  statistic: 'paired_delta_p50_p95_bootstrap_ci95',
  raw_artifact_schema: 'tradingview-mcp.benchmark-raw.v1',
});
export const GATE_B_BENCHMARK_CONFIG_SHA256 = digestJson(GATE_B_BENCHMARK_CONFIGURATION);
export const GATE_B_WORKLOAD_SHA256 = digestJson({
  ordered_case_ids: GATE_B_ORDERED_CASE_IDS,
  child_manifest_sha256: GATE_B_CHILD_MANIFEST_SHA256,
  budgets: GATE_B_BUDGETS,
  benchmark_config_sha256: GATE_B_BENCHMARK_CONFIG_SHA256,
  benchmark_workload_sha256: BENCHMARK_WORKLOAD_SHA256,
  baseline_artifact_sha256: BASELINE_ARTIFACT_SHA256,
  baseline_executor_artifact_sha256: BASELINE_EXECUTOR_ARTIFACT_SHA256,
  candidate_artifact_sha256: CANDIDATE_ARTIFACT_SHA256,
  candidate_executor_artifact_sha256: CANDIDATE_EXECUTOR_ARTIFACT_SHA256,
  chart_operation_registry_sha256: CHART_OPERATION_REGISTRY_SHA256,
  owner_operation_registry_sha256: OWNER_OPERATION_REGISTRY_SHA256,
});

export function resolveLiveCase(caseId, suppliedRegistryDigest) {
  if (suppliedRegistryDigest !== LIVE_CASE_REGISTRY_SHA256) {
    throw new GateBError('GATE_B_REGISTRY_DIGEST_MISMATCH');
  }
  if (typeof caseId !== 'string' || !Object.hasOwn(LIVE_CASE_REGISTRY, caseId)) {
    throw new GateBError('GATE_B_UNKNOWN_CASE');
  }
  return LIVE_CASE_REGISTRY[caseId];
}

export function buildGateBApprovalDraft({
  repositoryHead,
  workingTreeDiffSha256,
  testManifestSha256,
  approvalNonceSha256,
  targetPolicy,
  targetContext,
  buildSha256,
  issuedAt = '2020-01-01T00:00:00.000Z',
  expiresAt,
} = {}) {
  const draft = {
    schema_version: GATE_B_SCHEMA_VERSION,
    coordinator_version: COORDINATOR_VERSION,
    repository_head: repositoryHead,
    working_tree_diff_sha256: workingTreeDiffSha256,
    test_manifest_sha256: testManifestSha256,
    approval_nonce_sha256: approvalNonceSha256,
    benchmark_config_sha256: GATE_B_BENCHMARK_CONFIG_SHA256,
    benchmark_workload_sha256: BENCHMARK_WORKLOAD_SHA256,
    baseline_artifact_sha256: BASELINE_ARTIFACT_SHA256,
    baseline_executor_artifact_sha256: BASELINE_EXECUTOR_ARTIFACT_SHA256,
    baseline_executor_module_path: BASELINE_EXECUTOR_MODULE_PATH,
    baseline_executor_repository_commit: BASELINE_EXECUTOR_REPOSITORY_COMMIT,
    baseline_module_path: BASELINE_MODULE_PATH,
    baseline_repository_commit: BASELINE_REPOSITORY_COMMIT,
    build_sha256: buildSha256,
    child_manifest_sha256: GATE_B_CHILD_MANIFEST_SHA256,
    chart_operation_registry_sha256: CHART_OPERATION_REGISTRY_SHA256,
    candidate_artifact_sha256: CANDIDATE_ARTIFACT_SHA256,
    candidate_executor_artifact_sha256: CANDIDATE_EXECUTOR_ARTIFACT_SHA256,
    candidate_executor_module_path: CANDIDATE_EXECUTOR_MODULE_PATH,
    candidate_module_path: CANDIDATE_MODULE_PATH,
    candidate_repository_commit: repositoryHead,
    owner_operation_registry_sha256: OWNER_OPERATION_REGISTRY_SHA256,
    execution_case_set_sha256: GATE_B_EXECUTION_CASE_SET_SHA256,
    ipc_case_registry_sha256: GATE_B_IPC_CASE_REGISTRY_SHA256,
    live_case_registry_sha256: LIVE_CASE_REGISTRY_SHA256,
    target_policy: targetPolicy,
    target_context: targetContext,
    session_policy: 'owner_local_pre_post',
    workload_sha256: GATE_B_WORKLOAD_SHA256,
    external_action_budgets: GATE_B_BUDGETS,
    full_command: GATE_B_COMMAND,
    issued_at: issuedAt,
    expires_at: expiresAt,
    live_adapter_dispatch: 'INJECTED_REVIEWED_ADAPTER_ONLY',
  };
  return { ...draft, envelope_sha256: digestJson(draft) };
}

function isExactTargetContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  const keys = Object.keys(context).sort();
  const expected = ['execution_context_id', 'frame_id', 'loader_id', 'target_id', 'unique_context_id'];
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && HEX_TARGET_ID.test(context.target_id || '')
    && Number.isSafeInteger(context.execution_context_id)
    && context.execution_context_id >= 0
    && ['frame_id', 'loader_id', 'unique_context_id'].every(key => (
      typeof context[key] === 'string' && context[key].length > 0 && context[key].length <= 256
    ));
}

function isExactExplicitTargetPolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  const keys = Object.keys(policy).sort();
  return keys.length === 2
    && keys[0] === 'kind'
    && keys[1] === 'target_id'
    && policy.kind === 'explicit_target_id'
    && HEX_TARGET_ID.test(policy.target_id || '');
}

export function validateGateBApproval(envelope, expected, nowMs = Date.now()) {
  if (!envelope || typeof envelope !== 'object') throw new GateBError('GATE_B_ENVELOPE_INVALID');
  const envelopeKeys = Object.keys(envelope).sort();
  if (
    envelopeKeys.length !== GATE_B_ENVELOPE_KEYS.length
    || envelopeKeys.some((key, index) => key !== GATE_B_ENVELOPE_KEYS[index])
  ) {
    throw new GateBError('GATE_B_ENVELOPE_INVALID');
  }
  const suppliedDigest = envelope.envelope_sha256;
  const unsigned = { ...envelope };
  delete unsigned.envelope_sha256;
  if (!HEX_SHA256.test(suppliedDigest || '') || digestJson(unsigned) !== suppliedDigest) {
    throw new GateBError('GATE_B_ENVELOPE_DIGEST_MISMATCH');
  }
  if (
    !HEX_GIT_SHA1.test(envelope.repository_head || '')
    || !HEX_SHA256.test(envelope.working_tree_diff_sha256 || '')
    || !HEX_SHA256.test(envelope.test_manifest_sha256 || '')
    || !HEX_SHA256.test(envelope.approval_nonce_sha256 || '')
    || !HEX_SHA256.test(envelope.build_sha256 || '')
    || !HEX_SHA256.test(envelope.baseline_artifact_sha256 || '')
    || !HEX_SHA256.test(envelope.baseline_executor_artifact_sha256 || '')
    || !HEX_SHA256.test(envelope.candidate_artifact_sha256 || '')
    || !HEX_SHA256.test(envelope.candidate_executor_artifact_sha256 || '')
    || !HEX_SHA256.test(envelope.benchmark_workload_sha256 || '')
    || envelope.baseline_artifact_sha256 === envelope.candidate_artifact_sha256
    || envelope.baseline_executor_artifact_sha256 === envelope.candidate_executor_artifact_sha256
    || envelope.baseline_repository_commit === envelope.candidate_repository_commit
    || envelope.candidate_repository_commit !== envelope.repository_head
    || !isExactExplicitTargetPolicy(envelope.target_policy)
    || !isExactTargetContext(envelope.target_context)
    || envelope.target_policy.target_id !== envelope.target_context.target_id
  ) {
    throw new GateBError('GATE_B_ENVELOPE_INVALID');
  }
  const issuedMs = Date.parse(envelope.issued_at);
  const expiresMs = Date.parse(envelope.expires_at);
  if (!Number.isFinite(issuedMs) || !Number.isFinite(expiresMs) || issuedMs >= expiresMs || issuedMs > nowMs) {
    throw new GateBError('GATE_B_ENVELOPE_INVALID');
  }
  if (expiresMs <= nowMs) throw new GateBError('GATE_B_APPROVAL_EXPIRED');
  const fixedBindings = {
    schema_version: GATE_B_SCHEMA_VERSION,
    coordinator_version: COORDINATOR_VERSION,
    full_command: GATE_B_COMMAND,
    external_action_budgets: GATE_B_BUDGETS,
    session_policy: 'owner_local_pre_post',
    benchmark_config_sha256: GATE_B_BENCHMARK_CONFIG_SHA256,
    benchmark_workload_sha256: BENCHMARK_WORKLOAD_SHA256,
    baseline_artifact_sha256: BASELINE_ARTIFACT_SHA256,
    baseline_executor_artifact_sha256: BASELINE_EXECUTOR_ARTIFACT_SHA256,
    baseline_executor_module_path: BASELINE_EXECUTOR_MODULE_PATH,
    baseline_executor_repository_commit: BASELINE_EXECUTOR_REPOSITORY_COMMIT,
    baseline_module_path: BASELINE_MODULE_PATH,
    baseline_repository_commit: BASELINE_REPOSITORY_COMMIT,
    child_manifest_sha256: GATE_B_CHILD_MANIFEST_SHA256,
    chart_operation_registry_sha256: CHART_OPERATION_REGISTRY_SHA256,
    candidate_artifact_sha256: CANDIDATE_ARTIFACT_SHA256,
    candidate_executor_artifact_sha256: CANDIDATE_EXECUTOR_ARTIFACT_SHA256,
    candidate_executor_module_path: CANDIDATE_EXECUTOR_MODULE_PATH,
    candidate_module_path: CANDIDATE_MODULE_PATH,
    owner_operation_registry_sha256: OWNER_OPERATION_REGISTRY_SHA256,
    execution_case_set_sha256: GATE_B_EXECUTION_CASE_SET_SHA256,
    workload_sha256: GATE_B_WORKLOAD_SHA256,
  };
  for (const [field, value] of Object.entries(fixedBindings)) {
    if (digestJson(envelope[field]) !== digestJson(value)) {
      throw new GateBError('GATE_B_APPROVAL_BINDING_MISMATCH');
    }
  }
  const requiredMeasuredBindings = [
    'repository_head',
    'working_tree_diff_sha256',
    'test_manifest_sha256',
    'target_policy',
    'target_context',
    'build_sha256',
  ];
  for (const field of requiredMeasuredBindings) {
    if (!expected || !Object.hasOwn(expected, field)) {
      throw new GateBError('GATE_B_EXPECTED_BINDING_MISSING');
    }
  }
  for (const [field, value] of Object.entries(expected || {})) {
    if (digestJson(envelope[field]) !== digestJson(value)) {
      throw new GateBError('GATE_B_APPROVAL_BINDING_MISMATCH');
    }
  }
  if (envelope.live_case_registry_sha256 !== LIVE_CASE_REGISTRY_SHA256) {
    throw new GateBError('GATE_B_REGISTRY_DIGEST_MISMATCH');
  }
  if (envelope.ipc_case_registry_sha256 !== GATE_B_IPC_CASE_REGISTRY_SHA256) {
    throw new GateBError('GATE_B_REGISTRY_DIGEST_MISMATCH');
  }
  if (envelope.live_adapter_dispatch !== 'INJECTED_REVIEWED_ADAPTER_ONLY') {
    throw new GateBError('GATE_B_LIVE_DISPATCH_DISABLED');
  }
  return true;
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

const LEASE_HANDLES = new WeakMap();

async function secureRegularFile(path, maximumBytes = 4096) {
  let handle;
  try { handle = await open(path, FS_CONSTANTS.O_RDONLY | FS_CONSTANTS.O_NOFOLLOW); }
  catch { throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE'); }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximumBytes) {
      throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE');
    }
    return (await handle.readFile('utf8')).trim();
  } finally {
    await handle.close();
  }
}

async function strictDirectory(path) {
  const absolute = resolve(path);
  let actual;
  let stat;
  try {
    [actual, stat] = await Promise.all([realpath(absolute), lstat(absolute)]);
  } catch {
    throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE');
  }
  if (actual !== absolute || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE');
  }
  return absolute;
}

export async function resolveGateBStateDirectory({ repositoryRoot = ROOT, ...extra } = {}) {
  if (Object.keys(extra).length > 0) throw new GateBError('GATE_B_STATE_OVERRIDE_FORBIDDEN');
  const root = await strictDirectory(repositoryRoot);
  const dotGit = join(root, '.git');
  let dotGitStat;
  try { dotGitStat = await lstat(dotGit); } catch { throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE'); }
  let gitDir;
  if (dotGitStat.isDirectory() && !dotGitStat.isSymbolicLink()) {
    gitDir = await strictDirectory(dotGit);
  } else if (dotGitStat.isFile() && !dotGitStat.isSymbolicLink()) {
    const pointer = await secureRegularFile(dotGit);
    if (!pointer.startsWith('gitdir: ')) throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE');
    const value = pointer.slice('gitdir: '.length);
    gitDir = await strictDirectory(isAbsolute(value) ? value : resolve(root, value));
  } else {
    throw new GateBError('GATE_B_GIT_COMMON_DIR_UNSAFE');
  }
  let commonDir = gitDir;
  try {
    const commonValue = await secureRegularFile(join(gitDir, 'commondir'));
    commonDir = await strictDirectory(isAbsolute(commonValue) ? commonValue : resolve(gitDir, commonValue));
  } catch (error) {
    if (error?.code !== 'GATE_B_GIT_COMMON_DIR_UNSAFE') throw error;
    try {
      await lstat(join(gitDir, 'commondir'));
      throw error;
    } catch (missing) {
      if (missing?.code !== 'ENOENT') throw error;
    }
  }
  return join(commonDir, 'tradingview-mcp-e2e');
}

async function removeOwnedLock(stateDir, ownershipToken, stateHandle) {
  const stableStateDir = stateHandle ? `/proc/self/fd/${stateHandle.fd}` : stateDir;
  const lockDir = join(stableStateDir, 'active.lock');
  let stored;
  let ownerHandle;
  try {
    ownerHandle = await open(join(lockDir, 'owner'), FS_CONSTANTS.O_RDONLY | FS_CONSTANTS.O_NOFOLLOW);
    stored = await ownerHandle.readFile('utf8');
  } catch {
    throw new GateBError('GATE_B_LOCK_OWNERSHIP_UNKNOWN');
  } finally {
    await ownerHandle?.close();
  }
  const actual = Buffer.from(stored);
  const expected = Buffer.from(ownershipToken);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new GateBError('GATE_B_LOCK_OWNERSHIP_MISMATCH');
  }
  await rm(lockDir, { recursive: true });
  await fsyncDirectory(stableStateDir);
}

export async function acquireGateBLease({
  repositoryRoot = ROOT,
  nonce,
  envelope,
  expected,
  nowMs = Date.now(),
  ownershipToken,
  ...extra
} = {}) {
  if (Object.keys(extra).length > 0) {
    throw new GateBError('GATE_B_STATE_OVERRIDE_FORBIDDEN');
  }
  const stateDir = await resolveGateBStateDirectory({ repositoryRoot });
  if (typeof nonce !== 'string' || nonce.length < 32) throw new GateBError('GATE_B_NONCE_INVALID');
  validateGateBApproval(envelope, {
    ...(expected || {}),
    approval_nonce_sha256: sha256(nonce),
  }, nowMs);
  const owner = ownershipToken || randomBytes(32).toString('hex');
  await mkdir(stateDir, { recursive: true });
  await strictDirectory(stateDir);
  const stateHandle = await open(
    stateDir,
    FS_CONSTANTS.O_RDONLY | FS_CONSTANTS.O_DIRECTORY | FS_CONSTANTS.O_NOFOLLOW,
  );
  const stableStateDir = `/proc/self/fd/${stateHandle.fd}`;
  const lockDir = join(stableStateDir, 'active.lock');
  try { await mkdir(lockDir); } catch (error) {
    await stateHandle.close();
    if (error?.code === 'EEXIST') throw new GateBError('GATE_B_ACTIVE_LOCKED');
    throw error;
  }
  try {
    const ownerFile = await open(
      join(lockDir, 'owner'),
      FS_CONSTANTS.O_WRONLY | FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_EXCL | FS_CONSTANTS.O_NOFOLLOW,
      0o600,
    );
    try { await ownerFile.writeFile(owner); await ownerFile.sync(); } finally { await ownerFile.close(); }
    await fsyncDirectory(lockDir);
    const spentDir = join(stableStateDir, 'spent');
    await mkdir(spentDir, { recursive: true });
    await strictDirectory(join(stateDir, 'spent'));
    const nonceDigest = sha256(nonce);
    const spentPath = join(stateDir, 'spent', `${nonceDigest}.json`);
    const stableSpentPath = join(spentDir, `${nonceDigest}.json`);
    let spentFile;
    try {
      spentFile = await open(
        stableSpentPath,
        FS_CONSTANTS.O_WRONLY | FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_EXCL | FS_CONSTANTS.O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      if (error?.code === 'EEXIST') throw new GateBError('GATE_B_NONCE_SPENT');
      throw error;
    }
    const record = {
      schema_version: GATE_B_SCHEMA_VERSION,
      envelope_sha256: envelope.envelope_sha256,
      external_action_budgets: envelope.external_action_budgets,
    };
    try { await spentFile.writeFile(`${JSON.stringify(record)}\n`); await spentFile.sync(); }
    finally { await spentFile.close(); }
    await fsyncDirectory(spentDir);
    await fsyncDirectory(stableStateDir);
    const lease = Object.freeze({ stateDir, ownershipToken: owner, nonceDigest, spentPath });
    LEASE_HANDLES.set(lease, stateHandle);
    return lease;
  } catch (error) {
    try { await removeOwnedLock(stateDir, owner, stateHandle); } catch {
      await stateHandle.close();
      throw new GateBError('GATE_B_LOCK_CLEANUP_FAILED');
    }
    await stateHandle.close();
    throw error;
  }
}

export async function prepareGateBLease({
  repositoryRoot = ROOT,
  nonce,
  envelope,
  expected,
  nowMs = Date.now(),
  ownershipToken,
  ...extra
} = {}) {
  if (Object.keys(extra).length > 0) throw new GateBError('GATE_B_STATE_OVERRIDE_FORBIDDEN');
  validateGateBApproval(envelope, {
    ...(expected || {}),
    approval_nonce_sha256: sha256(nonce || ''),
  }, nowMs);
  return acquireGateBLease({ repositoryRoot, nonce, envelope, expected, nowMs, ownershipToken });
}

export async function releaseGateBLease(lease) {
  const stateHandle = LEASE_HANDLES.get(lease);
  if (!stateHandle) throw new GateBError('GATE_B_LOCK_OWNERSHIP_UNKNOWN');
  try { await removeOwnedLock(lease.stateDir, lease.ownershipToken, stateHandle); }
  finally { LEASE_HANDLES.delete(lease); await stateHandle.close(); }
}

export async function abandonGateBLease(lease) {
  const stateHandle = LEASE_HANDLES.get(lease);
  if (!stateHandle) return;
  LEASE_HANDLES.delete(lease);
  await stateHandle.close();
}

const APPROVAL_FILE_KEYS = Object.freeze(['envelope', 'nonce', 'schema_version']);
const APPROVAL_FILE_MAX_BYTES = 64 * 1024;
const SECRET_ENV_KEY = /(?:^|_)(?:APPROVAL|NONCE|SECRET|TOKEN)(?:_|$)|^GATE_B_/i;

function exactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}

async function readSecureApprovalFile(approvalFilePath) {
  if (typeof approvalFilePath !== 'string' || approvalFilePath.length === 0) {
    throw new GateBError('GATE_B_APPROVAL_FILE_UNAVAILABLE');
  }
  let handle;
  try {
    handle = await open(approvalFilePath, FS_CONSTANTS.O_RDONLY | FS_CONSTANTS.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === 'ELOOP') throw new GateBError('GATE_B_APPROVAL_FILE_UNSAFE');
    throw new GateBError('GATE_B_APPROVAL_FILE_UNAVAILABLE');
  }
  try {
    const stat = await handle.stat();
    const expectedUid = typeof process.getuid === 'function' ? process.getuid() : stat.uid;
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.uid !== expectedUid
      || (stat.mode & 0o777) !== 0o600
      || stat.size < 2
      || stat.size > APPROVAL_FILE_MAX_BYTES
    ) {
      throw new GateBError('GATE_B_APPROVAL_FILE_UNSAFE');
    }
    const bytes = Buffer.alloc(stat.size);
    const { bytesRead } = await handle.read(bytes, 0, stat.size, 0);
    if (bytesRead !== stat.size) throw new GateBError('GATE_B_APPROVAL_FILE_UNSAFE');
    const after = await handle.stat();
    if (
      after.dev !== stat.dev
      || after.ino !== stat.ino
      || after.size !== stat.size
      || after.mtimeMs !== stat.mtimeMs
      || after.ctimeMs !== stat.ctimeMs
    ) {
      throw new GateBError('GATE_B_APPROVAL_FILE_TOCTOU');
    }
    let approval;
    try { approval = JSON.parse(bytes.toString('utf8')); } catch {
      throw new GateBError('GATE_B_APPROVAL_FILE_INVALID');
    }
    if (
      !exactKeys(approval, APPROVAL_FILE_KEYS)
      || approval.schema_version !== GATE_B_SCHEMA_VERSION
      || typeof approval.nonce !== 'string'
      || !/^[a-f0-9]{64}$/.test(approval.nonce)
    ) {
      throw new GateBError('GATE_B_APPROVAL_FILE_INVALID');
    }
    return approval;
  } finally {
    await handle.close();
  }
}

export function buildLiveChildEnvironment(source = process.env, forbiddenValues = []) {
  const result = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (
      !SECRET_ENV_KEY.test(key)
      && typeof value === 'string'
      && !forbiddenValues.some(secret => typeof secret === 'string' && secret.length > 0 && value.includes(secret))
    ) result[key] = value;
  }
  result.TRADINGVIEW_MCP_COORDINATOR_MODE = 'live-child';
  delete result.TRADINGVIEW_MCP_LIVE_DISABLED;
  return Object.freeze(result);
}

/**
 * Consume a securely-delivered approval and transition to an injected live
 * adapter only after current bindings are measured twice and the global lease
 * has been made durable. The nonce is deliberately omitted from the plan.
 */
export async function activateGateBFromApprovalFile({
  approvalFilePath,
  repositoryRoot = ROOT,
  measureStaticBindings,
  liveAdapter,
  nowMs,
  clock,
  ownershipToken,
  expectedEnvelopeSha256,
  ...extra
} = {}) {
  if (Object.keys(extra).length > 0) throw new GateBError('GATE_B_STATE_OVERRIDE_FORBIDDEN');
  if (typeof measureStaticBindings !== 'function') {
    throw new GateBError('GATE_B_MEASUREMENT_UNAVAILABLE');
  }
  if (typeof liveAdapter !== 'function') throw new GateBError('GATE_B_LIVE_ADAPTER_UNAVAILABLE');
  const readTime = typeof clock === 'function'
    ? clock
    : nowMs === undefined ? Date.now : () => nowMs;
  let lastTime = -Infinity;
  const freshTime = () => {
    const value = readTime();
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < lastTime) {
      throw new GateBError('GATE_B_CLOCK_INVALID');
    }
    lastTime = value;
    return value;
  };

  const approval = await readSecureApprovalFile(approvalFilePath);
  if (
    expectedEnvelopeSha256 !== undefined
    && approval.envelope?.envelope_sha256 !== expectedEnvelopeSha256
  ) throw new GateBError('GATE_B_ENVELOPE_DIGEST_MISMATCH');
  let firstStatic;
  let secondStatic;
  try { firstStatic = await measureStaticBindings(); } catch { throw new GateBError('GATE_B_STATIC_MEASUREMENT_FAILED'); }
  const expectedWithUnverifiedLive = staticBindings => ({
    ...staticBindings,
    target_policy: approval.envelope.target_policy,
    target_context: approval.envelope.target_context,
    build_sha256: approval.envelope.build_sha256,
    approval_nonce_sha256: sha256(approval.nonce),
  });
  validateGateBApproval(approval.envelope, {
    ...expectedWithUnverifiedLive(firstStatic),
  }, freshTime());
  try { secondStatic = await measureStaticBindings(); } catch { throw new GateBError('GATE_B_STATIC_MEASUREMENT_FAILED'); }
  if (digestJson(firstStatic) !== digestJson(secondStatic)) throw new GateBError('GATE_B_STATIC_MEASUREMENT_DRIFT');
  const leaseTime = freshTime();
  validateGateBApproval(approval.envelope, expectedWithUnverifiedLive(secondStatic), leaseTime);

  const lease = await acquireGateBLease({
    repositoryRoot,
    nonce: approval.nonce,
    envelope: approval.envelope,
    expected: expectedWithUnverifiedLive(secondStatic),
    nowMs: leaseTime,
    ownershipToken,
  });
  try {
    validateGateBApproval(approval.envelope, expectedWithUnverifiedLive(secondStatic), freshTime());
    let livePreflightStarted = false;
    let livePreflightUsed = false;
    const assertLiveMeasurementReady = () => {
      if (livePreflightStarted) {
        throw new GateBError('GATE_B_LIVE_MEASUREMENT_UNAUTHORIZED');
      }
      livePreflightStarted = true;
      validateGateBApproval(approval.envelope, expectedWithUnverifiedLive(secondStatic), freshTime());
    };
    const completeLivePreflight = (firstLive, secondLive) => {
      if (!livePreflightStarted || livePreflightUsed) throw new GateBError('GATE_B_LIVE_MEASUREMENT_UNAUTHORIZED');
      livePreflightUsed = true;
      const firstCombined = { ...secondStatic, ...firstLive };
      validateGateBApproval(approval.envelope, {
        ...firstCombined, approval_nonce_sha256: sha256(approval.nonce),
      }, freshTime());
      if (digestJson(firstLive) !== digestJson(secondLive)) throw new GateBError('GATE_B_LIVE_MEASUREMENT_DRIFT');
      const second = { ...secondStatic, ...secondLive };
      validateGateBApproval(approval.envelope, {
        ...second, approval_nonce_sha256: sha256(approval.nonce),
      }, freshTime());
      return sealAuthoritativeBindings(approval.envelope, second);
    };
    const plan = Object.freeze({
    phase: 'live_plan_ready',
    lease,
    envelope_sha256: approval.envelope.envelope_sha256,
    target_policy: Object.freeze({ ...approval.envelope.target_policy }),
    target_context: Object.freeze({ ...approval.envelope.target_context }),
    session_policy: approval.envelope.session_policy,
    repository_head: approval.envelope.repository_head,
    working_tree_diff_sha256: approval.envelope.working_tree_diff_sha256,
    test_manifest_sha256: approval.envelope.test_manifest_sha256,
    build_sha256: approval.envelope.build_sha256,
    workload_sha256: approval.envelope.workload_sha256,
    benchmark_config_sha256: approval.envelope.benchmark_config_sha256,
    benchmark_workload_sha256: approval.envelope.benchmark_workload_sha256,
    baseline_artifact_sha256: approval.envelope.baseline_artifact_sha256,
    baseline_executor_artifact_sha256: approval.envelope.baseline_executor_artifact_sha256,
    baseline_executor_module_path: approval.envelope.baseline_executor_module_path,
    baseline_executor_repository_commit: approval.envelope.baseline_executor_repository_commit,
    baseline_module_path: approval.envelope.baseline_module_path,
    baseline_repository_commit: approval.envelope.baseline_repository_commit,
    candidate_artifact_sha256: approval.envelope.candidate_artifact_sha256,
    candidate_executor_artifact_sha256: approval.envelope.candidate_executor_artifact_sha256,
    candidate_executor_module_path: approval.envelope.candidate_executor_module_path,
    candidate_module_path: approval.envelope.candidate_module_path,
    candidate_repository_commit: approval.envelope.candidate_repository_commit,
    execution_case_set_sha256: approval.envelope.execution_case_set_sha256,
    child_manifest_sha256: approval.envelope.child_manifest_sha256,
    chart_operation_registry_sha256: approval.envelope.chart_operation_registry_sha256,
    owner_operation_registry_sha256: approval.envelope.owner_operation_registry_sha256,
    external_action_budgets: GATE_B_BUDGETS,
    child_env: buildLiveChildEnvironment(process.env, [approval.nonce]),
    assert_live_measurement_ready: assertLiveMeasurementReady,
    complete_live_preflight: completeLivePreflight,
    });
    validateGateBApproval(approval.envelope, expectedWithUnverifiedLive(secondStatic), freshTime());
    const adapterResult = await liveAdapter(plan);
    if (!livePreflightUsed) throw new GateBError('GATE_B_LIVE_MEASUREMENT_REQUIRED');
    return Object.freeze({
      phase: 'live_plan_dispatched',
      lease,
      adapter_result: adapterResult,
    });
  } catch (error) {
    // Never release on an unknown dispatch outcome. The durable lock and spent
    // marker force explicit read-only incident review before another attempt.
    await abandonGateBLease(lease);
    if (error instanceof GateBError) throw error;
    throw new GateBError('GATE_B_LIVE_ADAPTER_FAILED');
  }
}

const LIVE_STATE_KEYS = Object.freeze([
  'adapterDeadlineMs', 'benchmarkApproval', 'capabilityToken', 'cases',
  'createBoundSession', 'dispatchOwner', 'measureLiveBindings', 'runChildCase', 'runId', 'target',
]);
const GUARD_OPERATION_KEYS = Object.freeze([
  'captureInventory', 'cleanupCreated', 'countCreated', 'countOwnerlessMutations',
  'inspectPineSignals', 'inspectReplay', 'inventoriesEqual', 'restoreInventory',
]);

function exactFunctionSet(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === keys[index])
    && keys.every(key => typeof value[key] === 'function');
}

async function runGateBLiveStateMachine(plan, configuration) {
  if (!plan || plan.phase !== 'live_plan_ready' || !configuration || typeof configuration !== 'object') {
    throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
  }
  const keys = Object.keys(configuration).sort();
  if (
    keys.length !== LIVE_STATE_KEYS.length
    || keys.some((key, index) => key !== LIVE_STATE_KEYS[index])
    || typeof configuration.createBoundSession !== 'function'
    || typeof configuration.measureLiveBindings !== 'function'
    || typeof configuration.dispatchOwner !== 'function'
    || typeof configuration.runChildCase !== 'function'
  ) throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');

  const {
    runId, capabilityToken, adapterDeadlineMs, dispatchOwner, runChildCase,
    target, cases, benchmarkApproval,
  } = configuration;
  const suppliedCaseIds = Array.isArray(cases) ? cases.map(value => value?.id) : [];
  const expectedTarget = {
    targetId: plan.target_context.target_id,
    sessionId: plan.session_policy,
    executionContextId: plan.target_context.execution_context_id,
  };
  if (
    suppliedCaseIds.length !== GATE_B_ORDERED_CASE_IDS.length
    || suppliedCaseIds.some((caseId, index) => caseId !== GATE_B_ORDERED_CASE_IDS[index])
    || digestJson(target) !== digestJson(expectedTarget)
    || benchmarkApproval?.envelope_sha256 !== plan.envelope_sha256
    || benchmarkApproval?.repository_head !== plan.repository_head
    || benchmarkApproval?.working_tree_diff_sha256 !== plan.working_tree_diff_sha256
    || benchmarkApproval?.test_manifest_sha256 !== plan.test_manifest_sha256
    || benchmarkApproval?.build_sha256 !== plan.build_sha256
    || benchmarkApproval?.workload_sha256 !== plan.workload_sha256
    || benchmarkApproval?.benchmark_workload_sha256 !== plan.benchmark_workload_sha256
    || benchmarkApproval?.baseline_artifact_sha256 !== plan.baseline_artifact_sha256
    || benchmarkApproval?.baseline_executor_artifact_sha256 !== plan.baseline_executor_artifact_sha256
    || benchmarkApproval?.baseline_executor_module_path !== plan.baseline_executor_module_path
    || benchmarkApproval?.baseline_executor_repository_commit !== plan.baseline_executor_repository_commit
    || benchmarkApproval?.baseline_module_path !== plan.baseline_module_path
    || benchmarkApproval?.baseline_repository_commit !== plan.baseline_repository_commit
    || benchmarkApproval?.candidate_artifact_sha256 !== plan.candidate_artifact_sha256
    || benchmarkApproval?.candidate_executor_artifact_sha256 !== plan.candidate_executor_artifact_sha256
    || benchmarkApproval?.candidate_executor_module_path !== plan.candidate_executor_module_path
    || benchmarkApproval?.candidate_module_path !== plan.candidate_module_path
    || benchmarkApproval?.candidate_repository_commit !== plan.candidate_repository_commit
    || digestJson(benchmarkApproval?.target) !== digestJson(expectedTarget)
  ) throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
  let boundSession;
  const ledger = await createGateBLoopbackLedger({
    runId,
    capabilityToken,
    adapterDeadlineMs,
    budgets: plan.external_action_budgets,
    adapter: async (caseId, snapshot, control) => {
      return dispatchOwner(boundSession, caseId, snapshot, control);
    },
  });
  try {
    const control = ledger.bindControl();
    control.authorize('full_external_gate_invocation_count', 1);
    if (typeof plan.assert_live_measurement_ready !== 'function' || typeof plan.complete_live_preflight !== 'function') {
      throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
    }
    plan.assert_live_measurement_ready();
    let firstLive;
    let secondLive;
    try { firstLive = await configuration.measureLiveBindings(control); }
    catch { throw new GateBError('GATE_B_LIVE_MEASUREMENT_FAILED'); }
    try { secondLive = await configuration.measureLiveBindings(control); }
    catch { throw new GateBError('GATE_B_LIVE_MEASUREMENT_FAILED'); }
    const authoritativeBindings = plan.complete_live_preflight(firstLive, secondLive);
    if (!AUTHORITATIVE_BINDINGS.has(authoritativeBindings)) throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
    boundSession = await configuration.createBoundSession(control, authoritativeBindings);
    if (!boundSession || typeof boundSession !== 'object'
      || !exactFunctionSet(boundSession.guardOperations, GUARD_OPERATION_KEYS)) {
      throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
    }
    const client = createGateBLedgerClient({ runId, capabilityToken, port: ledger.port });
    const operations = {
      ...boundSession.guardOperations,
      async runOwnedCase(caseDefinition, approvedTarget, owner) {
        const wire = await runChildCase(client, caseDefinition, approvedTarget, owner);
        if (wire?.status === 'success' && wire?.code === 'CASE_OK') {
          return { status: 'success', code: 'CASE_OK', createdIds: [] };
        }
        if (wire?.status === 'failure' && wire?.code === 'CASE_FAILED') {
          return { status: 'failure', code: 'CASE_FAILED', createdIds: [] };
        }
        return { status: 'unknown', code: 'CASE_OUTCOME_UNKNOWN', createdIds: [] };
      },
    };
    const harnessResult = await createGuardedE2EHarness({
      target,
      cases,
      operations,
      deadlineMs: adapterDeadlineMs,
    }).run();
    if (harnessResult.status !== 'success' || harnessResult.initial_final_invariant !== true) {
      return Object.freeze({
        status: harnessResult.status === 'unknown' ? 'unknown' : 'failure',
        code: 'GATE_B_GUARDED_HARNESS_FAILED',
        harness_code: harnessResult.code,
        ledger: ledger.snapshot(),
      });
    }
    const actualLedger = () => {
      const current = ledger.snapshot();
      // The benchmark runner validates its ledger immediately before writing
      // the sole raw artifact. Account for that already-authorized fixed next
      // operation without consuming it early; artifactSink.write then records
      // the real capture and the final coordinator check requires exact totals.
      const afterArtifactWrite = {
        ...current,
        capture_count: current.capture_count + 1,
      };
      return {
        restorePassed: harnessResult.initial_final_invariant === true,
        budgetPassed: gateBInventoryIsExact(afterArtifactWrite, plan.external_action_budgets),
        unknownCount: current.outcome_unknown_count,
        directActionCount: 0,
      };
    };
    const benchmarkResult = await createApprovalBoundBenchmarkRunner({
      approval: benchmarkApproval,
      sampleCount: GATE_B_BENCHMARK_CONFIGURATION.sample_count,
      adapters: boundSession.benchmarkAdapters,
      artifactSink: boundSession.artifactSink,
      operations: { ...boundSession.benchmarkOperations, readLedger: async () => actualLedger() },
    }).run();
    if (benchmarkResult.status !== 'success') {
      return Object.freeze({
        status: 'failure', code: 'GATE_B_BENCHMARK_FAILED',
        benchmark_code: benchmarkResult.code, ledger: ledger.snapshot(),
      });
    }
    const snapshot = ledger.snapshot();
    if (!gateBInventoryIsExact(snapshot, plan.external_action_budgets)) {
      return Object.freeze({ status: 'unknown', code: 'GATE_B_LEDGER_INVALID', ledger: snapshot });
    }
    return Object.freeze({
      status: 'success',
      code: 'GATE_B_LIVE_COMPLETE',
      case_count: harnessResult.cases.length,
      benchmark_sample_count: benchmarkResult.sample_count,
      ledger: snapshot,
    });
  } finally {
    await ledger.close();
  }
}

const OFFLINE_SPECS = Object.freeze([
  Object.freeze({
    name: 'unit',
    command: process.env.npm_execpath || 'npm',
    args: Object.freeze(['run', 'test:unit']),
    live: false,
  }),
  Object.freeze({
    name: 'manifest',
    command: process.execPath,
    args: Object.freeze([
      '--import',
      OFFLINE_GUARD,
      '--experimental-vm-modules',
      '--test',
      '--test-concurrency=1',
      join(TEST_DIR, 'test_manifest.test.js'),
    ]),
    live: false,
  }),
]);

/**
 * Resolve all invocations into the offline branch until a separately reviewed
 * approval/nonce flow exists. No argument can grant live capabilities here.
 */
export function parseInvocation(args = []) {
  const values = Array.isArray(args) ? args : [];
  if (values.length === 1 && values[0] === '--phase0-read-only') {
    return {
      mode: 'phase0_read_only',
      approval_present: false,
      reason: 'explicit_read_only_requested',
    };
  }
  if (values.length === 1 && values[0] === '--offline-only') {
    return {
      mode: 'offline',
      approval_present: false,
      reason: 'offline_requested',
    };
  }

  return {
    mode: 'offline',
    approval_present: false,
    reason: 'approval_required',
  };
}

function normalizeResult(spec, result) {
  const exitCode = Number.isInteger(result?.status) ? result.status : null;
  const signal = typeof result?.signal === 'string' ? result.signal : null;
  const spawnError = result?.error ? 'spawn_failed' : null;
  const passed = exitCode === 0 && signal === null && spawnError === null;

  return {
    name: spec.name,
    status: passed ? 'passed' : 'failed',
    exit_code: exitCode,
    signal,
    error_code: spawnError,
  };
}

function executeSpec(spec) {
  const result = spawnSync(spec.command, [...spec.args], {
    cwd: ROOT,
    env: {
      ...process.env,
      TRADINGVIEW_MCP_COORDINATOR_MODE: 'offline',
      TRADINGVIEW_MCP_LIVE_DISABLED: '1',
      npm_config_ignore_scripts: 'true',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return result;
}

/**
 * Execute only the reviewed offline gates. The runner is injectable so the
 * no-live contract can be proven without starting a child process in tests.
 */
export function runOfflineChecks({ runner = executeSpec } = {}) {
  const results = OFFLINE_SPECS.map(spec => {
    try {
      return normalizeResult(spec, runner(spec));
    } catch (error) {
      return normalizeResult(spec, { status: null, signal: null, error: true });
    }
  });

  return {
    success: results.every(result => result.status === 'passed'),
    results,
    external_action_count: 0,
    live_test_started: false,
  };
}

export function buildSafeStop({ invocation, checks }) {
  return {
    schema_version: 1,
    status: 'safe_stop',
    code: COORDINATOR_SAFE_STOP_CODE,
    mode: invocation.mode,
    approval_present: invocation.approval_present,
    reason: invocation.reason,
    offline_checks: checks.results,
    external_action_count: 0,
    live_test_started: false,
    ledger: {
      cdp: 0,
      network: 0,
      ui: 0,
      child_live_test: 0,
    },
  };
}

function phase0Ledger(cdpRead = 0) {
  return {
    cdp_read: cdpRead,
    cdp_mutation: 0,
    network: 0,
    input: 0,
    ui: 0,
    child_live_test: 0,
  };
}

async function executePhase0Branch(invocation, phase0Configuration) {
  if (!phase0Configuration) {
    return {
      payload: {
        schema_version: 1,
        status: 'safe_stop',
        code: 'PHASE0_CONFIGURATION_REQUIRED',
        mode: invocation.mode,
        approval_present: false,
        lease_created: false,
        external_action_count: 0,
        live_test_started: false,
        ledger: phase0Ledger(),
      },
      exit_code: 1,
    };
  }
  try {
    const plan = createPhase0ReadOnlyPlan(phase0Configuration);
    const result = await runPhase0ReadOnly(plan);
    return {
      payload: {
        schema_version: 1,
        status: 'complete',
        code: result.code,
        mode: invocation.mode,
        approval_present: false,
        lease_created: false,
        external_action_count: result.counts.cdp_reads,
        live_test_started: false,
        counts: result.counts,
        snapshots: result.snapshots,
        ledger: phase0Ledger(result.counts.cdp_reads),
      },
      exit_code: 0,
    };
  } catch {
    return {
      payload: {
        schema_version: 1,
        status: 'failed',
        code: 'PHASE0_READ_ONLY_FAILED',
        mode: invocation.mode,
        approval_present: false,
        lease_created: false,
        external_action_count: 0,
        live_test_started: false,
        ledger: phase0Ledger(),
      },
      exit_code: 1,
    };
  }
}

export async function executeCoordinator({
  args = process.argv.slice(2),
  runner = executeSpec,
  phase0Configuration,
  liveConfiguration,
  liveAuthority,
} = {}) {
  const invocation = parseInvocation(args);
  if (invocation.mode === 'phase0_read_only') {
    return executePhase0Branch(invocation, phase0Configuration);
  }
  if (liveConfiguration !== undefined) {
    const keys = liveConfiguration && typeof liveConfiguration === 'object'
      ? Object.keys(liveConfiguration).sort()
      : [];
    const expectedKeys = [
      'approvalFilePath', 'expectedEnvelopeSha256', 'measureStaticBindings',
      'repositoryRoot', 'stateMachineConfiguration',
    ];
    if (
      !Array.isArray(args)
      || args.length !== 0
      || liveAuthority !== MAIN_LIVE_AUTHORITY
      || keys.length !== expectedKeys.length
      || keys.some((key, index) => key !== expectedKeys[index])
      || typeof liveConfiguration.measureStaticBindings !== 'function'
      || !liveConfiguration.stateMachineConfiguration
    ) {
      return {
        payload: {
          schema_version: 1, status: 'failed', code: 'GATE_B_LIVE_CONFIGURATION_INVALID',
          approval_present: false, live_test_started: false, external_action_count: 0,
        },
        exit_code: 1,
      };
    }
    try {
      const activated = await activateGateBFromApprovalFile({
        approvalFilePath: liveConfiguration.approvalFilePath,
        expectedEnvelopeSha256: liveConfiguration.expectedEnvelopeSha256,
        repositoryRoot: liveConfiguration.repositoryRoot,
        measureStaticBindings: liveConfiguration.measureStaticBindings,
        liveAdapter: plan => runGateBLiveStateMachine(plan, liveConfiguration.stateMachineConfiguration),
      });
      const state = activated.adapter_result;
      if (state?.status === 'unknown') await abandonGateBLease(activated.lease);
      else await releaseGateBLease(activated.lease);
      if (state?.status !== 'success') {
        return {
          payload: {
            schema_version: 1, status: state?.status || 'unknown', code: state?.code || 'GATE_B_LIVE_FAILED',
            approval_present: true, live_test_started: true, external_action_count: 1,
          },
          exit_code: 1,
        };
      }
      return {
        payload: {
          schema_version: 1,
          status: 'live_complete',
          code: 'GATE_B_LIVE_COMPLETE',
          approval_present: true,
          live_test_started: true,
          external_action_count: 1,
          case_count: state.case_count,
          benchmark_sample_count: state.benchmark_sample_count,
          ledger: state.ledger,
        },
        exit_code: 0,
      };
    } catch (error) {
      return {
        payload: {
          schema_version: 1, status: 'unknown', code: 'GATE_B_LIVE_FAILED',
          approval_present: true, live_test_started: false, external_action_count: 0,
        },
        exit_code: 1,
      };
    }
  }
  const checks = runOfflineChecks({ runner });
  return {
    payload: buildSafeStop({ invocation, checks }),
    exit_code: checks.success ? 0 : 1,
  };
}

async function executeMain() {
  const approvalFilePath = process.env.TRADINGVIEW_MCP_GATE_B_APPROVAL_FILE;
  if (approvalFilePath === undefined) return executeCoordinator();
  if (typeof approvalFilePath !== 'string' || approvalFilePath.length === 0 || approvalFilePath.includes('\0')) {
    return {
      payload: {
        schema_version: 1, status: 'failed', code: 'GATE_B_APPROVAL_FILE_UNAVAILABLE',
        approval_present: false, live_test_started: false, external_action_count: 0,
      },
      exit_code: 1,
    };
  }
  try {
    const approval = await readSecureApprovalFile(approvalFilePath);
    const { createFixedReviewedGateBLiveConfiguration } = await import('../src/e2e/live_runtime_factory.js');
    const assembled = await createFixedReviewedGateBLiveConfiguration({
      approvalFilePath,
      approvalEnvelope: Object.freeze({ ...approval.envelope }),
      repositoryRoot: ROOT,
    });
    if (!assembled) throw new GateBError('GATE_B_LIVE_CONFIGURATION_INVALID');
    const liveConfiguration = {
      ...assembled,
      approvalFilePath,
      expectedEnvelopeSha256: approval.envelope.envelope_sha256,
    };
    return executeCoordinator({ liveConfiguration, liveAuthority: MAIN_LIVE_AUTHORITY });
  } catch {
    return {
      payload: {
        schema_version: 1, status: 'failed', code: 'GATE_B_LIVE_CONFIGURATION_INVALID',
        approval_present: false, live_test_started: false, external_action_count: 0,
      },
      exit_code: 1,
    };
  }
}

async function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const [modulePath, invokedPath] = await Promise.all([
      realpath(fileURLToPath(import.meta.url)),
      realpath(resolve(process.argv[1])),
    ]);
    return modulePath === invokedPath;
  } catch {
    return false;
  }
}

const isMain = await isMainModule();
if (isMain) {
  const result = await executeMain();
  process.stdout.write(`${JSON.stringify(result.payload)}\n`);
  process.exitCode = result.exit_code;
}
