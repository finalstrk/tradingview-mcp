import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTelegramMessage,
  collectMtfContext,
  parseMasudaMessage,
  runWatcher,
  selectNewEvents,
} from '../scripts/masuda_telegram_watch.js';

const MESSAGE = 'MASUDA|v=1|setup=masuda_scalp|kind=composite|dir=long|state=triggered|ticker={{ticker}}|tf={{interval}}|close={{close}}';

function alert(overrides = {}) {
  return {
    alert_id: 42,
    symbol: 'FX:USDJPY',
    resolution: '5',
    message: MESSAGE,
    last_fired: 1_784_265_600,
    ...overrides,
  };
}

describe('masuda telegram watcher — event contract', () => {
  it('parses only versioned masuda_scalp messages', () => {
    assert.deepEqual(parseMasudaMessage(MESSAGE), {
      v: '1',
      setup: 'masuda_scalp',
      kind: 'composite',
      dir: 'long',
      state: 'triggered',
      ticker: '{{ticker}}',
      tf: '{{interval}}',
      close: '{{close}}',
    });
    assert.equal(parseMasudaMessage('ADX crossed'), null);
    assert.equal(parseMasudaMessage('MASUDA|setup=other|dir=long|state=triggered'), null);
  });

  it('emits each last_fired value once and supports priming', () => {
    const first = selectNewEvents([alert()], { alerts: {} });
    assert.equal(first.events.length, 1);
    assert.equal(first.state.alerts['42'], '1784265600');

    const duplicate = selectNewEvents([alert()], first.state);
    assert.equal(duplicate.events.length, 0);

    const next = selectNewEvents([alert({ last_fired: 1_784_265_900 })], first.state);
    assert.equal(next.events.length, 1);

    const primed = selectNewEvents([alert()], { alerts: {} }, { prime: true });
    assert.equal(primed.events.length, 0);
    assert.equal(primed.state.alerts['42'], '1784265600');
  });
});

describe('masuda telegram watcher — MTF collection', () => {
  it('collects matching panes in policy order and restores the active pane', async () => {
    const focused = [];
    const context = await collectMtfContext(alert(), {
      listPanes: async () => ({
        layout_name: '2x2 grid',
        active_index: 2,
        panes: [
          { index: 2, symbol: 'FX:USDJPY', resolution: '5' },
          { index: 0, symbol: 'FX:USDJPY', resolution: 'D' },
          { index: 1, symbol: 'FX:USDJPY', resolution: '60' },
          { index: 3, symbol: 'FX:USDJPY', resolution: '15' },
          { index: 4, symbol: 'NASDAQ:AAPL', resolution: '5' },
        ],
      }),
      focusPane: async ({ index }) => { focused.push(index); },
      delay: async () => {},
      getOhlcv: async () => ({ close: 162.3, high: 162.5, low: 162.1, change_pct: '0.1%' }),
      getStudyValues: async () => ({
        studies: [{ name: 'ADX', values: { ADX: '61.2' } }],
      }),
    });

    assert.deepEqual(context.snapshots.map(item => item.resolution), ['D', '60', '15', '5']);
    assert.deepEqual(focused, [0, 1, 3, 2, 2]);
    assert.match(context.snapshots[0].studies[0], /ADX=61.2/);
  });
});

describe('masuda telegram watcher — output and state', () => {
  it('builds a self-contained shadow notification', () => {
    const message = buildTelegramMessage({
      alert: alert(),
      event: parseMasudaMessage(MESSAGE),
      generatedAt: '2026-07-17T01:00:00.000Z',
      context: {
        snapshots: [{
          resolution: '5',
          ohlcv: { close: 162.3, high: 162.5, low: 162.1, change_pct: '0.1%' },
          studies: ['ADX: ADX=61.2'],
        }],
      },
    });

    assert.match(message, /増田式 shadow通知/);
    assert.match(message, /LONG候補/);
    assert.match(message, /5: close=162.3/);
    assert.match(message, /売買推奨・発注ではありません/);
    assert.match(message, /registry未採用/);
  });

  it('is silent while priming and persists the observed fire time', async () => {
    let saved = null;
    let contextCalls = 0;
    const output = await runWatcher({ statePath: '/unused', prime: true }, {
      readState: async () => ({ alerts: {} }),
      listAlerts: async () => ({ success: true, alerts: [alert()] }),
      writeState: async (_path, state) => { saved = state; },
      collectMtfContext: async () => { contextCalls += 1; return { snapshots: [] }; },
    });

    assert.equal(output, '');
    assert.equal(contextCalls, 0);
    assert.equal(saved.alerts['42'], '1784265600');
  });
});
