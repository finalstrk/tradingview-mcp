import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();

test('reuses the running localhost CDP browser session with kill_existing:false', {
  skip: client ? false : 'run only as a coordinator-owned Gate B live child',
  timeout: 120000,
}, async () => {
  assert.deepEqual(await client.dispatch('launch_reuse_1'), { status: 'success', code: 'CASE_OK' });
});
