import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();
const live = { skip: client ? false : 'run only as a coordinator-owned Gate B live child' };

describe('pine_check — server compile', live, () => {
  it('should compile valid Pine Script via TradingView API', async () => {
    assert.deepEqual(await client.dispatch('pine_facade_1'), { status: 'success', code: 'CASE_OK' });
  });
  it('should return errors for invalid Pine Script', async () => {
    assert.deepEqual(await client.dispatch('pine_facade_2'), { status: 'success', code: 'CASE_OK' });
  });
  it('should handle empty source gracefully', async () => {
    assert.deepEqual(await client.dispatch('pine_facade_3'), { status: 'success', code: 'CASE_OK' });
  });
});

describe('CLI — pine check server compile', live, () => {
  it('compiles valid Pine Script', async () => {
    assert.deepEqual(await client.dispatch('pine_facade_4'), { status: 'success', code: 'CASE_OK' });
  });
  it('returns errors for invalid Pine Script', async () => {
    assert.deepEqual(await client.dispatch('pine_facade_5'), { status: 'success', code: 'CASE_OK' });
  });
});
