import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod, lstat, mkdir, mkdtemp, open, readFile, readlink, rename, rm, stat, symlink, unlink, writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { types } from 'node:util';
import vm from 'node:vm';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const ARTIFACT_PATH = resolve(REPO_ROOT, 'scripts/pine_discovery_gate_a1.mjs');
const ARTIFACT_URL = pathToFileURL(ARTIFACT_PATH).href;
const APPROVAL_ARTIFACT_PATH = resolve(REPO_ROOT, 'docs/gate-a1-close-strategy-approval.md');
const TEST_HOST_PATH = resolve(REPO_ROOT, 'tests/pine_discovery_gate_a0.spec.mjs');
const CHILD_FIXTURE_PATH = resolve(REPO_ROOT, 'tests/fixtures/pine_discovery_gate_a0_child.mjs');
const SPENT_REGISTRY_PATH = resolve(REPO_ROOT, '.git/tradingview-mcp-gate-a1/spent');

const EXPECTED_EXPORTS = Object.freeze([
  'CLEANUP_RESERVE_MS',
  'CLI_FLUSH_FALLBACK_MS',
  'HARD_DEADLINE_EXIT_CODE',
  'OPERATION_DEADLINE_MS',
  'PROBE_BUDGET',
  'PROBE_CANDIDATE_ERROR_CODES',
  'PROBE_CANDIDATE_PATHS',
  'PROBE_CANDIDATE_VALUE_TYPES',
  'PROBE_ERROR_CODES',
  'PROBE_FUNCTION_DECLARATION',
  'PROBE_TARGET',
  'TOTAL_HARD_DEADLINE_MS',
  'WORK_DEADLINE_MS',
  'buildApprovalEnvelope',
  'computeProbeSelfSha256',
  'validateProbeResult',
  'consumeApprovalLease',
]);

const EXPECTED_TARGET = Object.freeze({
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

const EXPECTED_BUDGET = Object.freeze({
  open: 1,
  probe: 1,
  close: 1,
  retry: 0,
  fallback: 0,
});

const EXPECTED_CANDIDATE_PATHS = Object.freeze([
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

const EXPECTED_CANDIDATE_VALUE_TYPES = Object.freeze([
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

const EXPECTED_CANDIDATE_ERROR_CODES = Object.freeze({
  NONE: 'NONE',
  MEMBER_MISSING: 'MEMBER_MISSING',
  ACCESSOR_SKIPPED: 'ACCESSOR_SKIPPED',
  READ_FAILED: 'READ_FAILED',
  VALUE_UNAVAILABLE: 'VALUE_UNAVAILABLE',
  UNSTABLE: 'UNSTABLE',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
});

const EXPECTED_ERROR_CODES = Object.freeze({
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

const STATIC_EXPORTS = Object.freeze({
  'node:crypto': Object.freeze({ createHash, timingSafeEqual }),
  'node:fs': Object.freeze({ constants }),
  'node:fs/promises': Object.freeze({ lstat, mkdir, open, readFile, readlink, stat }),
  'node:path': Object.freeze({ basename, dirname, resolve }),
  'node:url': Object.freeze({ fileURLToPath: (await import('node:url')).fileURLToPath }),
  'node:util': Object.freeze({ types }),
});

async function readArtifactSource() {
  try {
    return await readFile(ARTIFACT_PATH, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const missing = new Error(`Cannot find module '${ARTIFACT_PATH}'`);
      missing.code = 'ERR_MODULE_NOT_FOUND';
      throw missing;
    }
    throw error;
  }
}

function createProcessStub(
  argv = [process.execPath, TEST_HOST_PATH],
  { stdoutCallbackMode = 'fire', env = {} } = {},
) {
  const state = {
    stdoutWrites: [],
    stdoutCallbacks: 0,
    stderrWrites: [],
    exits: [],
  };
  let resolveExit;
  const exitPromise = new Promise((resolvePromise) => {
    resolveExit = resolvePromise;
  });
  const stdout = Object.freeze({
    write(chunk, encoding, callback) {
      state.stdoutWrites.push(String(chunk));
      const completion = typeof encoding === 'function' ? encoding : callback;
      if (typeof completion === 'function') {
        state.stdoutCallbacks += 1;
        if (stdoutCallbackMode === 'fire') queueMicrotask(completion);
      }
      return true;
    },
  });
  const stderr = Object.freeze({
    write(chunk) {
      state.stderrWrites.push(String(chunk));
      return true;
    },
  });
  const processStub = Object.freeze({
    argv: Object.freeze([...argv]),
    env: Object.freeze({ ...env }),
    execPath: process.execPath,
    stdout,
    stderr,
    exit(code) {
      state.exits.push(code);
      resolveExit(code);
    },
  });
  return { processStub, state, exitPromise };
}

function createTimerHarness(observer) {
  const state = { setCalls: 0, clearCalls: 0 };
  const delayByHandle = new Map();
  const untrack = (handle) => {
    const originalDelay = delayByHandle.get(handle);
    if (originalDelay === undefined) return;
    delayByHandle.delete(handle);
    if (observer && originalDelay === 100) observer.pendingDelay100 -= 1;
  };
  const mapDelay = (delay) => {
    if (delay === 1000) return 20;
    if (delay === 20000) return 200;
    if (delay === 10000) return 100;
    if (delay === 30000) return 300;
    if (delay === 100) return 2;
    return Math.min(Number(delay) || 0, 5);
  };
  return {
    state,
    setTimeout(callback, delay, ...args) {
      state.setCalls += 1;
      if (delay === 100) {
        const handle = { logicalDelay100: true, cancelled: false };
        delayByHandle.set(handle, delay);
        if (observer) observer.pendingDelay100 += 1;
        queueMicrotask(() => {
          if (handle.cancelled) return;
          untrack(handle);
          callback(...args);
        });
        return handle;
      }
      let handle;
      handle = globalThis.setTimeout((...callbackArgs) => {
        untrack(handle);
        callback(...callbackArgs);
      }, mapDelay(delay), ...args);
      delayByHandle.set(handle, delay);
      if (observer && delay === 100) observer.pendingDelay100 += 1;
      return handle;
    },
    clearTimeout(handle) {
      state.clearCalls += 1;
      if (handle && handle.logicalDelay100 === true) {
        handle.cancelled = true;
        untrack(handle);
        return undefined;
      }
      untrack(handle);
      return globalThis.clearTimeout(handle);
    },
  };
}

async function createSyntheticModule(context, specifier) {
  const exportsForModule = STATIC_EXPORTS[specifier];
  if (!exportsForModule) {
    const error = new Error(`Static import rejected: ${specifier}`);
    error.code = 'ERR_STATIC_IMPORT_REJECTED';
    throw error;
  }
  const exportNames = Object.keys(exportsForModule);
  const module = new vm.SyntheticModule(
    exportNames,
    function setSyntheticExports() {
      for (const name of exportNames) this.setExport(name, exportsForModule[name]);
    },
    { context, identifier: `synthetic:${specifier}` },
  );
  await module.link(() => {
    throw new Error('Synthetic modules have no dependencies');
  });
  await module.evaluate();
  return module;
}

async function createDynamicCdpModule(context, defaultExport) {
  const module = new vm.SyntheticModule(
    ['default'],
    function setDefaultExport() {
      this.setExport('default', defaultExport);
    },
    { context, identifier: 'synthetic:chrome-remote-interface' },
  );
  await module.link(() => {
    throw new Error('Synthetic CDP module has no dependencies');
  });
  await module.evaluate();
  return module;
}

async function evaluateSource(source, {
  identifier = ARTIFACT_URL,
  argv = [process.execPath, TEST_HOST_PATH],
  dynamicModuleFactory,
  stdoutCallbackMode = 'fire',
  timerObserver,
  env,
} = {}) {
  const processHarness = createProcessStub(argv, { stdoutCallbackMode, env });
  const timerHarness = createTimerHarness(timerObserver);
  const state = processHarness.state;
  state.dynamicImportCount = 0;
  state.networkCalls = 0;
  const context = vm.createContext({
    AbortController,
    Buffer,
    TextDecoder,
    TextEncoder,
    URL,
    clearTimeout: timerHarness.clearTimeout,
    process: processHarness.processStub,
    queueMicrotask,
    setTimeout: timerHarness.setTimeout,
  });
  const module = new vm.SourceTextModule(source, {
    context,
    identifier,
    initializeImportMeta(meta) {
      meta.url = identifier;
    },
    async importModuleDynamically(specifier) {
      state.dynamicImportCount += 1;
      if (specifier !== 'chrome-remote-interface' || typeof dynamicModuleFactory !== 'function') {
        throw new Error(`Dynamic import rejected: ${specifier}`);
      }
      return dynamicModuleFactory(context);
    },
  });
  await module.link((specifier) => createSyntheticModule(context, specifier));
  await module.evaluate();
  state.timerCalls = timerHarness.state;
  return {
    context,
    module,
    namespace: module.namespace,
    state,
    exitPromise: processHarness.exitPromise,
  };
}

async function loadArtifact(options) {
  const source = await readArtifactSource();
  return { source, ...(await evaluateSource(source, options)) };
}

function independentArtifactDigest(source) {
  return createHash('sha256').update(Buffer.from(source)).digest('hex');
}

function changeDigestNibble(digest) {
  const replacement = digest[0] === '0' ? '1' : '0';
  return replacement + digest.slice(1);
}

async function awaitExit(exitPromise, label) {
  let timeoutHandle;
  try {
    return await Promise.race([
      exitPromise,
      new Promise((_, reject) => {
        timeoutHandle = globalThis.setTimeout(
          () => reject(new Error(`CLI exitPromise did not settle: ${label}`)),
          500,
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

async function runArtifactCli(cliArgs, {
  dynamicDefault = Object.freeze({}),
  dynamicModuleFactory,
  stdoutCallbackMode = 'fire',
  timerObserver,
  env,
} = {}) {
  const result = await loadArtifact({
    argv: [process.execPath, ARTIFACT_PATH, ...cliArgs],
    dynamicModuleFactory: dynamicModuleFactory
      ?? ((context) => createDynamicCdpModule(context, dynamicDefault)),
    stdoutCallbackMode,
    timerObserver,
    env,
  });
  const exitCode = await awaitExit(result.exitPromise, cliArgs.join(' ') || '<no-args>');
  return {
    ...result,
    exitCode,
    parsed: result.state.stdoutWrites.length === 1
      ? JSON.parse(result.state.stdoutWrites[0])
      : null,
  };
}

function assertDeepFrozen(value, path = 'value') {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const key of Reflect.ownKeys(value)) {
    assertDeepFrozen(value[key], `${path}.${String(key)}`);
  }
}

function toHostPlain(value) {
  if (Array.isArray(value)) return Array.from(value, toHostPlain);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, toHostPlain(value[key])]));
  }
  return value;
}

function makeCandidate(index, overrides = {}) {
  const [signal, owner, member] = EXPECTED_CANDIDATE_PATHS[index];
  return {
    signal,
    owner,
    member,
    available: true,
    value_type: EXPECTED_CANDIDATE_VALUE_TYPES[index][0],
    stable: true,
    read_count: 2,
    error_code: EXPECTED_CANDIDATE_ERROR_CODES.NONE,
    ...overrides,
  };
}

function makeValidProbeResult(candidateOverrides = new Map()) {
  return {
    contract: 'gate-a0-v1',
    success: true,
    editor_found: true,
    candidate_count: EXPECTED_CANDIDATE_PATHS.length,
    candidates: EXPECTED_CANDIDATE_PATHS.map((_, index) =>
      makeCandidate(index, candidateOverrides.get(index))),
    error_code: null,
  };
}

function makeUniformProbeFailure({ editorFound, errorCode, candidateError }) {
  const state = candidateError === EXPECTED_CANDIDATE_ERROR_CODES.MEMBER_MISSING
    ? { available: false, value_type: 'missing', stable: false, read_count: 0 }
    : { available: false, value_type: 'unavailable', stable: false, read_count: 0 };
  return {
    contract: 'gate-a0-v1',
    success: false,
    editor_found: editorFound,
    candidate_count: EXPECTED_CANDIDATE_PATHS.length,
    candidates: EXPECTED_CANDIDATE_PATHS.map((_, index) => makeCandidate(index, {
      ...state,
      error_code: candidateError,
    })),
    error_code: errorCode,
  };
}

function createProbeEnvironment({
  editorFound = true,
  reactValue,
  modelOverrides = {},
  rootOverride,
} = {}) {
  const calls = {
    click: 0,
    fetch: 0,
    focus: 0,
    getAlternativeVersionId: 0,
    getDomNode: 0,
    getEditors: 0,
    getModel: 0,
    getValue: 0,
    getVersionId: 0,
    setValue: 0,
    storageWrite: 0,
    unknownFunction: 0,
  };
  const root = rootOverride ?? {
    parentElement: null,
    click() { calls.click += 1; },
    focus() { calls.focus += 1; },
    unknownFunction() { calls.unknownFunction += 1; },
  };
  const safeReactValue = reactValue ?? {
    scriptId: 'SCRIPT_ID_SENTINEL',
    _scriptId: 'SCRIPT_ID_PRIVATE_SENTINEL',
    dirty: false,
    _dirty: false,
    persistenceMode: 'manual-save',
    autoSave: false,
    cloudVersion: 'CLOUD_VERSION_SENTINEL',
    unknownFunction() { calls.unknownFunction += 1; },
  };
  const fiber = {
    memoizedProps: { pineState: safeReactValue },
    memoizedState: null,
    return: null,
    unknownFunction() { calls.unknownFunction += 1; },
  };
  Object.defineProperty(root, '__reactFiber$gateA0', {
    configurable: true,
    enumerable: true,
    value: fiber,
  });
  const uri = Object.freeze({
    raw: 'MODEL_URI_SENTINEL',
    toJSON() { throw new Error('URI toJSON must not run'); },
    toString() { throw new Error('URI toString must not run'); },
  });
  const model = {
    uri,
    getValue() {
      calls.getValue += 1;
      return 'PINE_SOURCE_SENTINEL';
    },
    getVersionId() {
      calls.getVersionId += 1;
      return 41;
    },
    getAlternativeVersionId() {
      calls.getAlternativeVersionId += 1;
      return 37;
    },
    setValue() { calls.setValue += 1; },
    unknownFunction() { calls.unknownFunction += 1; },
    ...modelOverrides,
  };
  const editor = {
    getDomNode() {
      calls.getDomNode += 1;
      return root;
    },
    getModel() {
      calls.getModel += 1;
      return model;
    },
    focus() { calls.focus += 1; },
    unknownFunction() { calls.unknownFunction += 1; },
  };
  const monaco = {
    editor: {
      getEditors() {
        calls.getEditors += 1;
        return [editor];
      },
      unknownFunction() { calls.unknownFunction += 1; },
    },
  };
  const storage = {};
  Object.defineProperty(storage, 'gateA0', {
    set() { calls.storageWrite += 1; },
  });
  const context = vm.createContext({
    document: {
      querySelector(selector) {
        assert.equal(selector, '.monaco-editor.pine-editor-monaco');
        return editorFound ? root : null;
      },
    },
    fetch() { calls.fetch += 1; },
    localStorage: storage,
    window: { monaco },
  });
  return { calls, context, editor, fiber, model, root, safeReactValue };
}

function executeProbeClosure(declaration, environment) {
  return vm.runInContext(`(${declaration})()`, environment.context, { timeout: 100 });
}

function classifyDeclaration(functionDeclaration, probeDeclaration) {
  if (functionDeclaration === probeDeclaration) return 'probe';
  for (const [marker, name] of [
    ['gate-a0-preflight-v1', 'preflight'],
    ['gate-a1-close-capability-v1', 'close-capability'],
    ['gate-a0-open-v1', 'open'],
    ['gate-a0-close-v1', 'close'],
    ['gate-a0-postflight-v1', 'postflight'],
    ['gate-a0-visibility-v1', 'visibility'],
  ]) {
    if (functionDeclaration.includes(marker)) return name;
  }
  return 'unknown';
}

function createFakeCdp({
  mode = 'success',
  probeDeclaration,
  targetOverrides,
  targetList,
  afterActionDrift,
  identityFault,
} = {}) {
  const listTarget = {
    id: EXPECTED_TARGET.id,
    type: 'page',
    url: 'https://www.tradingview.com/chart/gate-a0/',
    ...targetOverrides,
  };
  const protocolTarget = {
    targetId: listTarget.id,
    type: listTarget.type,
    url: listTarget.url,
  };
  const calls = {
    actionOrder: [],
    callFunctionOn: [],
    closeActionCalls: 0,
    connectArgs: [],
    connectCount: 0,
    inputCalls: 0,
    identityFaultCount: 0,
    frameTreeCount: 0,
    listenerAdds: [],
    listenerRemoves: [],
    listCount: 0,
    openActionCalls: 0,
    releaseCount: 0,
    showWidgetCalls: 0,
    targetInfoCount: 0,
    trace: [],
    visibilityAfterClose: 0,
    visibilityAfterOpen: 0,
  };
  let visibilityPhase = 'initial';
  let currentTarget = { ...protocolTarget };
  let currentFrame = { id: 'frame-main', loaderId: 'loader-main' };
  let currentContext = {
    id: 7,
    uniqueId: 'unique-main',
    auxData: { isDefault: true, frameId: 'frame-main' },
  };
  let identityFaultTriggered = false;
  const listeners = new Map();

  function emitEvent(name, payload) {
    const handlers = listeners.get(name) ?? [];
    for (const handler of [...handlers]) handler(payload);
  }

  function applyAfterActionDrift(action) {
    if (!afterActionDrift || afterActionDrift.after !== action) return;
    if (afterActionDrift.kind === 'target') {
      currentTarget = { ...currentTarget, ...afterActionDrift.patch };
    } else if (afterActionDrift.kind === 'frame') {
      currentFrame = { ...currentFrame, ...afterActionDrift.patch };
    } else if (afterActionDrift.kind === 'destroy') {
      emitEvent('Runtime.executionContextDestroyed', {
        executionContextId: currentContext.id,
        executionContextUniqueId: currentContext.uniqueId,
      });
    } else if (afterActionDrift.kind === 'clear') {
      emitEvent('Runtime.executionContextsCleared', {});
    } else if (afterActionDrift.kind === 'frame-navigate') {
      currentFrame = { ...currentFrame, loaderId: 'loader-drifted' };
      emitEvent('Page.frameNavigated', { frame: { ...currentFrame } });
    } else if (afterActionDrift.kind === 'context-reuse') {
      currentContext = { ...currentContext, uniqueId: 'unique-reused' };
      emitEvent('Runtime.executionContextCreated', { context: { ...currentContext } });
    }
  }

  function neverSettles() {
    return new Promise(() => {});
  }

  function throwingVisibilityResponse(functionDeclaration) {
    const value = vm.runInNewContext(`(${functionDeclaration})()`, {
      document: {
        querySelector() {
          throw new Error('RAW_VISIBILITY_QUERY_SENTINEL');
        },
      },
    });
    return {
      result: typeof value === 'boolean'
        ? { type: 'boolean', value }
        : { type: 'object', value },
    };
  }

  const Runtime = {
    async enable() {},
    async evaluate() { calls.inputCalls += 1; },
    async callFunctionOn(params) {
      calls.callFunctionOn.push(params);
      const action = classifyDeclaration(params.functionDeclaration, probeDeclaration);
      calls.trace.push(action);
      if (action !== 'visibility') calls.actionOrder.push(action);
      if (action === 'preflight') {
        let response;
        if (mode === 'preflight-missing') response = {};
        else if (mode === 'preflight-wrong-type') response = { result: { type: 'string', value: 'true' } };
        else if (mode === 'preflight-false') response = { result: { type: 'boolean', value: false } };
        else response = { result: { type: 'boolean', value: true } };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'close-capability') {
        if (mode === 'close-capability-throw') throw new Error('RAW_CLOSE_CAPABILITY_SENTINEL');
        if (mode === 'close-capability-hang') return neverSettles();
        if (mode === 'close-capability-missing'
          || mode === 'close-capability-disappear') {
          return { result: { type: 'boolean', value: false } };
        }
        if (mode === 'close-capability-nonboolean') {
          return { result: { type: 'string', value: 'true' } };
        }
        const response = { result: { type: 'boolean', value: true } };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'open') {
        calls.openActionCalls += 1;
        visibilityPhase = 'after-open';
        if (mode === 'open-throw' || mode === 'open-throw-close-visible') {
          throw new Error('RAW_OPEN_SENTINEL');
        }
        if (mode === 'open-hang') return neverSettles();
        if (mode === 'open-false') return { result: { type: 'boolean', value: false } };
        if (mode === 'open-nonboolean') return { result: { type: 'string', value: 'true' } };
        if (mode === 'open-page') return { exceptionDetails: { text: 'RAW_OPEN_PAGE_SENTINEL' } };
        const response = { result: { type: 'boolean', value: true } };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'probe') {
        if (mode === 'probe-throw') throw new Error('RAW_PROBE_SENTINEL');
        if (mode === 'probe-page') {
          return { exceptionDetails: { text: 'RAW_PAGE_SENTINEL' } };
        }
        const response = { result: { type: 'object', value: makeValidProbeResult() } };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'close') {
        calls.closeActionCalls += 1;
        visibilityPhase = 'after-close';
        if (mode === 'close-throw') throw new Error('RAW_CLOSE_SENTINEL');
        if (mode === 'close-hang') return neverSettles();
        if (mode === 'close-false') return { result: { type: 'boolean', value: false } };
        const response = { result: { type: 'boolean', value: true } };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'postflight') {
        const response = {
          result: {
            type: 'boolean',
            value: ![
              'postflight-symbol-mismatch',
              'postflight-visibility-true',
              'postflight-visibility-failure',
              'postflight-visibility-query-throw-detach',
            ].includes(mode),
          },
        };
        applyAfterActionDrift(action);
        return response;
      }
      if (action === 'visibility') {
        if (visibilityPhase === 'after-open') {
          calls.visibilityAfterOpen += 1;
          if (mode === 'open-visibility-query-throw') {
            return throwingVisibilityResponse(params.functionDeclaration);
          }
          if (mode === 'open-visibility-page') {
            return { exceptionDetails: { text: 'RAW_OPEN_VISIBILITY_PAGE_SENTINEL' } };
          }
          if (mode === 'open-visibility-protocol') return {};
          if (mode === 'open-visibility-unproven') {
            return { result: { type: 'boolean', value: false } };
          }
          const visible = mode === 'visibility-open-delayed'
            ? calls.visibilityAfterOpen >= 8
            : true;
          return { result: { type: 'boolean', value: visible } };
        }
        if (visibilityPhase === 'after-close') {
          calls.visibilityAfterClose += 1;
          if (mode === 'open-visibility-query-throw') {
            return throwingVisibilityResponse(params.functionDeclaration);
          }
          if (calls.visibilityAfterClose === 1 && mode === 'close-visibility-query-throw') {
            return throwingVisibilityResponse(params.functionDeclaration);
          }
          if (calls.visibilityAfterClose === 1 && mode === 'close-visibility-page') {
            return { exceptionDetails: { text: 'RAW_CLOSE_VISIBILITY_SENTINEL' } };
          }
          if (calls.visibilityAfterClose === 1 && mode === 'close-visibility-nonboolean') {
            return { result: { type: 'object', value: null } };
          }
          if (calls.visibilityAfterClose > 1
            && mode === 'postflight-visibility-query-throw-detach') {
            return throwingVisibilityResponse(params.functionDeclaration);
          }
          if (mode === 'open-throw-close-visible') {
            return { result: { type: 'boolean', value: true } };
          }
          if (calls.visibilityAfterClose > 1 && mode === 'postflight-visibility-failure') {
            throw new Error('RAW_POSTFLIGHT_VISIBILITY_SENTINEL');
          }
          if (calls.visibilityAfterClose > 1 && mode === 'postflight-visibility-true') {
            return { result: { type: 'boolean', value: true } };
          }
          const visible = mode === 'visibility-close-delayed'
            ? calls.visibilityAfterClose < 8
            : false;
          return { result: { type: 'boolean', value: visible } };
        }
        return { result: { type: 'boolean', value: false } };
      }
      throw new Error('RAW_UNKNOWN_DECLARATION_SENTINEL');
    },
    async releaseObjectGroup() {
      calls.releaseCount += 1;
      calls.actionOrder.push('release');
    },
  };
  Runtime.enable = async () => {
    if (mode === 'enable-hang') return neverSettles();
    if (mode !== 'context-wait-hang') {
      emitEvent('Runtime.executionContextCreated', { context: { ...currentContext } });
    }
  };
  const Page = {
    async enable() {},
    async reload() { calls.inputCalls += 1; },
    async getFrameTree() {
      calls.frameTreeCount += 1;
      calls.trace.push('frame-tree');
      return { frameTree: { frame: { ...currentFrame } } };
    },
  };
  const Target = {
    async getTargetInfo() {
      calls.targetInfoCount += 1;
      calls.trace.push('target-info');
      const faultCall = identityFault?.boundary === 'pre-open'
        ? 3
        : identityFault?.boundary === 'pre-probe'
          ? 7
          : -1;
      const faultActive = calls.targetInfoCount === faultCall
        || (identityFaultTriggered && identityFault?.cleanup === 'reject');
      if (faultActive) {
        identityFaultTriggered = true;
        calls.identityFaultCount += 1;
        if (identityFault.kind === 'timeout' && calls.targetInfoCount === faultCall) {
          return neverSettles();
        }
        return {
          targetInfo: {
            ...currentTarget,
            targetId: `${EXPECTED_TARGET.id}0`,
          },
        };
      }
      return { targetInfo: { ...currentTarget } };
    },
  };
  const client = {
    Page,
    Runtime,
    Target,
    Input: {
      async dispatchKeyEvent() { calls.inputCalls += 1; },
    },
    on(name, handler) {
      calls.listenerAdds.push(name);
      const handlers = listeners.get(name) ?? [];
      handlers.push(handler);
      listeners.set(name, handlers);
      return this;
    },
    removeListener(name, handler) {
      calls.listenerRemoves.push(name);
      const handlers = listeners.get(name) ?? [];
      listeners.set(name, handlers.filter((candidate) => candidate !== handler));
      return this;
    },
    async close() {
      calls.actionOrder.push('detach');
      if (mode === 'detach-throw' || mode === 'postflight-visibility-query-throw-detach') {
        throw new Error('RAW_DETACH_SENTINEL');
      }
      if (mode === 'detach-hang') return neverSettles();
    },
  };
  async function cdp(options) {
    calls.connectCount += 1;
    calls.connectArgs.push(options);
    calls.actionOrder.push('connect');
    return client;
  }
  cdp.List = async () => {
    calls.listCount += 1;
    calls.actionOrder.push('List');
    return targetList ?? [{ ...listTarget }];
  };
  return {
    calls,
    cdp,
    client,
    emitEvent,
    get currentContext() { return currentContext; },
    get currentFrame() { return currentFrame; },
    get currentTarget() { return currentTarget; },
    target: listTarget,
  };
}

let approvalFixtureCounter = 0;

async function createApprovalFixture(digest, patch = {}) {
  const directory = await mkdtemp('/tmp/tradingview-a1-approval-');
  const approvalPath = resolve(directory, 'approval.json');
  const now = Date.now();
  approvalFixtureCounter += 1;
  const approval = {
    schema_version: 1,
    nonce: createHash('sha256').update(`${directory}:${approvalFixtureCounter}`).digest('hex'),
    bundle_sha256: digest,
    target_id: EXPECTED_TARGET.id,
    exact_command: `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=${digest}`,
    issued_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    initial_tuple: {
      symbol: EXPECTED_TARGET.symbol,
      resolution: EXPECTED_TARGET.resolution,
      chart_type: EXPECTED_TARGET.chart_type,
      study_count: EXPECTED_TARGET.study_count,
      shape_count: EXPECTED_TARGET.shape_count,
      replay_started: EXPECTED_TARGET.replay_started,
      bottom_widget_open: EXPECTED_TARGET.bottom_widget_open,
      pine_editor_open: EXPECTED_TARGET.pine_editor_open,
    },
    budgets: { ...EXPECTED_BUDGET },
    ...patch,
  };
  await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
  await chmod(approvalPath, 0o600);
  const nonceHash = createHash('sha256').update(approval.nonce).digest('hex');
  return {
    approval,
    approvalPath,
    directory,
    spentPath: resolve(SPENT_REGISTRY_PATH, `${nonceHash}.json`),
  };
}

async function cleanupApprovalFixture(fixture) {
  await unlink(fixture.spentPath).catch((error) => {
    if (!error || error.code !== 'ENOENT') throw error;
  });
  await rm(fixture.directory, { recursive: true, force: true });
}

async function runDScenario(mode, options = {}) {
  const { timerObserver, ...fakeOptions } = options;
  const importOnly = await loadArtifact();
  const digest = independentArtifactDigest(importOnly.source);
  const fake = createFakeCdp({
    mode,
    probeDeclaration: importOnly.namespace.PROBE_FUNCTION_DECLARATION,
    ...fakeOptions,
  });
  const fixture = await createApprovalFixture(digest);
  try {
    const result = await runArtifactCli(
      [`--bundle-sha256=${digest}`],
      {
        dynamicDefault: fake.cdp,
        timerObserver,
        env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath },
      },
    );
    return { ...result, fake, probeDeclaration: importOnly.namespace.PROBE_FUNCTION_DECLARATION };
  } finally {
    await cleanupApprovalFixture(fixture);
  }
}

function assertExactLedger(payload, open, probe, close) {
  assert.deepEqual(toHostPlain(payload.ledger), {
    editor_open_attempt_count: open,
    probe_invocation_count: probe,
    editor_close_attempt_count: close,
    retry_count: 0,
    fallback_count: 0,
  });
}

function assertSafeMainShape(payload) {
  assert.deepEqual(Object.keys(payload).sort(), [
    'editor_residual_state',
    'error_code',
    'ledger',
    'probe',
    'success',
  ].sort());
  assert.deepEqual(Object.keys(payload.ledger).sort(), [
    'editor_close_attempt_count',
    'editor_open_attempt_count',
    'fallback_count',
    'probe_invocation_count',
    'retry_count',
  ].sort());
  for (const key of [
    'editor_open_attempt_count',
    'probe_invocation_count',
    'editor_close_attempt_count',
    'retry_count',
    'fallback_count',
  ]) {
    assert.equal(Number.isInteger(payload.ledger[key]), true, `${key} must be an integer`);
  }
  assert.equal(payload.ledger.editor_open_attempt_count >= 0 && payload.ledger.editor_open_attempt_count <= 1, true);
  assert.equal(payload.ledger.probe_invocation_count >= 0 && payload.ledger.probe_invocation_count <= 1, true);
  assert.equal(payload.ledger.editor_close_attempt_count >= 0 && payload.ledger.editor_close_attempt_count <= 1, true);
  assert.equal(payload.ledger.probe_invocation_count <= payload.ledger.editor_open_attempt_count, true);
  assert.equal(payload.ledger.editor_close_attempt_count <= payload.ledger.editor_open_attempt_count, true);
  assert.equal(payload.ledger.retry_count, 0);
  assert.equal(payload.ledger.fallback_count, 0);
  assert.ok(['CLOSED', 'OPEN', 'UNKNOWN'].includes(payload.editor_residual_state));
}

function runChildFixture(mode) {
  return new Promise((resolvePromise, rejectPromise) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [
      '--no-warnings',
      '--import',
      './tests/offline_network_guard.js',
      '--experimental-vm-modules',
      CHILD_FIXTURE_PATH,
      mode,
    ], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let closed = false;
    const safetyHandle = globalThis.setTimeout(() => {
      if (closed) return;
      child.kill('SIGKILL');
      rejectPromise(new Error(`child safety timeout: ${mode}`));
    }, 2000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      closed = true;
      globalThis.clearTimeout(safetyHandle);
      rejectPromise(error);
    });
    child.once('close', (code, signal) => {
      closed = true;
      globalThis.clearTimeout(safetyHandle);
      resolvePromise({
        code,
        elapsedMs: Date.now() - startedAt,
        signal,
        stderr,
        stdout,
      });
    });
  });
}

function parseStaticImports(source) {
  const imports = [];
  const pattern = /^\s*import\s*\{([^}]+)\}\s*from\s*(['"])(node:[^'"]+)\2\s*;/gm;
  for (const match of source.matchAll(pattern)) {
    imports.push({
      specifier: match[3],
      names: match[1].split(',').map((name) => name.trim()).sort(),
    });
  }
  return imports.sort((left, right) => left.specifier.localeCompare(right.specifier));
}

test('Stage A: exact frozen constants and public namespace', async () => {
  const { namespace } = await loadArtifact();
  assert.deepEqual(Object.keys(namespace).sort(), [...EXPECTED_EXPORTS].sort());
  assert.deepEqual(toHostPlain(namespace.PROBE_TARGET), EXPECTED_TARGET);
  assert.deepEqual(toHostPlain(namespace.PROBE_BUDGET), EXPECTED_BUDGET);
  assert.deepEqual(toHostPlain(namespace.PROBE_CANDIDATE_PATHS), EXPECTED_CANDIDATE_PATHS);
  assert.deepEqual(toHostPlain(namespace.PROBE_CANDIDATE_VALUE_TYPES), EXPECTED_CANDIDATE_VALUE_TYPES);
  assert.deepEqual(toHostPlain(namespace.PROBE_CANDIDATE_ERROR_CODES), EXPECTED_CANDIDATE_ERROR_CODES);
  assert.deepEqual(toHostPlain(namespace.PROBE_ERROR_CODES), EXPECTED_ERROR_CODES);
  assert.equal(namespace.OPERATION_DEADLINE_MS, 1000);
  assert.equal(namespace.WORK_DEADLINE_MS, 20000);
  assert.equal(namespace.CLEANUP_RESERVE_MS, 10000);
  assert.equal(namespace.TOTAL_HARD_DEADLINE_MS, 30000);
  assert.equal(namespace.CLI_FLUSH_FALLBACK_MS, 100);
  assert.equal(namespace.HARD_DEADLINE_EXIT_CODE, 70);
  for (const name of [
    'PROBE_TARGET',
    'PROBE_BUDGET',
    'PROBE_CANDIDATE_PATHS',
    'PROBE_CANDIDATE_VALUE_TYPES',
    'PROBE_CANDIDATE_ERROR_CODES',
    'PROBE_ERROR_CODES',
  ]) {
    assertDeepFrozen(namespace[name], name);
  }
});

test('Stage A: static imports and named bindings are the exact six-module allowlist', async () => {
  const { source } = await loadArtifact();
  assert.deepEqual(parseStaticImports(source), [
    { specifier: 'node:crypto', names: ['createHash', 'timingSafeEqual'] },
    { specifier: 'node:fs', names: ['constants'] },
    { specifier: 'node:fs/promises', names: ['lstat', 'mkdir', 'open', 'readFile', 'readlink', 'stat'] },
    { specifier: 'node:path', names: ['basename', 'dirname', 'resolve'] },
    { specifier: 'node:url', names: ['fileURLToPath'] },
    { specifier: 'node:util', names: ['types'] },
  ]);
  const allStaticSpecifiers = [...source.matchAll(/^\s*import[\s\S]*?from\s*(['"])([^'"]+)\1\s*;/gm)]
    .map((match) => match[2])
    .sort();
  assert.deepEqual(allStaticSpecifiers, Object.keys(STATIC_EXPORTS).sort());
  assert.doesNotMatch(source, /import\s+(?:\*|[A-Za-z_$])/);
});

test('Stage A: VM linker rejects every non-allowlisted builtin before evaluation', async (t) => {
  for (const specifier of [
    'node:net',
    'node:tls',
    'node:http',
    'node:https',
    'node:child_process',
    'node:process',
    'node:timers',
    'node:unknown',
  ]) {
    await t.test(specifier, async () => {
      const source = `import { forbidden } from '${specifier}'; export const reached = true;`;
      await assert.rejects(
        evaluateSource(source, { identifier: `file:///deny-${specifier.slice(5)}.mjs` }),
        (error) => error?.code === 'ERR_STATIC_IMPORT_REJECTED',
      );
    });
  }
});

test('Stage A: import-only mode uses frozen global process and pure helpers have no live side effects', async () => {
  const { namespace, source, state } = await loadArtifact();
  assert.doesNotMatch(source, /from\s*['"]node:(?:process|timers)['"]/);
  const withoutQualifiedTimers = source
    .replaceAll('globalThis.setTimeout', '')
    .replaceAll('globalThis.clearTimeout', '');
  assert.doesNotMatch(withoutQualifiedTimers, /\b(?:setTimeout|clearTimeout)\s*\(/);

  const readFileFn = async () => Buffer.from('stage-a-pure-helper');
  await Promise.allSettled([
    namespace.computeProbeSelfSha256(readFileFn),
    namespace.buildApprovalEnvelope(readFileFn),
    Promise.resolve().then(() => namespace.validateProbeResult(null)),
  ]);
  assert.equal(state.dynamicImportCount, 0);
  assert.equal(state.networkCalls, 0);
  assert.deepEqual(state.stdoutWrites, []);
  assert.deepEqual(state.stderrWrites, []);
  assert.deepEqual(state.exits, []);
  assert.deepEqual(state.timerCalls, { setCalls: 0, clearCalls: 0 });
});

test('Stage B: strict CLI argument failures emit once before dynamic import', async (t) => {
  const source = await readArtifactSource();
  const digest = independentArtifactDigest(source);
  const cases = [
    ['no args', []],
    ['unknown arg', ['--unknown-option']],
    ['malformed digest', ['--bundle-sha256=abc']],
    ['uppercase digest', [`--bundle-sha256=${'A'.repeat(64)}`]],
    ['duplicate digest', [`--bundle-sha256=${digest}`, `--bundle-sha256=${digest}`]],
    ['approval plus digest', ['--approval-envelope', `--bundle-sha256=${digest}`]],
  ];
  for (const [name, args] of cases) {
    await t.test(name, async () => {
      const result = await runArtifactCli(args);
      assert.equal(result.exitCode, 1);
      assert.equal(result.state.dynamicImportCount, 0);
      assert.equal(result.state.stdoutWrites.length, 1);
      assert.equal(result.state.stdoutCallbacks, 1);
      assert.deepEqual(result.state.stderrWrites, []);
      assert.deepEqual(result.state.exits, [1]);
      assert.equal(result.parsed.success, false);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.ARGUMENT);
    });
  }
});

test('Stage B: shape-valid mismatching digest is rejected before dynamic import', async () => {
  const source = await readArtifactSource();
  const mismatch = changeDigestNibble(independentArtifactDigest(source));
  const result = await runArtifactCli([`--bundle-sha256=${mismatch}`]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.state.dynamicImportCount, 0);
  assert.equal(result.state.stdoutWrites.length, 1);
  assert.equal(result.state.stdoutCallbacks, 1);
  assert.deepEqual(result.state.stderrWrites, []);
  assert.deepEqual(result.state.exits, [1]);
  assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.DIGEST);
  assert.doesNotMatch(result.state.stdoutWrites[0], new RegExp(mismatch, 'i'));
});

test('Stage B: approval envelope binds exact artifact digest, command, tuple, budgets, and deadlines', async () => {
  const source = await readArtifactSource();
  const digest = independentArtifactDigest(source);
  const result = await runArtifactCli(['--approval-envelope']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.state.dynamicImportCount, 0);
  assert.equal(result.state.stdoutWrites.length, 1);
  assert.equal(result.state.stdoutCallbacks, 1);
  assert.deepEqual(result.state.stderrWrites, []);
  assert.deepEqual(result.state.exits, [0]);
  assert.deepEqual(Object.keys(result.parsed).sort(), [
    'budgets',
    'approval',
    'bundle_sha256',
    'cleanup_reserve_ms',
    'exact_command',
    'forbidden_effects',
    'hard_exit_cleanup_limit',
    'initial_tuple',
    'operation_deadline_ms',
    'target_id',
    'total_hard_deadline_ms',
    'tradingview_page_initiated_network',
    'work_deadline_ms',
  ].sort());
  assert.match(result.parsed.bundle_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.parsed.bundle_sha256, digest);
  assert.equal(
    result.parsed.exact_command,
    `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=${digest}`,
  );
  assert.deepEqual(result.parsed.exact_command.split(' '), [
    'node',
    'scripts/pine_discovery_gate_a1.mjs',
    `--bundle-sha256=${digest}`,
  ]);
  assert.doesNotMatch(result.parsed.exact_command, /--import|tests\/|offline_network_guard|["']/);
  assert.equal(result.parsed.target_id, EXPECTED_TARGET.id);
  assert.deepEqual(toHostPlain(result.parsed.approval), {
    schema_version: 1,
    secret_ingress_env: 'PINE_DISCOVERY_APPROVAL_FILE',
    file_mode: '0600',
    nonce_format: '64 lowercase hexadecimal characters',
    issued_at: 'strict ISO-8601 UTC timestamp supplied by approver',
    expires_at: 'strict ISO-8601 UTC timestamp supplied by approver',
    max_ttl_ms: 300000,
    one_shot: true,
  });
  assert.deepEqual(toHostPlain(result.parsed.initial_tuple), {
    symbol: EXPECTED_TARGET.symbol,
    resolution: EXPECTED_TARGET.resolution,
    chart_type: EXPECTED_TARGET.chart_type,
    study_count: EXPECTED_TARGET.study_count,
    shape_count: EXPECTED_TARGET.shape_count,
    replay_started: EXPECTED_TARGET.replay_started,
    bottom_widget_open: EXPECTED_TARGET.bottom_widget_open,
    pine_editor_open: EXPECTED_TARGET.pine_editor_open,
  });
  assert.deepEqual(toHostPlain(result.parsed.budgets), EXPECTED_BUDGET);
  assert.equal(result.parsed.operation_deadline_ms, 1000);
  assert.equal(result.parsed.work_deadline_ms, 20000);
  assert.equal(result.parsed.cleanup_reserve_ms, 10000);
  assert.equal(result.parsed.total_hard_deadline_ms, 30000);
  assert.equal(
    result.parsed.hard_exit_cleanup_limit,
    'PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN',
  );
  assert.equal(result.parsed.tradingview_page_initiated_network, 'UNKNOWN');
});

test('Stage B: written approval artifact binds the current digest and sole close() contract', async () => {
  const source = await readFile(ARTIFACT_PATH);
  const digest = createHash('sha256').update(source).digest('hex');
  const approval = await readFile(APPROVAL_ARTIFACT_PATH, 'utf8');

  assert.match(approval, new RegExp(`"bundle_sha256": "${digest}"`));
  assert.match(approval, new RegExp(`--bundle-sha256=${digest}`));
  assert.match(approval, /sole approved mutation calls the owner's `close` function/);
  assert.match(approval, /invocation is exactly `close\(\)`/);
  assert.doesNotMatch(approval, /typeof window\.TradingView\.bottomWidgetBar\.hideWidget/);
});

test('Stage B: approval lease is strict, one-shot, concurrent-safe, and crash-residual-safe', async (t) => {
  const { namespace, source } = await loadArtifact();
  const digest = independentArtifactDigest(source);

  await t.test('missing ingress fails before CRI import with zero ledger', async () => {
    const result = await runArtifactCli([`--bundle-sha256=${digest}`]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.state.dynamicImportCount, 0);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.APPROVAL);
    assertExactLedger(result.parsed, 0, 0, 0);
  });

  for (const [name, mutate] of [
    ['expired', (value) => ({ ...value, expires_at: new Date(Date.now() - 1).toISOString() })],
    ['future-issued', (value) => ({ ...value, issued_at: new Date(Date.now() + 60_000).toISOString() })],
    ['malformed-nonce', (value) => ({ ...value, nonce: 'secret-nonce' })],
    ['extra-top-level', (value) => ({ ...value, extra: true })],
    ['extra-tuple', (value) => ({
      ...value,
      initial_tuple: { ...value.initial_tuple, extra: true },
    })],
    ['wrong-target', (value) => ({ ...value, target_id: `${value.target_id}0` })],
    ['wrong-command', (value) => ({ ...value, exact_command: `${value.exact_command} --extra` })],
    ['wrong-bundle', (value) => ({ ...value, bundle_sha256: changeDigestNibble(digest) })],
  ]) {
    await t.test(name, async () => {
      const fixture = await createApprovalFixture(digest);
      const mutated = mutate(fixture.approval);
      await writeFile(fixture.approvalPath, JSON.stringify(mutated), { mode: 0o600 });
      await chmod(fixture.approvalPath, 0o600);
      try {
        const result = await runArtifactCli(
          [`--bundle-sha256=${digest}`],
          { env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath } },
        );
        assert.equal(result.exitCode, 1);
        assert.equal(result.state.dynamicImportCount, 0);
        assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.APPROVAL);
        assertExactLedger(result.parsed, 0, 0, 0);
        assert.doesNotMatch(result.state.stdoutWrites[0], new RegExp(fixture.approval.nonce, 'i'));
      } finally {
        await rm(fixture.directory, { recursive: true, force: true });
      }
    });
  }

  await t.test('non-0600 file is rejected', async () => {
    const fixture = await createApprovalFixture(digest);
    await chmod(fixture.approvalPath, 0o644);
    try {
      assert.equal(await namespace.consumeApprovalLease(fixture.approvalPath, digest), false);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test('symlink ingress is rejected without consuming its target', async () => {
    const fixture = await createApprovalFixture(digest);
    const symlinkPath = resolve(fixture.directory, 'approval-link.json');
    await symlink(fixture.approvalPath, symlinkPath);
    try {
      assert.equal(await namespace.consumeApprovalLease(symlinkPath, digest), false);
      assert.equal((await stat(fixture.approvalPath)).isFile(), true);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test('symlinked parent component is rejected', async () => {
    const fixture = await createApprovalFixture(digest);
    const wrapper = await mkdtemp('/tmp/tradingview-a1-parent-link-');
    const alias = resolve(wrapper, 'approval-parent');
    await symlink(fixture.directory, alias);
    try {
      assert.equal(
        await namespace.consumeApprovalLease(resolve(alias, 'approval.json'), digest),
        false,
      );
    } finally {
      await rm(wrapper, { recursive: true, force: true });
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  await t.test('rename-to-symlink and regular-file swap fail closed', async () => {
    for (const replacement of ['symlink', 'regular']) {
      const fixture = await createApprovalFixture(digest);
      const heldPath = resolve(fixture.directory, 'approval-held.json');
      await rename(fixture.approvalPath, heldPath);
      if (replacement === 'symlink') {
        await symlink(heldPath, fixture.approvalPath);
      } else {
        await writeFile(fixture.approvalPath, '{"swapped":true}', { mode: 0o600 });
        await chmod(fixture.approvalPath, 0o600);
      }
      try {
        assert.equal(await namespace.consumeApprovalLease(fixture.approvalPath, digest), false);
      } finally {
        await rm(fixture.directory, { recursive: true, force: true });
      }
    }
  });

  for (const phase of ['directory-stat', 'approval-stat', 'approval-read']) {
    await t.test(`parent rename injection at ${phase} writes no marker in either namespace`, async () => {
      const fixture = await createApprovalFixture(digest);
      const movedDirectory = `${fixture.directory}-moved`;
      const nonceHash = createHash('sha256').update(fixture.approval.nonce).digest('hex');
      const markerName = `.pine-discovery-spent-${nonceHash}`;
      const probeHandle = await open(fixture.approvalPath, 'r');
      const prototype = Object.getPrototypeOf(probeHandle);
      await probeHandle.close();
      const methodName = phase === 'approval-read' ? 'readFile' : 'stat';
      const originalMethod = prototype[methodName];
      let injected = false;
      prototype[methodName] = async function injectedParentRename(...args) {
        const target = await readlink(`/proc/self/fd/${this.fd}`);
        const result = await originalMethod.apply(this, args);
        const shouldInject = !injected && (
          (phase === 'directory-stat' && target === fixture.directory)
          || (phase !== 'directory-stat' && target === fixture.approvalPath)
        );
        if (shouldInject) {
          injected = true;
          await rename(fixture.directory, movedDirectory);
          await mkdir(fixture.directory, { mode: 0o700 });
        }
        return result;
      };
      try {
        assert.equal(await namespace.consumeApprovalLease(fixture.approvalPath, digest), false);
        assert.equal(injected, true);
        await assert.rejects(
          stat(resolve(fixture.directory, markerName)),
          (error) => error?.code === 'ENOENT',
        );
        await assert.rejects(
          stat(resolve(movedDirectory, markerName)),
          (error) => error?.code === 'ENOENT',
        );
        await assert.rejects(stat(fixture.spentPath), (error) => error?.code === 'ENOENT');
      } finally {
        prototype[methodName] = originalMethod;
        await rm(fixture.directory, { recursive: true, force: true });
        await rm(movedDirectory, { recursive: true, force: true });
      }
    });
  }

  await t.test('source binds validation to one no-follow FD and never hard-links approval plaintext', () => {
    assert.match(source, /constants\.O_DIRECTORY \| constants\.O_NOFOLLOW/);
    assert.match(source, /`\/proc\/self\/fd\/\$\{directory\.fd\}`/);
    assert.match(source, /open\([\s\S]*anchoredApprovalPath,[\s\S]*constants\.O_RDONLY \| constants\.O_NOFOLLOW/);
    assert.match(source, /approvalHandle\.stat\(\)/);
    assert.match(source, /approvalHandle\.readFile\(\)/);
    assert.match(source, /currentMetadata\.ino !== metadata\.ino/);
    assert.doesNotMatch(source, /link\(approvalPath|copyFile\(approvalPath/);
  });

  await t.test('only one concurrent claimant consumes a nonce', async () => {
    const fixture = await createApprovalFixture(digest);
    try {
      const claims = await Promise.all([
        namespace.consumeApprovalLease(fixture.approvalPath, digest),
        namespace.consumeApprovalLease(fixture.approvalPath, digest),
      ]);
      assert.deepEqual(claims.sort(), [false, true]);
      assert.equal(await namespace.consumeApprovalLease(fixture.approvalPath, digest), false);
      const nonceHash = createHash('sha256').update(fixture.approval.nonce).digest('hex');
      const marker = await readFile(
        fixture.spentPath,
        'utf8',
      );
      assert.doesNotMatch(marker, new RegExp(fixture.approval.nonce, 'i'));
      assert.doesNotMatch(marker, /"nonce"\s*:/);
      assert.doesNotMatch(marker, new RegExp(JSON.stringify(fixture.approval).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    } finally {
      await cleanupApprovalFixture(fixture);
    }
  });

  await t.test('same approval copied across two 0600 directories is globally one-shot', async () => {
    const first = await createApprovalFixture(digest);
    const second = await createApprovalFixture(digest);
    second.approval = first.approval;
    second.spentPath = first.spentPath;
    await writeFile(second.approvalPath, JSON.stringify(first.approval), { mode: 0o600 });
    await chmod(second.approvalPath, 0o600);
    try {
      const claims = [
        await namespace.consumeApprovalLease(first.approvalPath, digest),
        await namespace.consumeApprovalLease(second.approvalPath, digest),
      ];
      assert.deepEqual(claims, [true, false]);
      assert.equal((await stat(first.spentPath)).isFile(), true);
    } finally {
      await cleanupApprovalFixture(first);
      await cleanupApprovalFixture(second);
    }
  });

  await t.test('durable spent lease exists before CRI import begins', async () => {
    const fixture = await createApprovalFixture(digest);
    const spentPath = fixture.spentPath;
    let observedAtImport = false;
    try {
      const result = await runArtifactCli(
        [`--bundle-sha256=${digest}`],
        {
          env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath },
          dynamicModuleFactory: async (context) => {
            const spent = await stat(spentPath);
            assert.equal((await stat(fixture.approvalPath)).isFile(), true);
            observedAtImport = spent.isFile();
            return createDynamicCdpModule(context, Object.freeze({}));
          },
        },
      );
      assert.equal(observedAtImport, true);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.MODULE);
      assertExactLedger(result.parsed, 0, 0, 0);
    } finally {
      await cleanupApprovalFixture(fixture);
    }
  });

  await t.test('pre-existing spent lease rejects active crash residue', async () => {
    const fixture = await createApprovalFixture(digest);
    const nonceHash = createHash('sha256').update(fixture.approval.nonce).digest('hex');
    const spentPath = fixture.spentPath;
    await mkdir(SPENT_REGISTRY_PATH, { recursive: true, mode: 0o700 });
    await writeFile(spentPath, JSON.stringify({
      schema_version: 1,
      nonce_digest: nonceHash,
      envelope_digest: createHash('sha256').update(JSON.stringify(fixture.approval)).digest('hex'),
      issued_at: fixture.approval.issued_at,
      expires_at: fixture.approval.expires_at,
    }), { mode: 0o600 });
    await chmod(spentPath, 0o600);
    try {
      assert.equal(await namespace.consumeApprovalLease(fixture.approvalPath, digest), false);
      assert.equal((await stat(fixture.approvalPath)).isFile(), true);
      assert.equal((await stat(spentPath)).isFile(), true);
      const marker = await readFile(spentPath, 'utf8');
      assert.doesNotMatch(marker, new RegExp(fixture.approval.nonce, 'i'));
      assert.doesNotMatch(marker, /"nonce"\s*:/);
    } finally {
      await cleanupApprovalFixture(fixture);
    }
  });

  await t.test('secret nonce never reaches stdout or stderr on rejection', async () => {
    const fixture = await createApprovalFixture(digest, { expires_at: 'malformed-secret-expiry' });
    try {
      const result = await runArtifactCli(
        [`--bundle-sha256=${digest}`],
        { env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath } },
      );
      assert.equal(result.exitCode, 1);
      assert.equal(result.state.dynamicImportCount, 0);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.APPROVAL);
      assertExactLedger(result.parsed, 0, 0, 0);
      const output = `${result.state.stdoutWrites.join('')} ${result.state.stderrWrites.join('')}`;
      assert.doesNotMatch(output, new RegExp(fixture.approval.nonce, 'i'));
      assert.doesNotMatch(output, /malformed-secret-expiry/);
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });
});

test('Stage B: valid digest dynamically imports CRI exactly once and rejects a non-callable default safely', async () => {
  const source = await readArtifactSource();
  const digest = independentArtifactDigest(source);
  const sentinel = 'RAW_MODULE_VALUE_MUST_NOT_LEAK';
  const fixture = await createApprovalFixture(digest);
  const result = await runArtifactCli(
    [`--bundle-sha256=${digest}`],
    {
      dynamicDefault: Object.freeze({ sentinel }),
      env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath },
    },
  ).finally(() => cleanupApprovalFixture(fixture));
  assert.equal(result.exitCode, 1);
  assert.equal(result.state.dynamicImportCount, 1);
  assert.equal(result.state.stdoutWrites.length, 1);
  assert.equal(result.state.stdoutCallbacks, 1);
  assert.deepEqual(result.state.stderrWrites, []);
  assert.deepEqual(result.state.exits, [1]);
  assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.MODULE);
  assert.doesNotMatch(result.state.stdoutWrites[0], new RegExp(sentinel));
});

test('Stage B: namespace and production source expose no live callable or dependency-injection option', async () => {
  const { namespace, source } = await loadArtifact();
  for (const name of [
    'main',
    'executeMain',
    'runCli',
    'createLiveAdapter',
    'connect',
    'openEditor',
    'invokeProbe',
    'closeEditor',
    'sendCommand',
  ]) {
    assert.equal(name in namespace, false, `${name} must not be exported`);
  }
  const exportedFunctions = Object.entries(Object.getOwnPropertyDescriptors(namespace))
    .filter(([, descriptor]) => typeof descriptor.value === 'function')
    .map(([name]) => name)
    .sort();
  assert.deepEqual(exportedFunctions, [
    'buildApprovalEnvelope',
    'computeProbeSelfSha256',
    'consumeApprovalLease',
    'validateProbeResult',
  ]);
  assert.doesNotMatch(
    source,
    /--(?:read-file|loader|target|tuple|timer|deadline|observer)|process\.env\.(?:TARGET|TUPLE|TIMER|DEADLINE|OBSERVER)/i,
  );
});

test('Stage C: fixed closure is zero-argument, named, and contains no mutation or dynamic-code primitive', async () => {
  const { namespace } = await loadArtifact();
  const declaration = namespace.PROBE_FUNCTION_DECLARATION;
  assert.match(declaration, /^function\s+pineSignalDiscoveryMainWorld\s*\(\s*\)/);
  assert.doesNotMatch(
    declaration,
    /\beval\s*\(|\bFunction\s*\(|setValue|\.focus\s*\(|\.click\s*\(|\bsave\b|\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/i,
  );
});

test('Stage C: closure returns only allowlisted metadata and invokes only reviewed traversal/read methods', async () => {
  const { namespace } = await loadArtifact();
  const environment = createProbeEnvironment();
  const result = executeProbeClosure(namespace.PROBE_FUNCTION_DECLARATION, environment);
  const safe = namespace.validateProbeResult(result);
  assert.deepEqual(toHostPlain(safe), toHostPlain(result));
  assert.deepEqual(
    toHostPlain(result.candidates).map(({ signal, owner, member }) => [signal, owner, member]),
    EXPECTED_CANDIDATE_PATHS,
  );
  assert.equal(result.candidate_count, EXPECTED_CANDIDATE_PATHS.length);
  assert.equal(environment.calls.getEditors, 1);
  assert.equal(environment.calls.getDomNode, 1);
  assert.equal(environment.calls.getModel, 1);
  assert.equal(environment.calls.getValue, 2);
  assert.equal(environment.calls.getVersionId, 2);
  assert.equal(environment.calls.getAlternativeVersionId, 2);
  for (const forbidden of ['setValue', 'focus', 'click', 'fetch', 'storageWrite', 'unknownFunction']) {
    assert.equal(environment.calls[forbidden], 0, `${forbidden} must remain zero`);
  }
  const serialized = JSON.stringify(result);
  for (const sentinel of [
    'PINE_SOURCE_SENTINEL',
    'MODEL_URI_SENTINEL',
    'SCRIPT_ID_SENTINEL',
    'SCRIPT_ID_PRIVATE_SENTINEL',
    'CLOUD_VERSION_SENTINEL',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(sentinel));
  }
  assert.doesNotMatch(serialized, /preview|hash|length|stack|cause/);
});

test('Stage C: DOM parent and React return traversal stop at fixed bounds', async () => {
  const { namespace } = await loadArtifact();

  const parentNodes = Array.from({ length: 22 }, () => ({ parentElement: null }));
  for (let index = 0; index < parentNodes.length - 1; index += 1) {
    parentNodes[index].parentElement = parentNodes[index + 1];
  }
  const farReact = { memoizedProps: { pineState: { scriptId: 'FAR_PARENT_SENTINEL' } }, return: null };
  Object.defineProperty(parentNodes[21], '__reactFiber$tooFar', { value: farReact, enumerable: true });
  const parentEnvironment = createProbeEnvironment({ rootOverride: parentNodes[0] });
  delete parentNodes[0].__reactFiber$gateA0;
  const parentResult = executeProbeClosure(namespace.PROBE_FUNCTION_DECLARATION, parentEnvironment);
  assert.equal(parentResult.candidates[4].error_code, EXPECTED_CANDIDATE_ERROR_CODES.MEMBER_MISSING);

  const fiberEnvironment = createProbeEnvironment();
  delete fiberEnvironment.root.__reactFiber$gateA0;
  const fibers = Array.from({ length: 17 }, () => ({ memoizedProps: null, memoizedState: null, return: null }));
  for (let index = 0; index < fibers.length - 1; index += 1) fibers[index].return = fibers[index + 1];
  fibers[16].memoizedProps = { pineState: { scriptId: 'FAR_FIBER_SENTINEL' } };
  Object.defineProperty(fiberEnvironment.root, '__reactFiber$bounded', {
    value: fibers[0],
    enumerable: true,
  });
  const fiberResult = executeProbeClosure(namespace.PROBE_FUNCTION_DECLARATION, fiberEnvironment);
  assert.equal(fiberResult.candidates[4].error_code, EXPECTED_CANDIDATE_ERROR_CODES.MEMBER_MISSING);
});

test('Stage C: cross-read and per-index type mismatches are unavailable without coercion', async () => {
  const { namespace } = await loadArtifact();
  let versionRead = 0;
  const environment = createProbeEnvironment({
    reactValue: {
      scriptId: 123,
      _scriptId: 'stable-private',
      dirty: false,
      _dirty: false,
      persistenceMode: 'manual-save',
      autoSave: false,
      cloudVersion: 9,
    },
    modelOverrides: {
      getVersionId() {
        versionRead += 1;
        return versionRead === 1 ? 7 : '7';
      },
    },
  });
  const result = executeProbeClosure(namespace.PROBE_FUNCTION_DECLARATION, environment);
  for (const index of [2, 4]) {
    assert.deepEqual(toHostPlain(result.candidates[index]), makeCandidate(index, {
      available: false,
      value_type: 'unavailable',
      stable: false,
      read_count: 2,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.TYPE_MISMATCH,
    }));
  }
  assert.doesNotThrow(() => namespace.validateProbeResult(result));
});

test('Stage C: validator reconstructs exact schema and accepts only the candidate state matrix', async (t) => {
  const { namespace } = await loadArtifact();
  const acceptedOverrides = [
    {
      available: true,
      value_type: 'string',
      stable: true,
      read_count: 2,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.NONE,
    },
    {
      available: false,
      value_type: 'missing',
      stable: false,
      read_count: 0,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.MEMBER_MISSING,
    },
    {
      available: false,
      value_type: 'accessor',
      stable: false,
      read_count: 0,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.ACCESSOR_SKIPPED,
    },
    {
      available: false,
      value_type: 'unavailable',
      stable: false,
      read_count: 0,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.READ_FAILED,
    },
    {
      available: false,
      value_type: 'undefined',
      stable: true,
      read_count: 2,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.VALUE_UNAVAILABLE,
    },
    {
      available: true,
      value_type: 'string',
      stable: false,
      read_count: 2,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.UNSTABLE,
    },
    {
      available: false,
      value_type: 'unavailable',
      stable: false,
      read_count: 2,
      error_code: EXPECTED_CANDIDATE_ERROR_CODES.TYPE_MISMATCH,
    },
  ];
  for (const [index, overrides] of acceptedOverrides.entries()) {
    await t.test(overrides.error_code, () => {
      const input = makeValidProbeResult(new Map([[1, overrides]]));
      const output = namespace.validateProbeResult(input);
      assert.deepEqual(toHostPlain(output), input);
      assert.notEqual(output, input);
      assert.notEqual(output.candidates, input.candidates);
      assert.equal(index >= 0, true);
    });
  }
  const preflight = makeUniformProbeFailure({
    editorFound: false,
    errorCode: EXPECTED_ERROR_CODES.PREFLIGHT,
    candidateError: EXPECTED_CANDIDATE_ERROR_CODES.MEMBER_MISSING,
  });
  const page = makeUniformProbeFailure({
    editorFound: true,
    errorCode: EXPECTED_ERROR_CODES.PAGE,
    candidateError: EXPECTED_CANDIDATE_ERROR_CODES.READ_FAILED,
  });
  assert.deepEqual(toHostPlain(namespace.validateProbeResult(preflight)), preflight);
  assert.deepEqual(toHostPlain(namespace.validateProbeResult(page)), page);
});

test('Stage C: validator rejects tuple/count/code/state/top-level variations', async (t) => {
  const { namespace } = await loadArtifact();
  const invalidInputs = [];

  const reordered = makeValidProbeResult();
  [reordered.candidates[0], reordered.candidates[1]] = [reordered.candidates[1], reordered.candidates[0]];
  invalidInputs.push(['reordered tuple', reordered]);

  const duplicate = makeValidProbeResult();
  duplicate.candidates[1] = { ...duplicate.candidates[0] };
  invalidInputs.push(['duplicate tuple', duplicate]);

  const missing = makeValidProbeResult();
  missing.candidates.pop();
  invalidInputs.push(['missing candidate', missing]);

  const extra = makeValidProbeResult();
  extra.candidates.push({ ...extra.candidates[0] });
  invalidInputs.push(['extra candidate', extra]);

  const wrongCount = makeValidProbeResult();
  wrongCount.candidate_count = 10;
  invalidInputs.push(['wrong count', wrongCount]);

  const unknownCode = makeValidProbeResult();
  unknownCode.candidates[0].error_code = 'UNKNOWN_CODE';
  invalidInputs.push(['unknown code', unknownCode]);

  const invalidState = makeValidProbeResult();
  invalidState.candidates[0].available = true;
  invalidState.candidates[0].error_code = EXPECTED_CANDIDATE_ERROR_CODES.READ_FAILED;
  invalidState.candidates[0].value_type = 'unavailable';
  invalidState.candidates[0].stable = false;
  invalidState.candidates[0].read_count = 0;
  invalidInputs.push(['invalid availability state', invalidState]);

  const invalidTop = makeValidProbeResult();
  invalidTop.success = false;
  invalidTop.error_code = EXPECTED_ERROR_CODES.PAGE;
  invalidInputs.push(['invalid top-level combination', invalidTop]);

  const extraTopKey = makeValidProbeResult();
  extraTopKey.raw = 'must-not-be-read';
  invalidInputs.push(['extra top-level key', extraTopKey]);

  for (const [name, input] of invalidInputs) {
    await t.test(name, () => {
      assert.throws(
        () => namespace.validateProbeResult(input),
        (error) => error?.message === EXPECTED_ERROR_CODES.INVALID && !('cause' in error),
      );
    });
  }
});

test('Stage C: validator rejects proxies/accessors without invoking traps, getters, toJSON, or inspect', async () => {
  const { namespace } = await loadArtifact();
  const calls = { getter: 0, inspect: 0, proxy: 0, toJSON: 0 };
  const proxy = new Proxy(makeValidProbeResult(), {
    get() { calls.proxy += 1; throw new Error('proxy get'); },
    getOwnPropertyDescriptor() { calls.proxy += 1; throw new Error('proxy descriptor'); },
    ownKeys() { calls.proxy += 1; throw new Error('proxy ownKeys'); },
  });
  assert.throws(() => namespace.validateProbeResult(proxy));
  assert.equal(calls.proxy, 0);

  const accessor = makeValidProbeResult();
  Object.defineProperty(accessor, 'success', {
    enumerable: true,
    get() { calls.getter += 1; return true; },
  });
  assert.throws(() => namespace.validateProbeResult(accessor));
  assert.equal(calls.getter, 0);

  const custom = makeValidProbeResult();
  custom.toJSON = () => { calls.toJSON += 1; return {}; };
  custom[Symbol.for('nodejs.util.inspect.custom')] = () => { calls.inspect += 1; return ''; };
  assert.throws(() => namespace.validateProbeResult(custom));
  assert.deepEqual(calls, { getter: 0, inspect: 0, proxy: 0, toJSON: 0 });

  const candidateProxyInput = makeValidProbeResult();
  candidateProxyInput.candidates[0] = new Proxy(candidateProxyInput.candidates[0], {
    get() { calls.proxy += 1; throw new Error('candidate proxy get'); },
    ownKeys() { calls.proxy += 1; throw new Error('candidate proxy ownKeys'); },
  });
  assert.throws(() => namespace.validateProbeResult(candidateProxyInput));
  assert.equal(calls.proxy, 0);
});

test('Stage C: candidate reconstruction ignores inherited iterators and rejects index accessors unread', async (t) => {
  const { namespace } = await loadArtifact();

  await t.test('inherited throwing iterator is never invoked', () => {
    let iteratorCalls = 0;
    const input = makeValidProbeResult();
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, Symbol.iterator, {
      configurable: true,
      value() {
        iteratorCalls += 1;
        throw new Error('RAW_ITERATOR_SENTINEL');
      },
    });
    Object.setPrototypeOf(input.candidates, prototype);

    const output = namespace.validateProbeResult(input);
    assert.equal(iteratorCalls, 0);
    assert.deepEqual(toHostPlain(output), makeValidProbeResult());
  });

  await t.test('numeric accessor is rejected without getter or raw-value leakage', () => {
    let getterCalls = 0;
    const input = makeValidProbeResult();
    Object.defineProperty(input.candidates, '0', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('RAW_INDEX_GETTER_SENTINEL');
      },
    });

    assert.throws(
      () => namespace.validateProbeResult(input),
      (error) => error?.message === EXPECTED_ERROR_CODES.INVALID
        && !('cause' in error)
        && !String(error).includes('RAW_INDEX_GETTER_SENTINEL'),
    );
    assert.equal(getterCalls, 0);
  });
});

test('Stage D: success follows fixed order with exact budgets and closed residual', async () => {
  const result = await runDScenario('success');
  assert.equal(result.exitCode, 0);
  assert.equal(result.parsed.success, true);
  assert.equal(result.parsed.error_code, null);
  assert.equal(result.parsed.editor_residual_state, 'CLOSED');
  assertExactLedger(result.parsed, 1, 1, 1);
  assert.equal(result.parsed.probe.contract, 'gate-a0-v1');
  assert.deepEqual(result.fake.calls.actionOrder, [
    'List',
    'connect',
    'preflight',
    'close-capability',
    'open',
    'probe',
    'close',
    'postflight',
    'release',
    'detach',
  ]);
  assert.equal(result.fake.calls.listCount, 1);
  assert.equal(result.fake.calls.connectCount, 1);
  assert.equal(result.fake.calls.openActionCalls, 1);
  assert.equal(result.fake.calls.closeActionCalls, 1);
});

test('Stage D: false, missing, or wrong-type preflight performs no UI action and detaches', async (t) => {
  for (const mode of ['preflight-false', 'preflight-missing', 'preflight-wrong-type']) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.PREFLIGHT);
      assertExactLedger(result.parsed, 0, 0, 0);
      assert.equal(result.parsed.probe, null);
      assert.deepEqual(result.fake.calls.actionOrder, ['List', 'connect', 'preflight', 'release', 'detach']);
    });
  }
});

test('Stage D: close capability preflight fail-closes before every effect', async (t) => {
  for (const mode of [
    'close-capability-missing',
    'close-capability-throw',
    'close-capability-hang',
    'close-capability-nonboolean',
    'close-capability-disappear',
  ]) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.CLOSE_CAPABILITY);
      assertExactLedger(result.parsed, 0, 0, 0);
      assert.equal(result.fake.calls.openActionCalls, 0);
      assert.equal(result.fake.calls.closeActionCalls, 0);
      assert.deepEqual(result.fake.calls.actionOrder.slice(0, 4), [
        'List', 'connect', 'preflight', 'close-capability',
      ]);
      assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_CLOSE_CAPABILITY_SENTINEL/);
    });
  }

  await t.test('context drift after capability read', async () => {
    const result = await runDScenario('success', {
      afterActionDrift: {
        after: 'close-capability', kind: 'frame', patch: { loaderId: 'loader-drifted' },
      },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.CONTEXT_CHANGED);
    assertExactLedger(result.parsed, 0, 0, 0);
    assert.equal(result.fake.calls.openActionCalls, 0);
    assert.equal(result.fake.calls.closeActionCalls, 0);
  });
});

test('Stage D: open failures use fixed secret-safe classifications', async (t) => {
  for (const [mode, expectedCode] of [
    ['open-false', EXPECTED_ERROR_CODES.OPEN_ACTION_REJECTED],
    ['open-nonboolean', EXPECTED_ERROR_CODES.OPEN_NON_BOOLEAN],
    ['open-visibility-unproven', EXPECTED_ERROR_CODES.OPEN_VISIBILITY_UNPROVEN],
    ['open-throw', EXPECTED_ERROR_CODES.OPEN_PROTOCOL],
    ['open-page', EXPECTED_ERROR_CODES.OPEN_PAGE],
    ['open-hang', EXPECTED_ERROR_CODES.OPEN_DEADLINE],
    ['open-visibility-protocol', EXPECTED_ERROR_CODES.OPEN_PROTOCOL],
    ['open-visibility-page', EXPECTED_ERROR_CODES.OPEN_PAGE],
  ]) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, expectedCode);
      assert.equal(result.parsed.ledger.editor_open_attempt_count, 1);
      assert.equal(result.parsed.ledger.probe_invocation_count, 0);
      assert.equal(result.parsed.ledger.editor_close_attempt_count <= 1, true);
      assert.equal(result.fake.calls.openActionCalls, 1);
      assert.equal(result.fake.calls.closeActionCalls <= 1, true);
      assert.equal(result.parsed.ledger.retry_count, 0);
      assert.equal(result.parsed.ledger.fallback_count, 0);
      assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_OPEN/);
    });
  }
});

test('Stage D: probe throw/page failure consumes probe and closes once without raw leakage', async (t) => {
  for (const [mode, expectedCode] of [
    ['probe-throw', EXPECTED_ERROR_CODES.PROTOCOL],
    ['probe-page', EXPECTED_ERROR_CODES.PAGE],
  ]) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, expectedCode);
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.equal(result.fake.calls.closeActionCalls, 1);
      assert.equal(result.parsed.probe, null);
      assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_(?:PROBE|PAGE)_SENTINEL/);
    });
  }
});

test('Stage D: close failure or timeout never invokes a second close', async (t) => {
  for (const mode of ['close-throw', 'close-hang', 'close-false']) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.ok([EXPECTED_ERROR_CODES.CLOSE, EXPECTED_ERROR_CODES.DEADLINE].includes(result.parsed.error_code));
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.equal(result.fake.calls.closeActionCalls, 1);
      assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
    });
  }
});

test('Stage D: postflight failure reports OPEN only after a direct visibility proof', async (t) => {
  for (const [mode, expectedResidual] of [
    ['postflight-symbol-mismatch', 'UNKNOWN'],
    ['postflight-visibility-true', 'OPEN'],
    ['postflight-visibility-failure', 'UNKNOWN'],
  ]) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.POSTFLIGHT);
      assert.equal(result.parsed.editor_residual_state, expectedResidual);
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.equal(result.fake.calls.openActionCalls, 1);
      assert.equal(result.fake.calls.closeActionCalls, 1);
      assert.equal(result.fake.calls.visibilityAfterClose, 2);
      assert.equal(result.parsed.ledger.retry_count, 0);
      assert.equal(result.parsed.ledger.fallback_count, 0);
      assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_POSTFLIGHT_VISIBILITY_SENTINEL/);
    });
  }
});

test('Stage D: detach throw/timeout is sanitized and never retries', async (t) => {
  for (const mode of ['detach-throw', 'detach-hang']) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.ok([EXPECTED_ERROR_CODES.DETACH, EXPECTED_ERROR_CODES.DEADLINE].includes(result.parsed.error_code));
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_DETACH_SENTINEL|cause|stack/);
      assert.equal(result.fake.calls.connectCount, 1);
    });
  }
});

test('Stage D: fixed open and close closures call only the approved bottom-widget methods once', async () => {
  const result = await runDScenario('success');
  const capabilityParams = result.fake.calls.callFunctionOn.find((params) =>
    classifyDeclaration(params.functionDeclaration, result.probeDeclaration) === 'close-capability');
  const openParams = result.fake.calls.callFunctionOn.find((params) =>
    classifyDeclaration(params.functionDeclaration, result.probeDeclaration) === 'open');
  const closeParams = result.fake.calls.callFunctionOn.find((params) =>
    classifyDeclaration(params.functionDeclaration, result.probeDeclaration) === 'close');
  assert.ok(capabilityParams);
  assert.ok(openParams);
  assert.ok(closeParams);
  const calls = { activate: 0, click: 0, close: 0, focus: 0, hide: 0, input: 0, show: 0 };
  const sandbox = {
    window: {
      TradingView: {
        bottomWidgetBar: {
          activateScriptEditorTab() { calls.activate += 1; },
          close(...args) { assert.deepEqual(args, []); calls.close += 1; },
          hideWidget() { calls.hide += 1; },
          showWidget() { calls.show += 1; },
        },
      },
    },
  };
  assert.equal(vm.runInNewContext(`(${capabilityParams.functionDeclaration})()`, sandbox), true);
  assert.equal(vm.runInNewContext(`(${openParams.functionDeclaration})()`, sandbox), true);
  assert.equal(vm.runInNewContext(`(${closeParams.functionDeclaration})()`, sandbox), true);
  assert.deepEqual(calls, { activate: 1, click: 0, close: 1, focus: 0, hide: 0, input: 0, show: 0 });

  assert.equal(vm.runInNewContext(`(${openParams.functionDeclaration})()`, { window: {} }), false);
  assert.equal(vm.runInNewContext(`(${capabilityParams.functionDeclaration})()`, { window: {} }), false);
  assert.equal(vm.runInNewContext(`(${capabilityParams.functionDeclaration})()`, {
    window: {
      TradingView: {
        get bottomWidgetBar() { throw new Error('RAW_CAPABILITY_GETTER_SENTINEL'); },
      },
    },
  }), false);
  assert.equal(vm.runInNewContext(`(${closeParams.functionDeclaration})()`, { window: {} }), false);
  assert.doesNotMatch(openParams.functionDeclaration, /showWidget|\.click\s*\(|\.focus\s*\(|Input|dispatchKeyEvent/);
  assert.doesNotMatch(closeParams.functionDeclaration, /hideWidget|\.hide\s*\(|showWidget|\.click\s*\(|\.focus\s*\(|Input|dispatchKeyEvent/);
  assert.doesNotMatch(
    capabilityParams.functionDeclaration,
    /hideWidget\s*\(|activateScriptEditorTab\s*\(|\.close\s*\(|showWidget|\.click\s*\(|\.focus\s*\(|Input|dispatchKeyEvent/,
  );
});

test('Stage D: visibility read failures never fabricate a CLOSED observation', async (t) => {
  await t.test('exact closure returns fixed nonboolean when querySelector throws', async () => {
    const result = await runDScenario('success');
    assert.equal(result.exitCode, 0);
    assert.equal(result.parsed.editor_residual_state, 'CLOSED');
    const visibilityParams = result.fake.calls.callFunctionOn.find((params) =>
      classifyDeclaration(params.functionDeclaration, result.probeDeclaration) === 'visibility');
    assert.ok(visibilityParams);
    const value = vm.runInNewContext(`(${visibilityParams.functionDeclaration})()`, {
      document: {
        querySelector() {
          throw new Error('RAW_VISIBILITY_CLOSURE_SENTINEL');
        },
      },
    });
    assert.equal(value, null);
    assert.equal(vm.runInNewContext(`(${visibilityParams.functionDeclaration})()`, {
      document: { querySelector() { return null; } },
    }), false);
  });

  for (const mode of [
    'close-visibility-query-throw',
    'close-visibility-page',
    'close-visibility-nonboolean',
  ]) {
    await t.test(`${mode} is fixed CLOSE with unknown residual`, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.CLOSE);
      assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.notEqual(result.parsed.probe, null);
      assert.equal(result.fake.calls.closeActionCalls, 1);
      assert.equal(result.fake.calls.visibilityAfterClose, 1);
      assert.equal(result.parsed.ledger.retry_count, 0);
      assert.equal(result.parsed.ledger.fallback_count, 0);
      assert.doesNotMatch(
        result.state.stdoutWrites[0],
        /RAW_(?:VISIBILITY_QUERY|CLOSE_VISIBILITY)_SENTINEL/,
      );
    });
  }

  await t.test('open visibility query failure remains UNKNOWN when cleanup cannot prove false', async () => {
    const result = await runDScenario('open-visibility-query-throw');
    assert.equal(result.exitCode, 1);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.OPEN_PROTOCOL);
    assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
    assertExactLedger(result.parsed, 1, 0, 1);
    assert.equal(result.parsed.probe, null);
    assert.equal(result.fake.calls.openActionCalls, 1);
    assert.equal(result.fake.calls.closeActionCalls, 1);
    assert.equal(result.parsed.ledger.retry_count, 0);
    assert.equal(result.parsed.ledger.fallback_count, 0);
    assert.doesNotMatch(result.state.stdoutWrites[0], /RAW_VISIBILITY_QUERY_SENTINEL/);
  });

  await t.test('postflight visibility query failure stays UNKNOWN through detach failure', async () => {
    const result = await runDScenario('postflight-visibility-query-throw-detach');
    assert.equal(result.exitCode, 1);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.DETACH);
    assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
    assertExactLedger(result.parsed, 1, 1, 1);
    assert.notEqual(result.parsed.probe, null);
    assert.equal(result.fake.calls.closeActionCalls, 1);
    assert.equal(result.fake.calls.visibilityAfterClose, 2);
    assert.equal(result.parsed.ledger.retry_count, 0);
    assert.equal(result.parsed.ledger.fallback_count, 0);
    assert.doesNotMatch(
      result.state.stdoutWrites[0],
      /RAW_(?:VISIBILITY_QUERY|DETACH)_SENTINEL/,
    );
  });
});

test('Stage D: each visibility direction may poll eight times while its action remains exactly once', async (t) => {
  for (const [mode, openReads, closeReads] of [
    ['visibility-open-delayed', 8, 1],
    ['visibility-close-delayed', 1, 8],
  ]) {
    await t.test(mode, async () => {
      const result = await runDScenario(mode);
      assert.equal(result.exitCode, 0, JSON.stringify({
        errorCode: result.parsed?.error_code,
        openReads: result.fake.calls.visibilityAfterOpen,
        closeReads: result.fake.calls.visibilityAfterClose,
        timerCalls: result.state.timerCalls,
      }));
      assertExactLedger(result.parsed, 1, 1, 1);
      assert.equal(result.fake.calls.openActionCalls, 1);
      assert.equal(result.fake.calls.closeActionCalls, 1);
      assert.equal(result.fake.calls.visibilityAfterOpen, openReads);
      assert.equal(result.fake.calls.visibilityAfterClose, closeReads);
      assert.equal(result.fake.calls.inputCalls, 0);
      assert.equal(result.fake.calls.showWidgetCalls, 0);
    });
  }
});

test('Stage E: target selection accepts only one exact full ID and strict TradingView chart URL', async (t) => {
  const acceptedUrls = [
    'https://tradingview.com/chart',
    'https://www.tradingview.com/chart/',
    'https://sub.tradingview.com:443/chart/abc',
  ];
  for (const url of acceptedUrls) {
    await t.test(`accept ${url}`, async () => {
      const result = await runDScenario('success', {
        targetList: [{ id: EXPECTED_TARGET.id, type: 'page', url }],
      });
      assert.equal(result.exitCode, 0);
      assert.equal(result.fake.calls.listCount, 1);
      assert.equal(result.fake.calls.connectCount, 1);
    });
  }

  const exact = { id: EXPECTED_TARGET.id, type: 'page', url: 'https://www.tradingview.com/chart/abc' };
  const rejected = [
    ['prefix ID', [{ ...exact, id: EXPECTED_TARGET.id.slice(0, -1) }]],
    ['duplicate exact ID', [{ ...exact }, { ...exact }]],
    ['missing ID', [{ ...exact, id: undefined }]],
    ['wrong type', [{ ...exact, type: 'other' }]],
    ['String object URL', [{ ...exact, url: new String(exact.url) }]],
    ['invalid URL', [{ ...exact, url: 'not a url' }]],
    ['HTTP URL', [{ ...exact, url: 'http://www.tradingview.com/chart/abc' }]],
    ['username', [{ ...exact, url: 'https://user@www.tradingview.com/chart/abc' }]],
    ['password', [{ ...exact, url: 'https://user:pass@www.tradingview.com/chart/abc' }]],
    ['nonstandard port', [{ ...exact, url: 'https://www.tradingview.com:9443/chart/abc' }]],
    ['suffix confusion', [{ ...exact, url: 'https://tradingview.com.evil.example/chart/abc' }]],
    ['prefix confusion', [{ ...exact, url: 'https://eviltradingview.com/chart/abc' }]],
    ['chart evil path', [{ ...exact, url: 'https://www.tradingview.com/chart-evil' }]],
    ['non-chart path', [{ ...exact, url: 'https://www.tradingview.com/not-chart' }]],
  ];
  for (const [name, targetList] of rejected) {
    await t.test(`reject ${name}`, async () => {
      const result = await runDScenario('success', { targetList });
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.TARGET_REJECTED);
      assert.equal(result.fake.calls.listCount, 1);
      assert.equal(result.fake.calls.connectCount, 0);
      assert.equal(result.parsed.ledger.fallback_count, 0);
    });
  }
});

test('Stage E: accepted connection arguments are exact and no target fallback occurs', async () => {
  const result = await runDScenario('success');
  assert.equal(result.exitCode, 0);
  assert.equal(result.fake.calls.listCount, 1);
  assert.equal(result.fake.calls.connectCount, 1);
  assert.deepEqual(toHostPlain(result.fake.calls.connectArgs), [{
    host: '127.0.0.1',
    port: 9222,
    target: EXPECTED_TARGET.id,
  }]);
  assert.equal(result.parsed.ledger.fallback_count, 0);
});

test('Stage E: captures one default unique context and verifies target/frame/context before and after every action', async () => {
  const result = await runDScenario('success');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.fake.calls.listenerAdds.sort(), [
    'Page.frameNavigated',
    'Runtime.executionContextCreated',
    'Runtime.executionContextDestroyed',
    'Runtime.executionContextsCleared',
  ].sort());
  const majorActions = ['preflight', 'close-capability', 'open', 'probe', 'close', 'postflight'];
  for (const action of majorActions) {
    const position = result.fake.calls.trace.indexOf(action);
    assert.notEqual(position, -1, `${action} must execute`);
    assert.deepEqual(result.fake.calls.trace.slice(position - 2, position), ['target-info', 'frame-tree']);
    assert.deepEqual(result.fake.calls.trace.slice(position + 1, position + 3), ['target-info', 'frame-tree']);
  }
  for (const params of result.fake.calls.callFunctionOn) {
    assert.equal(params.uniqueContextId, 'unique-main');
    assert.equal('executionContextId' in params, false);
    assert.equal(params.returnByValue, true);
    assert.equal(params.awaitPromise, false);
    assert.equal(params.objectGroup, 'tradingview-mcp-pine-discovery-v1');
    assert.equal(typeof params.functionDeclaration, 'string');
  }
  assert.equal(result.fake.calls.targetInfoCount >= result.fake.calls.callFunctionOn.length * 2, true);
  assert.equal(result.fake.calls.frameTreeCount >= result.fake.calls.callFunctionOn.length * 2, true);
  assert.deepEqual(result.fake.calls.listenerRemoves.sort(), result.fake.calls.listenerAdds.sort());
});

test('Stage E: target-info drift is rejected by the same strict predicate before the next action', async (t) => {
  const driftCases = [
    ['targetId prefix', { targetId: EXPECTED_TARGET.id.slice(0, -1) }],
    ['targetId suffix', { targetId: `${EXPECTED_TARGET.id}0` }],
    ['type', { type: 'other' }],
    ['primitive URL', { url: new String('https://www.tradingview.com/chart/abc') }],
    ['invalid URL', { url: 'not a url' }],
    ['protocol', { url: 'http://www.tradingview.com/chart/abc' }],
    ['userinfo', { url: 'https://user@www.tradingview.com/chart/abc' }],
    ['port', { url: 'https://www.tradingview.com:9443/chart/abc' }],
    ['hostname', { url: 'https://tradingview.com.evil.example/chart/abc' }],
    ['path', { url: 'https://www.tradingview.com/chart-evil' }],
  ];
  for (const [name, patch] of driftCases) {
    await t.test(name, async () => {
      const result = await runDScenario('success', {
        afterActionDrift: { after: 'preflight', kind: 'target', patch },
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.CONTEXT_CHANGED);
      assert.equal(result.fake.calls.openActionCalls, 0);
      assertExactLedger(result.parsed, 0, 0, 0);
    });
  }
});

test('Stage E: frame, loader, destroy, clear, navigation, and numeric-ID reuse invalidate ownership', async (t) => {
  const driftCases = [
    ['frame ID', { after: 'preflight', kind: 'frame', patch: { id: 'frame-drifted' } }],
    ['loader ID', { after: 'preflight', kind: 'frame', patch: { loaderId: 'loader-drifted' } }],
    ['context destroyed', { after: 'preflight', kind: 'destroy' }],
    ['contexts cleared', { after: 'preflight', kind: 'clear' }],
    ['main frame navigated', { after: 'preflight', kind: 'frame-navigate' }],
    ['numeric context ID reused', { after: 'preflight', kind: 'context-reuse' }],
  ];
  for (const [name, afterActionDrift] of driftCases) {
    await t.test(name, async () => {
      const result = await runDScenario('success', { afterActionDrift });
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.CONTEXT_CHANGED);
      assert.equal(result.fake.calls.openActionCalls, 0);
      assertExactLedger(result.parsed, 0, 0, 0);
    });
  }
});

test('Stage E: release/detach stay bounded and forbidden domains remain unused', async () => {
  const result = await runDScenario('success');
  assert.equal(result.exitCode, 0);
  assert.equal(result.fake.calls.releaseCount, 1);
  assert.equal(result.fake.calls.actionOrder.filter((item) => item === 'detach').length, 1);
  assert.equal(result.fake.calls.inputCalls, 0);
  assert.doesNotMatch(result.source, /Runtime\.evaluate|Page\.reload|Input\.|fetch\(|https?\.request|WebSocket/);
  assert.doesNotMatch(result.source, /\bexecutionContextId\b/);
});

test('Stage F: child fault/hang matrix emits one sanitized SafeMain line within the hard boundary', async (t) => {
  const cases = [
    ['protocol', 1, EXPECTED_ERROR_CODES.PROTOCOL, 1, 1, 1, 'CLOSED'],
    ['page', 1, EXPECTED_ERROR_CODES.PAGE, 1, 1, 1, 'CLOSED'],
    ['late', 1, EXPECTED_ERROR_CODES.DEADLINE, 1, 1, 1, 'CLOSED'],
    ['list-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['connect-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['enable-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['frame-tree-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['context-wait-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['loader-hang', 70, EXPECTED_ERROR_CODES.HARD_DEADLINE, 0, 0, 0, 'UNKNOWN'],
    ['open-hang', 1, EXPECTED_ERROR_CODES.OPEN_DEADLINE, 1, 0, 1, 'CLOSED'],
    ['probe-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 1, 1, 1, 'CLOSED'],
    ['close-hang', 1, EXPECTED_ERROR_CODES.DEADLINE, 1, 1, 1, 'UNKNOWN'],
    ['work-abort', 1, EXPECTED_ERROR_CODES.OPEN_DEADLINE, 1, 0, 1, 'CLOSED'],
    ['hard-during-cleanup', 70, EXPECTED_ERROR_CODES.HARD_DEADLINE, 1, 1, 1, 'UNKNOWN'],
    ['matrix-invalid', 1, EXPECTED_ERROR_CODES.INTERNAL, 1, 1, 0, 'UNKNOWN'],
  ];
  for (const [mode, exitCode, errorCode, open, probe, close, residual] of cases) {
    await t.test(mode, async () => {
      const child = await runChildFixture(mode);
      assert.equal(child.signal, null);
      assert.equal(child.code, exitCode);
      assert.equal(child.stderr, '');
      assert.equal(child.elapsedMs < 2000, true);
      assert.equal(child.stdout.endsWith('\n'), true);
      const lines = child.stdout.trimEnd().split('\n');
      assert.equal(lines.length, 1);
      assert.doesNotMatch(
        child.stdout,
        /GATE_A0_RUNTIME_SENTINEL|RAW_|exceptionDetails|request|stack|cause|description/,
      );
      const payload = JSON.parse(lines[0]);
      assertSafeMainShape(payload);
      assert.equal(payload.success, false);
      assert.equal(payload.error_code, errorCode);
      assert.equal(payload.editor_residual_state, residual);
      assertExactLedger(payload, open, probe, close);
      if (mode !== 'close-hang') assert.equal(payload.probe, null);
      if (mode === 'hard-during-cleanup') {
        assert.notDeepEqual(payload.ledger, {
          editor_open_attempt_count: 0,
          probe_invocation_count: 0,
          editor_close_attempt_count: 0,
          retry_count: 0,
          fallback_count: 0,
        });
      }
    });
  }
});

test('Stage F: exact phase matrix preserves major rows and rejects phase-invalid combinations', async (t) => {
  const positiveCases = [
    ['preflight', 'preflight-false', {}, EXPECTED_ERROR_CODES.PREFLIGHT, 0, 0, 0, 'UNKNOWN', false],
    ['open', 'open-throw', {}, EXPECTED_ERROR_CODES.OPEN_PROTOCOL, 1, 0, 1, 'CLOSED', false],
    ['probe', 'probe-throw', {}, EXPECTED_ERROR_CODES.PROTOCOL, 1, 1, 1, 'CLOSED', false],
    ['close', 'close-false', {}, EXPECTED_ERROR_CODES.CLOSE, 1, 1, 1, 'UNKNOWN', true],
    [
      'close-context',
      'success',
      {
        afterActionDrift: {
          after: 'close',
          kind: 'target',
          patch: { targetId: `${EXPECTED_TARGET.id}0` },
        },
      },
      EXPECTED_ERROR_CODES.CONTEXT_CHANGED,
      1,
      1,
      1,
      'UNKNOWN',
      true,
    ],
    [
      'postflight-context',
      'success',
      {
        afterActionDrift: {
          after: 'postflight',
          kind: 'target',
          patch: { targetId: `${EXPECTED_TARGET.id}0` },
        },
      },
      EXPECTED_ERROR_CODES.CONTEXT_CHANGED,
      1,
      1,
      1,
      'UNKNOWN',
      true,
    ],
    ['postflight', 'postflight-symbol-mismatch', {}, EXPECTED_ERROR_CODES.POSTFLIGHT, 1, 1, 1, 'UNKNOWN', true],
    ['detach', 'detach-throw', {}, EXPECTED_ERROR_CODES.DETACH, 1, 1, 1, 'CLOSED', true],
  ];
  for (const [name, mode, options, errorCode, open, probe, close, residual, hasProbe] of positiveCases) {
    await t.test(name, async () => {
      const result = await runDScenario(mode, options);
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, errorCode);
      assert.equal(result.parsed.editor_residual_state, residual);
      assertExactLedger(result.parsed, open, probe, close);
      assert.equal(result.parsed.probe !== null, hasProbe);
      assert.equal(result.state.stdoutWrites.length, 1);
      if (name === 'postflight-context') {
        const postflightIndex = result.fake.calls.trace.indexOf('postflight');
        assert.notEqual(postflightIndex, -1);
        assert.deepEqual(
          result.fake.calls.trace.slice(postflightIndex + 1).filter((entry) =>
            ['target-info', 'frame-tree', 'visibility'].includes(entry)),
          ['target-info'],
        );
        assert.equal(result.fake.calls.visibilityAfterClose, 1);
      }
    });
  }

  const preEffectCases = [
    [
      'pre-open identity drift stays BEFORE_OPEN',
      { boundary: 'pre-open', kind: 'drift', cleanup: 'success' },
      EXPECTED_ERROR_CODES.CONTEXT_CHANGED,
      0,
      0,
      'CLOSED',
    ],
    [
      'pre-open identity timeout stays BEFORE_OPEN',
      { boundary: 'pre-open', kind: 'timeout', cleanup: 'success' },
      EXPECTED_ERROR_CODES.DEADLINE,
      0,
      0,
      'CLOSED',
    ],
    [
      'pre-probe identity drift keeps OPEN and cleanup succeeds',
      { boundary: 'pre-probe', kind: 'drift', cleanup: 'success' },
      EXPECTED_ERROR_CODES.CONTEXT_CHANGED,
      1,
      1,
      'CLOSED',
    ],
    [
      'pre-probe identity drift keeps OPEN and cleanup is rejected',
      { boundary: 'pre-probe', kind: 'drift', cleanup: 'reject' },
      EXPECTED_ERROR_CODES.CONTEXT_CHANGED,
      0,
      0,
      'UNKNOWN',
    ],
    [
      'pre-probe identity timeout keeps OPEN and cleanup succeeds',
      { boundary: 'pre-probe', kind: 'timeout', cleanup: 'success' },
      EXPECTED_ERROR_CODES.OPEN_DEADLINE,
      1,
      1,
      'CLOSED',
    ],
  ];
  for (const [name, identityFault, errorCode, close, closeActions, residual] of preEffectCases) {
    await t.test(name, async () => {
      const result = await runDScenario('success', { identityFault });
      const open = identityFault.boundary === 'pre-open' ? 0 : 1;
      assert.equal(result.exitCode, 1);
      assert.equal(result.parsed.error_code, errorCode);
      assert.equal(result.parsed.editor_residual_state, residual);
      assertExactLedger(result.parsed, open, 0, close);
      assert.equal(result.parsed.probe, null);
      assert.equal(result.fake.calls.openActionCalls, open);
      assert.equal(result.fake.calls.closeActionCalls, closeActions);
      assert.equal(
        result.fake.calls.callFunctionOn.some((params) =>
          classifyDeclaration(params.functionDeclaration, result.probeDeclaration) === 'probe'),
        false,
      );
      assert.equal(result.state.stdoutWrites.length, 1);
    });
  }

  await t.test('OPEN phase never serializes OPEN from a cleanup visibility proof', async () => {
    const result = await runDScenario('open-throw-close-visible');
    assert.equal(result.exitCode, 1);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.OPEN_PROTOCOL);
    assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
    assertExactLedger(result.parsed, 1, 0, 1);
    assert.equal(result.fake.calls.closeActionCalls, 1);
    assert.equal(result.fake.calls.visibilityAfterClose > 0, true);
    assert.equal(result.state.stdoutWrites.length, 1);
  });

  await t.test('probe phase with no close proof terminates INTERNAL with truthful ledger', async () => {
    const result = await runDScenario('success', {
      afterActionDrift: {
        after: 'probe',
        kind: 'target',
        patch: { targetId: `${EXPECTED_TARGET.id}0` },
      },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.INTERNAL);
    assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
    assertExactLedger(result.parsed, 1, 1, 0);
    assert.equal(result.parsed.probe, null);
    assert.equal(result.state.stdoutWrites.length, 1);
  });
});

test('Stage F: stdout callback and mapped fallback each produce one write and one exit', async () => {
  const callbackResult = await runArtifactCli([]);
  assert.equal(callbackResult.exitCode, 1);
  assert.equal(callbackResult.state.stdoutWrites.length, 1);
  assert.deepEqual(callbackResult.state.exits, [1]);

  const fallbackResult = await runArtifactCli([], { stdoutCallbackMode: 'never' });
  assert.equal(fallbackResult.exitCode, 1);
  assert.equal(fallbackResult.state.stdoutWrites.length, 1);
  assert.equal(fallbackResult.state.stdoutCallbacks, 1);
  assert.deepEqual(fallbackResult.state.exits, [1]);
  assertSafeMainShape(fallbackResult.parsed);

  const importOnly = await loadArtifact();
  const digest = independentArtifactDigest(importOnly.source);
  const fake = createFakeCdp({
    mode: 'success',
    probeDeclaration: importOnly.namespace.PROBE_FUNCTION_DECLARATION,
  });
  const successApproval = await createApprovalFixture(digest);
  const successFallback = await runArtifactCli(
    [`--bundle-sha256=${digest}`],
    {
      dynamicDefault: fake.cdp,
      stdoutCallbackMode: 'never',
      env: { PINE_DISCOVERY_APPROVAL_FILE: successApproval.approvalPath },
    },
  ).finally(() => cleanupApprovalFixture(successApproval));
  assert.equal(successFallback.exitCode, 0);
  assert.equal(successFallback.state.stdoutWrites.length, 1);
  assert.deepEqual(successFallback.state.exits, [0]);
  assertSafeMainShape(successFallback.parsed);
});

test('Stage F: total hard owner emits truthful once-only snapshot before a late loader settles', async () => {
  const importOnly = await loadArtifact();
  const digest = independentArtifactDigest(importOnly.source);
  const fake = createFakeCdp({
    mode: 'success',
    probeDeclaration: importOnly.namespace.PROBE_FUNCTION_DECLARATION,
  });
  const fixture = await createApprovalFixture(digest);
  const result = await runArtifactCli(
    [`--bundle-sha256=${digest}`],
    {
      env: { PINE_DISCOVERY_APPROVAL_FILE: fixture.approvalPath },
      dynamicModuleFactory: (context) => new Promise((resolveModule) => {
        globalThis.setTimeout(async () => {
          resolveModule(await createDynamicCdpModule(context, fake.cdp));
        }, 400);
      }),
    },
  ).finally(() => cleanupApprovalFixture(fixture));
  assert.equal(result.exitCode, 70);
  assertSafeMainShape(result.parsed);
  assert.equal(result.parsed.error_code, EXPECTED_ERROR_CODES.HARD_DEADLINE);
  assertExactLedger(result.parsed, 0, 0, 0);
  assert.equal(result.parsed.probe, null);
  assert.equal(result.parsed.editor_residual_state, 'UNKNOWN');
  await new Promise((resolvePromise) => globalThis.setTimeout(resolvePromise, 450));
  assert.equal(result.state.stdoutWrites.length, 1);
  assert.deepEqual(result.state.exits, [70]);
  assert.deepEqual(result.state.stderrWrites, []);
});

test('Stage F: source exposes fixed production deadlines only and no override channel', async () => {
  const { source } = await loadArtifact();
  for (const literal of ['1000', '20000', '10000', '30000', '100']) {
    assert.match(source, new RegExp(`\\b${literal}\\b`));
  }
  assert.doesNotMatch(
    source,
    /process\.env(?!\[APPROVAL_FILE_ENV\])|--(?:operation|work|cleanup|hard|flush|timer|deadline)|setTimeout\s*:\s*|clearTimeout\s*:\s*/,
  );
  assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+(?:runCli|executeMain|createLiveAdapter)/);
});
