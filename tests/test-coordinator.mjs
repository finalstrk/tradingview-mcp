import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants as FS_CONSTANTS } from 'node:fs';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);
const OFFLINE_GUARD = join(TEST_DIR, 'offline_network_guard.js');

export const COORDINATOR_SAFE_STOP_CODE = 'OFFLINE_APPROVAL_REQUIRED';
export const GATE_B_SCHEMA_VERSION = 1;
export const COORDINATOR_VERSION = 'gate-b-offline-v1';
export const GATE_B_COMMAND = 'npm test';

export const GATE_B_BUDGETS = Object.freeze({
  page_reload_count: 0,
  pine_facade_post_count: 6,
  harness_initiated_network_count: 6,
  ctrl_s_chord_count: 1,
  key_event_count: 2,
  tab_create_count: 0,
  tab_close_count: 0,
  tradingview_process_start_count: 0,
  tradingview_process_kill_count: 0,
  full_external_gate_invocation_count: 1,
});

export const LIVE_CASE_REGISTRY = Object.freeze({
  batch: Object.freeze({ file: 'tests/batch_e2e.test.js' }),
  chart: Object.freeze({ file: 'tests/e2e.test.js' }),
  graphics: Object.freeze({ file: 'tests/graphics_e2e.test.js' }),
  launch: Object.freeze({ file: 'tests/launch_e2e.test.js' }),
  pine_facade: Object.freeze({ file: 'tests/pine_facade_e2e.test.js' }),
  quote: Object.freeze({ file: 'tests/quote_e2e.test.js' }),
});

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const HEX_GIT_SHA1 = /^[0-9a-f]{40}$/;
const HEX_TARGET_ID = /^[0-9a-fA-F]{32}$/;
const GATE_B_ENVELOPE_KEYS = Object.freeze([
  'approval_nonce_sha256',
  'coordinator_version',
  'envelope_sha256',
  'expires_at',
  'external_action_budgets',
  'full_command',
  'live_adapter_dispatch',
  'live_case_registry_sha256',
  'repository_head',
  'schema_version',
  'target_policy',
  'test_manifest_sha256',
  'working_tree_diff_sha256',
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

export const LIVE_CASE_REGISTRY_SHA256 = digestJson(LIVE_CASE_REGISTRY);

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
  expiresAt,
} = {}) {
  const draft = {
    schema_version: GATE_B_SCHEMA_VERSION,
    coordinator_version: COORDINATOR_VERSION,
    repository_head: repositoryHead,
    working_tree_diff_sha256: workingTreeDiffSha256,
    test_manifest_sha256: testManifestSha256,
    approval_nonce_sha256: approvalNonceSha256,
    live_case_registry_sha256: LIVE_CASE_REGISTRY_SHA256,
    target_policy: targetPolicy,
    external_action_budgets: GATE_B_BUDGETS,
    full_command: GATE_B_COMMAND,
    expires_at: expiresAt,
    live_adapter_dispatch: 'INJECTED_REVIEWED_ADAPTER_ONLY',
  };
  return { ...draft, envelope_sha256: digestJson(draft) };
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
    || !isExactExplicitTargetPolicy(envelope.target_policy)
  ) {
    throw new GateBError('GATE_B_ENVELOPE_INVALID');
  }
  const expiresMs = Date.parse(envelope.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) throw new GateBError('GATE_B_APPROVAL_EXPIRED');
  const fixedBindings = {
    schema_version: GATE_B_SCHEMA_VERSION,
    coordinator_version: COORDINATOR_VERSION,
    full_command: GATE_B_COMMAND,
    external_action_budgets: GATE_B_BUDGETS,
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
  if (envelope.live_adapter_dispatch !== 'INJECTED_REVIEWED_ADAPTER_ONLY') {
    throw new GateBError('GATE_B_LIVE_DISPATCH_DISABLED');
  }
  return true;
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function removeOwnedLock(stateDir, ownershipToken) {
  const lockDir = join(stateDir, 'active.lock');
  let stored;
  try { stored = await readFile(join(lockDir, 'owner'), 'utf8'); } catch {
    throw new GateBError('GATE_B_LOCK_OWNERSHIP_UNKNOWN');
  }
  const actual = Buffer.from(stored);
  const expected = Buffer.from(ownershipToken);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new GateBError('GATE_B_LOCK_OWNERSHIP_MISMATCH');
  }
  await rm(lockDir, { recursive: true });
  await fsyncDirectory(stateDir);
}

export async function acquireGateBLease({
  stateDir,
  nonce,
  envelope,
  expected,
  nowMs = Date.now(),
  ownershipToken,
} = {}) {
  if (typeof nonce !== 'string' || nonce.length < 32) throw new GateBError('GATE_B_NONCE_INVALID');
  validateGateBApproval(envelope, {
    ...(expected || {}),
    approval_nonce_sha256: sha256(nonce),
  }, nowMs);
  const owner = ownershipToken || randomBytes(32).toString('hex');
  await mkdir(stateDir, { recursive: true });
  const lockDir = join(stateDir, 'active.lock');
  try { await mkdir(lockDir); } catch (error) {
    if (error?.code === 'EEXIST') throw new GateBError('GATE_B_ACTIVE_LOCKED');
    throw error;
  }
  try {
    const ownerFile = await open(join(lockDir, 'owner'), 'wx', 0o600);
    try { await ownerFile.writeFile(owner); await ownerFile.sync(); } finally { await ownerFile.close(); }
    await fsyncDirectory(lockDir);
    const spentDir = join(stateDir, 'spent');
    await mkdir(spentDir, { recursive: true });
    const nonceDigest = sha256(nonce);
    const spentPath = join(spentDir, `${nonceDigest}.json`);
    let spentFile;
    try { spentFile = await open(spentPath, 'wx', 0o600); } catch (error) {
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
    await fsyncDirectory(stateDir);
    return Object.freeze({ stateDir, ownershipToken: owner, nonceDigest, spentPath });
  } catch (error) {
    try { await removeOwnedLock(stateDir, owner); } catch {
      throw new GateBError('GATE_B_LOCK_CLEANUP_FAILED');
    }
    throw error;
  }
}

export async function prepareGateBLease({
  stateDir,
  nonce,
  envelope,
  expected,
  nowMs = Date.now(),
  ownershipToken,
} = {}) {
  validateGateBApproval(envelope, {
    ...(expected || {}),
    approval_nonce_sha256: sha256(nonce || ''),
  }, nowMs);
  return acquireGateBLease({ stateDir, nonce, envelope, expected, nowMs, ownershipToken });
}

export async function releaseGateBLease(lease) {
  await removeOwnedLock(lease.stateDir, lease.ownershipToken);
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
  stateDir,
  measureBindings,
  liveAdapter,
  nowMs = Date.now(),
  ownershipToken,
} = {}) {
  if (typeof measureBindings !== 'function') throw new GateBError('GATE_B_MEASUREMENT_UNAVAILABLE');
  if (typeof liveAdapter !== 'function') throw new GateBError('GATE_B_LIVE_ADAPTER_UNAVAILABLE');

  const approval = await readSecureApprovalFile(approvalFilePath);
  let first;
  let second;
  try { first = await measureBindings(); } catch { throw new GateBError('GATE_B_MEASUREMENT_FAILED'); }
  validateGateBApproval(approval.envelope, {
    ...first,
    approval_nonce_sha256: sha256(approval.nonce),
  }, nowMs);
  try { second = await measureBindings(); } catch { throw new GateBError('GATE_B_MEASUREMENT_FAILED'); }
  if (digestJson(first) !== digestJson(second)) throw new GateBError('GATE_B_MEASUREMENT_DRIFT');
  validateGateBApproval(approval.envelope, {
    ...second,
    approval_nonce_sha256: sha256(approval.nonce),
  }, nowMs);

  const lease = await acquireGateBLease({
    stateDir,
    nonce: approval.nonce,
    envelope: approval.envelope,
    expected: second,
    nowMs,
    ownershipToken,
  });
  const plan = Object.freeze({
    phase: 'live_plan_ready',
    lease,
    envelope_sha256: approval.envelope.envelope_sha256,
    target_policy: Object.freeze({ ...approval.envelope.target_policy }),
    external_action_budgets: GATE_B_BUDGETS,
    child_env: buildLiveChildEnvironment(process.env, [approval.nonce]),
  });
  try {
    const adapterResult = await liveAdapter(plan);
    return Object.freeze({
      phase: 'live_plan_dispatched',
      lease,
      adapter_result: adapterResult,
    });
  } catch {
    // Never release on an unknown dispatch outcome. The durable lock and spent
    // marker force explicit read-only incident review before another attempt.
    throw new GateBError('GATE_B_LIVE_ADAPTER_FAILED');
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
    timeout: 30_000,
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
    } catch {
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

export function executeCoordinator({ args = process.argv.slice(2), runner = executeSpec } = {}) {
  const invocation = parseInvocation(args);
  const checks = runOfflineChecks({ runner });
  return {
    payload: buildSafeStop({ invocation, checks }),
    exit_code: checks.success ? 0 : 1,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = executeCoordinator();
  process.stdout.write(`${JSON.stringify(result.payload)}\n`);
  process.exitCode = result.exit_code;
}
