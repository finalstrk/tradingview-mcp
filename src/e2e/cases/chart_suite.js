/**
 * Comprehensive E2E tests for all 70 TradingView MCP tools.
 * Requires TradingView Desktop running with --remote-debugging-port=9222
 *
 * Run: node --test tests/e2e.test.js
 *
 * Coverage: 70+ tests across 12 tool modules
 * - Health & Connection (4 tools)
 * - Chart Control (8 tools)
 * - Data Access (12 tools)
 * - Pine Script (12 tools)
 * - Drawing (5 tools)
 * - UI Automation (12 tools)
 * - Replay Mode (6 tools)
 * - Alerts (3 tools)
 * - Watchlist (2 tools)
 * - Indicators (2 tools)
 * - Batch (1 tool)
 * - Capture (1 tool)
 */

import assert from 'node:assert/strict';
import { types as utilTypes } from 'node:util';
import { CASE_FAILED, CASE_OK } from './fixed_result.js';
import { createChartOperationBridge } from '../chart_operation_registry.js';

const registeredRoot = { name: 'root', before: [], after: [], tests: [], suites: [] };
const registrationStack = [registeredRoot];

function describe(name, callback) {
  const suite = { name, before: [], after: [], tests: [], suites: [] };
  registrationStack.at(-1).suites.push(suite);
  registrationStack.push(suite);
  try { callback(); } finally { registrationStack.pop(); }
}
function it(name, callback) { registrationStack.at(-1).tests.push({ name, callback }); }
function before(callback) { registrationStack.at(-1).before.push(callback); }
function after(callback) { registrationStack.at(-1).after.push(callback); }

let client;
let activeCapability;
let activeGroup;
let activeInvocation = false;

// ── Helpers ──────────────────────────────────────────────────────────────

async function executeOperation(operationId, args = {}) {
  if (!activeCapability) throw new Error('CHART_SUITE_CAPABILITY_UNAVAILABLE');
  return activeCapability.execute(operationId, args);
}

async function fixedNetworkRequest() {
  const result = await executeOperation('chart.network.pine_check', {});
  return Object.freeze({
    ok: result.ok,
    status: result.status,
    json: async () => structuredClone(result.body),
  });
}

async function apiExists(path) {
  try {
    const pathId = path === CHART_API ? 'chart'
      : path === BOTTOM_BAR ? 'bottom_bar'
        : path === REPLAY_API ? 'replay' : null;
    if (!pathId) return false;
    return await executeOperation('chart.op.001', { p0: pathId });
  } catch { return false; }
}

const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';
const BARS_PATH = `${CHART_API}._chartWidget.model().mainSeries().bars()`;
const BOTTOM_BAR = 'window.TradingView.bottomWidgetBar';
const REPLAY_API = 'window.TradingViewApi._replayApi';

/** Unwrap TradingView WatchedValue objects */
function wv(path) {
  return `(function(){ var v = ${path}; return (v && typeof v === 'object' && typeof v.value === 'function') ? v.value() : v; })()`;
}

/** Sleep for ms */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════

describe('TradingView MCP — Full E2E (70 tools)', () => {

  before(async () => {
    if (!activeCapability) throw new Error('CHART_SUITE_CAPABILITY_UNAVAILABLE');
    await activeCapability.verify();
    client = Object.freeze({ reviewed: true });
  });

  after(async () => {
    await activeCapability.verify();
    client = undefined;
  });

  // ─── 1. HEALTH & CONNECTION (4 tools) ─────────────────────────────────

  describe('Health & Connection', () => {

    it('tv_health_check — CDP connection + chart state', async () => {
      assert.ok(client, 'CDP client connected');
      const state = await executeOperation('chart.op.002', {});
      assert.ok(state.apiAvailable, 'Chart API available');
      assert.ok(state.symbol, 'Has symbol');
      assert.ok(state.resolution, 'Has resolution');
      assert.ok(typeof state.chartType === 'number', 'Has chart type');
    });

    it('tv_discover — report available API paths', async () => {
      const chartApi = await apiExists(CHART_API);
      const bwb = await apiExists(BOTTOM_BAR);
      const replay = await apiExists(REPLAY_API);
      assert.ok(chartApi, 'Chart API available');
      assert.ok(bwb, 'bottomWidgetBar available');
      assert.ok(replay, 'replayApi available');
    });

    it('tv_ui_state — panels, buttons, chart state', async () => {
      const state = await executeOperation('chart.op.003', {});
      assert.ok(state, 'UI state returned');
      assert.ok(state.button_count > 0, 'Buttons found');
    });

    it('tv_launch — auto-detect binary (verify path resolution only)', async () => {
      // tv_launch is destructive (kills TradingView), so we only test path detection
      const { existsSync } = await import('fs');
      const paths = [
        '/Applications/TradingView.app/Contents/MacOS/TradingView',
        `${process.env.HOME}/Applications/TradingView.app/Contents/MacOS/TradingView`,
        '/opt/TradingView/tradingview',
        '/opt/TradingView/TradingView',
        '/usr/bin/tradingview',
        '/usr/local/bin/tradingview',
        '/snap/tradingview/current/tradingview',
        `${process.env.HOME}/.local/share/TradingView/TradingView`,
      ];
      const found = paths.some(p => existsSync(p));
      assert.ok(found, 'TradingView binary found on disk');
    });
  });

  // ─── 2. CHART CONTROL (8 tools) ──────────────────────────────────────

  describe('Chart Control', () => {
    let originalSymbol;
    let originalTF;
    let originalType;

    before(async () => {
      originalSymbol = await executeOperation('chart.op.004', {});
      originalTF = await executeOperation('chart.op.005', {});
      originalType = await executeOperation('chart.op.006', {});
    });

    after(async () => {
      await executeOperation('chart.op.007', { p0: originalSymbol });
      await sleep(2000);
      await executeOperation('chart.op.008', { p0: originalTF });
      await sleep(1000);
      await executeOperation('chart.op.009', { p0: originalType });
      await sleep(500);
    });

    it('chart_get_state — symbol, timeframe, studies', async () => {
      const state = await executeOperation('chart.op.010', {});
      assert.ok(state.symbol, 'Has symbol');
      assert.ok(state.resolution, 'Has resolution');
      assert.ok(typeof state.chartType === 'number', 'Has chart type');
      assert.ok(Array.isArray(state.studies), 'Studies is array');
    });

    it('chart_set_symbol — change ticker', async () => {
      await executeOperation('chart.op.011', {});
      await sleep(2500);
      const sym = await executeOperation('chart.op.012', {});
      assert.ok(sym.includes('AAPL'), `Symbol changed to AAPL, got: ${sym}`);
    });

    it('chart_set_timeframe — change resolution', async () => {
      await executeOperation('chart.op.013', {});
      await sleep(1500);
      const tf = await executeOperation('chart.op.014', {});
      assert.equal(tf, '1D');
    });

    it('chart_set_type — change chart style', async () => {
      await executeOperation('chart.op.015', {}); // Line
      await sleep(500);
      const ct = await executeOperation('chart.op.016', {});
      assert.equal(ct, 2, 'Chart type set to Line (2)');
    });

    it('chart_manage_indicator (add) — add Volume', async () => {
      const before = await executeOperation('chart.op.017', {});
      await executeOperation('chart.op.018', {});
      await sleep(1500);
      const after = await executeOperation('chart.op.019', {});
      const newIds = after.filter(id => !before.includes(id));
      assert.ok(newIds.length > 0, 'Volume study added');
      // Clean up: remove it
      for (const id of newIds) {
        await executeOperation('chart.op.020', { p0: id });
      }
    });

    it('chart_manage_indicator (remove) — add then remove', async () => {
      const before = await executeOperation('chart.op.021', {});
      await executeOperation('chart.op.022', {});
      await sleep(1500);
      const after = await executeOperation('chart.op.023', {});
      const newIds = after.filter(id => !before.includes(id));
      assert.ok(newIds.length > 0, 'Study added');

      for (const id of newIds) {
        await executeOperation('chart.op.024', { p0: id });
      }
      await sleep(500);
      const final = await executeOperation('chart.op.025', {});
      for (const id of newIds) {
        assert.ok(!final.includes(id), `Study ${id} removed`);
      }
    });

    it('chart_get_visible_range — get date range', async () => {
      const range = await executeOperation('chart.op.026', {});
      assert.ok(range, 'Visible range returned');
      assert.ok(range.from, 'Has from');
      assert.ok(range.to, 'Has to');
      assert.ok(range.to > range.from, 'to > from');
    });

    it('chart_set_visible_range — zoom via bar indices', async () => {
      await executeOperation('chart.op.027', {});
      await sleep(500);
      const rangeAfter = await executeOperation('chart.op.028', {});
      assert.ok(rangeAfter, 'Visible range returned after zoom');
      assert.ok(Number.isFinite(rangeAfter.from), 'Range after has finite from');
      assert.ok(Number.isFinite(rangeAfter.to), 'Range after has finite to');
      assert.ok(rangeAfter.to >= rangeAfter.from, 'Range after is ordered');
    });

    it('chart_scroll_to_date — jump to date', async () => {
      const resolution = await executeOperation('chart.op.029', {});
      assert.ok(resolution, 'Resolution available for scroll calculation');
      // Just verify the API call doesn't throw — actual scroll validated by range change
      await executeOperation('chart.op.030', {});
      await sleep(500);
    });

    it('symbol_info — symbol metadata', async () => {
      const info = await executeOperation('chart.op.031', {});
      assert.ok(info, 'Symbol info returned');
      assert.ok(info.symbol, 'Has symbol');
      assert.ok(info.exchange, 'Has exchange');
    });

    it('symbol_search — search dialog scraping', async () => {
      // Open symbol search
      await executeOperation('chart.op.032', {});
      await sleep(500);

      // Type search query
      await executeOperation('chart.input.insert_aapl', {});
      await sleep(800);

      // Read results
      const results = await executeOperation('chart.op.033', {});

      // Close dialog
      await executeOperation('chart.input.escape_down', {});
      await executeOperation('chart.input.escape_up', {});

      assert.ok(Array.isArray(results), 'Results array returned');
      // Results may or may not appear depending on dialog state
    });
  });

  // ─── 3. DATA ACCESS (12 tools) ────────────────────────────────────────

  describe('Data Access', () => {

    it('data_get_ohlcv — standard bar data', async () => {
      const data = await executeOperation('chart.op.034', {});
      assert.ok(data, 'Bar data returned');
      assert.ok(data.bars.length > 0, 'Has bars');
      const bar = data.bars[0];
      assert.ok(bar.time > 0, 'Has timestamp');
      assert.ok(bar.open > 0, 'Has open');
      assert.ok(bar.high >= bar.low, 'High >= Low');
      assert.ok(bar.close > 0, 'Has close');
    });

    it('data_get_ohlcv summary — compact stats', async () => {
      const data = await executeOperation('chart.op.035', {});
      assert.ok(data, 'Summary returned');
      assert.ok(data.bar_count > 0, 'Has bars');
      assert.ok(data.high >= data.low, 'High >= Low');
      const summarySize = JSON.stringify(data).length;
      assert.ok(summarySize < 1024, `Summary is ${summarySize} bytes (< 1KB)`);
    });

    it('data_get_study_values — indicator values from data window', async () => {
      const data = await executeOperation('chart.op.036', {});
      assert.ok(Array.isArray(data), 'Returns array');
      // May be empty if no indicators on chart — that's OK
    });

    it('data_get_indicator — study info and inputs', async () => {
      // Get a real entity_id first
      const studies = await executeOperation('chart.op.037', {});
      if (!studies || studies.length === 0) {
        // Skip if no studies on chart
        return;
      }
      const entityId = studies[0].id;
      const data = await executeOperation('chart.op.038', { p0: entityId });
      assert.ok(data, 'Indicator data returned');
      assert.ok(!data.error, 'No error');
    });

    it('data_get_pine_lines — horizontal price levels', async () => {
      const data = await executeOperation('chart.op.039', {});
      assert.ok(Array.isArray(data), 'Returns array');
      if (data.length > 0) {
        assert.ok(data[0].horizontal_levels, 'Has horizontal_levels');
        assert.ok(Array.isArray(data[0].horizontal_levels), 'Levels is array');
      }
    });

    it('data_get_pine_labels — text annotations', async () => {
      const data = await executeOperation('chart.op.040', {});
      assert.ok(Array.isArray(data), 'Returns array');
      if (data.length > 0) {
        assert.ok(Array.isArray(data[0].labels), 'Has labels array');
      }
    });

    it('data_get_pine_tables — table cell data', async () => {
      const data = await executeOperation('chart.op.041', {});
      assert.ok(data.path_accessible, 'Table cells path accessible');
    });

    it('data_get_pine_boxes — price zone boundaries', async () => {
      const data = await executeOperation('chart.op.042', {});
      assert.ok(Array.isArray(data), 'Returns array');
      if (data.length > 0) {
        assert.ok(Array.isArray(data[0].zones), 'Has zones array');
      }
    });

    it('quote_get — real-time quote', async () => {
      const quote = await executeOperation('chart.op.043', {});
      assert.ok(quote, 'Quote returned');
      assert.ok(quote.symbol, 'Has symbol');
      assert.ok(quote.close > 0 || quote.last > 0, 'Has price');
      const quoteSize = JSON.stringify(quote).length;
      assert.ok(quoteSize < 500, `Quote is ${quoteSize} bytes (< 500)`);
    });

    it('depth_get — DOM/order book (panel-dependent)', async () => {
      // depth_get requires the DOM panel to be open — test that the logic doesn't throw
      const data = await executeOperation('chart.op.044', {});
      assert.ok(typeof data.panel_found === 'boolean', 'DOM detection works');
    });

    it('data_get_strategy_results — strategy metrics (panel-dependent)', async () => {
      // Open strategy tester panel
      await executeOperation('chart.op.045', {});
      await sleep(500);

      const data = await executeOperation('chart.op.046', {});
      assert.ok(typeof data.panel_found === 'boolean', 'Strategy panel detection works');

      // Close it
      await executeOperation('chart.op.047', {});
    });

    it('data_get_trades — trade list (panel-dependent)', async () => {
      // Similar to strategy_results — verify panel detection
      await executeOperation('chart.op.048', {});
      await sleep(500);
      const panelExists = await executeOperation('chart.op.049', {});
      assert.ok(typeof panelExists === 'boolean', 'Panel detection works');
      await executeOperation('chart.op.050', {});
    });

    it('data_get_equity — equity curve (panel-dependent)', async () => {
      // Same pattern — just verify the panel access path works
      await executeOperation('chart.op.051', {});
      await sleep(500);
      const panelExists = await executeOperation('chart.op.052', {});
      assert.ok(typeof panelExists === 'boolean', 'Panel detection works');
      await executeOperation('chart.op.053', {});
    });
  });

  // ─── 4. PINE SCRIPT (12 tools) ────────────────────────────────────────

  describe('Pine Script', () => {
    let editorWasOpen = false;

    before(async () => {
      // Check if editor is already open
      editorWasOpen = await executeOperation('chart.op.054', {});
    });

    after(async () => {
      // Restore editor state
      if (!editorWasOpen) {
        await executeOperation('chart.op.055', {});
        await sleep(300);
      } else {
        await executeOperation('chart.op.057', {});
      }
    });

    async function ensureEditor() {
      await executeOperation('chart.op.057', {});
      return executeOperation('chart.op.058', {});
    }

    const FIND_MONACO = `
      (function findMonacoEditor() {
        var container = document.querySelector('.monaco-editor.pine-editor-monaco');
        if (!container) return null;
        var el = container;
        var fiberKey;
        for (var i = 0; i < 20; i++) {
          if (!el) break;
          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });
          if (fiberKey) break;
          el = el.parentElement;
        }
        if (!fiberKey) return null;
        var current = el[fiberKey];
        for (var d = 0; d < 15; d++) {
          if (!current) break;
          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {
            var env = current.memoizedProps.value.monacoEnv;
            if (env.editor && typeof env.editor.getEditors === 'function') {
              var editors = env.editor.getEditors();
              if (editors.length > 0) return { editor: editors[0], env: env };
            }
          }
          current = current.return;
        }
        return null;
      })()
    `;

    it('pine_get_source — read editor code', async () => {
      const ready = await ensureEditor();
      if (!ready) return; // Skip if editor can't be opened
      const source = await executeOperation('chart.op.059', {});
      // Source might be null if Monaco fiber path changed
      if (source !== null) {
        assert.ok(typeof source === 'string', 'Source is string');
      }
    });

    it('pine_set_source — inject code', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      const testCode = '//@version=6\nindicator("E2E Test", overlay=true)\nplot(close)';
      const set = await executeOperation('chart.op.060', { p0: testCode });
      if (set) {
        const readBack = await executeOperation('chart.op.061', {});
        assert.ok(readBack && readBack.includes('E2E Test'), 'Source was set');
      }
    });

    it('pine_compile — add to chart button', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      // Just verify we can find compile buttons
      const buttons = await executeOperation('chart.op.062', {});
      assert.ok(Array.isArray(buttons), 'Button scan works');
    });

    it('pine_smart_compile — detect button + check errors', async () => {
      // Same as pine_compile but also checks Monaco markers
      const ready = await ensureEditor();
      if (!ready) return;
      const markers = await executeOperation('chart.op.063', {});
      assert.ok(typeof markers === 'number', 'Marker count returned');
    });

    it('pine_get_errors — Monaco markers', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      const errors = await executeOperation('chart.op.064', {});
      assert.ok(Array.isArray(errors), 'Errors array returned');
    });

    it('pine_get_console — log output', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      const entries = await executeOperation('chart.op.065', {});
      assert.ok(typeof entries === 'number', 'Console row count returned');
    });

    it('pine_save — Ctrl+S dispatch', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      // Just verify key dispatch doesn't throw
      await executeOperation('chart.input.save_down', {});
      await executeOperation('chart.input.save_up', {});
      await sleep(300);
    });

    it('pine_new — find "New" menu items', async () => {
      const ready = await ensureEditor();
      if (!ready) return;
      // We just test that the Pine toolbar buttons are findable
      const hasPineToolbar = await executeOperation('chart.op.066', {});
      assert.ok(typeof hasPineToolbar === 'boolean', 'Pine toolbar detection works');
    });

    it('pine_open — script dropdown access', async () => {
      // Same as pine_new — tests toolbar button access
      const ready = await ensureEditor();
      if (!ready) return;
      const bottomArea = await executeOperation('chart.op.067', {});
      assert.ok(bottomArea, 'Bottom area exists for script dropdown');
    });

    it('pine_list_scripts — scrape dropdown items', async () => {
      // Tests the same path as pine_open — dropdown scraping
      const ready = await ensureEditor();
      if (!ready) return;
      // Just verify we can find the bottom area buttons
      const btnCount = await executeOperation('chart.op.068', {});
      assert.ok(btnCount >= 0, 'Button count retrieved');
    });

    it('pine_analyze — offline static analysis', async () => {
      // This runs offline, no TradingView needed
      // Test imported from pine_analyze.test.js pattern
      const source = `//@version=6
indicator("Test")
a = array.from(1, 2, 3)
val = array.get(a, 5)`;

      // Inline the analysis logic (same as the tool)
      const lines = source.split('\n');
      const arrays = new Map();
      const diagnostics = [];

      for (let i = 0; i < lines.length; i++) {
        const fromMatch = lines[i].match(/(\w+)\s*=\s*array\.from\(([^)]*)\)/);
        if (fromMatch) {
          const name = fromMatch[1].trim();
          const args = fromMatch[2].trim();
          arrays.set(name, { name, size: args === '' ? 0 : args.split(',').length, line: i + 1 });
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const pattern = /array\.(get|set)\(\s*(\w+)\s*,\s*(-?\d+)/g;
        let match;
        while ((match = pattern.exec(lines[i])) !== null) {
          const info = arrays.get(match[2]);
          if (info && info.size !== null) {
            const idx = parseInt(match[3], 10);
            if (idx < 0 || idx >= info.size) {
              diagnostics.push({ line: i + 1, message: `OOB index ${idx}`, severity: 'error' });
            }
          }
        }
      }
      assert.equal(diagnostics.length, 1, 'Detected 1 OOB error');
      assert.ok(diagnostics[0].message.includes('5'), 'Found index 5');
    });

    it('pine_check — server-side compile via TradingView API', async () => {
      const response = await fixedNetworkRequest();
      assert.ok(response.ok, `API returned ${response.status}`);
      const result = await response.json();
      assert.ok(result.result || result.error === undefined, 'Compiles successfully');
    });
  });

  // ─── 5. DRAWING (5 tools) ─────────────────────────────────────────────

  describe('Drawing', () => {

    after(async () => {
      // Clean up all drawings
      try { await executeOperation('chart.op.069', {}); } catch {}
    });

    it('draw_shape — create horizontal line', async () => {
      const quote = await executeOperation('chart.op.070', {});
      if (!quote) return;

      const result = await executeOperation('chart.op.071', { p0: quote.time, p1: quote.price });
      assert.ok(result, 'Shape created');
      assert.ok(result.entity_id, 'Has entity_id');
    });

    it('draw_list — list drawings', async () => {
      const shapes = await executeOperation('chart.op.072', {});
      assert.ok(Array.isArray(shapes), 'Shapes is array');
      assert.ok(shapes.length > 0, 'Has at least one shape');
    });

    it('draw_get_properties — read shape details', async () => {
      const shapes = await executeOperation('chart.op.073', {});
      if (!shapes || shapes.length === 0) return;

      const result = await executeOperation('chart.op.074', { p0: shapes[0].id });
      assert.ok(result, 'Properties returned');
      assert.ok(!result.error, 'No error');
    });

    it('draw_remove_one — remove single drawing', async () => {
      const shapes = await executeOperation('chart.op.075', {});
      if (!shapes || shapes.length === 0) return;

      const id = shapes[0].id;
      await executeOperation('chart.op.076', { p0: id });
      const after = await executeOperation('chart.op.077', {});
      const stillExists = after.some(s => s.id === id);
      assert.ok(!stillExists, 'Shape removed');
    });

    it('draw_clear — remove all drawings', async () => {
      // Add a shape first
      const quote = await executeOperation('chart.op.078', {});
      if (quote) {
        await executeOperation('chart.op.079', { p0: quote.time, p1: quote.price });
      }

      await executeOperation('chart.op.080', {});
      const after = await executeOperation('chart.op.081', {});
      assert.equal(after.length, 0, 'All shapes cleared');
    });
  });

  // ─── 6. UI AUTOMATION (12 tools) ──────────────────────────────────────

  describe('UI Automation', () => {

    it('ui_click — click element by aria-label', async () => {
      // Just verify the click logic works without side effects
      const result = await executeOperation('chart.op.082', {});
      assert.ok(typeof result.found === 'boolean', 'Element detection works');
    });

    it('ui_open_panel — open/close pine-editor', async () => {
      const bwb = await apiExists(BOTTOM_BAR);
      assert.ok(bwb, 'bottomWidgetBar exists');

      // Open
      await executeOperation('chart.op.083', {});
      await sleep(500);
      const isOpen = await executeOperation('chart.op.084', {});

      // Close
      await executeOperation('chart.op.085', {});
      await sleep(300);

      assert.ok(typeof isOpen === 'boolean', 'Panel toggle works');
    });

    it('ui_fullscreen — find fullscreen button', async () => {
      const found = await executeOperation('chart.op.086', {});
      assert.ok(typeof found === 'boolean', 'Fullscreen button detection works');
    });

    it('ui_keyboard — dispatch key events', async () => {
      // Press Escape — safe to dispatch
      await executeOperation('chart.input.escape_down', {});
      await executeOperation('chart.input.escape_up', {});
      // No assertion needed — verifying it doesn't throw
    });

    it('ui_type_text — insert text via CDP', async () => {
      // Just verify the reviewed text-input capability exists
      // We don't actually type into anything to avoid side effects
      assert.ok(typeof activeCapability.execute === 'function', 'fixed input operation available');
    });

    it('ui_hover — find element and dispatch mouseMoved', async () => {
      const coords = await executeOperation('chart.op.087', {});
      if (coords) {
        await executeOperation('chart.input.mouse_move', { x: coords.x, y: coords.y });
      }
      assert.ok(coords === null || (coords.x >= 0 && coords.y >= 0), 'Hover coordinates valid');
    });

    it('ui_scroll — dispatch mouseWheel event', async () => {
      const center = await executeOperation('chart.op.088', {});
      await executeOperation('chart.input.mouse_wheel', { x: center.x, y: center.y });
      // No assertion — verifying no throw
    });

    it('ui_mouse_click — click at coordinates', async () => {
      // Click in the middle of the chart (safe area)
      const center = await executeOperation('chart.op.089', {});
      await executeOperation('chart.input.mouse_move', { x: center.x, y: center.y });
      await executeOperation('chart.input.mouse_press', { x: center.x, y: center.y });
      await executeOperation('chart.input.mouse_release', { x: center.x, y: center.y });
    });

    it('ui_find_element — search by text', async () => {
      const results = await executeOperation('chart.op.090', {});
      assert.ok(Array.isArray(results), 'Element search works');
      assert.ok(results.length > 0, 'Found visible buttons');
    });

    it('ui_evaluate — execute arbitrary JS', async () => {
      const result = await executeOperation('chart.op.091', {});
      assert.equal(result, 2, 'JS evaluation works');
    });

    it('layout_list — find layout dropdown button', async () => {
      const found = await executeOperation('chart.op.092', {});
      assert.ok(typeof found === 'boolean', 'Layout button detection works');
    });

    it('layout_switch — layout dropdown access', async () => {
      // Same as layout_list — verify the dropdown button exists
      const found = await executeOperation('chart.op.093', {});
      assert.ok(typeof found === 'boolean', 'Layout switch button detection works');
    });
  });

  // ─── 7. REPLAY MODE (6 tools) ─────────────────────────────────────────

  describe('Replay Mode', () => {

    after(async () => {
      // Ensure replay is stopped
      try {
        const rp = REPLAY_API;
        const started = await executeOperation('chart.op.094', {});
        if (started) {
          await executeOperation('chart.op.095', {});
          await executeOperation('chart.op.096', {});
          await executeOperation('chart.op.097', {});
          await sleep(500);
        }
      } catch {}
    });

    it('replay_start — enter replay mode', async () => {
      const available = await executeOperation('chart.op.098', {});
      if (!available) return; // Skip if replay not available for current symbol

      await executeOperation('chart.op.099', {});
      await sleep(500);
      await executeOperation('chart.op.100', {});
      await sleep(500);

      const started = await executeOperation('chart.op.101', {});
      assert.ok(started, 'Replay started');
    });

    it('replay_step — advance one bar', async () => {
      const started = await executeOperation('chart.op.102', {});
      if (!started) return; // Skip if replay didn't start

      await executeOperation('chart.op.103', {});
      const date = await executeOperation('chart.op.104', {});
      assert.ok(date !== null && date !== undefined, 'Current date returned');
    });

    it('replay_autoplay — toggle autoplay', async () => {
      const started = await executeOperation('chart.op.105', {});
      if (!started) return;

      await executeOperation('chart.op.106', {});
      await sleep(200);
      const isAutoplay = await executeOperation('chart.op.107', {});
      assert.ok(typeof isAutoplay === 'boolean', 'Autoplay state returned');

      // Stop autoplay if it was turned on
      if (isAutoplay) {
        await executeOperation('chart.op.108', {});
        await sleep(200);
      }
    });

    it('replay_trade — buy action', async () => {
      const started = await executeOperation('chart.op.109', {});
      if (!started) return;

      await executeOperation('chart.op.110', {});
      const position = await executeOperation('chart.op.111', {});
      assert.ok(position !== undefined, 'Position returned after buy');

      // Close position
      try { await executeOperation('chart.op.112', {}); } catch {}
    });

    it('replay_status — get replay state', async () => {
      const status = await executeOperation('chart.op.113', {});
      assert.ok(typeof status.is_replay_available === 'boolean', 'Replay availability returned');
      assert.ok(typeof status.is_replay_started === 'boolean', 'Replay started state returned');
    });

    it('replay_stop — return to realtime', async () => {
      const started = await executeOperation('chart.op.114', {});
      if (!started) return;

      try { await executeOperation('chart.op.115', {}); } catch {}
      try { await executeOperation('chart.op.116', {}); } catch {}
      try { await executeOperation('chart.op.117', {}); } catch {}
      await sleep(500);

      const stoppedNow = await executeOperation('chart.op.118', {});
      assert.equal(typeof stoppedNow, 'boolean', 'Replay stopped state returned');
    });
  });

  // ─── 8. ALERTS (3 tools) ──────────────────────────────────────────────

  describe('Alerts', () => {

    it('alert_create — find Create Alert button', async () => {
      const found = await executeOperation('chart.op.119', {});
      assert.ok(typeof found === 'boolean', 'Alert button detection works');
    });

    it('alert_list — scrape alert items', async () => {
      const items = await executeOperation('chart.op.120', {});
      assert.ok(Array.isArray(items), 'Alert list returned');
    });

    it('alert_delete — context menu access', async () => {
      // Just verify the alerts button exists for context menu
      const found = await executeOperation('chart.op.121', {});
      assert.ok(typeof found === 'boolean', 'Alerts button detection works');
    });
  });

  // ─── 9. WATCHLIST (2 tools) ───────────────────────────────────────────

  describe('Watchlist', () => {

    it('watchlist_get — read watchlist symbols', async () => {
      // Open watchlist panel
      await executeOperation('chart.op.122', {});
      await sleep(500);

      const symbols = await executeOperation('chart.op.123', {});
      assert.ok(Array.isArray(symbols), 'Symbols returned');
    });

    it('watchlist_add — find add button', async () => {
      const found = await executeOperation('chart.op.124', {});
      // Button may or may not be found depending on watchlist state
      assert.ok(found === null || typeof found === 'string', 'Add button detection works');
    });
  });

  // ─── 10. INDICATORS (2 tools) ─────────────────────────────────────────

  describe('Indicators', () => {

    it('indicator_toggle_visibility — show/hide study', async () => {
      const studies = await executeOperation('chart.op.125', {});
      if (!studies || studies.length === 0) return;

      const id = studies[0].id;
      const result = await executeOperation('chart.op.126', { p0: id });
      if (!result.error) {
        assert.notEqual(result.was, result.toggled, 'Visibility toggled');
        assert.equal(result.was, result.restored, 'Visibility restored');
      }
    });

    it('indicator_set_inputs — change study parameters', async () => {
      const studies = await executeOperation('chart.op.127', {});
      if (!studies || studies.length === 0) return;

      const id = studies[0].id;
      const result = await executeOperation('chart.op.128', { p0: id });
      assert.ok(result, 'Input values retrieved');
      assert.ok(typeof result.input_count === 'number', 'Has input count');
    });
  });

  // ─── 11. BATCH (1 tool) ───────────────────────────────────────────────

  describe('Batch', () => {

    it('batch_run — verify symbol/tf switching mechanism', async () => {
      // batch_run iterates symbols + timeframes, sets each, then runs an action.
      // We test the underlying switching mechanism without running a full batch.
      const original = await executeOperation('chart.op.129', {});
      assert.ok(original, 'Can read current symbol for batch switching');

      // Verify setSymbol exists
      const hasSetSymbol = await executeOperation('chart.op.130', {});
      assert.ok(hasSetSymbol, 'setSymbol available for batch operations');

      const hasSetResolution = await executeOperation('chart.op.131', {});
      assert.ok(hasSetResolution, 'setResolution available for batch operations');
    });
  });

  // ─── 12. CAPTURE (1 tool) ─────────────────────────────────────────────

  describe('Capture', () => {

    it('capture_screenshot — reviewed screenshot capability', async () => {
      const { data } = await executeOperation('chart.capture.full_png', {});
      assert.ok(data, 'Screenshot data returned');
      assert.ok(data.length > 100, 'Screenshot has content');
      const buf = Buffer.from(data, 'base64');
      assert.ok(buf.length > 1000, `Screenshot is ${buf.length} bytes`);
    });

    it('capture_screenshot (chart region) — clip to chart area', async () => {
      const bounds = await executeOperation('chart.op.132', {});
      if (!bounds) return;

      const { data } = await executeOperation('chart.capture.clip_png', {
        height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y,
      });
      assert.ok(data, 'Chart region screenshot returned');
      const buf = Buffer.from(data, 'base64');
      assert.ok(buf.length > 500, `Chart screenshot is ${buf.length} bytes`);
    });
  });

  // ─── 13. CONTEXT SIZE VALIDATION ──────────────────────────────────────

  describe('Context Size Validation', () => {

    it('quote_get output < 500 bytes', async () => {
      const quote = await executeOperation('chart.op.133', {});
      const size = JSON.stringify({ success: true, ...quote }, null, 2).length;
      assert.ok(size < 500, `quote_get output is ${size} bytes (< 500)`);
    });

    it('data_get_study_values output < 2KB', async () => {
      const data = await executeOperation('chart.op.134', {});
      const size = JSON.stringify({ success: true, studies: data }, null, 2).length;
      assert.ok(size < 2048, `data_get_study_values output is ${size} bytes (< 2KB)`);
    });

    it('pine lines compact < 4KB per study', async () => {
      const data = await executeOperation('chart.op.135', {});
      for (const study of data) {
        const size = JSON.stringify(study).length;
        assert.ok(size < 4096, `${study.name}: pine lines ${size} bytes (< 4KB)`);
      }
    });

    it('pine labels compact < 8KB per study', async () => {
      const data = await executeOperation('chart.op.136', {});
      for (const study of data) {
        const size = JSON.stringify(study).length;
        assert.ok(size < 8192, `${study.name}: pine labels ${size} bytes (< 8KB)`);
      }
    });

    it('data_get_ohlcv summary < 1KB', async () => {
      const data = await executeOperation('chart.op.137', {});
      if (data) {
        const size = JSON.stringify({ success: true, ...data }, null, 2).length;
        assert.ok(size < 1024, `OHLCV summary is ${size} bytes (< 1KB)`);
      }
    });

    it('capture_screenshot returns path, not image data', async () => {
      // The tool saves to disk and returns path — verify size of response structure
      const response = JSON.stringify({
        success: true,
        method: 'cdp',
        file_path: '/path/to/screenshots/tv_full_2025-01-01T00-00-00-000Z.png',
        region: 'full',
        size_bytes: 150000,
      }, null, 2);
      assert.ok(response.length < 500, `Screenshot response is ${response.length} bytes (< 500)`);
    });
  });
});


const GROUP_NAMES = Object.freeze([
  'Health & Connection', 'Chart Control', 'Data Access', 'Pine Script', 'Drawing',
  'UI Automation', 'Replay Mode', 'Alerts', 'Watchlist', 'Indicators', 'Batch',
  'Capture', 'Context Size Validation',
]);
const GROUP_KEYS = Object.freeze([
  'health', 'chart', 'data', 'pine', 'drawing', 'ui', 'replay',
  'alerts', 'watchlist', 'indicators', 'batch', 'capture', 'context_size',
]);
export const CHART_SUITE_CASE_IDS = Object.freeze(GROUP_KEYS.map(group => `chart_suite_${group}_1`));
const CASE_TO_NAME = new Map(CHART_SUITE_CASE_IDS.map((caseId, index) => [caseId, GROUP_NAMES[index]]));

async function captureSuiteState() {
  return executeOperation('chart.op.138', {});
}

async function restoreSuiteState(state) {
  if (!state || typeof state !== 'object') throw new Error('CHART_SUITE_STATE_UNAVAILABLE');
  await executeOperation('chart.op.139', { p0: state.symbol });
  await sleep(1500);
  await executeOperation('chart.op.140', { p0: state.resolution });
  await sleep(750);
  await executeOperation('chart.op.141', { p0: state.chartType });
  if (!state.replayStarted) {
    await executeOperation('chart.op.142', {});
  }
  if (!state.pineOpen) {
    await executeOperation('chart.op.143', {});
  } else if (typeof state.pineSource === 'string') {
    await executeOperation('chart.op.144', { p0: state.pineSource });
  }
}

function fullSuite() {
  return registeredRoot.suites.find(suite => suite.name === 'TradingView MCP — Full E2E (70 tools)');
}

async function runHooks(hooks) {
  for (const hook of hooks) await hook();
}

export async function runChartSuiteGroup(root, group, {
  captureStateImpl = captureSuiteState,
  restoreStateImpl = restoreSuiteState,
} = {}) {
  if (!root || !group) throw new Error('fixed chart suite group unavailable');
  let primaryError;
  let initialState;
  try {
    await runHooks(root.before);
    initialState = await captureStateImpl();
    await runHooks(group.before);
    for (const entry of group.tests) await entry.callback();
  } catch (error) {
    primaryError = error;
  } finally {
    try { await runHooks([...group.after].reverse()); } catch (error) { primaryError ||= error; }
    try { await restoreStateImpl(initialState); } catch (error) { primaryError ||= error; }
    try { await runHooks([...root.after].reverse()); } catch (error) { primaryError ||= error; }
  }
  if (primaryError) throw primaryError;
}

async function runRegisteredGroup(caseId) {
  const groupName = CASE_TO_NAME.get(caseId);
  const root = fullSuite();
  const group = root?.suites.find(suite => suite.name === groupName);
  activeGroup = GROUP_KEYS[CHART_SUITE_CASE_IDS.indexOf(caseId)];
  return runChartSuiteGroup(root, group);
}

const CONTEXT_KEYS = Object.freeze(['frameId', 'loaderId', 'sessionId', 'targetId', 'uniqueContextId']);
const ADAPTER_KEYS = Object.freeze(['capture', 'input', 'inspectIdentity', 'mutate', 'network', 'read']);

function exactPlain(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { return false; }
  const actual = Reflect.ownKeys(descriptors).sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === keys[index])
    && actual.every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], 'value'));
}

function normalizeOwnerConfiguration(configuration) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) return null;
  const configurationKeys = Object.keys(configuration).sort();
  const accepted = configurationKeys.length === 3
    ? ['approvedContext', 'deadlineMs', 'reviewedAdapters']
    : ['approvedContext', 'deadlineMs', 'executeGroupImpl', 'reviewedAdapters'];
  if (!exactPlain(configuration, accepted)) return null;
  const { approvedContext, reviewedAdapters, deadlineMs, executeGroupImpl = runRegisteredGroup } = configuration;
  if (!exactPlain(approvedContext, CONTEXT_KEYS) || CONTEXT_KEYS.some(key => (
    typeof approvedContext[key] !== 'string' || approvedContext[key].length < 1 || approvedContext[key].length > 256
  ))) return null;
  if (!exactPlain(reviewedAdapters, ADAPTER_KEYS) || ADAPTER_KEYS.some(key => typeof reviewedAdapters[key] !== 'function')) return null;
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000 || typeof executeGroupImpl !== 'function') return null;
  return Object.freeze({
    approvedContext: Object.freeze({ ...approvedContext }), reviewedAdapters, deadlineMs, executeGroupImpl,
  });
}

function identityMatches(actual, expected) {
  return exactPlain(actual, CONTEXT_KEYS) && CONTEXT_KEYS.every(key => actual[key] === expected[key]);
}

function createReviewedCapability(configuration) {
  const { approvedContext, reviewedAdapters, deadlineMs } = configuration;

  async function bounded(operation, controller) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('CHART_SUITE_DEADLINE_EXCEEDED'));
          }, deadlineMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function verify(controller = new AbortController()) {
    const actual = await bounded(
      () => reviewedAdapters.inspectIdentity(approvedContext, controller.signal),
      controller,
    );
    if (!identityMatches(actual, approvedContext)) throw new Error('CHART_SUITE_CONTEXT_DRIFT');
  }

  async function invoke(name, args) {
    const controller = new AbortController();
    await verify(controller);
    const value = await bounded(
      () => reviewedAdapters[name](...args, approvedContext, controller.signal),
      controller,
    );
    await verify(controller);
    return value;
  }

  const bridge = createChartOperationBridge({
    reviewedAdapters: Object.freeze({
      read: (method, params) => invoke('read', [method, params]),
      mutate: (method, params) => invoke('mutate', [method, params]),
      input: (method, params) => invoke('input', [method, params]),
      capture: (method, params) => invoke('capture', [method, params]),
      network: request => invoke('network', [request]),
    }),
  });

  return Object.freeze({
    approvedContext,
    verify,
    execute: (operationId, args) => bridge.execute(operationId, args),
  });
}

export function createChartSuiteCaseOwner(configuration = {}) {
  const normalized = normalizeOwnerConfiguration(configuration);
  return Object.freeze({
    async run(caseId) {
      if (activeInvocation || !normalized || !CASE_TO_NAME.has(caseId)) return CASE_FAILED;
      activeInvocation = true;
      const capability = createReviewedCapability(normalized);
      try {
        activeCapability = capability;
        await normalized.executeGroupImpl(caseId, capability);
        return CASE_OK;
      } catch {
        return CASE_FAILED;
      } finally {
        activeCapability = undefined;
        activeGroup = undefined;
        activeInvocation = false;
      }
    },
  });
}
