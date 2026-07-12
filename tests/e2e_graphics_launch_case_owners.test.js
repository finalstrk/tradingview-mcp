import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGraphicsCaseOwner } from '../src/e2e/cases/graphics.js';
import { createLaunchCaseOwner } from '../src/e2e/cases/launch.js';

const emptyGraphics = { success: true, study_count: 0, studies: [] };
const bridge = (reports, calls = []) => ({ execute: async id => { calls.push(id); return structuredClone(reports[id]); } });

test('graphics owners retain OHLCV and primitive assertions behind fixed operations', async () => {
  const calls = [];
  const common = { target_preserved: true, chart_state_preserved: true, disconnects: 1 };
  const owner = createGraphicsCaseOwner({ operationBridge: bridge({
    'owner.graphics.ohlcv.1': { ...common, summary_matches_live: true, summary: { open: 100, close: 115, high: 120, low: 90, range: 30, change: 15, change_pct: '15%' } },
    'owner.graphics.primitives.1': { ...common, lines: emptyGraphics, verbose_lines: emptyGraphics, labels: emptyGraphics, verbose_labels: emptyGraphics, boxes: emptyGraphics, verbose_boxes: emptyGraphics, tables: emptyGraphics },
  }, calls) });
  assert.deepEqual(await owner.run('graphics_ohlcv_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(await owner.run('graphics_primitives_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(calls, ['owner.graphics.ohlcv.1', 'owner.graphics.primitives.1']);
});

test('launch owner retains reuse and no-kill assertions behind a fixed operation', async () => {
  const endpoint = { Browser: 'TradingView', webSocketDebuggerUrl: 'ws://fixed' };
  const calls = [];
  const owner = createLaunchCaseOwner({ operationBridge: bridge({ 'owner.launch.reuse.1': {
    success: true, cdp_ready: true, reused: true, old_process_killed: false,
    browser: endpoint.Browser, web_socket_debugger_url: endpoint.webSocketDebuggerUrl, before: endpoint, after: endpoint,
  } }, calls) });
  assert.deepEqual(await owner.run('launch_reuse_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(calls, ['owner.launch.reuse.1']);
});

test('graphics and launch owners and children have zero raw external access', async () => {
  for (const file of ['../src/e2e/cases/graphics.js', '../src/e2e/cases/launch.js', 'graphics_e2e.test.js', 'launch_e2e.test.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|node:child_process|Runtime\.evaluate|probeCdpEndpoint|\blaunch\s*\(/);
  }
});
