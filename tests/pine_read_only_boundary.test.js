import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { discoverOpenPineEditorReadOnly } from '../src/core/pine_read_only_boundary.js';
import { discoverOpenPineEditorReadOnly as publicBoundary } from '../src/core/index.js';
import { isOfflineNetworkGuardInstalled } from './offline_network_guard.js';

function fixture({ editorOpen, editorProjection, chartProjection, failAt } = {}) {
  const effects = {
    activate: 0,
    show: 0,
    click: 0,
    focus: 0,
    keyboard: 0,
    input: 0,
    fetch: 0,
  };
  const reads = { visibility: 0, editor: 0, chart: 0 };

  return {
    effects,
    reads,
    reader: {
      async readEditorVisibility() {
        reads.visibility += 1;
        if (failAt === 'visibility') throw new Error('secret visibility failure');
        return editorOpen;
      },
      async readEditorProjection() {
        reads.editor += 1;
        if (failAt === 'editor') throw new Error('secret editor failure');
        return editorProjection;
      },
      async readChartProjection() {
        reads.chart += 1;
        if (failAt === 'chart') throw new Error('secret chart failure');
        return chartProjection;
      },
      activateScriptEditorTab() { effects.activate += 1; },
      showWidget() { effects.show += 1; },
      click() { effects.click += 1; },
      focus() { effects.focus += 1; },
      dispatchKeyboardEvent() { effects.keyboard += 1; },
      sendInput() { effects.input += 1; },
      fetch() { effects.fetch += 1; },
    },
  };
}

function assertNoForbiddenEffects(effects) {
  assert.deepEqual(effects, {
    activate: 0,
    show: 0,
    click: 0,
    focus: 0,
    keyboard: 0,
    input: 0,
    fetch: 0,
  });
}

describe('closed-editor read-only Pine discovery boundary', () => {
  it('is exposed through the public core API', () => {
    assert.equal(publicBoundary, discoverOpenPineEditorReadOnly);
  });

  it('has a static capability boundary containing only the three approved reader calls', () => {
    const source = readFileSync(
      new URL('../src/core/pine_read_only_boundary.js', import.meta.url),
      'utf8',
    );
    const calls = [...source.matchAll(/reader\.([A-Za-z]\w*)\s*\(/g)].map(match => match[1]);

    assert.equal(isOfflineNetworkGuardInstalled(), true);
    assert.deepEqual([...new Set(calls)].sort(), [
      'readChartProjection',
      'readEditorProjection',
      'readEditorVisibility',
    ]);
  });

  for (const editorOpen of [false, true]) {
    it(`accesses only approved read APIs at runtime when editor open is ${editorOpen}`, async () => {
      const state = fixture({
        editorOpen,
        editorProjection: { modelAvailable: true, markerCount: 0 },
        chartProjection: { symbol: 'FX:USDJPY', interval: '15' },
      });
      const accessed = [];
      const monitoredReader = new Proxy(state.reader, {
        get(target, property, receiver) {
          accessed.push(property);
          return Reflect.get(target, property, receiver);
        },
      });

      const result = await discoverOpenPineEditorReadOnly(monitoredReader);

      assert.equal(result.code, editorOpen ? 'PINE_EDITOR_READ_ONLY' : 'PINE_EDITOR_UNAVAILABLE');
      assert.deepEqual([...new Set(accessed)].sort(), [
        'readChartProjection',
        'readEditorProjection',
        'readEditorVisibility',
      ]);
      assert.equal(accessed.every(property => typeof property === 'string' && property.startsWith('read')), true);
      assertNoForbiddenEffects(state.effects);
    });
  }

  it('returns fixed unavailable result without editor, UI, input, or network effects', async () => {
    const state = fixture({
      editorOpen: false,
      chartProjection: { symbol: 'FX:USDJPY', interval: '15' },
    });

    const result = await discoverOpenPineEditorReadOnly(state.reader);

    assert.deepEqual(result, {
      ok: false,
      code: 'PINE_EDITOR_UNAVAILABLE',
      editor: null,
      chart: { symbol: 'FX:USDJPY', interval: '15' },
    });
    assert.deepEqual(state.reads, { visibility: 1, editor: 0, chart: 1 });
    assertNoForbiddenEffects(state.effects);
  });

  it('reads existing editor and chart projections without invoking forbidden capabilities', async () => {
    const state = fixture({
      editorOpen: true,
      editorProjection: { modelAvailable: true, markerCount: 2 },
      chartProjection: { symbol: 'FX:USDJPY', interval: '15' },
    });

    const result = await discoverOpenPineEditorReadOnly(state.reader);

    assert.deepEqual(result, {
      ok: true,
      code: 'PINE_EDITOR_READ_ONLY',
      editor: { modelAvailable: true, markerCount: 2 },
      chart: { symbol: 'FX:USDJPY', interval: '15' },
    });
    assert.deepEqual(state.reads, { visibility: 1, editor: 1, chart: 1 });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.editor), true);
    assert.equal(Object.isFrozen(result.chart), true);
    assertNoForbiddenEffects(state.effects);
  });

  const hostileCases = [
    ['secret editor key', () => ({ editorProjection: { modelAvailable: true, apiKey: 'secret' } })],
    ['secret chart key', () => ({ chartProjection: { symbol: 'FX:USDJPY', token: 'secret' } })],
    ['function capability', () => ({ editorProjection: { dispatchKeyboardEvent() {} } })],
    ['proxy', () => ({ editorProjection: new Proxy({ modelAvailable: true }, {}) })],
    ['cycle', () => {
      const editorProjection = { modelAvailable: true };
      editorProjection.self = editorProjection;
      return { editorProjection };
    }],
    ['deep payload', () => ({
      editorProjection: { modelAvailable: true, nested: { a: { b: { c: { d: true } } } } },
    })],
    ['oversized string', () => ({ chartProjection: { symbol: 'X'.repeat(5000), interval: '15' } })],
  ];

  for (const [name, makeProjection] of hostileCases) {
    it(`rejects ${name} with a fixed result and no effect`, async () => {
      const projection = makeProjection();
      const state = fixture({
        editorOpen: true,
        editorProjection: { modelAvailable: true, markerCount: 0 },
        chartProjection: { symbol: 'FX:USDJPY', interval: '15' },
        ...projection,
      });

      const result = await discoverOpenPineEditorReadOnly(state.reader);

      assert.deepEqual(result, {
        ok: false,
        code: 'PINE_DISCOVERY_READ_FAILED',
        editor: null,
        chart: null,
      });
      assert.equal(JSON.stringify(result).includes('secret'), false);
      assertNoForbiddenEffects(state.effects);
    });
  }

  it('rejects accessors without invoking them', async () => {
    const state = fixture({
      editorOpen: true,
      editorProjection: { modelAvailable: true },
      chartProjection: { symbol: 'FX:USDJPY', interval: '15' },
    });
    const editorProjection = {};
    Object.defineProperty(editorProjection, 'modelAvailable', {
      enumerable: true,
      get() {
        state.effects.focus += 1;
        return true;
      },
    });
    state.reader.readEditorProjection = async () => editorProjection;

    const result = await discoverOpenPineEditorReadOnly(state.reader);

    assert.equal(result.code, 'PINE_DISCOVERY_READ_FAILED');
    assertNoForbiddenEffects(state.effects);
  });

  it('returns detached frozen projections that cannot observe later reader mutation', async () => {
    const editorProjection = { modelAvailable: true, markerCount: 2 };
    const chartProjection = { symbol: 'FX:USDJPY', interval: '15' };
    const state = fixture({ editorOpen: true, editorProjection, chartProjection });

    const result = await discoverOpenPineEditorReadOnly(state.reader);
    editorProjection.markerCount = 99;
    chartProjection.symbol = 'SECRET:CHANGED';

    assert.deepEqual(result.editor, { modelAvailable: true, markerCount: 2 });
    assert.deepEqual(result.chart, { symbol: 'FX:USDJPY', interval: '15' });
    assert.throws(() => { result.editor.markerCount = 4; }, TypeError);
    assertNoForbiddenEffects(state.effects);
  });

  for (const failAt of ['visibility', 'editor', 'chart']) {
    it(`returns a fixed sanitized read error when ${failAt} projection fails`, async () => {
      const state = fixture({
        editorOpen: true,
        editorProjection: { modelAvailable: true },
        chartProjection: { symbol: 'FX:USDJPY' },
        failAt,
      });

      const result = await discoverOpenPineEditorReadOnly(state.reader);

      assert.deepEqual(result, {
        ok: false,
        code: 'PINE_DISCOVERY_READ_FAILED',
        editor: null,
        chart: null,
      });
      assert.equal(JSON.stringify(result).includes('secret'), false);
      assertNoForbiddenEffects(state.effects);
    });
  }

  it('rejects malformed visibility as a fixed read error', async () => {
    const state = fixture({ editorOpen: 'yes', chartProjection: {} });

    const result = await discoverOpenPineEditorReadOnly(state.reader);

    assert.deepEqual(result, {
      ok: false,
      code: 'PINE_DISCOVERY_READ_FAILED',
      editor: null,
      chart: null,
    });
    assert.deepEqual(state.reads, { visibility: 1, editor: 0, chart: 0 });
    assertNoForbiddenEffects(state.effects);
  });
});
