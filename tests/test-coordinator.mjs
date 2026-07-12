import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);
const OFFLINE_GUARD = join(TEST_DIR, 'offline_network_guard.js');

export const COORDINATOR_SAFE_STOP_CODE = 'OFFLINE_APPROVAL_REQUIRED';

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
