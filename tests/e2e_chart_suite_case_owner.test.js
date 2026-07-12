import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHART_SUITE_CASE_IDS,
  createChartSuiteCaseOwner,
  runChartSuiteGroup,
} from '../src/e2e/cases/chart_suite.js';
import { CHART_OPERATION_REGISTRY } from '../src/e2e/chart_operation_registry.js';
import { GATE_B_IPC_CASE_REGISTRY } from '../src/e2e/gate_b_loopback_ipc.js';

const GROUPS = Object.freeze([
  'health', 'chart', 'data', 'pine', 'drawing', 'ui', 'replay',
  'alerts', 'watchlist', 'indicators', 'batch', 'capture', 'context_size',
]);
const APPROVED = Object.freeze({
  targetId: 'approved-target', frameId: 'approved-frame', loaderId: 'approved-loader',
  uniqueContextId: 'approved-context', sessionId: 'approved-session',
});

function reviewed(overrides = {}) {
  return Object.freeze({
    inspectIdentity: async () => ({ ...APPROVED }),
    read: async () => true,
    mutate: async () => true,
    input: async () => ({}),
    capture: async () => ({ data: 'a'.repeat(2000) }),
    network: async () => ({ ok: true, status: 200, body: { result: {} } }),
    ...overrides,
  });
}

test('chart suite fixes one case ID per original hierarchical group in original order', () => {
  assert.deepEqual(CHART_SUITE_CASE_IDS, GROUPS.map(group => `chart_suite_${group}_1`));
  for (const caseId of CHART_SUITE_CASE_IDS) assert.ok(Object.hasOwn(GATE_B_IPC_CASE_REGISTRY, caseId));
});

test('chart suite owner dispatches every fixed group in order and exposes only fixed results', async () => {
  const events = [];
  const owner = createChartSuiteCaseOwner({
    approvedContext: APPROVED,
    reviewedAdapters: reviewed(),
    deadlineMs: 100,
    executeGroupImpl: async caseId => { events.push(caseId); },
  });

  for (const group of GROUPS) {
    assert.deepEqual(await owner.run(`chart_suite_${group}_1`), { status: 'success', code: 'CASE_OK' });
  }
  assert.deepEqual(events, CHART_SUITE_CASE_IDS);
});

test('registered group always runs group and root restore hooks after assertion failure', async () => {
  const events = [];
  const root = {
    before: [async () => events.push('root-before')],
    after: [async () => events.push('root-after')],
  };
  const group = {
    before: [async () => events.push('group-before')],
    after: [async () => events.push('group-after')],
    tests: [
      { callback: async () => events.push('assertion-1') },
      { callback: async () => { events.push('assertion-2'); throw new Error('SECRET'); } },
      { callback: async () => events.push('assertion-3') },
    ],
  };
  const state = Object.freeze({ fixed: true });
  await assert.rejects(runChartSuiteGroup(root, group, {
    captureStateImpl: async () => { events.push('capture'); return state; },
    restoreStateImpl: async captured => { assert.equal(captured, state); events.push('restore'); },
  }), /SECRET/);
  assert.deepEqual(events, [
    'root-before', 'capture', 'group-before', 'assertion-1', 'assertion-2',
    'group-after', 'restore', 'root-after',
  ]);
});

test('chart suite owner maps secret-bearing execution failures to fixed results', async () => {
  const owner = createChartSuiteCaseOwner({
    approvedContext: APPROVED,
    reviewedAdapters: reviewed(),
    deadlineMs: 100,
    executeGroupImpl: async () => { throw new Error('SECRET assertion detail'); },
  });
  const result = await owner.run('chart_suite_chart_1');
  assert.deepEqual(result, { status: 'failure', code: 'CASE_FAILED' });
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.deepEqual(await owner.run('attacker-controlled'), { status: 'failure', code: 'CASE_FAILED' });
});

test('owner requires exact approved identity and reviewed capabilities with no raw transport injection', async () => {
  const valid = { approvedContext: APPROVED, reviewedAdapters: reviewed(), deadlineMs: 100, executeGroupImpl: async () => {} };
  for (const invalid of [
    {},
    { ...valid, rawTransport: {} },
    { ...valid, approvedContext: { ...APPROVED, extra: true } },
    { ...valid, reviewedAdapters: { ...reviewed(), rawTransport: {} } },
    { ...valid, reviewedAdapters: { ...reviewed(), mutate: undefined } },
  ]) {
    assert.deepEqual(await createChartSuiteCaseOwner(invalid).run('chart_suite_health_1'), { status: 'failure', code: 'CASE_FAILED' });
  }
});

test('owner binds to the approved target among two targets and fails closed on pre/post drift without leaks', async () => {
  const seen = [];
  let identityReads = 0;
  const owner = createChartSuiteCaseOwner({
    approvedContext: APPROVED,
    reviewedAdapters: reviewed({
      inspectIdentity: async () => {
        identityReads += 1;
        return identityReads === 1 ? { ...APPROVED } : { ...APPROVED, targetId: 'other-target' };
      },
    }),
    deadlineMs: 100,
    executeGroupImpl: async (_caseId, capability) => {
      seen.push(capability.approvedContext.targetId);
      await capability.execute('chart.op.004', {});
    },
  });
  const result = await owner.run('chart_suite_health_1');
  assert.deepEqual(result, { status: 'failure', code: 'CASE_FAILED' });
  assert.deepEqual(seen, ['approved-target']);
  assert.equal(JSON.stringify(result).includes('other-target'), false);
});

test('owner rejects pre-action context drift before the reviewed action', async () => {
  let reads = 0;
  const owner = createChartSuiteCaseOwner({
    approvedContext: APPROVED,
    reviewedAdapters: reviewed({
      inspectIdentity: async () => ({ ...APPROVED, sessionId: 'unapproved-session' }),
      read: async () => { reads += 1; return true; },
    }),
    deadlineMs: 100,
    executeGroupImpl: async (_caseId, capability) => capability.execute('chart.op.004', {}),
  });
  assert.deepEqual(await owner.run('chart_suite_health_1'), { status: 'failure', code: 'CASE_FAILED' });
  assert.equal(reads, 0);
});

test('owner bounds a non-settling reviewed action and leaks no adapter error detail', async () => {
  const owner = createChartSuiteCaseOwner({
    approvedContext: APPROVED,
    reviewedAdapters: reviewed({ read: async () => new Promise(() => {}) }),
    deadlineMs: 5,
    executeGroupImpl: async (_caseId, capability) => capability.execute('chart.op.004', {}),
  });
  const result = await owner.run('chart_suite_health_1');
  assert.deepEqual(result, { status: 'failure', code: 'CASE_FAILED' });
  assert.equal(JSON.stringify(result).includes('chart.op.004'), false);
});

test('owner retains the complete assertion and lifecycle contract from the former child', async () => {
  const source = await readFile(new URL('../src/e2e/cases/chart_suite.js', import.meta.url), 'utf8');
  const registry = await readFile(new URL('../src/e2e/chart_operation_registry.js', import.meta.url), 'utf8');
  assert.equal((source.match(/\bit\s*\(/g) || []).length, 80);
  assert.equal((source.match(/assert\.(?:ok|equal|deepEqual|notEqual|match)\s*\(/g) || []).length, 125);
  assert.match(source, /before\(async \(\) =>/);
  assert.match(source, /after\(async \(\) =>/);
  assert.match(source, /chart\.op\.139/);
  assert.match(registry, /setSymbol\(p0, \{\}\)/);
  assert.match(registry, /stopReplay\(\)/);
  assert.match(registry, /removeEntity/);
  assert.doesNotMatch(source, /chrome-remote-interface|\bfetch\s*\(|Runtime\.evaluate|\bCDP\.List|\bInput\.|\bPage\./);
  assert.doesNotMatch(source, /activeCapability\.(?:read|mutate)\s*\(/);
  const operationArguments = [...source.matchAll(/\bexecuteOperation\s*\(([^,\n]+)/g)].map(match => match[1].trim());
  assert.equal(operationArguments.shift(), 'operationId');
  assert.ok(operationArguments.every(argument => /^['"]chart\./.test(argument)));
});

test('full E2E child dispatches only fixed case IDs with zero direct external-action surfaces', async () => {
  const source = await readFile(new URL('e2e.test.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chrome-remote-interface|Runtime\.evaluate|Input\.dispatch|Page\.capture|\bevaluate\s*\(|\bfetch\s*\(|node:child_process/);
  assert.doesNotMatch(source, /expression\s*:|target(?:Id|_id)\s*:|input\s*:|method\s*:|https?:\/\//);
  const dispatched = [...source.matchAll(/\.dispatch\(['"]([a-z0-9_]+)['"]\)/g)].map(match => match[1]);
  assert.deepEqual(dispatched, CHART_SUITE_CASE_IDS);
});

test('production owner runs every former suite group through fixed registry operations and a fake reviewed transport', async () => {
  const declarationToId = new Map();
  for (const [id, entry] of Object.entries(CHART_OPERATION_REGISTRY)) {
    if (entry.params.functionDeclaration && !declarationToId.has(entry.params.functionDeclaration)) {
      declarationToId.set(entry.params.functionDeclaration, id);
    }
  }
  const ledger = { read: 0, mutation: 0, input: 0, capture: 0, network: 0, identity: 0 };
  const operations = [];
  let pineSource = '//@version=6\nindicator("Initial")';
  let chartSymbol = 'NASDAQ:AAPL';
  let chartResolution = '1D';
  let chartType = 1;
  let studies = [];
  let shapes = [];
  let studySequence = 0;
  const png = Buffer.alloc(1_500, 1).toString('base64');

  function fixture(id, declaration, params) {
    if (declaration.includes('.setSymbol(')) chartSymbol = params.arguments[0]?.value || 'NASDAQ:AAPL';
    if (declaration.includes('.setResolution(')) chartResolution = params.arguments[0]?.value || '1D';
    if (declaration.includes('.setChartType(')) chartType = params.arguments[0]?.value ?? 2;
    if (declaration.includes('.symbol());}')) return chartSymbol;
    if (declaration.includes('.resolution());}')) return chartResolution;
    if (declaration.includes('.chartType());}')) return chartType;
    if (declaration.includes('.setValue(p0)')) pineSource = params.arguments[0].value;
    if (declaration.includes('.createStudy(')) studies.push(`study-${++studySequence}`);
    if (declaration.includes('.removeEntity(p0)')) studies = studies.filter(item => item !== params.arguments[0].value);
    if (declaration.includes('.createShape(')) shapes.push({ id: `shape-${shapes.length + 1}`, name: 'horizontal_line' });
    if (declaration.includes('.removeEntity(p0)')) shapes = shapes.filter(item => item.id !== params.arguments[0].value);
    if (declaration.includes('.removeAllShapes(')) shapes = [];
    if (declaration.includes('.getAllShapes(')) return [...shapes];
    if (declaration.includes('.getShapeById(')) return { properties: {} };
    if (id !== 'chart.op.010' && declaration.includes('getAllStudies().map')) return [...studies];
    if (id !== 'chart.op.010' && declaration.includes('getAllStudies()')) return [];
    const values = {
      'chart.op.001': true,
      'chart.op.002': { apiAvailable: true, symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1 },
      'chart.op.003': { bottom_panel: { height: 100 }, right_panel: { width: 100 }, button_count: 2 },
      'chart.op.004': 'NASDAQ:AAPL', 'chart.op.005': '1D', 'chart.op.006': 1,
      'chart.op.010': { symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1, studies: [] },
      'chart.op.026': { from: 1, to: 2 }, 'chart.op.031': { symbol: 'AAPL', exchange: 'NASDAQ' },
      'chart.op.033': [],
      'chart.op.034': { bars: [{ time: 1, open: 1, high: 2, low: 1, close: 2, volume: 1 }], total_bars: 1 },
      'chart.op.035': { bar_count: 1, open: 1, close: 2, high: 2, low: 1 },
      'chart.op.036': [], 'chart.op.039': [], 'chart.op.040': [],
      'chart.op.041': { path_accessible: true }, 'chart.op.042': [],
      'chart.op.043': { symbol: 'NASDAQ:AAPL', close: 2 },
      'chart.op.044': { panel_found: false }, 'chart.op.046': { panel_found: false },
      'chart.op.049': false, 'chart.op.052': false,
      'chart.op.054': true, 'chart.op.059': pineSource, 'chart.op.061': pineSource,
      'chart.op.062': [], 'chart.op.063': 0, 'chart.op.064': [], 'chart.op.065': 0,
      'chart.op.066': true, 'chart.op.067': true, 'chart.op.068': 0,
      'chart.op.070': { time: 1, price: 2 },
      'chart.op.071': { entity_id: 'shape-1' }, 'chart.op.072': [],
      'chart.op.078': { time: 1, price: 2 }, 'chart.op.081': [],
      'chart.op.082': { found: false }, 'chart.op.084': true, 'chart.op.086': false,
      'chart.op.087': { x: 1, y: 1 }, 'chart.op.088': { x: 1, y: 1 },
      'chart.op.089': { x: 1, y: 1 }, 'chart.op.090': ['button'], 'chart.op.091': 2,
      'chart.op.092': false, 'chart.op.093': false,
      'chart.op.094': false,
      'chart.op.113': { is_replay_available: false, is_replay_started: false },
      'chart.op.119': false, 'chart.op.120': [], 'chart.op.121': false,
      'chart.op.123': [], 'chart.op.124': null,
      'chart.op.129': 'NASDAQ:AAPL', 'chart.op.130': true, 'chart.op.131': true,
      'chart.op.132': null,
      'chart.op.133': { symbol: 'NASDAQ:AAPL', close: 2 },
      'chart.op.134': [], 'chart.op.135': [], 'chart.op.136': [],
      'chart.op.137': { bar_count: 1, open: 1, close: 2, high: 2, low: 1 },
      'chart.op.138': {
        symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1,
        replayStarted: false, pineOpen: true, pineSource,
      },
    };
    if (Object.hasOwn(values, id)) return values[id];
    const entry = CHART_OPERATION_REGISTRY[id];
    return entry?.kind === 'mutation' ? true : null;
  }

  const reviewedAdapters = Object.freeze({
    inspectIdentity: async () => { ledger.identity += 1; return { ...APPROVED }; },
    read: async (method, params) => {
      ledger.read += 1;
      assert.equal(method, 'Runtime.callFunctionOn');
      const id = declarationToId.get(params.functionDeclaration);
      operations.push(id);
      return fixture(id, params.functionDeclaration, params);
    },
    mutate: async (method, params) => {
      ledger.mutation += 1;
      assert.equal(method, 'Runtime.callFunctionOn');
      const id = declarationToId.get(params.functionDeclaration);
      operations.push(id);
      return fixture(id, params.functionDeclaration, params);
    },
    input: async () => { ledger.input += 1; return {}; },
    capture: async () => { ledger.capture += 1; return { data: png }; },
    network: async () => { ledger.network += 1; return { ok: true, status: 200, body: { result: {} } }; },
  });
  const owner = createChartSuiteCaseOwner({ approvedContext: APPROVED, reviewedAdapters, deadlineMs: 5_000 });
  const results = [];
  for (const caseId of CHART_SUITE_CASE_IDS) {
    const result = await owner.run(caseId);
    results.push(result);
    assert.deepEqual(result, { status: 'success', code: 'CASE_OK' }, `${caseId}: ${operations.slice(-12).join(',')}`);
  }
  assert.ok(ledger.read > 0 && ledger.mutation > 0 && ledger.input > 0 && ledger.capture > 0 && ledger.network > 0);
  assert.ok(ledger.identity >= 2 * (ledger.read + ledger.mutation + ledger.input + ledger.capture + ledger.network));
  assert.equal(JSON.stringify(results).includes('SECRET'), false);
});
