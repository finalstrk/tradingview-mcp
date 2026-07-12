import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';

import {
  GATE_B_IPC_CASE_REGISTRY_SHA256,
  createGateBLedgerClient,
  createGateBLoopbackLedger,
  createBudgetAuthorizedAdapters,
  isLoopbackPeer,
} from '../src/e2e/gate_b_loopback_ipc.js';

const RUN_ID = 'run-0123456789abcdef0123456789abcdef';
const TOKEN = 'cap-0123456789abcdef0123456789abcdef0123456789abcdef';

function config(adapter, overrides = {}) {
  return {
    runId: RUN_ID,
    capabilityToken: TOKEN,
    budgets: {
      logical_operation_count: 11, cdp_session_attach_count: 978, cdp_session_detach_count: 978,
      cdp_protocol_read_count: 7832, cdp_protocol_mutation_count: 122, cdp_protocol_input_count: 12,
      network_request_count: 6, child_process_count: 8, capture_count: 3,
      full_external_gate_invocation_count: 1,
    },
    adapterDeadlineMs: 50,
    adapter,
    ...overrides,
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

test('one authenticated fixed case authorizes effects immediately before adapter action', async () => {
  let observed;
  const ledger = await createGateBLoopbackLedger(config(async (caseId, _snapshot, control) => {
    control.authorize('network_request_count', 1);
    const snapshot = control.snapshot();
    observed = { caseId, snapshot };
    return { status: 'success', code: 'CASE_OK', effect_started: true };
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
    assert.equal(observed.snapshot.network_request_count, 1);
    assert.equal(ledger.snapshot().network_request_count, 1);
  } finally {
    await ledger.close();
  }
});

test('failure is accepted only with proof that no effect started', async () => {
  let call = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    call += 1;
    return call === 1
      ? { status: 'failure', code: 'CASE_FAILED', effect_started: false }
      : { status: 'failure', code: 'CASE_FAILED', effect_started: true };
  }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    assert.deepEqual(await client.dispatch('quote_1'), { status: 'failure', code: 'CASE_FAILED' });
    assert.deepEqual(await client.dispatch('quote_2'), { status: 'unknown', code: 'ADAPTER_OUTCOME_INVALID' });
    assert.equal(ledger.snapshot().outcome_unknown_count, 1);
  } finally { await ledger.close(); }
});

test('adapter timeout is unknown and the serialized queue advances once', async () => {
  let calls = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    calls += 1;
    if (calls === 1) return new Promise(() => {});
    return { status: 'success', code: 'CASE_OK', effect_started: true };
  }, { adapterDeadlineMs: 5 }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    const first = client.dispatch('quote_1');
    const second = client.dispatch('quote_2');
    assert.deepEqual(await first, { status: 'unknown', code: 'ADAPTER_OUTCOME_UNKNOWN' });
    assert.deepEqual(await second, { status: 'success', code: 'CASE_OK' });
    assert.equal(calls, 2);
    assert.equal(ledger.snapshot().outcome_unknown_count, 1);
  } finally { await ledger.close(); }
});

test('IPC registry is exactly the 24 reviewed migrated cases with inventory-derived totals', async () => {
  const { GATE_B_IPC_CASE_REGISTRY } = await import('../src/e2e/gate_b_loopback_ipc.js');
  assert.equal(Object.keys(GATE_B_IPC_CASE_REGISTRY).length, 24);
  for (const removed of ['ctrl_s', 'page_reload', 'pine_facade_6']) {
    assert.equal(Object.hasOwn(GATE_B_IPC_CASE_REGISTRY, removed), false);
  }
  const totals = Object.values(GATE_B_IPC_CASE_REGISTRY).reduce((sum, delta) => {
    for (const [key, value] of Object.entries(delta)) sum[key] = (sum[key] || 0) + value;
    return sum;
  }, {});
  assert.deepEqual(totals, {});
});

test('rejects unknown fields, unknown case, bad token, registry drift and replay before adapter', async () => {
  let calls = 0;
  const ledger = await createGateBLoopbackLedger(config(async () => {
    calls += 1;
    return { status: 'success', code: 'CASE_OK', effect_started: true };
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
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK', effect_started: true })));
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
  const ledger = await createGateBLoopbackLedger(config(async (_caseId, _snapshot, control) => {
    control.authorize('network_request_count', 1);
    calls += 1;
    return { status: 'success', code: 'CASE_OK', effect_started: true };
  }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    assert.equal((await client.dispatch('chart_suite_pine_1')).status, 'success');
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await client.dispatch(`pine_facade_${index + 1}`)).status, 'success');
    }
    assert.deepEqual(await client.dispatch('pine_facade_1'), { status: 'failure', code: 'IPC_BUDGET_EXCEEDED' });
    assert.equal(calls, 6);
    assert.equal(ledger.snapshot().network_request_count, 6);
  } finally {
    await ledger.close();
  }
});

test('concurrent dispatch is strictly serialized through one adapter queue', async () => {
  const releases = [];
  const ledger = await createGateBLoopbackLedger(config(() => new Promise(resolve => releases.push(resolve))));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    const first = client.dispatch('pine_facade_1');
    const second = client.dispatch('pine_facade_2');
    while (releases.length < 1) await new Promise(resolve => setImmediate(resolve));
    assert.equal(releases.length, 1);
    releases[0]({ status: 'success', code: 'CASE_OK', effect_started: true });
    assert.equal((await first).status, 'success');
    while (releases.length < 2) await new Promise(resolve => setImmediate(resolve));
    releases[1]({ status: 'success', code: 'CASE_OK', effect_started: true });
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
    return { status: 'success', code: secret, effect_started: true, raw: secret };
  }));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    const thrown = await client.dispatch('pine_facade_1');
    const malformed = await client.dispatch('pine_facade_2');
    assert.deepEqual(thrown, { status: 'unknown', code: 'ADAPTER_OUTCOME_UNKNOWN' });
    assert.deepEqual(malformed, { status: 'unknown', code: 'ADAPTER_OUTCOME_INVALID' });
    assert.doesNotMatch(JSON.stringify([thrown, malformed, ledger.snapshot()]), new RegExp(secret));
    assert.equal(ledger.snapshot().outcome_unknown_count, 2);
  } finally {
    await ledger.close();
  }
});

test('client maps server close to a fixed unknown result without token leakage', async () => {
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK', effect_started: true })));
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
  assert.equal(ledger.snapshot().network_request_count, 0);
});

test('client rejects a non-fixed case before serialization or network use', async () => {
  const ledger = await createGateBLoopbackLedger(config(async () => ({ status: 'success', code: 'CASE_OK', effect_started: true })));
  try {
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    let serialized = false;
    const hostile = { toJSON() { serialized = true; throw new Error('RAW_SECRET_SENTINEL'); } };
    assert.deepEqual(await client.dispatch(hostile), { status: 'failure', code: 'IPC_CASE_UNKNOWN' });
    assert.equal(serialized, false);
    assert.equal(ledger.snapshot().network_request_count, 0);
  } finally {
    await ledger.close();
  }
});

test('reviewed adapter wrapper authorizes every CDP, text, key, mouse, capture and network effect at dispatch time', async () => {
  const counters = {};
  const calls = [];
  const control = {
    authorize(key, delta) { counters[key] = (counters[key] || 0) + delta; },
  };
  const adapters = createBudgetAuthorizedAdapters({
    control,
    adapters: {
      inspectIdentity: async () => ({}), read: async () => ({}), mutate: async () => ({}),
      input: async method => { calls.push(method); return {}; }, capture: async () => ({}),
      network: async () => ({ ok: true }),
    },
  });
  await adapters.inspectIdentity();
  await adapters.read('fixed');
  await adapters.mutate('fixed');
  await adapters.input('insertText', { text: 'fixed' });
  await adapters.input('dispatchKeyEvent', { type: 'keyDown', key: 's', modifiers: 2 });
  await adapters.input('dispatchKeyEvent', { type: 'keyUp', key: 's' });
  await adapters.input('dispatchMouseEvent', { type: 'mouseMoved' });
  await adapters.capture('captureScreenshot', {});
  await adapters.network({ url: 'https://pine-facade.tradingview.com/fixed', options: { method: 'POST' } });
  assert.deepEqual(counters, {
    cdp_protocol_read_count: 2, cdp_protocol_mutation_count: 1,
    cdp_protocol_input_count: 4, capture_count: 1, network_request_count: 1,
  });
  assert.deepEqual(calls, ['insertText', 'dispatchKeyEvent', 'dispatchKeyEvent', 'dispatchMouseEvent']);
});

test('one frozen ledger control is bound once and shared with serialized dispatch', async () => {
  let adapterControl;
  const ledger = await createGateBLoopbackLedger(config(async (_caseId, _snapshot, control) => {
    adapterControl = control;
    control.authorize('cdp_protocol_read_count', 1);
    return { status: 'success', code: 'CASE_OK', effect_started: true };
  }));
  try {
    const bound = ledger.bindControl();
    assert.equal(Object.isFrozen(bound), true);
    assert.deepEqual(Object.keys(bound).sort(), ['authorize', 'snapshot']);
    assert.throws(() => ledger.bindControl(), /IPC_CONTROL_ALREADY_BOUND/);
    bound.authorize('capture_count', 1);
    const client = createGateBLedgerClient({ runId: RUN_ID, capabilityToken: TOKEN, port: ledger.port });
    assert.deepEqual(await client.dispatch('chart_suite_health_1'), { status: 'success', code: 'CASE_OK' });
    assert.equal(adapterControl, bound);
    assert.equal(bound.snapshot().capture_count, 1);
    assert.equal(bound.snapshot().cdp_protocol_read_count, 1);
  } finally {
    await ledger.close();
  }
});
