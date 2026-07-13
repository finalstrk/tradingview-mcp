import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readlink, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';

void types;

const actualReadFile = readFile;
const APPROVAL_FILE_ENV = 'PINE_DISCOVERY_APPROVAL_FILE';
const APPROVAL_MAX_TTL_MS = 5 * 60 * 1000;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPENT_STATE_COMPONENTS = Object.freeze(['tradingview-mcp-gate-a1', 'spent']);

export const PROBE_TARGET = Object.freeze({
  id: '119DB9629A03197CFB120366EA6729CC',
  symbol: 'FX:USDJPY',
  resolution: '15',
  chart_type: 1,
  study_count: 12,
  shape_count: 0,
  replay_started: false,
  bottom_widget_open: false,
  pine_editor_open: false,
});

export const PROBE_BUDGET = Object.freeze({
  open: 1,
  probe: 1,
  close: 1,
  retry: 0,
  fallback: 0,
});

export const PROBE_CANDIDATE_PATHS = Object.freeze([
  Object.freeze(['model_uri', 'monaco_model', 'uri']),
  Object.freeze(['source_readability', 'monaco_model', 'getValue']),
  Object.freeze(['model_version', 'monaco_model', 'getVersionId']),
  Object.freeze(['model_alternative_version', 'monaco_model', 'getAlternativeVersionId']),
  Object.freeze(['script_id', 'react_value', 'scriptId']),
  Object.freeze(['script_id', 'react_value', '_scriptId']),
  Object.freeze(['dirty', 'react_value', 'dirty']),
  Object.freeze(['dirty', 'react_value', '_dirty']),
  Object.freeze(['persistence_mode', 'react_value', 'persistenceMode']),
  Object.freeze(['persistence_mode', 'react_value', 'autoSave']),
  Object.freeze(['cloud_version', 'react_value', 'cloudVersion']),
]);

export const PROBE_CANDIDATE_VALUE_TYPES = Object.freeze([
  Object.freeze(['object']),
  Object.freeze(['string']),
  Object.freeze(['number']),
  Object.freeze(['number']),
  Object.freeze(['string']),
  Object.freeze(['string']),
  Object.freeze(['boolean']),
  Object.freeze(['boolean']),
  Object.freeze(['string']),
  Object.freeze(['boolean']),
  Object.freeze(['string', 'number']),
]);

export const PROBE_CANDIDATE_ERROR_CODES = Object.freeze({
  NONE: 'NONE',
  MEMBER_MISSING: 'MEMBER_MISSING',
  ACCESSOR_SKIPPED: 'ACCESSOR_SKIPPED',
  READ_FAILED: 'READ_FAILED',
  VALUE_UNAVAILABLE: 'VALUE_UNAVAILABLE',
  UNSTABLE: 'UNSTABLE',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
});

export const PROBE_ERROR_CODES = Object.freeze({
  ARGUMENT: 'PINE_DISCOVERY_ARGUMENT',
  MODULE: 'PINE_DISCOVERY_MODULE',
  TARGET_REJECTED: 'PINE_DISCOVERY_TARGET_REJECTED',
  CONNECT: 'PINE_DISCOVERY_CONNECT',
  CONTEXT_CHANGED: 'PINE_DISCOVERY_CONTEXT_CHANGED',
  PREFLIGHT: 'PINE_DISCOVERY_PREFLIGHT',
  CLOSE_CAPABILITY: 'PINE_DISCOVERY_CLOSE_CAPABILITY',
  OPEN: 'PINE_DISCOVERY_OPEN',
  OPEN_ACTION_REJECTED: 'PINE_DISCOVERY_OPEN_ACTION_REJECTED',
  OPEN_NON_BOOLEAN: 'PINE_DISCOVERY_OPEN_NON_BOOLEAN',
  OPEN_VISIBILITY_UNPROVEN: 'PINE_DISCOVERY_OPEN_VISIBILITY_UNPROVEN',
  OPEN_PROTOCOL: 'PINE_DISCOVERY_OPEN_PROTOCOL',
  OPEN_PAGE: 'PINE_DISCOVERY_OPEN_PAGE',
  OPEN_DEADLINE: 'PINE_DISCOVERY_OPEN_DEADLINE',
  PROTOCOL: 'PINE_DISCOVERY_PROTOCOL',
  PAGE: 'PINE_DISCOVERY_PAGE',
  INVALID: 'PINE_DISCOVERY_RESULT_INVALID',
  CLOSE: 'PINE_DISCOVERY_CLOSE',
  POSTFLIGHT: 'PINE_DISCOVERY_POSTFLIGHT',
  DETACH: 'PINE_DISCOVERY_DETACH',
  DEADLINE: 'PINE_DISCOVERY_DEADLINE',
  HARD_DEADLINE: 'PINE_DISCOVERY_HARD_DEADLINE',
  INTERNAL: 'PINE_DISCOVERY_INTERNAL',
  DIGEST: 'PINE_DISCOVERY_DIGEST',
  APPROVAL: 'PINE_DISCOVERY_APPROVAL',
});

function pineSignalDiscoveryMainWorld() {
  const paths = [
    ['model_uri', 'monaco_model', 'uri'],
    ['source_readability', 'monaco_model', 'getValue'],
    ['model_version', 'monaco_model', 'getVersionId'],
    ['model_alternative_version', 'monaco_model', 'getAlternativeVersionId'],
    ['script_id', 'react_value', 'scriptId'],
    ['script_id', 'react_value', '_scriptId'],
    ['dirty', 'react_value', 'dirty'],
    ['dirty', 'react_value', '_dirty'],
    ['persistence_mode', 'react_value', 'persistenceMode'],
    ['persistence_mode', 'react_value', 'autoSave'],
    ['cloud_version', 'react_value', 'cloudVersion'],
  ];
  const valueTypes = [
    ['object'],
    ['string'],
    ['number'],
    ['number'],
    ['string'],
    ['string'],
    ['boolean'],
    ['boolean'],
    ['string'],
    ['boolean'],
    ['string', 'number'],
  ];
  const callableModelMembers = {
    getValue: true,
    getVersionId: true,
    getAlternativeVersionId: true,
  };

  function fixedCandidate(index, state) {
    return {
      signal: paths[index][0],
      owner: paths[index][1],
      member: paths[index][2],
      available: state.available,
      value_type: state.value_type,
      stable: state.stable,
      read_count: state.read_count,
      error_code: state.error_code,
    };
  }

  function uniformCandidates(errorCode) {
    const missing = errorCode === 'MEMBER_MISSING';
    const candidates = [];
    for (let index = 0; index < paths.length; index += 1) {
      candidates.push(fixedCandidate(index, {
        available: false,
        value_type: missing ? 'missing' : 'unavailable',
        stable: false,
        read_count: 0,
        error_code: errorCode,
      }));
    }
    return candidates;
  }

  function findDataDescriptor(owner, member) {
    if ((typeof owner !== 'object' && typeof owner !== 'function') || owner === null) {
      return { kind: 'missing' };
    }
    let current = owner;
    for (let depth = 0; current !== null && depth < 6; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, member);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          return { kind: 'accessor' };
        }
        return { kind: 'data', value: descriptor.value };
      }
      current = Object.getPrototypeOf(current);
    }
    return { kind: 'missing' };
  }

  function invokeReviewed(owner, member) {
    const descriptor = findDataDescriptor(owner, member);
    if (descriptor.kind !== 'data' || typeof descriptor.value !== 'function') {
      throw new Error('reviewed-call-unavailable');
    }
    return descriptor.value.call(owner);
  }

  function scoreReactValue(value) {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return 0;
    const members = ['scriptId', '_scriptId', 'dirty', '_dirty', 'persistenceMode', 'autoSave', 'cloudVersion'];
    let score = 0;
    for (let index = 0; index < members.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, members[index]);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) score += 1;
    }
    return score;
  }

  function bestReactValue(container, currentBest) {
    let best = currentBest;
    let bestScore = scoreReactValue(best);
    if ((typeof container !== 'object' && typeof container !== 'function') || container === null) {
      return best;
    }
    const directScore = scoreReactValue(container);
    if (directScore > bestScore) {
      best = container;
      bestScore = directScore;
    }
    const names = Object.getOwnPropertyNames(container);
    for (let index = 0; index < names.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(container, names[index]);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
      const child = descriptor.value;
      const childScore = scoreReactValue(child);
      if (childScore > bestScore) {
        best = child;
        bestScore = childScore;
      }
    }
    return best;
  }

  function locateReactValue(editorRoot) {
    let fiber = null;
    let node = editorRoot;
    for (let parentDepth = 0; node !== null && parentDepth < 20; parentDepth += 1) {
      const names = Object.getOwnPropertyNames(node);
      for (let index = 0; index < names.length; index += 1) {
        const name = names[index];
        if (!name.startsWith('__reactFiber$') && !name.startsWith('__reactInternalInstance$')) continue;
        const descriptor = Object.getOwnPropertyDescriptor(node, name);
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          fiber = descriptor.value;
          break;
        }
      }
      if (fiber !== null) break;
      const parentDescriptor = Object.getOwnPropertyDescriptor(node, 'parentElement');
      if (!parentDescriptor || !Object.prototype.hasOwnProperty.call(parentDescriptor, 'value')) break;
      node = parentDescriptor.value;
    }
    let best = null;
    for (let fiberDepth = 0; fiber !== null && fiberDepth < 15; fiberDepth += 1) {
      const props = findDataDescriptor(fiber, 'memoizedProps');
      const state = findDataDescriptor(fiber, 'memoizedState');
      if (props.kind === 'data') best = bestReactValue(props.value, best);
      if (state.kind === 'data') best = bestReactValue(state.value, best);
      const parent = findDataDescriptor(fiber, 'return');
      fiber = parent.kind === 'data' ? parent.value : null;
    }
    return best;
  }

  function readCandidate(index, owners) {
    const ownerName = paths[index][1];
    const member = paths[index][2];
    const owner = owners[ownerName];
    if ((typeof owner !== 'object' && typeof owner !== 'function') || owner === null) {
      return fixedCandidate(index, {
        available: false,
        value_type: 'missing',
        stable: false,
        read_count: 0,
        error_code: 'MEMBER_MISSING',
      });
    }
    let firstDescriptor;
    let secondDescriptor;
    let first;
    let second;
    try {
      firstDescriptor = findDataDescriptor(owner, member);
      if (firstDescriptor.kind === 'missing') {
        return fixedCandidate(index, {
          available: false,
          value_type: 'missing',
          stable: false,
          read_count: 0,
          error_code: 'MEMBER_MISSING',
        });
      }
      if (firstDescriptor.kind === 'accessor') {
        return fixedCandidate(index, {
          available: false,
          value_type: 'accessor',
          stable: false,
          read_count: 0,
          error_code: 'ACCESSOR_SKIPPED',
        });
      }
      if (ownerName === 'monaco_model' && callableModelMembers[member] === true) {
        first = invokeReviewed(owner, member);
      } else {
        first = firstDescriptor.value;
      }
      secondDescriptor = findDataDescriptor(owner, member);
      if (secondDescriptor.kind !== 'data') {
        return fixedCandidate(index, {
          available: false,
          value_type: 'unavailable',
          stable: false,
          read_count: 0,
          error_code: 'READ_FAILED',
        });
      }
      if (ownerName === 'monaco_model' && callableModelMembers[member] === true) {
        second = invokeReviewed(owner, member);
      } else {
        second = secondDescriptor.value;
      }
    } catch {
      return fixedCandidate(index, {
        available: false,
        value_type: 'unavailable',
        stable: false,
        read_count: 0,
        error_code: 'READ_FAILED',
      });
    }

    const firstType = first === undefined ? 'undefined' : typeof first;
    const secondType = second === undefined ? 'undefined' : typeof second;
    if (firstType === 'undefined' && secondType === 'undefined') {
      return fixedCandidate(index, {
        available: false,
        value_type: 'undefined',
        stable: true,
        read_count: 2,
        error_code: 'VALUE_UNAVAILABLE',
      });
    }
    const allowed = valueTypes[index];
    if (firstType !== secondType || !allowed.includes(firstType) || !allowed.includes(secondType)) {
      return fixedCandidate(index, {
        available: false,
        value_type: 'unavailable',
        stable: false,
        read_count: 2,
        error_code: 'TYPE_MISMATCH',
      });
    }
    const stable = Object.is(first, second);
    return fixedCandidate(index, {
      available: true,
      value_type: firstType,
      stable,
      read_count: 2,
      error_code: stable ? 'NONE' : 'UNSTABLE',
    });
  }

  let editorFound = false;
  try {
    const editorRoot = document.querySelector('.monaco-editor.pine-editor-monaco');
    if (editorRoot === null) {
      return {
        contract: 'gate-a0-v1',
        success: false,
        editor_found: false,
        candidate_count: paths.length,
        candidates: uniformCandidates('MEMBER_MISSING'),
        error_code: 'PINE_DISCOVERY_PREFLIGHT',
      };
    }
    editorFound = true;
    const monacoEnv = window && window.monaco;
    const editorApi = monacoEnv && monacoEnv.editor;
    let monacoEditor = null;
    let monacoModel = null;
    if (editorApi) {
      const editors = invokeReviewed(editorApi, 'getEditors');
      if (Array.isArray(editors)) {
        for (let index = 0; index < editors.length; index += 1) {
          const candidateEditor = editors[index];
          if (invokeReviewed(candidateEditor, 'getDomNode') === editorRoot) {
            monacoEditor = candidateEditor;
            break;
          }
        }
      }
    }
    if (monacoEditor !== null) monacoModel = invokeReviewed(monacoEditor, 'getModel');
    const owners = {
      monaco_env: monacoEnv,
      monaco_editor: monacoEditor,
      monaco_model: monacoModel,
      react_value: locateReactValue(editorRoot),
    };
    const candidates = [];
    for (let index = 0; index < paths.length; index += 1) {
      candidates.push(readCandidate(index, owners));
    }
    return {
      contract: 'gate-a0-v1',
      success: true,
      editor_found: true,
      candidate_count: paths.length,
      candidates,
      error_code: null,
    };
  } catch {
    return {
      contract: 'gate-a0-v1',
      success: false,
      editor_found: editorFound,
      candidate_count: paths.length,
      candidates: uniformCandidates(editorFound ? 'READ_FAILED' : 'MEMBER_MISSING'),
      error_code: editorFound ? 'PINE_DISCOVERY_PAGE' : 'PINE_DISCOVERY_PREFLIGHT',
    };
  }
}

export const PROBE_FUNCTION_DECLARATION = pineSignalDiscoveryMainWorld.toString();

const OBJECT_GROUP = 'tradingview-mcp-pine-discovery-v1';
const VISIBILITY_POLL_MS = 100;
const VISIBILITY_POLL_LIMIT = 8;
const DESTROYED_CONTEXT_NUMERIC_KEY = 'execution' + 'ContextId';

const PREFLIGHT_FUNCTION_DECLARATION = (function gateA0PreflightMainWorld() {
  'gate-a0-preflight-v1';
  try {
    const chart = window.TradingViewApi._activeChartWidgetWV.value();
    const replay = window.TradingViewApi._replayApi;
    const unwrap = (value) => (
      value && typeof value === 'object' && typeof value.value === 'function'
        ? value.value()
        : value
    );
    const studies = chart.getAllStudies();
    const shapes = chart.getAllShapes();
    const replayStarted = unwrap(replay.isReplayStarted());
    const bottomArea = document.querySelector('[class*="layout__area--bottom"]');
    const bottomOpen = Boolean(bottomArea && bottomArea.offsetHeight > 50);
    const editorOpen = document.querySelector('.monaco-editor.pine-editor-monaco') !== null;
    return chart.symbol() === 'FX:USDJPY'
      && chart.resolution() === '15'
      && chart.chartType() === 1
      && Array.isArray(studies)
      && studies.length === 12
      && Array.isArray(shapes)
      && shapes.length === 0
      && replayStarted === false
      && bottomOpen === false
      && editorOpen === false;
  } catch {
    return false;
  }
}).toString();

const CLOSE_CAPABILITY_FUNCTION_DECLARATION = (function gateA1CloseCapabilityMainWorld() {
  'gate-a1-close-capability-v1';
  try {
    const bar = window.TradingView && window.TradingView.bottomWidgetBar;
    return Boolean(bar && typeof bar.close === 'function');
  } catch {
    return false;
  }
}).toString();

const OPEN_FUNCTION_DECLARATION = (function gateA0OpenMainWorld() {
  'gate-a0-open-v1';
  try {
    const bar = window.TradingView && window.TradingView.bottomWidgetBar;
    if (!bar || typeof bar.activateScriptEditorTab !== 'function') return false;
    bar.activateScriptEditorTab();
    return true;
  } catch {
    return false;
  }
}).toString();

const CLOSE_FUNCTION_DECLARATION = (function gateA0CloseMainWorld() {
  'gate-a0-close-v1';
  try {
    const bar = window.TradingView && window.TradingView.bottomWidgetBar;
    if (!bar || typeof bar.close !== 'function') return false;
    bar.close();
    return true;
  } catch {
    return false;
  }
}).toString();

const VISIBILITY_FUNCTION_DECLARATION = (function gateA0VisibilityMainWorld() {
  'gate-a0-visibility-v1';
  try {
    return document.querySelector('.monaco-editor.pine-editor-monaco') !== null;
  } catch {
    return null;
  }
}).toString();

const POSTFLIGHT_FUNCTION_DECLARATION = (function gateA0PostflightMainWorld() {
  'gate-a0-postflight-v1';
  try {
    const chart = window.TradingViewApi._activeChartWidgetWV.value();
    const replay = window.TradingViewApi._replayApi;
    const unwrap = (value) => (
      value && typeof value === 'object' && typeof value.value === 'function'
        ? value.value()
        : value
    );
    const studies = chart.getAllStudies();
    const shapes = chart.getAllShapes();
    const replayStarted = unwrap(replay.isReplayStarted());
    const bottomArea = document.querySelector('[class*="layout__area--bottom"]');
    const bottomOpen = Boolean(bottomArea && bottomArea.offsetHeight > 50);
    const editorOpen = document.querySelector('.monaco-editor.pine-editor-monaco') !== null;
    return chart.symbol() === 'FX:USDJPY'
      && chart.resolution() === '15'
      && chart.chartType() === 1
      && Array.isArray(studies)
      && studies.length === 12
      && Array.isArray(shapes)
      && shapes.length === 0
      && replayStarted === false
      && bottomOpen === false
      && editorOpen === false;
  } catch {
    return false;
  }
}).toString();

export const OPERATION_DEADLINE_MS = 1000;
export const WORK_DEADLINE_MS = 20000;
export const CLEANUP_RESERVE_MS = 10000;
export const TOTAL_HARD_DEADLINE_MS = 30000;
export const CLI_FLUSH_FALLBACK_MS = 100;
export const HARD_DEADLINE_EXIT_CODE = 70;

const HARD_EXIT_CLEANUP_LIMIT =
  'PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN';

const FORBIDDEN_EFFECTS = Object.freeze([
  'SOURCE_MUTATION',
  'SAVE',
  'KEYBOARD_INPUT',
  'MOUSE_INPUT',
  'HARNESS_INITIATED_EXTERNAL_NETWORK',
  'PINE_FACADE_POST',
  'PAGE_RELOAD',
  'TAB_OPERATION',
  'PROCESS_OPERATION',
]);

const RUN_PHASE = Object.freeze({
  SUCCESS: 'SUCCESS',
  ARGUMENT: 'ARGUMENT',
  DIGEST: 'DIGEST',
  APPROVAL: 'APPROVAL',
  MODULE: 'MODULE',
  SELECTION: 'SELECTION',
  CONNECT: 'CONNECT',
  BEFORE_OPEN: 'BEFORE_OPEN',
  PREFLIGHT: 'PREFLIGHT',
  OPEN: 'OPEN',
  PROBE: 'PROBE',
  CLOSE: 'CLOSE',
  POSTFLIGHT: 'POSTFLIGHT',
  DETACH: 'DETACH',
  HARD: 'HARD',
  INTERNAL: 'INTERNAL',
});

const VISIBILITY_EVIDENCE = Object.freeze({
  CLOSED: 'PROVED_CLOSED',
  OPEN: 'PROVED_OPEN',
  UNKNOWN: 'UNKNOWN',
});

function fixedError(code) {
  return new Error(code);
}

async function computeSha256With(readFileFn) {
  if (typeof readFileFn !== 'function') throw fixedError(PROBE_ERROR_CODES.ARGUMENT);
  let bytes;
  try {
    bytes = await readFileFn(fileURLToPath(import.meta.url));
  } catch {
    throw fixedError(PROBE_ERROR_CODES.ARGUMENT);
  }
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export async function computeProbeSelfSha256(readFileFn) {
  return computeSha256With(readFileFn);
}

export async function buildApprovalEnvelope(readFileFn) {
  const bundleSha256 = await computeSha256With(readFileFn);
  return {
    bundle_sha256: bundleSha256,
    exact_command: `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=${bundleSha256}`,
    target_id: PROBE_TARGET.id,
    initial_tuple: {
      symbol: PROBE_TARGET.symbol,
      resolution: PROBE_TARGET.resolution,
      chart_type: PROBE_TARGET.chart_type,
      study_count: PROBE_TARGET.study_count,
      shape_count: PROBE_TARGET.shape_count,
      replay_started: PROBE_TARGET.replay_started,
      bottom_widget_open: PROBE_TARGET.bottom_widget_open,
      pine_editor_open: PROBE_TARGET.pine_editor_open,
    },
    budgets: {
      open: PROBE_BUDGET.open,
      probe: PROBE_BUDGET.probe,
      close: PROBE_BUDGET.close,
      retry: PROBE_BUDGET.retry,
      fallback: PROBE_BUDGET.fallback,
    },
    forbidden_effects: [...FORBIDDEN_EFFECTS],
    operation_deadline_ms: OPERATION_DEADLINE_MS,
    work_deadline_ms: WORK_DEADLINE_MS,
    cleanup_reserve_ms: CLEANUP_RESERVE_MS,
    total_hard_deadline_ms: TOTAL_HARD_DEADLINE_MS,
    hard_exit_cleanup_limit: HARD_EXIT_CLEANUP_LIMIT,
    tradingview_page_initiated_network: 'UNKNOWN',
    approval: {
      schema_version: 1,
      secret_ingress_env: APPROVAL_FILE_ENV,
      file_mode: '0600',
      nonce_format: '64 lowercase hexadecimal characters',
      issued_at: 'strict ISO-8601 UTC timestamp supplied by approver',
      expires_at: 'strict ISO-8601 UTC timestamp supplied by approver',
      max_ttl_ms: APPROVAL_MAX_TTL_MS,
      one_shot: true,
    },
  };
}

function exactJsonObject(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function strictUtcTimestamp(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function approvalMatches(value, bundleSha256, nowMs) {
  const topKeys = [
    'schema_version', 'nonce', 'bundle_sha256', 'target_id', 'exact_command',
    'issued_at', 'expires_at', 'initial_tuple', 'budgets',
  ];
  if (!exactJsonObject(value, topKeys)
    || value.schema_version !== 1
    || typeof value.nonce !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.nonce)
    || value.bundle_sha256 !== bundleSha256
    || value.target_id !== PROBE_TARGET.id
    || value.exact_command
      !== `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=${bundleSha256}`
    || !exactJsonObject(value.initial_tuple, [
      'symbol', 'resolution', 'chart_type', 'study_count', 'shape_count',
      'replay_started', 'bottom_widget_open', 'pine_editor_open',
    ])
    || !exactJsonObject(value.budgets, ['open', 'probe', 'close', 'retry', 'fallback'])) {
    return false;
  }
  for (const [key, expected] of Object.entries(PROBE_TARGET)) {
    if (key !== 'id' && value.initial_tuple[key] !== expected) return false;
  }
  for (const [key, expected] of Object.entries(PROBE_BUDGET)) {
    if (value.budgets[key] !== expected) return false;
  }
  const issuedAt = strictUtcTimestamp(value.issued_at);
  const expiresAt = strictUtcTimestamp(value.expires_at);
  return issuedAt !== null && expiresAt !== null
    && issuedAt <= nowMs
    && expiresAt > nowMs
    && expiresAt > issuedAt
    && expiresAt - issuedAt <= APPROVAL_MAX_TTL_MS;
}

async function secureParentDirectory(path) {
  const parent = dirname(path);
  const components = parent.split('/').filter((component) => component.length > 0);
  let current = '/';
  for (const component of components) {
    current = resolve(current, component);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) return null;
  }
  const directory = await open(
    parent,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const directoryMetadata = await directory.stat();
    if (!directoryMetadata.isDirectory()) {
      await directory.close();
      return null;
    }
    const anchor = `/proc/self/fd/${directory.fd}`;
    const anchorTarget = await readlink(anchor);
    const anchorMetadata = await stat(anchor);
    if (typeof anchorTarget !== 'string' || !anchorTarget.startsWith('/')
      || anchorMetadata.dev !== directoryMetadata.dev
      || anchorMetadata.ino !== directoryMetadata.ino) {
      await directory.close();
      return null;
    }
    return { anchor, directory, directoryMetadata, parent };
  } catch {
    await directory.close();
    throw fixedError(PROBE_ERROR_CODES.APPROVAL);
  }
}

async function readSmallStrictPath(path) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > 4096) {
    return null;
  }
  const text = await readFile(path, 'utf8');
  if (text.includes('\0') || text.includes('\r') || text.split('\n').filter(Boolean).length !== 1) {
    return null;
  }
  return text.trim();
}

async function gitCommonDirectory() {
  const dotGit = resolve(REPOSITORY_ROOT, '.git');
  const dotGitMetadata = await lstat(dotGit);
  let gitDirectory;
  if (dotGitMetadata.isDirectory() && !dotGitMetadata.isSymbolicLink()) {
    gitDirectory = dotGit;
  } else if (dotGitMetadata.isFile() && !dotGitMetadata.isSymbolicLink()) {
    const declaration = await readSmallStrictPath(dotGit);
    const match = declaration && /^gitdir: (.+)$/.exec(declaration);
    if (!match) return null;
    gitDirectory = resolve(REPOSITORY_ROOT, match[1]);
  } else {
    return null;
  }
  const securedGitDirectory = await secureParentDirectory(resolve(gitDirectory, 'anchor'));
  if (securedGitDirectory === null) return null;
  await securedGitDirectory.directory.close();
  let commonDirectory = gitDirectory;
  try {
    const declaration = await readSmallStrictPath(resolve(gitDirectory, 'commondir'));
    if (declaration === null) return null;
    commonDirectory = resolve(gitDirectory, declaration);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') return null;
  }
  const commonMetadata = await lstat(commonDirectory);
  if (!commonMetadata.isDirectory() || commonMetadata.isSymbolicLink()) return null;
  return commonDirectory;
}

async function secureSpentStateDirectory() {
  const commonDirectory = await gitCommonDirectory();
  if (commonDirectory === null) return null;
  let current = commonDirectory;
  for (const component of SPENT_STATE_COMPONENTS) {
    current = resolve(current, component);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (!error || error.code !== 'EEXIST') return null;
    }
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()
      || (metadata.mode & 0o777) !== 0o700) return null;
  }
  return secureParentDirectory(resolve(current, 'anchor'));
}

export async function consumeApprovalLease(approvalPath, bundleSha256, nowMs = Date.now()) {
  let approvalHandle;
  let parentHandle;
  let stateHandle;
  try {
    if (typeof approvalPath !== 'string' || !approvalPath.startsWith('/')
      || typeof bundleSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(bundleSha256)
      || !Number.isFinite(nowMs)) return false;
    const parent = dirname(approvalPath);
    const approvalName = basename(approvalPath);
    if (approvalName.length === 0 || resolve(parent, approvalName) !== approvalPath) return false;
    const securedParent = await secureParentDirectory(approvalPath);
    if (securedParent === null) return false;
    parentHandle = securedParent.directory;
    const anchoredApprovalPath = `${securedParent.anchor}/${approvalName}`;
    approvalHandle = await open(
      anchoredApprovalPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const metadata = await approvalHandle.stat();
    if (!metadata.isFile() || (metadata.mode & 0o777) !== 0o600
      || metadata.size === 0 || metadata.size > 8192) return false;
    const bytes = await approvalHandle.readFile();
    if (bytes.length !== metadata.size) return false;
    let approval;
    try {
      approval = JSON.parse(bytes.toString('utf8'));
    } catch {
      return false;
    }
    if (!approvalMatches(approval, bundleSha256, nowMs)) return false;
    const currentMetadata = await lstat(anchoredApprovalPath);
    if (currentMetadata.isSymbolicLink()
      || currentMetadata.dev !== metadata.dev
      || currentMetadata.ino !== metadata.ino) return false;
    const nonceHash = createHash('sha256').update(approval.nonce).digest('hex');
    const envelopeHash = createHash('sha256').update(bytes).digest('hex');
    const currentParentMetadata = await lstat(parent);
    if (currentParentMetadata.isSymbolicLink()
      || currentParentMetadata.dev !== securedParent.directoryMetadata.dev
      || currentParentMetadata.ino !== securedParent.directoryMetadata.ino) return false;
    const securedState = await secureSpentStateDirectory();
    if (securedState === null) return false;
    stateHandle = securedState.directory;
    const spentPath = `${securedState.anchor}/${nonceHash}.json`;
    const markerHandle = await open(
      spentPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const marker = JSON.stringify({
        schema_version: 1,
        nonce_digest: nonceHash,
        envelope_digest: envelopeHash,
        issued_at: approval.issued_at,
        expires_at: approval.expires_at,
      });
      await markerHandle.writeFile(marker);
      await markerHandle.sync();
    } finally {
      await markerHandle.close();
    }
    await stateHandle.sync();
    return true;
  } catch {
    return false;
  } finally {
    if (approvalHandle) {
      try {
        await approvalHandle.close();
      } catch {
        // The spent marker, if created, remains authoritative.
      }
    }
    if (parentHandle) {
      try {
        await parentHandle.close();
      } catch {
        // The spent marker, if created, remains authoritative.
      }
    }
    if (stateHandle) {
      try {
        await stateHandle.close();
      } catch {
        // The spent marker, if created, remains authoritative.
      }
    }
  }
}

function invalidProbeResult() {
  throw fixedError(PROBE_ERROR_CODES.INVALID);
}

function readExactDataObject(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) invalidProbeResult();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) invalidProbeResult();
  const actualKeys = ownKeys.slice().sort();
  const sortedExpected = expectedKeys.slice().sort();
  if (actualKeys.length !== sortedExpected.length) invalidProbeResult();
  for (let index = 0; index < sortedExpected.length; index += 1) {
    if (actualKeys[index] !== sortedExpected[index]) invalidProbeResult();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalidProbeResult();
    output[key] = descriptor.value;
  }
  return output;
}

function readExactCandidateArray(value) {
  if (!Array.isArray(value) || types.isProxy(value)) invalidProbeResult();
  const keys = Reflect.ownKeys(value);
  const expectedKeys = Array.from({ length: PROBE_CANDIDATE_PATHS.length }, (_, index) => String(index));
  expectedKeys.push('length');
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) {
    invalidProbeResult();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  if (!lengthDescriptor
    || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
    || lengthDescriptor.value !== PROBE_CANDIDATE_PATHS.length) {
    invalidProbeResult();
  }
  const output = [];
  for (let index = 0; index < PROBE_CANDIDATE_PATHS.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      invalidProbeResult();
    }
    output.push(descriptor.value);
  }
  return output;
}

function validCandidateState(candidate, index) {
  const allowedTypes = PROBE_CANDIDATE_VALUE_TYPES[index];
  switch (candidate.error_code) {
    case PROBE_CANDIDATE_ERROR_CODES.NONE:
      return candidate.available === true
        && allowedTypes.includes(candidate.value_type)
        && candidate.stable === true
        && candidate.read_count === 2;
    case PROBE_CANDIDATE_ERROR_CODES.MEMBER_MISSING:
      return candidate.available === false
        && candidate.value_type === 'missing'
        && candidate.stable === false
        && candidate.read_count === 0;
    case PROBE_CANDIDATE_ERROR_CODES.ACCESSOR_SKIPPED:
      return candidate.available === false
        && candidate.value_type === 'accessor'
        && candidate.stable === false
        && candidate.read_count === 0;
    case PROBE_CANDIDATE_ERROR_CODES.READ_FAILED:
      return candidate.available === false
        && candidate.value_type === 'unavailable'
        && candidate.stable === false
        && candidate.read_count === 0;
    case PROBE_CANDIDATE_ERROR_CODES.VALUE_UNAVAILABLE:
      return candidate.available === false
        && candidate.value_type === 'undefined'
        && candidate.stable === true
        && candidate.read_count === 2;
    case PROBE_CANDIDATE_ERROR_CODES.UNSTABLE:
      return candidate.available === true
        && allowedTypes.includes(candidate.value_type)
        && candidate.stable === false
        && candidate.read_count === 2;
    case PROBE_CANDIDATE_ERROR_CODES.TYPE_MISMATCH:
      return candidate.available === false
        && candidate.value_type === 'unavailable'
        && candidate.stable === false
        && candidate.read_count === 2;
    default:
      return false;
  }
}

export function validateProbeResult(value) {
  const top = readExactDataObject(value, [
    'contract',
    'success',
    'editor_found',
    'candidate_count',
    'candidates',
    'error_code',
  ]);
  if (top.contract !== 'gate-a0-v1'
    || typeof top.success !== 'boolean'
    || typeof top.editor_found !== 'boolean'
    || top.candidate_count !== PROBE_CANDIDATE_PATHS.length) {
    invalidProbeResult();
  }
  const inputCandidates = readExactCandidateArray(top.candidates);
  const candidates = [];
  for (let index = 0; index < inputCandidates.length; index += 1) {
    const candidate = readExactDataObject(inputCandidates[index], [
      'signal',
      'owner',
      'member',
      'available',
      'value_type',
      'stable',
      'read_count',
      'error_code',
    ]);
    const expectedPath = PROBE_CANDIDATE_PATHS[index];
    if (candidate.signal !== expectedPath[0]
      || candidate.owner !== expectedPath[1]
      || candidate.member !== expectedPath[2]
      || !validCandidateState(candidate, index)) {
      invalidProbeResult();
    }
    candidates.push({
      signal: candidate.signal,
      owner: candidate.owner,
      member: candidate.member,
      available: candidate.available,
      value_type: candidate.value_type,
      stable: candidate.stable,
      read_count: candidate.read_count,
      error_code: candidate.error_code,
    });
  }

  const successCombination = top.success === true
    && top.editor_found === true
    && top.error_code === null;
  const preflightCombination = top.success === false
    && top.editor_found === false
    && top.error_code === PROBE_ERROR_CODES.PREFLIGHT
    && candidates.every((candidate) => candidate.error_code === PROBE_CANDIDATE_ERROR_CODES.MEMBER_MISSING);
  const pageCombination = top.success === false
    && top.editor_found === true
    && top.error_code === PROBE_ERROR_CODES.PAGE
    && candidates.every((candidate) => candidate.error_code === PROBE_CANDIDATE_ERROR_CODES.READ_FAILED);
  if (!successCombination && !preflightCombination && !pageCombination) invalidProbeResult();

  return {
    contract: 'gate-a0-v1',
    success: top.success,
    editor_found: top.editor_found,
    candidate_count: PROBE_CANDIDATE_PATHS.length,
    candidates,
    error_code: top.error_code,
  };
}

function createProgressRecord() {
  return {
    editor_open_attempt_count: 0,
    probe_invocation_count: 0,
    editor_close_attempt_count: 0,
    retry_count: 0,
    fallback_count: 0,
  };
}

function snapshotProgress(progress) {
  return {
    editor_open_attempt_count: progress.editor_open_attempt_count,
    probe_invocation_count: progress.probe_invocation_count,
    editor_close_attempt_count: progress.editor_close_attempt_count,
    retry_count: progress.retry_count,
    fallback_count: progress.fallback_count,
  };
}

function residualForPhase(phase, ledger, visibilityEvidence) {
  switch (phase) {
    case RUN_PHASE.SUCCESS:
      return visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED ? 'CLOSED' : 'UNKNOWN';
    case RUN_PHASE.PREFLIGHT:
    case RUN_PHASE.BEFORE_OPEN:
      return visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED ? 'CLOSED' : 'UNKNOWN';
    case RUN_PHASE.OPEN:
      return ledger.editor_close_attempt_count === 1
        && visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED
        ? 'CLOSED'
        : 'UNKNOWN';
    case RUN_PHASE.PROBE:
      if (visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED) return 'CLOSED';
      if (visibilityEvidence === VISIBILITY_EVIDENCE.OPEN) return 'OPEN';
      return 'UNKNOWN';
    case RUN_PHASE.CLOSE:
    case RUN_PHASE.POSTFLIGHT:
      return visibilityEvidence === VISIBILITY_EVIDENCE.OPEN ? 'OPEN' : 'UNKNOWN';
    case RUN_PHASE.DETACH:
      if (visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED) return 'CLOSED';
      if (visibilityEvidence === VISIBILITY_EVIDENCE.OPEN) return 'OPEN';
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

function safeFailure(errorCode, progress, phase, visibilityEvidence, probe = null) {
  const ledger = snapshotProgress(progress);
  return {
    success: false,
    error_code: errorCode,
    editor_residual_state: residualForPhase(phase, ledger, visibilityEvidence),
    ledger,
    probe,
  };
}

function safeSuccess(progress, phase, visibilityEvidence, probe) {
  const ledger = snapshotProgress(progress);
  return {
    success: true,
    error_code: null,
    editor_residual_state: residualForPhase(phase, ledger, visibilityEvidence),
    ledger,
    probe,
  };
}

function invalidSafeMain() {
  throw fixedError(PROBE_ERROR_CODES.INTERNAL);
}

function readSafeDataObject(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) invalidSafeMain();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) invalidSafeMain();
  const actualKeys = ownKeys.slice().sort();
  const sortedExpected = expectedKeys.slice().sort();
  if (actualKeys.length !== sortedExpected.length) invalidSafeMain();
  for (let index = 0; index < sortedExpected.length; index += 1) {
    if (actualKeys[index] !== sortedExpected[index]) invalidSafeMain();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalidSafeMain();
    output[key] = descriptor.value;
  }
  return output;
}

function validateLedgerSnapshot(value) {
  const ledger = readSafeDataObject(value, [
    'editor_open_attempt_count',
    'probe_invocation_count',
    'editor_close_attempt_count',
    'retry_count',
    'fallback_count',
  ]);
  for (const key of [
    'editor_open_attempt_count',
    'probe_invocation_count',
    'editor_close_attempt_count',
    'retry_count',
    'fallback_count',
  ]) {
    if (!Number.isInteger(ledger[key])) invalidSafeMain();
  }
  if (ledger.editor_open_attempt_count < 0 || ledger.editor_open_attempt_count > 1
    || ledger.probe_invocation_count < 0 || ledger.probe_invocation_count > 1
    || ledger.editor_close_attempt_count < 0 || ledger.editor_close_attempt_count > 1
    || ledger.probe_invocation_count > ledger.editor_open_attempt_count
    || ledger.editor_close_attempt_count > ledger.editor_open_attempt_count
    || ledger.retry_count !== 0
    || ledger.fallback_count !== 0) {
    invalidSafeMain();
  }
  return {
    editor_open_attempt_count: ledger.editor_open_attempt_count,
    probe_invocation_count: ledger.probe_invocation_count,
    editor_close_attempt_count: ledger.editor_close_attempt_count,
    retry_count: 0,
    fallback_count: 0,
  };
}

function safeMainCombination(payload, hasProbe, phase, visibilityEvidence) {
  const ledger = payload.ledger;
  const open = ledger.editor_open_attempt_count;
  const probe = ledger.probe_invocation_count;
  const close = ledger.editor_close_attempt_count;
  const residual = payload.editor_residual_state;
  const expectedResidual = residualForPhase(phase, ledger, visibilityEvidence);
  if (residual !== expectedResidual) return false;
  if (phase === RUN_PHASE.SUCCESS) {
    return payload.success === true
      && payload.error_code === null
      && open === 1 && probe === 1 && close === 1
      && hasProbe
      && visibilityEvidence === VISIBILITY_EVIDENCE.CLOSED;
  }
  if (payload.success !== false || typeof payload.error_code !== 'string') return false;
  switch (phase) {
    case RUN_PHASE.ARGUMENT:
      return payload.error_code === PROBE_ERROR_CODES.ARGUMENT
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.DIGEST:
      return payload.error_code === PROBE_ERROR_CODES.DIGEST
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.APPROVAL:
      return payload.error_code === PROBE_ERROR_CODES.APPROVAL
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.MODULE:
      return payload.error_code === PROBE_ERROR_CODES.MODULE
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.SELECTION:
      return payload.error_code === PROBE_ERROR_CODES.TARGET_REJECTED
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.CONNECT:
      return payload.error_code === PROBE_ERROR_CODES.CONNECT
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.PREFLIGHT:
      return (payload.error_code === PROBE_ERROR_CODES.PREFLIGHT
          || payload.error_code === PROBE_ERROR_CODES.CLOSE_CAPABILITY)
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.BEFORE_OPEN:
      return (payload.error_code === PROBE_ERROR_CODES.CONTEXT_CHANGED
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && open === 0 && probe === 0 && close === 0 && !hasProbe;
    case RUN_PHASE.OPEN:
      return (payload.error_code === PROBE_ERROR_CODES.OPEN_ACTION_REJECTED
          || payload.error_code === PROBE_ERROR_CODES.OPEN_NON_BOOLEAN
          || payload.error_code === PROBE_ERROR_CODES.OPEN_VISIBILITY_UNPROVEN
          || payload.error_code === PROBE_ERROR_CODES.OPEN_PROTOCOL
          || payload.error_code === PROBE_ERROR_CODES.OPEN_PAGE
          || payload.error_code === PROBE_ERROR_CODES.OPEN_DEADLINE
          || payload.error_code === PROBE_ERROR_CODES.CONTEXT_CHANGED
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && open === 1 && probe === 0 && (close === 0 || close === 1) && !hasProbe;
    case RUN_PHASE.PROBE:
      return (payload.error_code === PROBE_ERROR_CODES.PROTOCOL
          || payload.error_code === PROBE_ERROR_CODES.PAGE
          || payload.error_code === PROBE_ERROR_CODES.INVALID
          || payload.error_code === PROBE_ERROR_CODES.CONTEXT_CHANGED
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && open === 1 && probe === 1 && close === 1 && !hasProbe;
    case RUN_PHASE.CLOSE:
      return (payload.error_code === PROBE_ERROR_CODES.CLOSE
          || payload.error_code === PROBE_ERROR_CODES.CONTEXT_CHANGED
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && open === 1 && close === 1
        && (probe === 1 || (probe === 0 && !hasProbe))
        && (!hasProbe || probe === 1);
    case RUN_PHASE.POSTFLIGHT:
      return (payload.error_code === PROBE_ERROR_CODES.POSTFLIGHT
          || payload.error_code === PROBE_ERROR_CODES.CONTEXT_CHANGED
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && open === 1 && probe === 1 && close === 1 && hasProbe;
    case RUN_PHASE.DETACH:
      return (payload.error_code === PROBE_ERROR_CODES.DETACH
          || payload.error_code === PROBE_ERROR_CODES.DEADLINE)
        && (!hasProbe || probe === 1);
    case RUN_PHASE.HARD:
      return payload.error_code === PROBE_ERROR_CODES.HARD_DEADLINE
        && !hasProbe && residual === 'UNKNOWN';
    case RUN_PHASE.INTERNAL:
      return payload.error_code === PROBE_ERROR_CODES.INTERNAL
        && !hasProbe && residual === 'UNKNOWN';
    default:
      return false;
  }
}

function validateSafeMainPayload(value, phase, visibilityEvidence) {
  const top = readSafeDataObject(value, [
    'success',
    'error_code',
    'editor_residual_state',
    'ledger',
    'probe',
  ]);
  if (typeof top.success !== 'boolean'
    || !['CLOSED', 'OPEN', 'UNKNOWN'].includes(top.editor_residual_state)) {
    invalidSafeMain();
  }
  const ledger = validateLedgerSnapshot(top.ledger);
  let probe = null;
  let hasProbe = false;
  if (top.probe !== null) {
    try {
      probe = validateProbeResult(top.probe);
      hasProbe = true;
    } catch {
      invalidSafeMain();
    }
  }
  const reconstructed = {
    success: top.success,
    error_code: top.error_code,
    editor_residual_state: top.editor_residual_state,
    ledger,
    probe,
  };
  if (!safeMainCombination(reconstructed, hasProbe, phase, visibilityEvidence)) invalidSafeMain();
  return reconstructed;
}

function hardDeadlinePayload(progress) {
  return validateSafeMainPayload({
    success: false,
    error_code: PROBE_ERROR_CODES.HARD_DEADLINE,
    editor_residual_state: 'UNKNOWN',
    ledger: validateLedgerSnapshot(snapshotProgress(progress)),
    probe: null,
  }, RUN_PHASE.HARD, VISIBILITY_EVIDENCE.UNKNOWN);
}

function internalTerminalPayload(progress) {
  let ledger;
  try {
    ledger = validateLedgerSnapshot(snapshotProgress(progress));
  } catch {
    ledger = {
      editor_open_attempt_count: 0,
      probe_invocation_count: 0,
      editor_close_attempt_count: 0,
      retry_count: 0,
      fallback_count: 0,
    };
  }
  return {
    success: false,
    error_code: PROBE_ERROR_CODES.INTERNAL,
    editor_residual_state: 'UNKNOWN',
    ledger,
    probe: null,
  };
}

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || typeof argv[0] !== 'string') {
    return { kind: 'failure', errorCode: PROBE_ERROR_CODES.ARGUMENT };
  }
  if (argv[0] === '--approval-envelope') return { kind: 'approval' };
  const match = /^--bundle-sha256=([a-f0-9]{64})$/.exec(argv[0]);
  if (!match) return { kind: 'failure', errorCode: PROBE_ERROR_CODES.ARGUMENT };
  return { kind: 'bundle', digest: match[1] };
}

function digestMatches(actualDigest, suppliedDigest) {
  const actual = Buffer.from(actualDigest, 'hex');
  const supplied = Buffer.from(suppliedDigest, 'hex');
  return actual.length === supplied.length && timingSafeEqual(actual, supplied);
}

function finiteOperation(operation, signal) {
  if (signal && signal.aborted) {
    return Promise.resolve({ ok: false, deadline: true });
  }
  let operationPromise;
  try {
    operationPromise = Promise.resolve().then(operation);
  } catch {
    return Promise.resolve({ ok: false, deadline: false });
  }
  operationPromise.catch(() => {});
  return new Promise((resolveOperation) => {
    let settled = false;
    const onAbort = () => finish({ ok: false, deadline: true });
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(deadlineHandle);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolveOperation(outcome);
    };
    const deadlineHandle = globalThis.setTimeout(
      () => finish({ ok: false, deadline: true }),
      OPERATION_DEADLINE_MS,
    );
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    operationPromise.then(
      (value) => finish({ ok: true, value }),
      () => finish({ ok: false, deadline: false }),
    );
  });
}

function fixedWait(signal) {
  if (signal && signal.aborted) return Promise.resolve(false);
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (completed) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(waitHandle);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolveWait(completed);
    };
    const onAbort = () => finish(false);
    const waitHandle = globalThis.setTimeout(() => finish(true), VISIBILITY_POLL_MS);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function remoteBoolean(response) {
  if (response === null || typeof response !== 'object') return { ok: false, page: false };
  if (response.exceptionDetails !== undefined) return { ok: false, page: true };
  const result = response.result;
  if (result === null || typeof result !== 'object'
    || result.type !== 'boolean'
    || typeof result.value !== 'boolean') {
    return { ok: false, page: false };
  }
  return { ok: true, value: result.value };
}

function normalizeTargetBoundary(target, identifierKey) {
  try {
    if (target === null || typeof target !== 'object' || types.isProxy(target)) return null;
    const identifier = Object.getOwnPropertyDescriptor(target, identifierKey);
    const type = Object.getOwnPropertyDescriptor(target, 'type');
    const url = Object.getOwnPropertyDescriptor(target, 'url');
    if (!identifier || !Object.hasOwn(identifier, 'value')
      || !type || !Object.hasOwn(type, 'value')
      || !url || !Object.hasOwn(url, 'value')) {
      return null;
    }
    return {
      targetId: identifier.value,
      type: type.value,
      url: url.value,
    };
  } catch {
    return null;
  }
}

function normalizeListedTarget(target) {
  return normalizeTargetBoundary(target, 'id');
}

function normalizeProtocolTarget(target) {
  return normalizeTargetBoundary(target, 'targetId');
}

function strictTargetPredicate(target) {
  try {
    if (target === null || typeof target !== 'object'
      || target.targetId !== PROBE_TARGET.id
      || target.type !== 'page'
      || typeof target.url !== 'string') {
      return false;
    }
    const parsed = new URL(target.url);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.port === ''
      && (hostname === 'tradingview.com' || hostname.endsWith('.tradingview.com'))
      && (parsed.pathname === '/chart' || parsed.pathname.startsWith('/chart/'));
  } catch {
    return false;
  }
}

function validMainFrame(frame) {
  return frame !== null
    && typeof frame === 'object'
    && typeof frame.id === 'string'
    && frame.id.length > 0
    && typeof frame.loaderId === 'string'
    && frame.loaderId.length > 0;
}

function installContextTracker(client, state) {
  if (typeof client.on !== 'function' || typeof client.removeListener !== 'function') return false;
  let resolveContext;
  const contextPromise = new Promise((resolvePromise) => {
    resolveContext = resolvePromise;
  });
  const tracker = {
    candidate: null,
    contextPromise,
    currentUniqueId: null,
    handlers: [],
    invalidated: false,
  };
  const add = (name, handler) => {
    client.on(name, handler);
    tracker.handlers.push([name, handler]);
  };
  add('Runtime.executionContextCreated', (event) => {
    try {
      const context = event && event.context;
      const auxiliary = context && context.auxData;
      if (!context || !auxiliary || auxiliary.isDefault !== true
        || !Number.isInteger(context.id)
        || typeof context.uniqueId !== 'string'
        || context.uniqueId.length === 0
        || typeof auxiliary.frameId !== 'string'
        || auxiliary.frameId.length === 0) {
        return;
      }
      if (state.identity) {
        if (auxiliary.frameId === state.identity.frameId
          && (context.id !== state.identity.id || context.uniqueId !== state.identity.uniqueId)) {
          tracker.invalidated = true;
        }
        return;
      }
      if (!state.mainFrame || auxiliary.frameId !== state.mainFrame.id) return;
      if (tracker.candidate
        && (tracker.candidate.id !== context.id || tracker.candidate.uniqueId !== context.uniqueId)) {
        tracker.invalidated = true;
        return;
      }
      tracker.candidate = {
        id: context.id,
        uniqueId: context.uniqueId,
        frameId: auxiliary.frameId,
      };
      tracker.currentUniqueId = context.uniqueId;
      resolveContext(tracker.candidate);
    } catch {
      tracker.invalidated = true;
    }
  });
  add('Runtime.executionContextDestroyed', (event) => {
    try {
      if (!state.identity) return;
      const numericContextId = event && event[DESTROYED_CONTEXT_NUMERIC_KEY];
      if ((Number.isInteger(numericContextId)
          && numericContextId === state.identity.id)
        || (typeof (event && event.executionContextUniqueId) === 'string'
          && event.executionContextUniqueId === state.identity.uniqueId)) {
        tracker.invalidated = true;
      }
    } catch {
      tracker.invalidated = true;
    }
  });
  add('Runtime.executionContextsCleared', () => {
    tracker.invalidated = true;
  });
  add('Page.frameNavigated', (event) => {
    try {
      if (!state.identity) return;
      const frame = event && event.frame;
      if (frame && frame.id === state.identity.frameId
        && frame.loaderId !== state.identity.loaderId) {
        tracker.invalidated = true;
      }
    } catch {
      tracker.invalidated = true;
    }
  });
  state.contextTracker = tracker;
  return true;
}

function removeContextTracker(client, tracker) {
  if (!tracker || typeof client.removeListener !== 'function') return;
  for (const [name, handler] of tracker.handlers) {
    try {
      client.removeListener(name, handler);
    } catch {
      tracker.invalidated = true;
    }
  }
  tracker.handlers.length = 0;
}

async function verifyIdentity(client, state) {
  const tracker = state.contextTracker;
  const identity = state.identity;
  if (!identity || !tracker || tracker.invalidated
    || tracker.currentUniqueId !== identity.uniqueId) {
    return { ok: false, deadline: false, contextChanged: true };
  }
  if (state.operationSignal && state.operationSignal.aborted) {
    return { ok: false, deadline: true, contextChanged: false };
  }
  const targetInfo = await finiteOperation(() => client.Target.getTargetInfo({
    targetId: PROBE_TARGET.id,
  }), state.operationSignal);
  if (!targetInfo.ok) {
    return {
      ok: false,
      deadline: targetInfo.deadline,
      contextChanged: !targetInfo.deadline,
    };
  }
  const canonicalTarget = targetInfo.value
    && normalizeProtocolTarget(targetInfo.value.targetInfo);
  if (!canonicalTarget || !strictTargetPredicate(canonicalTarget)) {
    return { ok: false, deadline: false, contextChanged: true };
  }
  const frameTree = await finiteOperation(
    () => client.Page.getFrameTree(),
    state.operationSignal,
  );
  if (!frameTree.ok) {
    return {
      ok: false,
      deadline: frameTree.deadline,
      contextChanged: !frameTree.deadline,
    };
  }
  const frame = frameTree.value && frameTree.value.frameTree && frameTree.value.frameTree.frame;
  if (!validMainFrame(frame)
    || frame.id !== identity.frameId
    || frame.loaderId !== identity.loaderId
    || tracker.invalidated
    || tracker.currentUniqueId !== identity.uniqueId) {
    return { ok: false, deadline: false, contextChanged: true };
  }
  return { ok: true };
}

async function callMainWorld(client, functionDeclaration, state) {
  const before = await verifyIdentity(client, state);
  if (!before.ok) return { ...before, identityCheck: true };
  const invoked = await finiteOperation(() => client.Runtime.callFunctionOn({
    functionDeclaration,
    uniqueContextId: state.identity.uniqueId,
    returnByValue: true,
    awaitPromise: false,
    objectGroup: OBJECT_GROUP,
  }), state.operationSignal);
  const after = await verifyIdentity(client, state);
  if (!after.ok) return { ...after, identityCheck: true };
  return invoked;
}

async function callEffectMainWorld(client, functionDeclaration, state, beforeCall) {
  const before = await verifyIdentity(client, state);
  if (!before.ok) return before;
  if (state.operationSignal && state.operationSignal.aborted) {
    return { ok: false, deadline: true, contextChanged: false };
  }
  beforeCall();
  const invoked = await finiteOperation(() => client.Runtime.callFunctionOn({
    functionDeclaration,
    uniqueContextId: state.identity.uniqueId,
    returnByValue: true,
    awaitPromise: false,
    objectGroup: OBJECT_GROUP,
  }), state.operationSignal);
  const after = await verifyIdentity(client, state);
  if (!after.ok) return after;
  return invoked;
}

async function pollVisibility(client, expectedVisible, state) {
  let lastVisible = null;
  for (let index = 0; index < VISIBILITY_POLL_LIMIT; index += 1) {
    const outcome = await callMainWorld(client, VISIBILITY_FUNCTION_DECLARATION, state);
    if (!outcome.ok) {
      return {
        ok: false,
        errorCode: outcome.contextChanged
          ? PROBE_ERROR_CODES.CONTEXT_CHANGED
          : outcome.deadline
            ? PROBE_ERROR_CODES.DEADLINE
            : PROBE_ERROR_CODES.PROTOCOL,
        lastVisible,
      };
    }
    const decoded = remoteBoolean(outcome.value);
    if (!decoded.ok) {
      return {
        ok: false,
        errorCode: decoded.page ? PROBE_ERROR_CODES.PAGE : PROBE_ERROR_CODES.PROTOCOL,
        lastVisible,
      };
    }
    lastVisible = decoded.value;
    if (lastVisible === expectedVisible) return { ok: true, lastVisible };
    if (index + 1 < VISIBILITY_POLL_LIMIT) {
      const waited = await fixedWait(state.operationSignal);
      if (!waited) {
        return {
          ok: false,
          errorCode: PROBE_ERROR_CODES.DEADLINE,
          lastVisible,
        };
      }
    }
  }
  return { ok: false, errorCode: null, lastVisible };
}

async function attemptOpen(client, progress, state) {
  const action = await callEffectMainWorld(
    client,
    OPEN_FUNCTION_DECLARATION,
    state,
    () => {
      progress.editor_open_attempt_count += 1;
      state.phase = RUN_PHASE.OPEN;
      state.visibilityEvidence = VISIBILITY_EVIDENCE.UNKNOWN;
    },
  );
  if (!action.ok) {
    return {
      ok: false,
      errorCode: action.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : action.deadline
          ? PROBE_ERROR_CODES.OPEN_DEADLINE
          : PROBE_ERROR_CODES.OPEN_PROTOCOL,
    };
  }
  const decoded = remoteBoolean(action.value);
  if (!decoded.ok) {
    return {
      ok: false,
      errorCode: decoded.page
        ? PROBE_ERROR_CODES.OPEN_PAGE
        : PROBE_ERROR_CODES.OPEN_NON_BOOLEAN,
    };
  }
  if (decoded.value !== true) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.OPEN_ACTION_REJECTED };
  }
  const visible = await pollVisibility(client, true, state);
  if (!visible.ok) {
    state.visibilityEvidence = visible.lastVisible === false
      ? VISIBILITY_EVIDENCE.CLOSED
      : VISIBILITY_EVIDENCE.UNKNOWN;
    return {
      ok: false,
      errorCode: visible.errorCode === PROBE_ERROR_CODES.CONTEXT_CHANGED
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : visible.errorCode === PROBE_ERROR_CODES.DEADLINE
          ? PROBE_ERROR_CODES.OPEN_DEADLINE
          : visible.errorCode === PROBE_ERROR_CODES.PAGE
            ? PROBE_ERROR_CODES.OPEN_PAGE
            : visible.errorCode === PROBE_ERROR_CODES.PROTOCOL
              ? PROBE_ERROR_CODES.OPEN_PROTOCOL
              : PROBE_ERROR_CODES.OPEN_VISIBILITY_UNPROVEN,
    };
  }
  state.visibilityEvidence = VISIBILITY_EVIDENCE.OPEN;
  return { ok: true };
}

async function attemptClose(client, progress, state) {
  const action = await callEffectMainWorld(
    client,
    CLOSE_FUNCTION_DECLARATION,
    state,
    () => {
      progress.editor_close_attempt_count += 1;
      state.phase = RUN_PHASE.CLOSE;
      state.visibilityEvidence = VISIBILITY_EVIDENCE.UNKNOWN;
    },
  );
  if (!action.ok) {
    return {
      ok: false,
      errorCode: action.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : action.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.CLOSE,
    };
  }
  const decoded = remoteBoolean(action.value);
  if (!decoded.ok || decoded.value !== true) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.CLOSE };
  }
  const visible = await pollVisibility(client, false, state);
  if (!visible.ok) {
    state.visibilityEvidence = visible.lastVisible === true
      ? VISIBILITY_EVIDENCE.OPEN
      : VISIBILITY_EVIDENCE.UNKNOWN;
    return {
      ok: false,
      errorCode: visible.errorCode === PROBE_ERROR_CODES.CONTEXT_CHANGED
        || visible.errorCode === PROBE_ERROR_CODES.DEADLINE
        ? visible.errorCode
        : PROBE_ERROR_CODES.CLOSE,
    };
  }
  state.visibilityEvidence = VISIBILITY_EVIDENCE.CLOSED;
  return { ok: true };
}

async function observePostflightVisibility(client, state) {
  const observed = await callMainWorld(client, VISIBILITY_FUNCTION_DECLARATION, state);
  if (!observed.ok) {
    state.visibilityEvidence = VISIBILITY_EVIDENCE.UNKNOWN;
    return;
  }
  const decoded = remoteBoolean(observed.value);
  state.visibilityEvidence = !decoded.ok
    ? VISIBILITY_EVIDENCE.UNKNOWN
    : decoded.value
      ? VISIBILITY_EVIDENCE.OPEN
      : VISIBILITY_EVIDENCE.CLOSED;
}

async function runNormalProbeFlow(cdp, progress, state) {
  if (typeof cdp.List !== 'function') {
    state.phase = RUN_PHASE.MODULE;
    return { ok: false, errorCode: PROBE_ERROR_CODES.MODULE, probe: null };
  }
  state.phase = RUN_PHASE.SELECTION;
  const listed = await finiteOperation(
    () => cdp.List({ host: '127.0.0.1', port: 9222 }),
    state.operationSignal,
  );
  if (!listed.ok) {
    if (listed.deadline) state.phase = RUN_PHASE.BEFORE_OPEN;
    return {
      ok: false,
      errorCode: listed.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.TARGET_REJECTED,
      probe: null,
    };
  }
  if (!Array.isArray(listed.value)) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.TARGET_REJECTED, probe: null };
  }
  const matches = listed.value.map(normalizeListedTarget).filter(strictTargetPredicate);
  if (matches.length !== 1) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.TARGET_REJECTED, probe: null };
  }

  state.phase = RUN_PHASE.CONNECT;
  const connected = await finiteOperation(
    () => cdp({
      host: '127.0.0.1',
      port: 9222,
      target: PROBE_TARGET.id,
    }),
    state.operationSignal,
  );
  if (!connected.ok) {
    if (connected.deadline) state.phase = RUN_PHASE.BEFORE_OPEN;
    return {
      ok: false,
      errorCode: connected.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.CONNECT,
      probe: null,
    };
  }
  state.client = connected.value;
  const client = state.client;
  if (!client || !client.Runtime || !client.Page || !client.Target
    || typeof client.Runtime.callFunctionOn !== 'function'
    || typeof client.Target.getTargetInfo !== 'function'
    || typeof client.Page.getFrameTree !== 'function'
    || !installContextTracker(client, state)) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.CONNECT, probe: null };
  }
  const pageEnabled = await finiteOperation(() => client.Page.enable(), state.operationSignal);
  if (!pageEnabled.ok) {
    if (pageEnabled.deadline) state.phase = RUN_PHASE.BEFORE_OPEN;
    return {
      ok: false,
      errorCode: pageEnabled.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.CONNECT,
      probe: null,
    };
  }
  state.phase = RUN_PHASE.BEFORE_OPEN;
  const initialFrameTree = await finiteOperation(
    () => client.Page.getFrameTree(),
    state.operationSignal,
  );
  if (!initialFrameTree.ok) {
    return {
      ok: false,
      errorCode: initialFrameTree.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.CONTEXT_CHANGED,
      probe: null,
    };
  }
  const mainFrame = initialFrameTree.value
    && initialFrameTree.value.frameTree
    && initialFrameTree.value.frameTree.frame;
  if (!validMainFrame(mainFrame)) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.CONTEXT_CHANGED, probe: null };
  }
  state.mainFrame = { id: mainFrame.id, loaderId: mainFrame.loaderId };
  state.phase = RUN_PHASE.CONNECT;
  const runtimeEnabled = await finiteOperation(
    () => client.Runtime.enable(),
    state.operationSignal,
  );
  if (!runtimeEnabled.ok) {
    if (runtimeEnabled.deadline) state.phase = RUN_PHASE.BEFORE_OPEN;
    return {
      ok: false,
      errorCode: runtimeEnabled.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.CONNECT,
      probe: null,
    };
  }
  state.phase = RUN_PHASE.BEFORE_OPEN;
  if (!state.contextTracker.candidate) {
    const contextWait = await finiteOperation(
      () => state.contextTracker.contextPromise,
      state.operationSignal,
    );
    if (!contextWait.ok) {
      return {
        ok: false,
        errorCode: contextWait.deadline ? PROBE_ERROR_CODES.DEADLINE : PROBE_ERROR_CODES.CONTEXT_CHANGED,
        probe: null,
      };
    }
  }
  const context = state.contextTracker.candidate;
  if (!context || state.contextTracker.invalidated
    || typeof context.uniqueId !== 'string'
    || context.uniqueId.length === 0) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.CONTEXT_CHANGED, probe: null };
  }
  state.identity = Object.freeze({
    id: context.id,
    uniqueId: context.uniqueId,
    frameId: mainFrame.id,
    loaderId: mainFrame.loaderId,
  });
  state.contextTracker.currentUniqueId = context.uniqueId;

  state.phase = RUN_PHASE.PREFLIGHT;
  const preflight = await callMainWorld(client, PREFLIGHT_FUNCTION_DECLARATION, state);
  if (!preflight.ok) {
    if (preflight.contextChanged || preflight.deadline) state.phase = RUN_PHASE.BEFORE_OPEN;
    return {
      ok: false,
      errorCode: preflight.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : preflight.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.PREFLIGHT,
      probe: null,
    };
  }
  const preflightValue = remoteBoolean(preflight.value);
  if (!preflightValue.ok || preflightValue.value !== true) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.PREFLIGHT, probe: null };
  }
  state.visibilityEvidence = VISIBILITY_EVIDENCE.CLOSED;

  const closeCapability = await callMainWorld(
    client,
    CLOSE_CAPABILITY_FUNCTION_DECLARATION,
    state,
  );
  if (!closeCapability.ok) {
    if (closeCapability.contextChanged || closeCapability.identityCheck) {
      state.phase = RUN_PHASE.BEFORE_OPEN;
    }
    return {
      ok: false,
      errorCode: closeCapability.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : closeCapability.identityCheck && closeCapability.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.CLOSE_CAPABILITY,
      probe: null,
    };
  }
  const closeCapabilityValue = remoteBoolean(closeCapability.value);
  if (!closeCapabilityValue.ok || closeCapabilityValue.value !== true) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.CLOSE_CAPABILITY, probe: null };
  }

  state.phase = RUN_PHASE.BEFORE_OPEN;
  const opened = await attemptOpen(client, progress, state);
  if (!opened.ok) return { ok: false, errorCode: opened.errorCode, probe: null };

  const probed = await callEffectMainWorld(
    client,
    PROBE_FUNCTION_DECLARATION,
    state,
    () => {
      progress.probe_invocation_count += 1;
      state.phase = RUN_PHASE.PROBE;
    },
  );
  if (!probed.ok) {
    return {
      ok: false,
      errorCode: probed.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : probed.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.PROTOCOL,
      probe: null,
    };
  }
  if (probed.value === null || typeof probed.value !== 'object') {
    return { ok: false, errorCode: PROBE_ERROR_CODES.PROTOCOL, probe: null };
  }
  if (probed.value.exceptionDetails !== undefined) {
    return { ok: false, errorCode: PROBE_ERROR_CODES.PAGE, probe: null };
  }
  let safeProbe;
  try {
    safeProbe = validateProbeResult(probed.value.result && probed.value.result.value);
  } catch {
    return { ok: false, errorCode: PROBE_ERROR_CODES.INVALID, probe: null };
  }
  state.probe = safeProbe;

  const closed = await attemptClose(client, progress, state);
  if (!closed.ok) return { ok: false, errorCode: closed.errorCode, probe: safeProbe };

  state.phase = RUN_PHASE.POSTFLIGHT;
  const postflight = await callMainWorld(client, POSTFLIGHT_FUNCTION_DECLARATION, state);
  if (!postflight.ok) {
    if (!postflight.contextChanged && !postflight.deadline) {
      await observePostflightVisibility(client, state);
    }
    return {
      ok: false,
      errorCode: postflight.contextChanged
        ? PROBE_ERROR_CODES.CONTEXT_CHANGED
        : postflight.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.POSTFLIGHT,
      probe: safeProbe,
    };
  }
  const postflightValue = remoteBoolean(postflight.value);
  if (!postflightValue.ok || postflightValue.value !== true) {
    await observePostflightVisibility(client, state);
    return { ok: false, errorCode: PROBE_ERROR_CODES.POSTFLIGHT, probe: safeProbe };
  }
  state.visibilityEvidence = VISIBILITY_EVIDENCE.CLOSED;
  state.phase = RUN_PHASE.SUCCESS;
  return { ok: true, errorCode: null, probe: safeProbe };
}

async function executeLiveProbe(cdp, progress, workSignal) {
  const state = {
    client: null,
    contextTracker: null,
    identity: null,
    mainFrame: null,
    operationSignal: workSignal,
    phase: RUN_PHASE.MODULE,
    probe: null,
    visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
  };
  let flow = { ok: false, errorCode: PROBE_ERROR_CODES.INTERNAL, probe: null };
  let cleanupFailure = null;
  let originPhase = RUN_PHASE.INTERNAL;
  try {
    flow = await runNormalProbeFlow(cdp, progress, state);
    originPhase = state.phase;
  } catch {
    flow = { ok: false, errorCode: PROBE_ERROR_CODES.INTERNAL, probe: null };
    state.phase = RUN_PHASE.INTERNAL;
    originPhase = RUN_PHASE.INTERNAL;
  } finally {
    const cleanupController = new AbortController();
    const cleanupHandle = globalThis.setTimeout(
      () => cleanupController.abort(),
      CLEANUP_RESERVE_MS,
    );
    state.operationSignal = cleanupController.signal;
    try {
      if (state.client && progress.editor_open_attempt_count === 1
        && progress.editor_close_attempt_count === 0) {
        const closed = await attemptClose(state.client, progress, state);
        if (!closed.ok) cleanupFailure = closed.errorCode;
      }
      if (state.client && state.client.Runtime
        && typeof state.client.Runtime.releaseObjectGroup === 'function') {
        const released = await finiteOperation(() => state.client.Runtime.releaseObjectGroup({
          objectGroup: OBJECT_GROUP,
        }), cleanupController.signal);
        if (!released.ok) cleanupFailure = released.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.DETACH;
      }
      if (state.client) removeContextTracker(state.client, state.contextTracker);
      if (state.client && typeof state.client.close === 'function') {
        const detached = await finiteOperation(
          () => state.client.close(),
          cleanupController.signal,
        );
        if (!detached.ok) cleanupFailure = detached.deadline
          ? PROBE_ERROR_CODES.DEADLINE
          : PROBE_ERROR_CODES.DETACH;
      }
    } finally {
      globalThis.clearTimeout(cleanupHandle);
    }
  }

  if (cleanupFailure === PROBE_ERROR_CODES.DETACH || cleanupFailure === PROBE_ERROR_CODES.DEADLINE) {
    if (flow.ok || cleanupFailure === PROBE_ERROR_CODES.DETACH) {
      state.phase = RUN_PHASE.DETACH;
      return {
        payload: safeFailure(
          cleanupFailure,
          progress,
          state.phase,
          state.visibilityEvidence,
          flow.probe,
        ),
        phase: state.phase,
        visibilityEvidence: state.visibilityEvidence,
      };
    }
  }
  const payload = flow.ok
    ? safeSuccess(progress, originPhase, state.visibilityEvidence, flow.probe)
    : safeFailure(
      flow.errorCode,
      progress,
      originPhase,
      state.visibilityEvidence,
      flow.probe,
    );
  return {
    payload,
    phase: originPhase,
    visibilityEvidence: state.visibilityEvidence,
  };
}

async function executeMain(argv, progress) {
  const workController = new AbortController();
  const workHandle = globalThis.setTimeout(
    () => workController.abort(),
    WORK_DEADLINE_MS,
  );
  try {
    const parsed = parseArguments(argv);
    if (parsed.kind === 'failure') {
      return {
        kind: 'main',
        payload: safeFailure(
          parsed.errorCode,
          progress,
          RUN_PHASE.ARGUMENT,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.ARGUMENT,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }
    if (parsed.kind === 'approval') {
      try {
        return {
          kind: 'approval',
          payload: await buildApprovalEnvelope(actualReadFile),
          exitCode: 0,
        };
      } catch {
        return {
          kind: 'main',
          payload: safeFailure(
            PROBE_ERROR_CODES.INTERNAL,
            progress,
            RUN_PHASE.INTERNAL,
            VISIBILITY_EVIDENCE.UNKNOWN,
          ),
          phase: RUN_PHASE.INTERNAL,
          visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
          exitCode: 1,
        };
      }
    }

    let actualDigest;
    try {
      actualDigest = await computeSha256With(actualReadFile);
    } catch {
      return {
        kind: 'main',
        payload: safeFailure(
          PROBE_ERROR_CODES.INTERNAL,
          progress,
          RUN_PHASE.INTERNAL,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.INTERNAL,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }
    if (!digestMatches(actualDigest, parsed.digest)) {
      return {
        kind: 'main',
        payload: safeFailure(
          PROBE_ERROR_CODES.DIGEST,
          progress,
          RUN_PHASE.DIGEST,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.DIGEST,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }

    const approvalConsumed = await consumeApprovalLease(
      process.env[APPROVAL_FILE_ENV],
      actualDigest,
    );
    if (!approvalConsumed) {
      return {
        kind: 'main',
        payload: safeFailure(
          PROBE_ERROR_CODES.APPROVAL,
          progress,
          RUN_PHASE.APPROVAL,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.APPROVAL,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }

    let cdpModule;
    try {
      cdpModule = await import('chrome-remote-interface');
    } catch {
      return {
        kind: 'main',
        payload: safeFailure(
          PROBE_ERROR_CODES.MODULE,
          progress,
          RUN_PHASE.MODULE,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.MODULE,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }
    if (typeof cdpModule.default !== 'function') {
      return {
        kind: 'main',
        payload: safeFailure(
          PROBE_ERROR_CODES.MODULE,
          progress,
          RUN_PHASE.MODULE,
          VISIBILITY_EVIDENCE.UNKNOWN,
        ),
        phase: RUN_PHASE.MODULE,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }
    const liveOutcome = await executeLiveProbe(
      cdpModule.default,
      progress,
      workController.signal,
    );
    return {
      kind: 'main',
      ...liveOutcome,
      exitCode: liveOutcome.payload.success ? 0 : 1,
    };
  } finally {
    globalThis.clearTimeout(workHandle);
  }
}

function runCli() {
  const progress = createProgressRecord();
  let emitted = false;
  let exited = false;

  const emit = (payload, exitCode) => {
    if (emitted) return;
    emitted = true;
    let serialized;
    try {
      serialized = `${JSON.stringify(payload)}\n`;
    } catch {
      serialized = `${JSON.stringify(internalTerminalPayload(progress))}\n`;
      exitCode = 1;
    }
    let fallbackHandle;
    const finish = () => {
      if (exited) return;
      exited = true;
      globalThis.clearTimeout(fallbackHandle);
      process.exit(exitCode);
    };
    fallbackHandle = globalThis.setTimeout(finish, CLI_FLUSH_FALLBACK_MS);
    try {
      process.stdout.write(serialized, finish);
    } catch {
      finish();
    }
  };

  const hardHandle = globalThis.setTimeout(() => {
    if (emitted) return;
    try {
      emit(hardDeadlinePayload(progress), HARD_DEADLINE_EXIT_CODE);
    } catch {
      emit(internalTerminalPayload(progress), 1);
    }
  }, TOTAL_HARD_DEADLINE_MS);

  const settle = async () => {
    let outcome;
    try {
      outcome = await executeMain(process.argv.slice(2), progress);
    } catch {
      outcome = {
        kind: 'main',
        payload: internalTerminalPayload(progress),
        phase: RUN_PHASE.INTERNAL,
        visibilityEvidence: VISIBILITY_EVIDENCE.UNKNOWN,
        exitCode: 1,
      };
    }
    if (emitted) return;
    globalThis.clearTimeout(hardHandle);
    if (outcome.kind === 'approval') {
      emit(outcome.payload, outcome.exitCode);
      return;
    }
    try {
      emit(validateSafeMainPayload(
        outcome.payload,
        outcome.phase,
        outcome.visibilityEvidence,
      ), outcome.exitCode);
    } catch {
      emit(internalTerminalPayload(progress), 1);
    }
  };
  settle();
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli();
}
