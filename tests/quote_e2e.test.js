import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();

describe('getQuote() live read-only contract', { skip: client ? false : 'run only as a coordinator-owned Gate B live child' }, () => {
  it('rejects 20/20 explicit mismatches with no payload or chart mutation', async () => {
    assert.deepEqual(await client.dispatch('quote_1'), { status: 'success', code: 'CASE_OK' });
  });

  it('returns matching bar time/close 20/20 times without chart mutation', async () => {
    assert.deepEqual(await client.dispatch('quote_2'), { status: 'success', code: 'CASE_OK' });
  });
});
