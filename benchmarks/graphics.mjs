#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_PATH = join(ROOT, 'src', 'core', 'data.js');
const CONNECTION_URL = pathToFileURL(join(ROOT, 'src', 'connection.js')).href;
const INTERNAL_BLOB = 'internal-only-field-'.repeat(32);

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function collection(items, mapKey) {
  const byId = new Map(items.map((item, index) => [`id-${index}`, item]));
  return {
    get(key) {
      if (key !== mapKey) return null;
      return { get: flag => flag === false ? { _primitivesDataById: byId } : null };
    },
  };
}

function source(name, collectionName, mapKey, items) {
  return {
    metaInfo: () => ({ description: name }),
    _graphics: {
      _primitivesCollection: {
        [collectionName]: collection(items, mapKey),
      },
    },
  };
}

function rawFields(index) {
  return {
    internal_blob: INTERNAL_BLOB,
    internal_nested: {
      index,
      flags: [true, false, true, false],
      cache: { left: index - 1, right: index + 1, padding: INTERNAL_BLOB },
    },
  };
}

function fixtureSources() {
  const lines = Array.from({ length: 500 }, (_, index) => {
    const price = 1.23456 + index * 0.00001;
    return {
      y1: price, y2: price, x1: 1_700_000_000 + index, x2: 1_700_000_100 + index,
      st: index % 3, w: (index % 4) + 1, ci: `#${(index % 0xffffff).toString(16).padStart(6, '0')}`,
      ...rawFields(index),
    };
  });
  const labels = Array.from({ length: 500 }, (_, index) => ({
    t: `Label ${String(index).padStart(3, '0')}`,
    y: 1.23456 + index * 0.00001,
    x: 1_700_000_000 + index,
    yl: 'price', sz: index % 3, tci: '#ffffff', ci: '#000000',
    ...rawFields(index),
  }));
  const boxes = Array.from({ length: 500 }, (_, index) => {
    const high = 1.23456 + index * 0.00001;
    return {
      y1: high, y2: high - 0.000004, x1: 1_700_000_000 + index, x2: 1_700_000_100 + index,
      c: '#336699', bc: '#11223380',
      ...rawFields(index),
    };
  });
  const tables = [];
  for (let table = 0; table < 4; table += 1) {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const index = table * 50 + row * 5 + col;
        tables.push({ tid: table, row, col, t: `T${table}R${row}C${col}`, ...rawFields(index) });
      }
    }
  }
  return [
    source('Benchmark Lines', 'dwglines', 'lines', lines),
    source('Benchmark Labels', 'dwglabels', 'labels', labels),
    source('Benchmark Boxes', 'dwgboxes', 'boxes', boxes),
    source('Benchmark Tables', 'dwgtablecells', 'tableCells', tables),
  ];
}

function pageContext() {
  const sources = fixtureSources();
  const chart = { model: () => ({ model: () => ({ dataSources: () => sources }) }) };
  return vm.createContext({
    window: {
      TradingViewApi: {
        _activeChartWidgetWV: { value: () => ({ _chartWidget: chart }) },
      },
    },
  });
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

function validateResponse(response, phase) {
  const errors = [];
  const lineStudy = response.lines.studies[0];
  const labelStudy = response.labels.studies[0];
  const boxStudy = response.boxes.studies[0];
  const tableStudy = response.tables.studies[0];
  if (lineStudy?.name !== 'Benchmark Lines' || lineStudy?.total_lines !== 500) errors.push('line name/count');
  if (labelStudy?.name !== 'Benchmark Labels' || labelStudy?.total_labels !== 500) errors.push('label name/count');
  if (labelStudy?.showing !== 50 || labelStudy?.labels?.[0]?.text !== 'Label 450' || labelStudy?.labels?.at(-1)?.text !== 'Label 499') errors.push('label tail');
  if (boxStudy?.name !== 'Benchmark Boxes' || boxStudy?.total_boxes !== 500) errors.push('box name/count');
  if (tableStudy?.name !== 'Benchmark Tables' || tableStudy?.tables?.length !== 4) errors.push('table name/count');
  if (tableStudy?.tables?.[0]?.rows?.[0] !== 'T0R0C0 | T0R0C1 | T0R0C2 | T0R0C3 | T0R0C4') errors.push('table rows');
  if (phase === 'before') {
    if (!(lineStudy?.horizontal_levels?.length < 500)) errors.push('before line collision missing');
    if (!(boxStudy?.zones?.length < 500)) errors.push('before box collision missing');
  } else {
    if (lineStudy?.horizontal_levels?.length !== 500) errors.push('after line precision');
    if (boxStudy?.zones?.length !== 500) errors.push('after box precision');
  }
  return errors;
}

const iterations = Number(argument('iterations', '30'));
const phase = argument('phase', 'before');
if (!Number.isInteger(iterations) || iterations < 30) throw new Error('--iterations must be an integer >= 30');
if (!['before', 'after'].includes(phase)) throw new Error('--phase must be before or after');
if (typeof global.gc !== 'function') throw new Error('Run with --expose-gc to measure heap peak');

const page = pageContext();
let recording = false;
let iterationBytes = 0;
let iterationHeapPeak = 0;
let transferredRaw = false;
const evaluateFixture = async expression => {
  const value = vm.runInContext(expression, page);
  const serialized = JSON.stringify(value);
  const transferred = JSON.parse(serialized);
  if (recording) {
    iterationBytes += Buffer.byteLength(serialized);
    iterationHeapPeak = Math.max(iterationHeapPeak, process.memoryUsage().heapUsed);
    transferredRaw ||= serialized.includes('internal-only-field-') || serialized.includes('"raw"');
  }
  return transferred;
};
const data = await loadDataModule(evaluateFixture);

async function operation() {
  return {
    lines: await data.getPineLines(),
    labels: await data.getPineLabels({ max_labels: 50 }),
    boxes: await data.getPineBoxes(),
    tables: await data.getPineTables(),
  };
}

for (let index = 0; index < 3; index += 1) await operation();

const latencyMs = [];
const bytes = [];
const heapPeakBytes = [];
let reference = null;
let responseMismatches = 0;
let contractErrors = [];
for (let index = 0; index < iterations; index += 1) {
  global.gc();
  const heapStart = process.memoryUsage().heapUsed;
  iterationBytes = 0;
  iterationHeapPeak = heapStart;
  recording = true;
  const started = process.hrtime.bigint();
  const response = await operation();
  latencyMs.push(Number(process.hrtime.bigint() - started) / 1e6);
  recording = false;
  bytes.push(iterationBytes);
  heapPeakBytes.push(Math.max(0, iterationHeapPeak - heapStart));
  if (reference === null) {
    reference = response;
    contractErrors = validateResponse(response, phase);
  } else if (!isDeepStrictEqual(response, reference)) {
    responseMismatches += 1;
  }
}

const output = {
  phase,
  iterations,
  fixture: { lines: 500, labels: 500, boxes: 500, table_cells: 200 },
  cdp_equivalent_bytes_per_iteration: {
    p50: percentile(bytes, 0.5),
    p95: percentile(bytes, 0.95),
  },
  latency_ms: {
    p50: percentile(latencyMs, 0.5),
    p95: percentile(latencyMs, 0.95),
  },
  heap_peak_bytes: Math.max(...heapPeakBytes),
  raw_internal_fields_transferred: transferredRaw,
  response_mismatches: responseMismatches,
  contract_errors: contractErrors,
  observed: {
    horizontal_levels: reference.lines.studies[0].horizontal_levels.length,
    labels_showing: reference.labels.studies[0].showing,
    zones: reference.boxes.studies[0].zones.length,
    tables: reference.tables.studies[0].tables.length,
  },
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
