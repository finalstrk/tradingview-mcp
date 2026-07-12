/**
 * P1-04 deterministic precision and graphics projection contracts.
 *
 * Run with:
 *   node --experimental-vm-modules --test tests/data_precision.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_PATH = join(ROOT, 'src', 'core', 'data.js');
const CONNECTION_URL = pathToFileURL(join(ROOT, 'src', 'connection.js')).href;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadDataModule(evaluateImpl) {
  const context = vm.createContext({});
  const connection = new vm.SyntheticModule(
    ['evaluate', 'evaluateAsync', 'KNOWN_PATHS', 'safeString'],
    function initialize() {
      this.setExport('evaluate', evaluateImpl);
      this.setExport('evaluateAsync', evaluateImpl);
      this.setExport('KNOWN_PATHS', {
        chartApi: 'window.TradingViewApi._activeChartWidgetWV.value()',
        mainSeriesBars: 'window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars()',
      });
      this.setExport('safeString', value => JSON.stringify(String(value)));
    },
    { context, identifier: CONNECTION_URL },
  );
  const data = new vm.SourceTextModule(readFileSync(DATA_PATH, 'utf8'), {
    context,
    identifier: pathToFileURL(DATA_PATH).href,
  });
  await data.link(specifier => {
    if (specifier === '../connection.js') return connection;
    throw new Error(`Unexpected import in data.js: ${specifier}`);
  });
  await data.evaluate();
  return data.namespace;
}

function primitiveCollection(items, mapKey) {
  const byId = new Map(items.map((item, index) => [item.id ?? `id-${index}`, item.raw ?? item]));
  return {
    get(key) {
      if (key !== mapKey) return null;
      return { get: flag => flag === false ? { _primitivesDataById: byId } : null };
    },
  };
}

function graphicsSource(name, collectionName, mapKey, items) {
  return {
    metaInfo: () => ({ description: name }),
    _graphics: {
      _primitivesCollection: {
        [collectionName]: primitiveCollection(items, mapKey),
      },
    },
  };
}

function pageHarness({ bars = [], sources = [] } = {}) {
  const barStore = {
    firstIndex: () => 0,
    lastIndex: () => bars.length - 1,
    size: () => bars.length,
    valueAt: index => bars[index] ?? null,
  };
  const widget = {
    model: () => ({
      mainSeries: () => ({ bars: () => barStore }),
      model: () => ({ dataSources: () => sources }),
    }),
  };
  const page = vm.createContext({
    window: {
      TradingViewApi: {
        _activeChartWidgetWV: { value: () => ({ _chartWidget: widget }) },
      },
    },
  });
  const transfers = [];
  const evaluate = async expression => {
    const result = vm.runInContext(expression, page);
    const transferred = plain(result);
    transfers.push(transferred);
    return transferred;
  };
  return { evaluate, transfers };
}

async function moduleFor(fixture) {
  const harness = pageHarness(fixture);
  return { data: await loadDataModule(harness.evaluate), harness };
}

describe('OHLCV summary absolute-price precision', () => {
  it('preserves exact five-decimal high/low/range/change values', async () => {
    const bars = [
      [1, 1.23456, 1.23457, 1.23451, 1.23455, 100],
      [2, 1.23455, 1.23458, 1.23452, 1.23457, 200],
    ];
    const { data } = await moduleFor({ bars });
    const result = plain(await data.getOhlcv({ count: 2, summary: true }));

    assert.equal(result.open, 1.23456);
    assert.equal(result.close, 1.23457);
    assert.equal(result.high, 1.23458);
    assert.equal(result.low, 1.23451);
    assert.equal(result.range, 1.23458 - 1.23451);
    assert.equal(result.change, 1.23457 - 1.23456);
    assert.equal(result.change_pct, '0%');
  });

  it('preserves very-small finite ranges and changes instead of rounding to zero', async () => {
    const bars = [
      [1, 0.00001234, 0.00001236, 0.00001231, 0.00001235, 1],
      [2, 0.00001235, 0.00001239, 0.00001233, 0.00001238, 2],
    ];
    const { data } = await moduleFor({ bars });
    const result = plain(await data.getOhlcv({ count: 2, summary: true }));

    assert.equal(result.high, 0.00001239);
    assert.equal(result.low, 0.00001231);
    assert.equal(result.range, 0.00001239 - 0.00001231);
    assert.equal(result.change, 0.00001238 - 0.00001234);
    assert.ok(result.range > 0);
    assert.ok(result.change > 0);
  });
});

describe('Pine line projection', () => {
  it('keeps neighboring compact levels distinct and projects before transfer', async () => {
    const items = [
      { y1: 1.23456, y2: 1.23456, internal: { secret: 'raw-1' } },
      { y1: 1.23457, y2: 1.23457, internal: { secret: 'raw-2' } },
      { y1: 0.00001234, y2: 0.00001234, internal: { secret: 'raw-3' } },
      { y1: 1.23456, y2: 1.23456, internal: { secret: 'duplicate' } },
      { y1: 2, y2: 3, internal: { secret: 'diagonal' } },
      { y1: Infinity, y2: Infinity, internal: { secret: 'invalid' } },
    ];
    const sources = [graphicsSource('Lines', 'dwglines', 'lines', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineLines());

    assert.deepEqual(result, {
      success: true,
      study_count: 1,
      studies: [{
        name: 'Lines',
        total_lines: 6,
        horizontal_levels: [1.23457, 1.23456, 0.00001234],
      }],
    });
    assert.deepEqual(harness.transfers.at(-1), result.studies, 'page result is already compact');
    assert.equal(JSON.stringify(harness.transfers.at(-1)).includes('secret'), false);
    assert.equal(JSON.stringify(harness.transfers.at(-1)).includes('raw'), false);
  });

  it('verbose lines expose only public fields and normalize non-finite numbers', async () => {
    const items = [
      { id: 'first', raw: { y1: 1.23456, y2: 1.23457, x1: 10, x2: 11, st: 2, w: 1, ci: '#fff', secret: 'omit' } },
      { id: 'bad', raw: { y1: NaN, y2: Infinity, x1: Infinity, x2: 12, st: {}, w: NaN, ci: {}, secret: 'omit' } },
    ];
    const sources = [graphicsSource('Lines', 'dwglines', 'lines', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineLines({ verbose: true }));

    assert.deepEqual(result.studies[0].all_lines, [
      { id: 'first', y1: 1.23456, y2: 1.23457, x1: 10, x2: 11, horizontal: false, style: 2, width: 1, color: '#fff' },
      { id: 'bad', y1: null, y2: null, x1: null, x2: 12, horizontal: false, style: null, width: null, color: null },
    ]);
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.deepEqual(harness.transfers.at(-1), result.studies, 'verbose projection happens in page context');
  });
});

describe('Pine label projection', () => {
  it('preserves label precision and filtered tail semantics in page context', async () => {
    const items = [
      { t: 'old', y: 9.9, internal: 'omit' },
      { t: '', y: NaN, internal: 'omit-invalid' },
      { t: 'near-1', y: 1.23456, internal: 'omit' },
      { t: 'near-2', y: 1.23457, internal: 'omit' },
      { t: 'tiny', y: 0.00001234, internal: 'omit' },
    ];
    const sources = [graphicsSource('Labels', 'dwglabels', 'labels', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineLabels({ max_labels: 3 }));

    assert.deepEqual(result.studies[0], {
      name: 'Labels',
      total_labels: 5,
      showing: 3,
      labels: [
        { text: 'near-1', price: 1.23456 },
        { text: 'near-2', price: 1.23457 },
        { text: 'tiny', price: 0.00001234 },
      ],
    });
    assert.deepEqual(harness.transfers.at(-1), result.studies, 'tail limiting happens before transfer');
    assert.equal(JSON.stringify(harness.transfers.at(-1)).includes('internal'), false);
  });

  it('verbose labels retain public order/schema and normalize malformed fields', async () => {
    const items = [
      { id: 'old', raw: { t: 'old', y: 1, x: 1, yl: 'price', sz: 1, tci: '#1', ci: '#2' } },
      { id: 'near', raw: { t: 'near', y: 1.23456, x: 2, yl: 'price', sz: 2, tci: '#3', ci: '#4', secret: true } },
      { id: 'bad', raw: { t: 'bad', y: Infinity, x: NaN, yl: {}, sz: NaN, tci: {}, ci: {}, secret: true } },
    ];
    const sources = [graphicsSource('Labels', 'dwglabels', 'labels', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineLabels({ max_labels: 2, verbose: true }));

    assert.deepEqual(result.studies[0].labels, [
      { id: 'near', text: 'near', price: 1.23456, x: 2, yloc: 'price', size: 2, textColor: '#3', color: '#4' },
      { id: 'bad', text: 'bad', price: null, x: null, yloc: null, size: null, textColor: null, color: null },
    ]);
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.deepEqual(harness.transfers.at(-1), result.studies);
  });
});

describe('Pine box projection', () => {
  it('keeps neighboring compact zones distinct and omits non-finite zones', async () => {
    const items = [
      { y1: 1.23457, y2: 1.23456, internal: 'omit' },
      { y1: 1.23458, y2: 1.23457, internal: 'omit' },
      { y1: 0.00001235, y2: 0.00001234, internal: 'omit' },
      { y1: 1.23457, y2: 1.23456, internal: 'duplicate' },
      { y1: Infinity, y2: 1, internal: 'invalid' },
    ];
    const sources = [graphicsSource('Boxes', 'dwgboxes', 'boxes', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineBoxes());

    assert.deepEqual(result.studies[0], {
      name: 'Boxes',
      total_boxes: 5,
      zones: [
        { high: 1.23458, low: 1.23457 },
        { high: 1.23457, low: 1.23456 },
        { high: 0.00001235, low: 0.00001234 },
      ],
    });
    assert.deepEqual(harness.transfers.at(-1), result.studies);
    assert.equal(JSON.stringify(harness.transfers.at(-1)).includes('internal'), false);
  });

  it('verbose boxes transfer public fields only and normalize malformed numbers', async () => {
    const items = [
      { id: 'first', raw: { y1: 1.23457, y2: 1.23456, x1: 10, x2: 11, c: '#1', bc: '#2', secret: true } },
      { id: 'bad', raw: { y1: Infinity, y2: NaN, x1: NaN, x2: 12, c: {}, bc: {}, secret: true } },
    ];
    const sources = [graphicsSource('Boxes', 'dwgboxes', 'boxes', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineBoxes({ verbose: true }));

    assert.deepEqual(result.studies[0].all_boxes, [
      { id: 'first', high: 1.23457, low: 1.23456, x1: 10, x2: 11, borderColor: '#1', bgColor: '#2' },
      { id: 'bad', high: null, low: null, x1: null, x2: 12, borderColor: null, bgColor: null },
    ]);
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.deepEqual(harness.transfers.at(-1), result.studies);
  });
});

describe('Pine table projection and study filtering', () => {
  it('formats deterministic table/row/column order and skips malformed coordinates', async () => {
    const items = [
      { tid: 2, row: 1, col: 1, t: 'B', internal: 'omit' },
      { tid: 2, row: 1, col: 0, t: 'A', internal: 'omit' },
      { tid: 1, row: 0, col: 1, t: 'Y', internal: 'omit' },
      { tid: 1, row: 0, col: 0, t: 'X', internal: 'omit' },
      { tid: 1, row: Infinity, col: 0, t: 'invalid-row', internal: 'omit' },
      { tid: 1, row: 1, col: NaN, t: 'invalid-col', internal: 'omit' },
    ];
    const sources = [graphicsSource('Tables', 'dwgtablecells', 'tableCells', items)];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineTables());

    assert.deepEqual(result, {
      success: true,
      study_count: 1,
      studies: [{ name: 'Tables', tables: [{ rows: ['X | Y'] }, { rows: ['A | B'] }] }],
    });
    assert.deepEqual(harness.transfers.at(-1), result.studies);
    assert.equal(JSON.stringify(harness.transfers.at(-1)).includes('internal'), false);
  });

  it('preserves source order while filtering studies in page context', async () => {
    const sources = [
      graphicsSource('Alpha Lines', 'dwglines', 'lines', [{ y1: 1, y2: 1 }]),
      graphicsSource('Beta Lines', 'dwglines', 'lines', [{ y1: 2, y2: 2 }]),
      graphicsSource('Beta Lines 2', 'dwglines', 'lines', [{ y1: 3, y2: 3 }]),
    ];
    const { data, harness } = await moduleFor({ sources });
    const result = plain(await data.getPineLines({ study_filter: 'Beta' }));

    assert.deepEqual(result.studies.map(study => study.name), ['Beta Lines', 'Beta Lines 2']);
    assert.deepEqual(result.studies.map(study => study.horizontal_levels), [[2], [3]]);
    assert.deepEqual(harness.transfers.at(-1), result.studies);
  });
});
