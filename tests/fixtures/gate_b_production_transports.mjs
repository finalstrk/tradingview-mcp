import { CHART_OPERATION_REGISTRY } from '../../src/e2e/chart_operation_registry.js';
import { createHash } from 'node:crypto';

const canonical = value => value && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  : JSON.stringify(value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const BASELINE_REPOSITORY_COMMIT = '28e257eeba9c103278612a0672d67d35a597ca7e';
export const BASELINE_MODULE_PATH = 'src/e2e/benchmark/baseline_workload.js';
export const CANDIDATE_MODULE_PATH = 'src/e2e/benchmark/candidate_workload.js';
export const BASELINE_ARTIFACT_SHA256 = '0abf60cbef8a5977632abdfb7c7e8c7b0785475514eeda3d498f82d27620fb09';
export const CANDIDATE_ARTIFACT_SHA256 = '17266bbcfb301398330b4fa7fd06a76d2a65eb59aeb556bd3d0b63e26e5e35f7';
export const BASELINE_EXECUTOR_REPOSITORY_COMMIT = 'c8ba1d90c6bbc8cab4f5811aed45f1f839044c71';
export const BASELINE_EXECUTOR_MODULE_PATH = 'src/e2e/benchmark/baseline_executor.js';
export const BASELINE_EXECUTOR_ARTIFACT_SHA256 = '74e156c04b9a55f1cf13fa1ca50baf27666a85f88113cf1c3d960b5c11a5a3ef';
export const CANDIDATE_EXECUTOR_MODULE_PATH = 'src/e2e/benchmark/candidate_executor.js';
export const CANDIDATE_EXECUTOR_ARTIFACT_SHA256 = '6891a902f3cf911af2d19ddd67c6534ed54a940c91a68cc212da2349b052d5ec';
export const BENCHMARK_WORKLOAD_SHA256 = digest({ version: 1, operation: 'document-ready-state-length', pairing: 'interleaved', samples: 30 });
export const PRODUCTION_PROTOCOL_INVENTORY = Object.freeze({
  logical_operation_count: 11, cdp_session_attach_count: 978, cdp_session_detach_count: 978,
  cdp_protocol_read_count: 7832, cdp_protocol_mutation_count: 122, cdp_protocol_input_count: 12,
  network_request_count: 6, child_process_count: 8, capture_count: 3,
});

const declarations = new Map();
for (const [id, entry] of Object.entries(CHART_OPERATION_REGISTRY)) {
  if (entry.params.functionDeclaration && !declarations.has(entry.params.functionDeclaration)) {
    declarations.set(entry.params.functionDeclaration, id);
  }
}
const local = input => Object.freeze({ ...input.target, sessionId: 'fixture-owner-local-session' });
const emptyGraphics = () => ({ success: true, study_count: 0, studies: [] });
let chartSymbol = 'NASDAQ:AAPL';
let chartResolution = '1D';
let chartType = 1;
let pineSource = '//@version=6\nindicator("Initial")';
let studies = [];
let shapes = [];
let sequence = 0;
const png = Buffer.alloc(1_500, 1).toString('base64');

function chartValue(method, params) {
  if (method !== 'Runtime.callFunctionOn') return {};
  const declaration = params.functionDeclaration;
  const id = declarations.get(declaration);
  if (declaration.includes('.setSymbol(')) chartSymbol = params.arguments[0]?.value || chartSymbol;
  if (declaration.includes('.setResolution(')) chartResolution = params.arguments[0]?.value || chartResolution;
  if (declaration.includes('.setChartType(')) chartType = params.arguments[0]?.value ?? 2;
  if (declaration.includes('.symbol());}')) return chartSymbol;
  if (declaration.includes('.resolution());}')) return chartResolution;
  if (declaration.includes('.chartType());}')) return chartType;
  if (declaration.includes('.setValue(p0)')) pineSource = params.arguments[0].value;
  if (declaration.includes('.createStudy(')) studies.push(`study-${++sequence}`);
  if (declaration.includes('.removeEntity(p0)')) {
    const removed = params.arguments[0]?.value;
    studies = studies.filter(value => value !== removed);
    shapes = shapes.filter(value => value.id !== removed);
  }
  if (declaration.includes('.createShape(')) shapes.push({ id: `shape-${++sequence}`, name: 'horizontal_line' });
  if (declaration.includes('.removeAllShapes(')) shapes = [];
  if (declaration.includes('.getAllShapes(')) return [...shapes];
  if (declaration.includes('.getShapeById(')) return { properties: {} };
  if (id !== 'chart.op.010' && declaration.includes('getAllStudies().map')) return [...studies];
  if (id !== 'chart.op.010' && declaration.includes('getAllStudies()')) return [];
  const values = {
    'chart.op.001': true, 'chart.op.002': { apiAvailable: true, symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1 },
    'chart.op.003': { bottom_panel: { height: 100 }, right_panel: { width: 100 }, button_count: 2 },
    'chart.op.004': 'NASDAQ:AAPL', 'chart.op.005': '1D', 'chart.op.006': 1,
    'chart.op.010': { symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1, studies: [] },
    'chart.op.026': { from: 1, to: 2 }, 'chart.op.031': { symbol: 'AAPL', exchange: 'NASDAQ' },
    'chart.op.033': [], 'chart.op.034': { bars: [{ time: 1, open: 1, high: 2, low: 1, close: 2, volume: 1 }], total_bars: 1 },
    'chart.op.035': { bar_count: 1, open: 1, close: 2, high: 2, low: 1 }, 'chart.op.036': [], 'chart.op.039': [], 'chart.op.040': [],
    'chart.op.041': { path_accessible: true }, 'chart.op.042': [], 'chart.op.043': { symbol: 'NASDAQ:AAPL', close: 2 },
    'chart.op.044': { panel_found: false }, 'chart.op.046': { panel_found: false }, 'chart.op.049': false, 'chart.op.052': false,
    'chart.op.054': true, 'chart.op.059': pineSource, 'chart.op.061': pineSource, 'chart.op.062': [], 'chart.op.063': 0,
    'chart.op.064': [], 'chart.op.065': 0, 'chart.op.066': true, 'chart.op.067': true, 'chart.op.068': 0,
    'chart.op.070': { time: 1, price: 2 }, 'chart.op.071': { entity_id: 'shape-1' }, 'chart.op.072': [],
    'chart.op.078': { time: 1, price: 2 }, 'chart.op.081': [], 'chart.op.082': { found: false }, 'chart.op.084': true,
    'chart.op.086': false, 'chart.op.087': { x: 1, y: 1 }, 'chart.op.088': { x: 1, y: 1 }, 'chart.op.089': { x: 1, y: 1 },
    'chart.op.090': ['button'], 'chart.op.091': 2, 'chart.op.092': false, 'chart.op.093': false, 'chart.op.094': false,
    'chart.op.113': { is_replay_available: false, is_replay_started: false }, 'chart.op.119': false, 'chart.op.120': [],
    'chart.op.121': false, 'chart.op.123': [], 'chart.op.124': null, 'chart.op.129': 'NASDAQ:AAPL', 'chart.op.130': true,
    'chart.op.131': true, 'chart.op.132': null, 'chart.op.133': { symbol: 'NASDAQ:AAPL', close: 2 }, 'chart.op.134': [],
    'chart.op.135': [], 'chart.op.136': [], 'chart.op.137': { bar_count: 1, open: 1, close: 2, high: 2, low: 1 },
    'chart.op.138': { symbol: 'NASDAQ:AAPL', resolution: '1D', chartType: 1, replayStarted: false, pineOpen: true, pineSource },
  };
  if (Object.hasOwn(values, id)) return values[id];
  return CHART_OPERATION_REGISTRY[id]?.kind === 'mutation' ? true : null;
}

function ownerResult(id) {
  const initial = { api_available: true, symbol: 'FX:USDJPY', timeframe: '15', bar_count: 100 };
  const rows = ['FX:USDJPY', 'FX:EURUSD'].flatMap(symbol => ['5', '15'].map(timeframe => ({
    requested: { symbol, timeframe }, observed: { symbol, timeframe, bar_count: 10 }, oracle_verified: true,
  })));
  if (id === 'owner.batch.1') return { initial, restored: { ...initial }, before_chart_ids: ['fixed'], after_chart_ids: ['fixed'], target_preserved: true,
    result: { success: true, failed: 0, results: rows, restoration: { required: true, attempted: true, success: true, requested: { symbol: initial.symbol, timeframe: initial.timeframe } } } };
  if (id.startsWith('owner.quote.')) return { iterations: 20, mismatches: 0, chart_mutations: 0, disconnects: 1, price_fields_leaked: 0 };
  if (id === 'owner.pine_facade.1') return { accepted: true };
  if (id === 'owner.pine_facade.2') return { error_count: 1, unknown_function_reported: true };
  if (id === 'owner.pine_facade.3') return { status: 400 };
  if (id === 'owner.pine_facade.4') return { exit_code: 0, success: true, compiled: true };
  if (id === 'owner.pine_facade.5') return { exit_code: 0, compiled: false, error_count: 1 };
  const common = { target_preserved: true, chart_state_preserved: true, disconnects: 1 };
  if (id === 'owner.graphics.ohlcv.1') return { ...common, summary_matches_live: true, summary: { open: 100, close: 115, high: 120, low: 90, range: 30, change: 15, change_pct: '15%' } };
  if (id === 'owner.graphics.primitives.1') return { ...common, lines: emptyGraphics(), verbose_lines: emptyGraphics(), labels: emptyGraphics(), verbose_labels: emptyGraphics(), boxes: emptyGraphics(), verbose_boxes: emptyGraphics(), tables: emptyGraphics() };
  const endpoint = { Browser: 'TradingView', webSocketDebuggerUrl: 'ws://fixed' };
  return { success: true, cdp_ready: true, reused: true, old_process_killed: false, browser: endpoint.Browser, web_socket_debugger_url: endpoint.webSocketDebuggerUrl, before: { ...endpoint }, after: { ...endpoint } };
}

const transport = (input, methods) => Object.freeze({ identity: async () => local(input), ...methods });
export const FIXED_PRODUCTION_TRANSPORT_CONSTRUCTORS = Object.freeze({
  createChartTransport: input => transport(input, { execute: async (kind, method, params) => kind === 'network'
    ? { ok: true, status: 200, body: { result: {} } }
    : method === 'captureScreenshot' ? { data: png } : chartValue(method, params) }),
  createOwnerTransport: input => transport(input, { execute: async id => ownerResult(id) }),
  createGuardTransport: input => transport(input, { execute: async (name, args) => name === 'inspectReplay' ? { active: false } : name === 'inspectPineSignals' ? { proven: true } : name.startsWith('count') ? 0 : name === 'inventoriesEqual' ? JSON.stringify(args[0]) === JSON.stringify(args[1]) : name === 'captureInventory' ? { stable: true } : true }),
  createBenchmarkTransport: input => transport(input, {
    executeSample: async ({ phase }) => phase === 'before' ? 10 : 9,
    restore: async (_target, _provenance, control) => {
      const current = control.snapshot();
      for (const [counter, ceiling] of Object.entries(PRODUCTION_PROTOCOL_INVENTORY)) {
        const reserved = counter === 'capture_count' ? 1 : 0;
        const remaining = ceiling - reserved - (current[counter] || 0);
        if (remaining > 0) control.authorize(counter, remaining);
      }
      return true;
    },
  }),
  createArtifactTransport: input => transport(input, { write: async (_value, _provenance, control) => {
    const current = control.snapshot();
    for (const [counter, ceiling] of Object.entries(PRODUCTION_PROTOCOL_INVENTORY)) {
      const remaining = ceiling - (current[counter] || 0);
      if (remaining > 0) control.authorize(counter, remaining);
    }
    return { artifactId: 'fixture-artifact' };
  } }),
  createMeasurementTransport: input => transport(input, {
    measureStaticBindings: async () => ({
    repository_head: 'a'.repeat(40), working_tree_diff_sha256: 'b'.repeat(64), test_manifest_sha256: 'c'.repeat(64),
    }),
    measureLiveBindings: async () => ({
    target_policy: input.transportContext.targetPolicy, target_context: input.transportContext.targetContext, build_sha256: '8'.repeat(64),
    }),
  }),
});
