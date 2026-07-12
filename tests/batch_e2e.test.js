import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();

test('batch live state machine is exact and restores the explicitly selected existing target', {
  skip: client ? false : 'run only as a coordinator-owned Gate B live child',
  timeout: 120000,
}, async () => {
  assert.deepEqual(await client.dispatch('batch_1'), { status: 'success', code: 'CASE_OK' });
});
