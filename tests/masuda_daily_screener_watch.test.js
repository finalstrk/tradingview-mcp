import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTelegramMessage,
  normalizeScreenerSnapshot,
  parseNumeric,
  runWatcher,
  selectChartTarget,
  selectNewSignals,
  symbolFromHref,
} from '../scripts/masuda_daily_screener_watch.js';

const HEADERS = [
  'Symbol',
  'Long Trigger',
  'Short Trigger',
  'Composite State',
  'Buy Conditions',
  'Sell Conditions',
  'ADX',
  'RSI',
  'Stoch %K',
  'Stoch %D',
  'Bar Day UTC',
];

function rawRow({
  ticker = '1333',
  name = 'Umios Corporation',
  href = 'https://www.tradingview.com/chart/?symbol=TSE%3A1333',
  values = ['1.00', '0.00', '1.00', '2.00', '0.00', '61.20', '22.50', '18.00', '15.00', '20650.00'],
} = {}) {
  return {
    identity_lines: [ticker, name, 'D'],
    value_cells: values,
    href,
    symbol_full: null,
    data_symbol: null,
  };
}

function rawSnapshot(overrides = {}) {
  return {
    headers: HEADERS,
    watchlist: 'Watchlist\nwatchlist_formatted',
    indicator: '増田式 Daily Watchlist v1',
    scanned_at: '2026-07-17T07:10:00.000Z',
    original_url: 'https://jp.tradingview.com/chart/wu1kDZvT/',
    pane_before: { layout: '4', active_index: 0, panes: [] },
    pane_after: { layout: '4', active_index: 0, panes: [] },
    rows: [rawRow()],
    ...overrides,
  };
}

describe('masuda daily screener watcher — parsing contract', () => {
  it('parses TradingView numeric cells and exchange-qualified links', () => {
    assert.equal(parseNumeric('20,650.00'), 20650);
    assert.equal(parseNumeric('1.25K'), 1250);
    assert.equal(parseNumeric('—'), null);
    assert.equal(symbolFromHref('https://www.tradingview.com/chart/?symbol=TSE%3A1333'), 'TSE:1333');
    assert.equal(symbolFromHref('https://www.tradingview.com/symbols/FX-USDJPY/'), 'FX:USDJPY');
    assert.equal(symbolFromHref('https://www.tradingview.com/symbols/BTCUSD/?exchange=BITSTAMP'), 'BITSTAMP:BTCUSD');
  });

  it('normalizes the exact 10-plot daily contract', () => {
    const snapshot = normalizeScreenerSnapshot(rawSnapshot());
    assert.equal(snapshot.rows.length, 1);
    assert.equal(snapshot.rows[0].symbol, 'TSE:1333');
    assert.equal(snapshot.rows[0].interval, 'D');
    assert.equal(snapshot.rows[0].long_trigger, 1);
    assert.equal(snapshot.rows[0].bar_day_utc, 20650);
  });

  it('ignores only TradingView trailing blank action columns', () => {
    const row = rawRow();
    const snapshot = normalizeScreenerSnapshot(rawSnapshot({
      headers: [...HEADERS, ''],
      rows: [{ ...row, value_cells: [...row.value_cells, ''] }],
    }));
    assert.equal(snapshot.headers.length, HEADERS.length);
    assert.equal(snapshot.rows[0].bar_day_utc, 20650);
  });

  it('accepts mixed-asset rows that omit D when another row verifies the daily interval', () => {
    const apple = rawRow({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      href: 'https://www.tradingview.com/symbols/NASDAQ-AAPL/',
    });
    const snapshot = normalizeScreenerSnapshot(rawSnapshot({
      rows: [
        rawRow(),
        { ...apple, identity_lines: ['AAPL', 'Apple Inc.'] },
      ],
    }));
    assert.equal(snapshot.rows[1].symbol, 'NASDAQ:AAPL');
    assert.equal(snapshot.rows[1].name, 'Apple Inc.');
    assert.equal(snapshot.rows[1].interval, 'D');
    assert.equal(snapshot.rows[1].interval_verified, false);
  });

  it('uses a Screener row key when an unsupported symbol has no link', () => {
    const unsupported = rawRow({ ticker: 'J', name: 'J225', href: null, values: Array(10).fill('—') });
    const snapshot = normalizeScreenerSnapshot(rawSnapshot({
      rows: [
        rawRow(),
        { ...unsupported, identity_lines: ['J', 'J225'], data_symbol: 'FXOPEN:J225' },
      ],
    }));
    assert.equal(snapshot.rows[1].symbol, 'FXOPEN:J225');
    assert.equal(snapshot.rows[1].long_trigger, null);
  });

  it('fails closed on changed columns or non-daily rows', () => {
    assert.throws(
      () => normalizeScreenerSnapshot(rawSnapshot({ headers: HEADERS.slice(0, -1) })),
      /Unexpected Pine Screener columns/
    );
    assert.throws(
      () => normalizeScreenerSnapshot(rawSnapshot({ rows: [{ ...rawRow(), identity_lines: ['1333', 'Umios', '60'] }] })),
      /explicit non-daily interval/
    );
  });

  it('requires exchange-qualified identity only when a row triggers', () => {
    const quiet = normalizeScreenerSnapshot(rawSnapshot({
      rows: [rawRow({ href: null, values: ['0', '0', '0', '0', '0', '10', '50', '40', '40', '20650'] })],
    }));
    assert.equal(selectNewSignals(quiet).events.length, 0);

    const triggered = normalizeScreenerSnapshot(rawSnapshot({ rows: [rawRow({ href: null })] }));
    assert.throws(() => selectNewSignals(triggered), /no verified exchange-qualified symbol identity/);
  });
});

describe('masuda daily screener watcher — dedupe and output', () => {
  it('dedupes by symbol, direction, and confirmed UTC bar day', () => {
    const snapshot = normalizeScreenerSnapshot(rawSnapshot());
    const first = selectNewSignals(snapshot, { notified: {} }, { now: '2026-07-17T07:11:00.000Z' });
    assert.equal(first.events.length, 1);
    assert.ok(first.state.notified['TSE:1333|long|20650']);

    const duplicate = selectNewSignals(snapshot, first.state, { now: '2026-07-17T07:12:00.000Z' });
    assert.equal(duplicate.events.length, 0);

    const nextBar = normalizeScreenerSnapshot(rawSnapshot({
      rows: [rawRow({ values: ['1', '0', '1', '2', '0', '62', '21', '19', '16', '20651'] })],
    }));
    assert.equal(selectNewSignals(nextBar, first.state).events.length, 1);
  });

  it('supports silent priming while recording existing signals', () => {
    const snapshot = normalizeScreenerSnapshot(rawSnapshot());
    const selected = selectNewSignals(snapshot, { notified: {} }, { prime: true });
    assert.equal(selected.events.length, 0);
    assert.equal(selected.observed.length, 1);
    assert.ok(selected.state.notified['TSE:1333|long|20650']);
  });

  it('formats a compact non-advisory Telegram message', () => {
    const snapshot = normalizeScreenerSnapshot(rawSnapshot());
    const selected = selectNewSignals(snapshot, { notified: {} });
    const message = buildTelegramMessage(selected.events, snapshot);
    assert.match(message, /増田式 日足ウォッチ/);
    assert.match(message, /TSE:1333 LONG/);
    assert.match(message, /売買推奨・発注ではありません/);
    assert.match(message, /actではなくwatch/);
  });
});

describe('masuda daily screener watcher — orchestration', () => {
  it('writes state and stays silent when priming', async () => {
    let saved;
    const output = await runWatcher({
      statePath: '/unused',
      prime: true,
      report: false,
      watchlist: 'watchlist_formatted',
      indicator: '増田式 Daily Watchlist v1',
    }, {
      scanTradingView: async () => rawSnapshot(),
      readState: async () => ({ notified: {} }),
      writeState: async (_path, state) => { saved = state; },
      now: () => '2026-07-17T07:11:00.000Z',
    });
    assert.equal(output, '');
    assert.ok(saved.notified['TSE:1333|long|20650']);
    assert.equal(saved.last_scan.row_count, 1);
  });

  it('report mode returns diagnostics without changing state', async () => {
    let writeCalls = 0;
    const output = await runWatcher({
      statePath: '/unused',
      prime: false,
      report: true,
      watchlist: 'watchlist_formatted',
      indicator: '増田式 Daily Watchlist v1',
    }, {
      scanTradingView: async () => rawSnapshot(),
      readState: async () => ({ notified: {} }),
      writeState: async () => { writeCalls += 1; },
    });
    const report = JSON.parse(output);
    assert.equal(report.row_count, 1);
    assert.equal(report.new_signal_count, 1);
    assert.equal(report.verified_symbol_count, 1);
    assert.equal(writeCalls, 0);
  });

  it('selects only the dedicated chart URL target', () => {
    const target = selectChartTarget([
      { id: 'other', type: 'page', url: 'https://jp.tradingview.com/chart/other/' },
      { id: 'masuda', type: 'page', url: 'https://jp.tradingview.com/chart/wu1kDZvT/' },
    ]);
    assert.equal(target.id, 'masuda');
    assert.throws(() => selectChartTarget([]), /found 0/);
  });
});
