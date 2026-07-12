import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createGraphicsCaseOwner } from '../src/e2e/cases/graphics.js';
import { createLaunchCaseOwner } from '../src/e2e/cases/launch.js';

const chart = Object.freeze({ symbol: 'FX:USDJPY', resolution: '15', chart_type: 1, layout: 's', active_index: 0, panes: [] });
const target = Object.freeze({ id: 'fixed-target' });
const bars = Object.freeze([
  Object.freeze({ open: 100, high: 110, low: 90, close: 105 }),
  Object.freeze({ open: 105, high: 120, low: 95, close: 115 }),
]);
const emptyGraphics = Object.freeze({ success: true, study_count: 0, studies: Object.freeze([]) });

test('graphics owner retains exact OHLCV assertions and returns a fixed result', async () => {
  let disconnects = 0;
  const owner = createGraphicsCaseOwner({
    chartState: async () => structuredClone(chart), targetInfo: async () => target,
    getOhlcvImpl: async options => options.summary
      ? { open: 100, close: 115, high: 120, low: 90, range: 30, change: 15, change_pct: '15%' }
      : { bars: structuredClone(bars) },
    disconnectImpl: async () => { disconnects += 1; },
  });
  assert.deepEqual(await owner.run('graphics_ohlcv_1'), { status: 'success', code: 'CASE_OK' });
  assert.equal(disconnects, 1);
  assert.deepEqual(await owner.run('attacker-controlled'), { status: 'failure', code: 'CASE_FAILED' });
});

test('graphics owner retains public primitive schema assertions behind the fixed case', async () => {
  const owner = createGraphicsCaseOwner({
    chartState: async () => structuredClone(chart), targetInfo: async () => target,
    getPineLinesImpl: async () => emptyGraphics, getPineLabelsImpl: async () => emptyGraphics,
    getPineBoxesImpl: async () => emptyGraphics, getPineTablesImpl: async () => emptyGraphics,
    disconnectImpl: async () => {},
  });
  assert.deepEqual(await owner.run('graphics_primitives_1'), { status: 'success', code: 'CASE_OK' });
});

test('launch owner fixes endpoint, timeouts and kill policy inside coordinator ownership', async () => {
  const endpoint = { Browser: 'TradingView', webSocketDebuggerUrl: 'ws://fixed' };
  let launchRequest;
  const owner = createLaunchCaseOwner({
    probe: async request => { assert.deepEqual(request, { port: 9222, timeout_ms: 1500 }); return endpoint; },
    launchImpl: async request => {
      launchRequest = request;
      return { success: true, cdp_ready: true, reused: true, old_process_killed: false, browser: endpoint.Browser, web_socket_debugger_url: endpoint.webSocketDebuggerUrl };
    },
  });
  assert.deepEqual(await owner.run('launch_reuse_1'), { status: 'success', code: 'CASE_OK' });
  assert.deepEqual(launchRequest, { port: 9222, kill_existing: false, request_timeout_ms: 1500, overall_timeout_ms: 3000 });
});

test('migrated graphics and launch children send only fixed case IDs', async () => {
  for (const file of ['graphics_e2e.test.js', 'launch_e2e.test.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|node:child_process|Runtime\.evaluate|probeCdpEndpoint|\blaunch\s*\(/);
    assert.doesNotMatch(source, /expression\s*:|target(?:Id|_id)\s*:|input\s*:|method\s*:|https?:\/\//);
    assert.match(source, /\.dispatch\(['"][a-z0-9_]+['"]\)/);
  }
});
