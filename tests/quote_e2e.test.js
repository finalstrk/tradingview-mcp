/**
 * P1-03 live, read-only quote contract checks.
 * Requires TradingView Desktop with CDP on localhost:9222.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

import { disconnect, evaluate } from '../src/connection.js';
import { getQuote } from '../src/core/data.js';

const PRICE_FIELDS = [
  'time', 'open', 'high', 'low', 'close', 'last', 'volume', 'bid', 'ask', 'header_price',
];

function canonicalSymbol(symbol) {
  const normalized = String(symbol || '').trim();
  const colon = normalized.lastIndexOf(':');
  return colon === -1 ? normalized : normalized.slice(colon + 1);
}

async function snapshot() {
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
        var pane = all[i];
        if (pane === widget) activeIndex = i;
        try {
          var model = pane.model();
          var series = model.mainSeries();
          panes.push({ symbol: series.symbol(), resolution: series.interval() });
        } catch(e) {
          panes.push({ error: e.message });
        }
      }
      var bars = widget.model().mainSeries().bars();
      var last = bars && typeof bars.lastIndex === 'function'
        ? bars.valueAt(bars.lastIndex())
        : null;
      return {
        chart: {
          symbol: api.symbol(),
          resolution: api.resolution(),
          chart_type: api.chartType(),
          layout: unwrap(cwc && cwc._layoutType),
          active_index: activeIndex,
          panes: panes,
        },
        bar: last ? { time: last[0], close: last[4] } : null,
      };
    })()
  `);
}

describe('getQuote() live read-only contract', () => {
  before(async () => {
    const current = await snapshot();
    assert.ok(current.chart.symbol, 'active TradingView symbol is available');
    assert.ok(current.bar, 'active TradingView bar is available');
  });

  after(async () => {
    await disconnect();
  });

  it('rejects 20/20 explicit mismatches with no payload or chart mutation', async () => {
    let falseSuccesses = 0;
    let chartMutations = 0;

    for (let i = 0; i < 20; i++) {
      const beforeState = await snapshot();
      const requested = `P1_03_NEVER_MATCH_${i}`;
      try {
        await getQuote({ symbol: requested });
        falseSuccesses += 1;
      } catch (error) {
        assert.equal(error.code, 'QUOTE_SYMBOL_MISMATCH');
        assert.equal(error.requested_symbol, requested);
        assert.equal(error.observed_symbol, beforeState.chart.symbol);
        for (const field of PRICE_FIELDS) {
          assert.equal(Object.hasOwn(error, field), false, `mismatch exposed ${field}`);
        }
      }
      const afterState = await snapshot();
      if (!isDeepStrictEqual(beforeState.chart, afterState.chart)) chartMutations += 1;
    }

    assert.equal(falseSuccesses, 0, 'mismatched-symbol false successes');
    assert.equal(chartMutations, 0, 'chart mutations caused by mismatch validation');
  });

  it('returns matching bar time/close 20/20 times without chart mutation', async () => {
    let barMismatches = 0;
    let chartMutations = 0;

    for (let i = 0; i < 20; i++) {
      const beforeState = await snapshot();
      const requested = i % 2 === 0
        ? beforeState.chart.symbol
        : canonicalSymbol(beforeState.chart.symbol);
      const quote = await getQuote({ symbol: requested });
      const afterState = await snapshot();
      const matchesBefore = quote.time === beforeState.bar?.time && quote.close === beforeState.bar?.close;
      const matchesAfter = quote.time === afterState.bar?.time && quote.close === afterState.bar?.close;
      if (!matchesBefore && !matchesAfter) barMismatches += 1;
      if (!isDeepStrictEqual(beforeState.chart, afterState.chart)) chartMutations += 1;

      assert.equal(quote.success, true);
      assert.equal(quote.symbol, requested);
    }

    assert.equal(barMismatches, 0, 'matching-symbol time/close mismatches');
    assert.equal(chartMutations, 0, 'chart mutations caused by matching validation');
  });
});
