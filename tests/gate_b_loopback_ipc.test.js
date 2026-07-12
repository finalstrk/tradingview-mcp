import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';

import {
  GATE_B_IPC_CASE_REGISTRY_SHA256,
  createGateBLedgerClient,
  createGateBLoopbackLedger,
  isLoopbackPeer,
} from '../src/e2e/gate_b_loopback_ipc.js';

const RUN_ID = 'run-0123456789abcdef0123456789abcdef';
const TOKEN = 'cap-0123456789abcdef0123456789abcdef0123456789abcdef';

function config(adapter) {
  return {
    runId: RUN_ID,
    capabilityToken: TOKEN,
    budgets: {
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
    },
    adapter,
  };
}

function sendRaw(port, payload) {
  return new Promise(resolve => {
    const bytes = Buffer.from(JSON.stringify(payload));
    const request = httpRequest({
      host: '127.0.0.1', port, method: 'POST', path: '/dispatch',
      headers: { 'content-type': 'application/json', 'content-length': bytes.length },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
    });
    request.end(bytes);
  });
}

test('one authenticated fixed case dispatches once and increments before adapter', async () => {
  let observed;
  const ledger = await createGateBLoopbackLedger(config(async (caseId, snapshot) => {
    observed = { caseId, snapshot };
    return { status: 'success', code: 'CASE_OK' };
  }));
  try {
    const client = createGateBLedgerClient({
      runId: RUN_ID,
      capabilityToken: TOKEN,
      port: ledger.port,
      registrySha256: GATE_B_IPC_CASE_REGISTRY_SHA256,
    });
    assert.deepEqual(await client.dispatch('pine_facade_1'), { status: 'success', code: 'CASE_OK' });
    assert.equal(observed.caseId, 'pine_facade_1');
    assert.equal(observed.snapshot.pine_facade_post_count, 1);
    assert.equal(observed.snapshot.harness_initiated_network_count, 1);
    assert.equal(ledger.snapshot().pine_facade_post_count, 1);
  } finally {
    await ledger.close();
  }
});

test('rejects unknown fields, unknown case, bad token, registry drift and replay before adapter', async () => {
  let calls = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    calls += 1;
    return { status: 'success', code: 'CASE_OK' };
  }));
  try {
    const send = payload => sendRaw(ledger.port, payload);
    const base = {
      run_id: RUN_ID,
      capability_token: TOKEN,
      sequence: 1,
      case_id: 'pine_facade_1',
      registry_sha256: GATE_B_IPC_CASE_REGISTRY_SHA256,
    };
    assert.deepEqual(await send({ ...base, extra: true }), { status: 'failure', code: 'IPC_REQUEST_INVALID' });
    assert.deepEqual(await send({ ...base, case_id: 'arbitrary' }), { status: 'failure', code: 'IPC_CASE_UNKNOWN' });
    assert.deepEqual(await send({ ...base, capability_token: `${TOKEN}x` }), { status: 'failure', code: 'IPC_AUTH_FAILED' });
    assert.deepEqual(await send({ ...base, registry_sha256: '0'.repeat(64) }), { status: 'failure', code: 'IPC_REGISTRY_DRIFT' });
    assert.deepEqual(await send(base), { status: 'success', code: 'CASE_OK' });
    assert.deepEqual(await send(base), { status: 'failure', code: 'IPC_SEQUENCE_REPLAY' });
    assert.equal(calls, 1);
  } finally {
    await ledger.close();
  }
});

test('requires loopback peers and exact run identity', async () => {
  assert.equal(isLoopbackPeer('127.0.0.1'), true);
  assert.equal(isLoopbackPeer('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackPeer('::1'), true);
  assert.equal(isLoopbackPeer('192.0.2.1'), false);
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK' })));
  try {
    const request = {
      run_id: `${RUN_ID}x`, capability_token: TOKEN, sequence: 1,
      case_id: 'pine_facade_1', registry_sha256: GATE_B_IPC_CASE_REGISTRY_SHA256,
    };
    assert.deepEqual(await sendRaw(ledger.port, request), { status: 'failure', code: 'IPC_RUN_MISMATCH' });
  } finally {
    await ledger.close();
  }
});

test('budget overflow is rejected before adapter and does not increment', async () => {
  let calls = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    calls += 1;
    return { status: 'success', code: 'CASE_OK' };
  }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    for (let index = 0; index < 6; index += 1) {
      assert.equal((await client.dispatch(`pine_facade_${index + 1}`)).status, 'success');
    }
    assert.deepEqual(await client.dispatch('pine_facade_1'), { status: 'failure', code: 'IPC_BUDGET_EXCEEDED' });
    assert.equal(calls, 6);
    assert.equal(ledger.snapshot().pine_facade_post_count, 6);
  } finally {
    await ledger.close();
  }
});

test('concurrent dispatch reserves sequence and counters authoritatively', async () => {
  const releases = [];
  const ledger = await createGateBLoopbackLedger(config(() => new Promise(resolve => releases.push(resolve))));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    const first = client.dispatch('pine_facade_1');
    const second = client.dispatch('pine_facade_2');
    while (releases.length < 2) await new Promise(resolve => setImmediate(resolve));
    assert.equal(ledger.snapshot().pine_facade_post_count, 2);
    releases[1]({ status: 'success', code: 'CASE_OK' });
    releases[0]({ status: 'success', code: 'CASE_OK' });
    assert.equal((await first).status, 'success');
    assert.equal((await second).status, 'success');
  } finally {
    await ledger.close();
  }
});

test('adapter throw and invalid output are sanitized to fixed outcomes', async () => {
  const secret = 'RAW_SECRET_SENTINEL';
  let count = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    count += 1;
    if (count === 1) throw new Error(secret);
    return { status: 'success', code: secret, raw: secret };
  }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    const thrown = await client.dispatch('pine_facade_1');
    const malformed = await client.dispatch('pine_facade_2');
    assert.deepEqual(thrown, { status: 'failure', code: 'ADAPTER_FAILURE' });
    assert.deepEqual(malformed, { status: 'unknown', code: 'ADAPTER_OUTCOME_INVALID' });
    assert.doesNotMatch(JSON.stringify([thrown, malformed, ledger.snapshot()]), new RegExp(secret));
    assert.equal(ledger.snapshot().outcome_unknown_count, 1);
  } finally {
    await ledger.close();
  }
});

test('client maps server close to a fixed unknown result without token leakage', async () => {
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK' })));
  const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
  await ledger.close();
  const result = await client.dispatch('pine_facade_1');
  assert.deepEqual(result, { status: 'unknown', code: 'IPC_UNAVAILABLE' });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN));
});

test('server close terminates an in-flight request whose adapter never settles', async () => {
  let entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const ledger = await createGateBLoopbackLedger(config(async () => {
    entered();
    return new Promise(() => {});
  }));
  const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
  const pending = client.dispatch('pine_facade_1');
  await enteredPromise;
  await ledger.close();
  assert.deepEqual(await pending, { status: 'unknown', code: 'IPC_UNAVAILABLE' });
  assert.equal(ledger.snapshot().pine_facade_post_count, 1);
});

test('client rejects a non-fixed case before serialization or network use', async () => {
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK' })));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    let serialized = false;
    const hostile = { toJSON() { serialized = true; throw new Error('RAW_SECRET_SENTINEL'); } };
    assert.deepEqual(await client.dispatch(hostile), { status: 'failure', code: 'IPC_CASE_UNKNOWN' });
    assert.equal(serialized, false);
    assert.equal(ledger.snapshot().pine_facade_post_count, 0);
  } finally {
    await ledger.close();
  }
});
