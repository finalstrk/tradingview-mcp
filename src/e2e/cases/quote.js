import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

import { disconnect, evaluate } from '../../connection.js';
import { getQuote } from '../../core/data.js';
import { runFixedCase } from './fixed_result.js';

export const QUOTE_CASE_IDS = Object.freeze(['quote_1', 'quote_2']);
const PRICE_FIELDS = Object.freeze(['time', 'open', 'high', 'low', 'close', 'last', 'volume', 'bid', 'ask', 'header_price']);

function canonicalSymbol(symbol) {
  const normalized = String(symbol || '').trim();
  const colon = normalized.lastIndexOf(':');
  return colon === -1 ? normalized : normalized.slice(colon + 1);
}

async function defaultSnapshot() {
  return evaluate(`(function() {
    function unwrap(value) {
      return value && typeof value === 'object' && typeof value.value === 'function' ? value.value() : value;
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
      } catch(e) { panes.push({ error: e.message }); }
    }
    var bars = widget.model().mainSeries().bars();
    var last = bars && typeof bars.lastIndex === 'function' ? bars.valueAt(bars.lastIndex()) : null;
    return {
      chart: { symbol: api.symbol(), resolution: api.resolution(), chart_type: api.chartType(),
        layout: unwrap(cwc && cwc._layoutType), active_index: activeIndex, panes: panes },
      bar: last ? { time: last[0], close: last[4] } : null,
    };
  })()`);
}

export function createQuoteCaseOwner({ snapshot = defaultSnapshot, getQuoteImpl = getQuote, disconnectImpl = disconnect } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (!QUOTE_CASE_IDS.includes(caseId)) return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const current = await snapshot();
        assert.ok(current.chart.symbol);
        assert.ok(current.bar);
        try {
          let mismatches = 0;
          let chartMutations = 0;
          for (let i = 0; i < 20; i++) {
            const beforeState = await snapshot();
            if (caseId === 'quote_1') {
              const requested = `P1_03_NEVER_MATCH_${i}`;
              try {
                await getQuoteImpl({ symbol: requested });
                mismatches += 1;
              } catch (error) {
                assert.equal(error.code, 'QUOTE_SYMBOL_MISMATCH');
                assert.equal(error.requested_symbol, requested);
                assert.equal(error.observed_symbol, beforeState.chart.symbol);
                for (const field of PRICE_FIELDS) assert.equal(Object.hasOwn(error, field), false);
              }
            } else {
              const requested = i % 2 === 0 ? beforeState.chart.symbol : canonicalSymbol(beforeState.chart.symbol);
              const quote = await getQuoteImpl({ symbol: requested });
              const afterState = await snapshot();
              if (!(
                (quote.time === beforeState.bar?.time && quote.close === beforeState.bar?.close)
                || (quote.time === afterState.bar?.time && quote.close === afterState.bar?.close)
              )) mismatches += 1;
              if (!isDeepStrictEqual(beforeState.chart, afterState.chart)) chartMutations += 1;
              assert.equal(quote.success, true);
              assert.equal(quote.symbol, requested);
              continue;
            }
            const afterState = await snapshot();
            if (!isDeepStrictEqual(beforeState.chart, afterState.chart)) chartMutations += 1;
          }
          assert.equal(mismatches, 0);
          assert.equal(chartMutations, 0);
        } finally {
          await disconnectImpl();
        }
      });
    },
  });
}
