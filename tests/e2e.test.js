import test from 'node:test';
import assert from 'node:assert/strict';

import { createFixedCaseChildClient } from '../src/e2e/cases/child_client.js';

const client = createFixedCaseChildClient();
const options = {
  skip: client ? false : 'run only as a coordinator-owned Gate B live child',
  timeout: 120000,
};

test('health and connection contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_health_1'), { status: 'success', code: 'CASE_OK' });
});

test('chart control contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_chart_1'), { status: 'success', code: 'CASE_OK' });
});

test('data access contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_data_1'), { status: 'success', code: 'CASE_OK' });
});

test('Pine Script contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_pine_1'), { status: 'success', code: 'CASE_OK' });
});

test('drawing contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_drawing_1'), { status: 'success', code: 'CASE_OK' });
});

test('UI automation contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_ui_1'), { status: 'success', code: 'CASE_OK' });
});

test('replay contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_replay_1'), { status: 'success', code: 'CASE_OK' });
});

test('alert contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_alerts_1'), { status: 'success', code: 'CASE_OK' });
});

test('watchlist contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_watchlist_1'), { status: 'success', code: 'CASE_OK' });
});

test('indicator contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_indicators_1'), { status: 'success', code: 'CASE_OK' });
});

test('batch contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_batch_1'), { status: 'success', code: 'CASE_OK' });
});

test('capture contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_capture_1'), { status: 'success', code: 'CASE_OK' });
});

test('context-size contracts', options, async () => {
  assert.deepEqual(await client.dispatch('chart_suite_context_size_1'), { status: 'success', code: 'CASE_OK' });
});
