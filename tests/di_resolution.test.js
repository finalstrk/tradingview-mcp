/**
 * Regression tests for the _resolve(_deps) DI pattern in src/core modules.
 *
 * Bug: after the hardening refactor renamed the direct import to `_evaluate`,
 * several handlers kept calling bare `evaluate(...)` / `getChartApi(...)`
 * without destructuring them from _resolve(_deps), throwing
 * "evaluate is not defined" at runtime (chart_scroll_to_date,
 * chart_get_visible_range, symbol_info, and all drawing read/remove tools).
 *
 * Two layers of coverage:
 *   1. Offline smoke tests — call each handler with mocked _deps and assert
 *      it completes without ReferenceError.
 *   2. Static source audit — scan every exported async function in src/core
 *      that calls evaluate/evaluateAsync/getChartApi and assert it resolves
 *      them via _resolve() first.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVisibleRange, scrollToDate, symbolInfo } from '../src/core/chart.js';
import { listDrawings, getProperties, removeOne, clearAll } from '../src/core/drawing.js';

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core');

// ── Mock helpers ─────────────────────────────────────────────────────────

function mockEvaluate(responses = {}) {
  const calls = [];
  const fn = async (expr) => {
    calls.push(expr);
    for (const [key, val] of Object.entries(responses)) {
      if (expr.includes(key)) return val;
    }
    return undefined;
  };
  fn.calls = calls;
  return fn;
}

function mockDeps(responses = {}) {
  const evaluate = mockEvaluate(responses);
  return {
    _deps: {
      evaluate,
      evaluateAsync: evaluate,
      waitForChartReady: async () => true,
      getChartApi: async () => 'window.__api',
    },
    evaluate,
  };
}

// ── Smoke tests: handlers must run offline with injected deps ────────────

describe('chart.js — DI resolution smoke tests', () => {
  it('getVisibleRange() resolves evaluate from _deps', async () => {
    const { _deps, evaluate } = mockDeps({
      getVisibleRange: { visible_range: { from: 1, to: 2 }, bars_range: { from: 0, to: 10 } },
    });
    const result = await getVisibleRange({ _deps });
    assert.equal(result.success, true);
    assert.deepEqual(result.visible_range, { from: 1, to: 2 });
    assert.ok(evaluate.calls.length > 0, 'injected evaluate was called');
  });

  it('scrollToDate() resolves evaluate from _deps', async () => {
    const { _deps, evaluate } = mockDeps({ 'resolution()': '5' });
    const result = await scrollToDate({ date: '2025-01-15', _deps });
    assert.equal(result.success, true);
    assert.equal(result.resolution, '5');
    assert.ok(evaluate.calls.length >= 2, 'injected evaluate was called for resolution + scroll');
  });

  it('symbolInfo() resolves evaluate from _deps', async () => {
    const { _deps, evaluate } = mockDeps({
      symbolExt: { symbol: 'ES1!', exchange: 'CME', type: 'futures' },
    });
    const result = await symbolInfo({ _deps });
    assert.equal(result.success, true);
    assert.equal(result.symbol, 'ES1!');
    assert.ok(evaluate.calls.length > 0, 'injected evaluate was called');
  });
});

describe('drawing.js — DI resolution smoke tests', () => {
  it('listDrawings() resolves evaluate/getChartApi from _deps', async () => {
    const { _deps } = mockDeps({ getAllShapes: [{ id: 'a', name: 'line' }] });
    const result = await listDrawings({ _deps });
    assert.equal(result.success, true);
    assert.equal(result.count, 1);
  });

  it('getProperties() resolves evaluate/getChartApi from _deps', async () => {
    const { _deps } = mockDeps({ getShapeById: { entity_id: 'a' } });
    const result = await getProperties({ entity_id: 'a', _deps });
    assert.equal(result.success, true);
  });

  it('removeOne() resolves evaluate/getChartApi from _deps', async () => {
    const { _deps } = mockDeps({ removeEntity: { removed: true, entity_id: 'a', remaining_shapes: 0 } });
    const result = await removeOne({ entity_id: 'a', _deps });
    assert.equal(result.success, true);
  });

  it('clearAll() resolves evaluate/getChartApi from _deps', async () => {
    const { _deps, evaluate } = mockDeps();
    const result = await clearAll({ _deps });
    assert.equal(result.success, true);
    assert.ok(evaluate.calls.length > 0, 'injected evaluate was called');
  });
});

// ── Static audit: every DI module's exports must call _resolve() ─────────

describe('source audit — exported functions resolve DI helpers before use', () => {
  const DI_CALL = /(?<![._$\w])(evaluate|evaluateAsync|getChartApi|getReplayApi|waitForChartReady)\s*\(/;
  const coreFiles = readdirSync(CORE_DIR).filter(f => f.endsWith('.js'));

  for (const file of coreFiles) {
    const source = readFileSync(join(CORE_DIR, file), 'utf8');
    if (!source.includes('function _resolve(')) continue; // module doesn't use the DI pattern

    it(`${file}: no exported function calls a DI helper without _resolve()`, () => {
      // Split on exported function boundaries; chunk 0 is the module header.
      const chunks = source.split(/^export (?:async )?function /m);
      const offenders = [];
      for (const chunk of chunks.slice(1)) {
        const name = chunk.slice(0, chunk.indexOf('('));
        if (chunk.match(DI_CALL) && !chunk.includes('_resolve(')) offenders.push(name);
      }
      assert.deepEqual(offenders, [],
        `functions calling evaluate/getChartApi etc. without _resolve(_deps): ${offenders.join(', ')}`);
    });
  }
});
