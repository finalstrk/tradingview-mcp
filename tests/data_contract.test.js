/**
 * P1-03 data-contract unit tests.
 *
 * The quote harness executes the real page expression produced by getQuote()
 * against a complete, read-only fake of the TradingView objects it consumes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {
  getEquity,
  getQuote,
  getStrategyResults,
  getTrades,
} from '../src/core/data.js';
import { registerDataTools } from '../src/tools/data.js';

const BAR = [1_720_000_000, 156.1, 157.2, 155.8, 156.9, 12_345];

function quotePage({ observed = 'FX:USDJPY', canonical = 'USDJPY', bar = BAR } = {}) {
  const state = {
    symbolReads: 0,
    barReads: 0,
    mutations: 0,
  };
  const exchange = observed.includes(':') ? observed.split(':')[0] : '';
  const bars = {
    lastIndex() {
      state.barReads += 1;
      return 0;
    },
    valueAt(index) {
      state.barReads += 1;
      return index === 0 ? [...bar] : null;
    },
  };
  const api = {
    symbol() {
      state.symbolReads += 1;
      return observed;
    },
    symbolExt() {
      state.symbolReads += 1;
      return {
        symbol: canonical,
        ticker: canonical,
        pro_name: observed,
        full_name: observed,
        exchange,
        description: 'U.S. Dollar / Japanese Yen',
        type: 'forex',
      };
    },
    setSymbol() { state.mutations += 1; },
    setResolution() { state.mutations += 1; },
    _chartWidget: {
      model() {
        return {
          mainSeries() {
            return { bars: () => bars };
          },
        };
      },
    },
  };
  const context = {
    window: {
      TradingViewApi: {
        _activeChartWidgetWV: { value: () => api },
      },
    },
    document: { querySelector: () => null },
  };

  return {
    state,
    evaluate: async expression => vm.runInNewContext(expression, context),
  };
}

function resultDeps(result) {
  return { evaluate: async () => structuredClone(result) };
}

describe('getQuote() symbol contract', () => {
  it('fails closed on a requested/active symbol mismatch without reading prices', async () => {
    const page = quotePage({ observed: 'FX:USDJPY', canonical: 'USDJPY' });

    await assert.rejects(
      () => getQuote({ symbol: 'NASDAQ:AAPL', _deps: { evaluate: page.evaluate } }),
      error => {
        assert.equal(error.code, 'QUOTE_SYMBOL_MISMATCH');
        assert.equal(error.requested_symbol, 'NASDAQ:AAPL');
        assert.equal(error.observed_symbol, 'FX:USDJPY');
        for (const field of ['time', 'open', 'high', 'low', 'close', 'last', 'volume', 'bid', 'ask', 'header_price']) {
          assert.equal(Object.hasOwn(error, field), false, `mismatch must not expose ${field}`);
        }
        return true;
      },
    );

    assert.ok(page.state.symbolReads > 0, 'active symbol was observed');
    assert.equal(page.state.barReads, 0, 'bar payload was not read after mismatch');
    assert.equal(page.state.mutations, 0, 'quote validation stayed read-only');
  });

  it('accepts an exchange-prefixed active symbol requested in canonical form', async () => {
    const page = quotePage({ observed: 'FX:USDJPY', canonical: 'USDJPY' });
    const quote = await getQuote({ symbol: 'USDJPY', _deps: { evaluate: page.evaluate } });

    assert.equal(quote.success, true);
    assert.equal(quote.symbol, 'USDJPY');
    assert.equal(quote.time, BAR[0]);
    assert.equal(quote.close, BAR[4]);
    assert.equal(quote.last, BAR[4]);
    assert.ok(page.state.symbolReads > 0, 'explicit requests are validated against the active symbol');
    assert.equal(page.state.mutations, 0);
  });

  it('rejects a conflicting explicit exchange even when the ticker text matches', async () => {
    const page = quotePage({ observed: 'FX:USDJPY', canonical: 'USDJPY' });

    await assert.rejects(
      () => getQuote({ symbol: 'NASDAQ:USDJPY', _deps: { evaluate: page.evaluate } }),
      error => {
        assert.equal(error.code, 'QUOTE_SYMBOL_MISMATCH');
        assert.equal(error.requested_symbol, 'NASDAQ:USDJPY');
        assert.equal(error.observed_symbol, 'FX:USDJPY');
        return true;
      },
    );
    assert.equal(page.state.barReads, 0);
    assert.equal(page.state.mutations, 0);
  });

  it('accepts the matching exchange-prefixed form without chart mutation', async () => {
    const page = quotePage({ observed: 'FX:USDJPY', canonical: 'USDJPY' });
    const quote = await getQuote({ symbol: 'FX:USDJPY', _deps: { evaluate: page.evaluate } });

    assert.equal(quote.success, true);
    assert.equal(quote.symbol, 'FX:USDJPY');
    assert.equal(quote.open, BAR[1]);
    assert.equal(quote.high, BAR[2]);
    assert.equal(quote.low, BAR[3]);
    assert.equal(quote.volume, BAR[5]);
    assert.equal(page.state.mutations, 0);
  });

  it('quotes the observed active chart when no explicit symbol is supplied', async () => {
    const page = quotePage({ observed: 'CME_MINI:ES1!', canonical: 'ES1!' });
    const quote = await getQuote({ _deps: { evaluate: page.evaluate } });

    assert.equal(quote.success, true);
    assert.equal(quote.symbol, 'CME_MINI:ES1!');
    assert.equal(quote.time, BAR[0]);
    assert.equal(quote.close, BAR[4]);
    assert.equal(page.state.mutations, 0);
  });
});

describe('strategy/trades/equity soft-error contract', () => {
  const SAFE_INTERNAL_ERROR = 'TradingView returned an internal data error.';

  it('rejects an internal strategy error instead of returning success:true', async () => {
    await assert.rejects(
      () => getStrategyResults({ _deps: resultDeps({ metrics: {}, source: 'internal_api', error: 'No strategy found.' }) }),
      error => error.message === 'No strategy found.',
    );
  });

  it('rejects a present empty-string strategy error with a safe non-empty message', async () => {
    await assert.rejects(
      () => getStrategyResults({ _deps: resultDeps({ metrics: {}, source: 'internal_api', error: '' }) }),
      error => error instanceof Error && error.message === SAFE_INTERNAL_ERROR,
    );
  });

  it('rejects an internal trades error instead of returning success:true', async () => {
    await assert.rejects(
      () => getTrades({ _deps: resultDeps({ trades: [], source: 'internal_api', error: 'ordersData() failed.' }) }),
      error => error.message === 'ordersData() failed.',
    );
  });

  it('normalizes a present object-valued trades error to a safe message', async () => {
    await assert.rejects(
      () => getTrades({ _deps: resultDeps({ trades: [], source: 'internal_api', error: { code: 'ORDERS_FAILED' } }) }),
      error => error instanceof Error && error.message === SAFE_INTERNAL_ERROR,
    );
  });

  it('rejects an internal equity error instead of returning success:true', async () => {
    await assert.rejects(
      () => getEquity({ _deps: resultDeps({ data: [], source: 'internal_api', error: 'No strategy found.' }) }),
      error => error.message === 'No strategy found.',
    );
  });

  it('rejects a present numeric equity error even when its value is falsy', async () => {
    await assert.rejects(
      () => getEquity({ _deps: resultDeps({ data: [], source: 'internal_api', error: 0 }) }),
      error => error instanceof Error && error.message === SAFE_INTERNAL_ERROR,
    );
  });

  it('preserves legitimate empty strategy, trades, and equity results', async () => {
    const strategy = await getStrategyResults({
      _deps: resultDeps({ metrics: {}, source: 'internal_api' }),
    });
    const trades = await getTrades({
      _deps: resultDeps({ trades: [], source: 'internal_api' }),
    });
    const equity = await getEquity({
      _deps: resultDeps({ data: [], source: 'internal_api' }),
    });

    assert.deepEqual(strategy, {
      success: true,
      metric_count: 0,
      source: 'internal_api',
      metrics: {},
    });
    assert.deepEqual(trades, {
      success: true,
      trade_count: 0,
      source: 'internal_api',
      trades: [],
    });
    assert.deepEqual(equity, {
      success: true,
      data_points: 0,
      source: 'internal_api',
      data: [],
      equity_summary: undefined,
      note: undefined,
    });
  });

  it('keeps an equity-summary fallback successful without a full curve', async () => {
    const summary = { netProfit: 42.5, totalTrades: 7 };
    const note = 'Full equity curve not available; summary returned.';
    const equity = await getEquity({
      _deps: resultDeps({
        data: [],
        equity_summary: summary,
        source: 'internal_api',
        note,
      }),
    });

    assert.equal(equity.success, true);
    assert.equal(equity.data_points, 0);
    assert.deepEqual(equity.equity_summary, summary);
    assert.equal(equity.note, note);
    assert.equal(Object.hasOwn(equity, 'error'), false);
  });
});

describe('MCP data tool failure propagation', () => {
  it('marks strategy, trades, and equity core failures as tool errors', async () => {
    const handlers = new Map();
    const server = {
      tool(name, description, schema, handler) {
        handlers.set(name, handler);
      },
    };
    const fail = message => async () => { throw new Error(message); };
    registerDataTools(server, {
      core: {
        getStrategyResults: fail('strategy unavailable'),
        getTrades: fail('trades unavailable'),
        getEquity: fail('equity unavailable'),
      },
    });

    for (const [name, input, message] of [
      ['data_get_strategy_results', {}, 'strategy unavailable'],
      ['data_get_trades', {}, 'trades unavailable'],
      ['data_get_equity', {}, 'equity unavailable'],
    ]) {
      const response = await handlers.get(name)(input);
      const payload = JSON.parse(response.content[0].text);
      assert.equal(response.isError, true, `${name} must set MCP isError`);
      assert.deepEqual(payload, { success: false, error: message });
    }
  });

  it('preserves structured quote mismatch details at the tool boundary', async () => {
    const handlers = new Map();
    const server = {
      tool(name, description, schema, handler) {
        handlers.set(name, handler);
      },
    };
    const mismatch = new Error('Requested symbol "NASDAQ:AAPL" does not match active chart symbol "FX:USDJPY".');
    Object.assign(mismatch, {
      code: 'QUOTE_SYMBOL_MISMATCH',
      requested_symbol: 'NASDAQ:AAPL',
      observed_symbol: 'FX:USDJPY',
    });
    registerDataTools(server, {
      core: {
        getQuote: async () => { throw mismatch; },
      },
    });

    const response = await handlers.get('quote_get')({ symbol: 'NASDAQ:AAPL' });
    const payload = JSON.parse(response.content[0].text);
    assert.equal(response.isError, true);
    assert.equal(payload.success, false);
    assert.equal(payload.code, 'QUOTE_SYMBOL_MISMATCH');
    assert.equal(payload.requested_symbol, 'NASDAQ:AAPL');
    assert.equal(payload.observed_symbol, 'FX:USDJPY');
    for (const field of ['time', 'open', 'high', 'low', 'close', 'last', 'volume']) {
      assert.equal(Object.hasOwn(payload, field), false);
    }
  });
});
