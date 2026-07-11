/**
 * Daily review formatter tests — no TradingView connection needed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildMarkdownReport, summarizeRegistry } from '../scripts/daily_review.js';

describe('daily review — registry summary', () => {
  it('counts setup x market statuses', () => {
    const summary = summarizeRegistry({
      version: 1,
      updated: '2026-07-07',
      setups: [
        {
          id: 'orb',
          name: 'Opening Range Breakout',
          markets: {
            fx: { status: 'rejected', bt_winrate: 0.4, bt_pf: 0.8, evidence: ['a.json'] },
            stocks_jp: { status: 'candidate', evidence: [] },
          },
        },
        {
          id: 'nr_squeeze',
          name: 'NR Squeeze',
          markets: {
            futures: { status: 'adopted', bt_winrate: 0.52, bt_pf: 1.4, evidence: ['b.json', 'c.json'] },
          },
        },
      ],
    });

    assert.equal(summary.setup_count, 2);
    assert.equal(summary.market_count, 3);
    assert.equal(summary.counts.rejected, 1);
    assert.equal(summary.counts.candidate, 1);
    assert.equal(summary.counts.adopted, 1);
    assert.equal(summary.adopted[0].setup, 'nr_squeeze');
  });
});

describe('daily review — markdown report', () => {
  it('renders read-only boundaries, gates, and watch labels', () => {
    const markdown = buildMarkdownReport({
      generated_at: '2026-07-07T01:23:45.000Z',
      options: { bars: 100 },
      cdp: { ok: true, data: { cdp_connected: true, chart_symbol: 'FX:USDJPY', chart_resolution: '5' } },
      chart: { ok: true, data: { symbol: 'FX:USDJPY', resolution: '5', studies: [{ id: 'a', name: 'DT NR Squeeze v1' }] } },
      quote: { ok: true, data: { symbol: 'FX:USDJPY', last: 157.12, volume: 1234, description: 'U.S. Dollar / Japanese Yen' } },
      ohlcv: { ok: true, data: { change: 0.12, change_pct: '0.08%', high: 157.4, low: 156.8, avg_volume: 1000 } },
      study_values: { ok: true, data: { studies: [{ name: 'RSI', values: { RSI: '55.1' } }] } },
      dt_labels: { ok: true, data: { studies: [{ name: 'DT NR Squeeze v1', labels: [{ text: 'DT|nr_squeeze|long|forming', price: 157.2 }] }] } },
      dt_tables: { ok: true, data: { studies: [] } },
      dt_lines: { ok: true, data: { studies: [] } },
      watchlist: { ok: true, data: { source: 'data_attributes', count: 1, symbols: [{ symbol: 'FX:USDJPY', last: '157.12' }] } },
      registry: {
        ok: true,
        data: {
          updated: '2026-07-07',
          setup_count: 1,
          market_count: 1,
          counts: { candidate: 1 },
          adopted: [],
          candidate: [{ setup: 'nr_squeeze', market: 'fx', status: 'candidate', bt_winrate: null, bt_pf: null, evidence_count: 0 }],
          rejected: [],
        },
      },
      stats: { ok: true, data: { exists: false, groups: [] } },
    });

    assert.match(markdown, /Read-only boundary/);
    assert.match(markdown, /発注しません/);
    assert.match(markdown, /No adopted setup x market/);
    assert.match(markdown, /DT\|nr_squeeze\|long\|forming/);
    assert.match(markdown, /interpretation: watch/);
    assert.doesNotMatch(markdown, /実弾発注/);
  });
});
