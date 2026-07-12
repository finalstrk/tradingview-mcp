import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COORDINATOR_SAFE_STOP_CODE,
  buildSafeStop,
  parseInvocation,
  runOfflineChecks,
} from './test-coordinator.mjs';

test('normal invocation plans only offline checks and no external actions', () => {
  const calls = [];
  const result = runOfflineChecks({
    runner(spec) {
      calls.push(spec);
      return { status: 0, signal: null, error: undefined };
    },
  });

  assert.deepEqual(calls.map(spec => spec.name), ['unit', 'manifest']);
  assert.equal(result.success, true);
  assert.equal(result.external_action_count, 0);
  assert.equal(result.live_test_started, false);
  assert.ok(calls.every(spec => spec.live === false));
});

test('invocation parser never grants live mode without an approval nonce', () => {
  assert.deepEqual(parseInvocation([]), {
    mode: 'offline',
    approval_present: false,
    reason: 'approval_required',
  });
  assert.deepEqual(parseInvocation(['--offline-only']), {
    mode: 'offline',
    approval_present: false,
    reason: 'offline_requested',
  });
  assert.deepEqual(parseInvocation(['--approval-envelope']), {
    mode: 'offline',
    approval_present: false,
    reason: 'approval_required',
  });
});

test('safe-stop payload has a fixed, zero-action ledger', () => {
  const payload = buildSafeStop({
    invocation: parseInvocation([]),
    checks: {
      success: true,
      external_action_count: 0,
      live_test_started: false,
      results: [],
    },
  });

  assert.equal(payload.code, COORDINATOR_SAFE_STOP_CODE);
  assert.equal(payload.status, 'safe_stop');
  assert.equal(payload.external_action_count, 0);
  assert.equal(payload.live_test_started, false);
  assert.deepEqual(payload.ledger, {
    cdp: 0,
    network: 0,
    ui: 0,
    child_live_test: 0,
  });
});

test('offline failure is reported without exposing child output', () => {
  const result = runOfflineChecks({
    runner() {
      return { status: 17, signal: null, stderr: 'SECRET_CHILD_OUTPUT' };
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.results[0].exit_code, 17);
  assert.equal(Object.hasOwn(result.results[0], 'stderr'), false);
});

test('coordinator source has no live transport or integration-test import', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./test-coordinator.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chrome-remote-interface|node:http|node:https|fetch\s*\(/);
  assert.doesNotMatch(source, /(?:e2e|pine_facade|launch)_e2e\.test\.js/);
});
