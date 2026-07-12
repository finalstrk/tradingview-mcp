import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();

test('returns live OHLCV summary with exact finite absolute values', {
  skip: client ? false : 'run only as a coordinator-owned Gate B live child', timeout: 120000,
}, async () => {
  assert.deepEqual(await client.dispatch('graphics_ohlcv_1'), { status: 'success', code: 'CASE_OK' });
});

test('returns finite public graphics schemas without transferring internal primitives', {
  skip: client ? false : 'run only as a coordinator-owned Gate B live child', timeout: 120000,
}, async () => {
  assert.deepEqual(await client.dispatch('graphics_primitives_1'), { status: 'success', code: 'CASE_OK' });
});
