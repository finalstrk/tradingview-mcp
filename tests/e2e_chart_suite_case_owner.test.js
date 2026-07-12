import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHART_SUITE_CASE_IDS,
  createChartSuiteCaseOwner,
} from '../src/e2e/cases/chart_suite.js';

const GROUPS = Object.freeze([
  'health', 'chart', 'data', 'pine', 'drawing', 'ui', 'replay',
  'alerts', 'watchlist', 'indicators', 'batch', 'capture', 'context_size',
]);

test('chart suite fixes one case ID per original hierarchical group in original order', () => {
  assert.deepEqual(CHART_SUITE_CASE_IDS, GROUPS.map(group => `chart_suite_${group}_1`));
});

test('chart suite owner captures, executes, cleans and restores each group in order', async () => {
  const events = [];
  const inventory = Object.freeze({ symbol: 'FX:USDJPY', resolution: '15' });
  const owner = createChartSuiteCaseOwner({
    captureGroup: async group => { events.push(`capture:${group}`); return inventory; },
    executeGroup: async group => { events.push(`execute:${group}`); },
    cleanupGroup: async group => { events.push(`cleanup:${group}`); },
    restoreGroup: async (group, captured) => {
      assert.equal(captured, inventory);
      events.push(`restore:${group}`);
    },
    verifyGroup: async (group, captured) => {
      assert.equal(captured, inventory);
      events.push(`verify:${group}`);
      return true;
    },
  });

  for (const group of GROUPS) {
    assert.deepEqual(await owner.run(`chart_suite_${group}_1`), { status: 'success', code: 'CASE_OK' });
  }
  assert.deepEqual(events, GROUPS.flatMap(group => [
    `capture:${group}`, `execute:${group}`, `cleanup:${group}`, `restore:${group}`, `verify:${group}`,
  ]));
});

test('chart suite owner always cleans and restores after assertion failure and exposes no details', async () => {
  const events = [];
  const owner = createChartSuiteCaseOwner({
    captureGroup: async () => ({ fixed: true }),
    executeGroup: async () => { events.push('execute'); throw new Error('SECRET assertion detail'); },
    cleanupGroup: async () => { events.push('cleanup'); },
    restoreGroup: async () => { events.push('restore'); },
    verifyGroup: async () => { events.push('verify'); return true; },
  });

  const result = await owner.run('chart_suite_replay_1');
  assert.deepEqual(result, { status: 'failure', code: 'CASE_FAILED' });
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.deepEqual(events, ['execute', 'cleanup', 'restore', 'verify']);
});

test('chart suite owner fails closed when restoration cannot be verified', async () => {
  const owner = createChartSuiteCaseOwner({
    captureGroup: async () => ({}), executeGroup: async () => {}, cleanupGroup: async () => {},
    restoreGroup: async () => {}, verifyGroup: async () => false,
  });
  assert.deepEqual(await owner.run('chart_suite_chart_1'), { status: 'failure', code: 'CASE_FAILED' });
  assert.deepEqual(await owner.run('attacker-controlled'), { status: 'failure', code: 'CASE_FAILED' });
});

test('full E2E child dispatches only fixed case IDs with zero direct external-action surfaces', async () => {
  const source = await readFile(new URL('e2e.test.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chrome-remote-interface|Runtime\.evaluate|Input\.dispatch|Page\.capture|\bevaluate\s*\(|\bfetch\s*\(|node:child_process/);
  assert.doesNotMatch(source, /expression\s*:|target(?:Id|_id)\s*:|input\s*:|method\s*:|https?:\/\//);
  const dispatched = [...source.matchAll(/\.dispatch\(['"]([a-z0-9_]+)['"]\)/g)].map(match => match[1]);
  assert.deepEqual(dispatched, CHART_SUITE_CASE_IDS);
});
