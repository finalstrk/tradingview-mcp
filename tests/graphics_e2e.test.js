/**
 * P1-04 live, non-destructive graphics/OHLCV read-path verification.
 * Requires an existing TradingView target on localhost:9222.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { disconnect, evaluate, getTargetInfo } from '../src/connection.js';
import {
  getOhlcv,
  getPineBoxes,
  getPineLabels,
  getPineLines,
  getPineTables,
} from '../src/core/data.js';

let initialTarget;
let initialState;

async function chartState() {
  return evaluate(`
    (function() {
      function unwrap(value) {
        return value && typeof value === 'object' && typeof value.value === 'function'
          ? value.value()
          : value;
      }
      var api = window.TradingViewApi._activeChartWidgetWV.value();
      var widget = api._chartWidget;
      var cwc = window.TradingViewApi._chartWidgetCollection;
      var all = cwc && typeof cwc.getAll === 'function' ? cwc.getAll() : [widget];
      var activeIndex = null;
      var panes = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i] === widget) activeIndex = i;
        try {
          var series = all[i].model().mainSeries();
          panes.push({ symbol: series.symbol(), resolution: series.interval() });
        } catch(e) {
          panes.push({ error: e.message });
        }
      }
      return {
        symbol: api.symbol(),
        resolution: api.resolution(),
        chart_type: api.chartType(),
        layout: unwrap(cwc && cwc._layoutType),
        active_index: activeIndex,
        panes: panes,
      };
    })()
  `);
}

function expectedSummary(raw) {
  const bars = raw.bars;
  const highs = bars.map(bar => bar.high);
  const lows = bars.map(bar => bar.low);
  return {
    open: bars[0].open,
    close: bars.at(-1).close,
    high: Math.max(...highs),
    low: Math.min(...lows),
    range: Math.max(...highs) - Math.min(...lows),
    change: bars.at(-1).close - bars[0].open,
  };
}

function summaryMatches(summary, raw) {
  const expected = expectedSummary(raw);
  return Object.entries(expected).every(([key, value]) => Object.is(summary[key], value));
}

function assertFiniteOrNull(value, message) {
  assert.ok(value === null || Number.isFinite(value), message);
}

function assertGraphicsSchema(result, kind, verbose = false) {
  assert.equal(result.success, true);
  assert.equal(result.study_count, result.studies.length);
  for (const study of result.studies) {
    assert.equal(typeof study.name, 'string');
    if (kind === 'lines') {
      assert.ok(Number.isInteger(study.total_lines));
      for (const level of study.horizontal_levels) assert.ok(Number.isFinite(level));
      if (verbose) {
        assert.ok(study.all_lines.length <= study.total_lines);
        for (const line of study.all_lines) {
          assert.deepEqual(Object.keys(line), ['id', 'y1', 'y2', 'x1', 'x2', 'horizontal', 'style', 'width', 'color']);
          assertFiniteOrNull(line.y1, 'line y1');
          assertFiniteOrNull(line.y2, 'line y2');
        }
      }
    } else if (kind === 'labels') {
      assert.ok(Number.isInteger(study.total_labels));
      assert.equal(study.showing, study.labels.length);
      for (const label of study.labels) {
        assert.equal(typeof label.text, 'string');
        assertFiniteOrNull(label.price, 'label price');
      }
    } else if (kind === 'boxes') {
      assert.ok(Number.isInteger(study.total_boxes));
      for (const zone of study.zones) {
        assert.ok(Number.isFinite(zone.high));
        assert.ok(Number.isFinite(zone.low));
      }
      if (verbose) {
        assert.ok(study.all_boxes.length <= study.total_boxes);
        for (const box of study.all_boxes) {
          assert.deepEqual(Object.keys(box), ['id', 'high', 'low', 'x1', 'x2', 'borderColor', 'bgColor']);
          assertFiniteOrNull(box.high, 'box high');
          assertFiniteOrNull(box.low, 'box low');
        }
      }
    } else if (kind === 'tables') {
      for (const table of study.tables) {
        assert.ok(Array.isArray(table.rows));
        for (const row of table.rows) assert.equal(typeof row, 'string');
      }
    }
  }
}

describe('P1-04 live read-only graphics/OHLCV paths', () => {
  before(async () => {
    initialState = await chartState();
    initialTarget = await getTargetInfo();
    assert.ok(initialTarget?.id, 'existing TradingView target is available');
    assert.ok(initialState.symbol, 'active chart symbol is available');
  });

  after(async () => {
    try {
      const finalState = await chartState();
      const finalTarget = await getTargetInfo();
      assert.equal(finalTarget.id, initialTarget.id, 'TradingView target/session did not change');
      assert.deepEqual(finalState, initialState, 'graphics/OHLCV reads did not mutate chart state');
    } finally {
      await disconnect();
    }
  });

  it('returns live OHLCV summary with exact finite absolute values', async () => {
    const rawBefore = await getOhlcv({ count: 5 });
    const summary = await getOhlcv({ count: 5, summary: true });
    const rawAfter = await getOhlcv({ count: 5 });

    for (const key of ['open', 'close', 'high', 'low', 'range', 'change']) {
      assert.ok(Number.isFinite(summary[key]), `${key} is finite`);
    }
    assert.ok(summaryMatches(summary, rawBefore) || summaryMatches(summary, rawAfter), 'summary preserves the live bar values exactly');
    assert.match(summary.change_pct, /^-?\d+(?:\.\d+)?%$/);
  });

  it('returns finite public graphics schemas without transferring internal primitives', async () => {
    const lines = await getPineLines();
    const verboseLines = await getPineLines({ verbose: true });
    const labels = await getPineLabels({ max_labels: 50 });
    const verboseLabels = await getPineLabels({ max_labels: 50, verbose: true });
    const boxes = await getPineBoxes();
    const verboseBoxes = await getPineBoxes({ verbose: true });
    const tables = await getPineTables();

    assertGraphicsSchema(lines, 'lines');
    assertGraphicsSchema(verboseLines, 'lines', true);
    assertGraphicsSchema(labels, 'labels');
    assertGraphicsSchema(verboseLabels, 'labels', true);
    assertGraphicsSchema(boxes, 'boxes');
    assertGraphicsSchema(verboseBoxes, 'boxes', true);
    assertGraphicsSchema(tables, 'tables');

    const counts = {
      line_studies: lines.study_count,
      label_studies: labels.study_count,
      box_studies: boxes.study_count,
      table_studies: tables.study_count,
    };
    if (Object.values(counts).every(count => count === 0)) {
      process.stdout.write(`# P1-04 live precondition: no Pine primitives on active chart ${JSON.stringify(counts)}\n`);
    }
  });
});
