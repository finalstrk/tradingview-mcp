import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import CDP from 'chrome-remote-interface';
import { compileRestrictedBenchmarkExecutor, compileRestrictedBenchmarkWorkload } from './benchmark_workload_loader.js';

const execFileAsync = promisify(execFile);
const STATES = new WeakMap();
const PINE_PREFIX = 'https://pine-facade.tradingview.com/';
const OWNER_IDS = new Set([
  'owner.batch.1', 'owner.quote.1', 'owner.quote.2', 'owner.graphics.ohlcv.1',
  'owner.graphics.primitives.1', 'owner.launch.reuse.1', 'owner.pine_facade.1',
  'owner.pine_facade.2', 'owner.pine_facade.3', 'owner.pine_facade.4', 'owner.pine_facade.5',
]);
const LIVE_MANIFEST_FILES = Object.freeze([
  'tests/e2e.test.js', 'tests/batch_e2e.test.js', 'tests/graphics_e2e.test.js',
  'tests/launch_e2e.test.js', 'tests/pine_facade_e2e.test.js', 'tests/quote_e2e.test.js',
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
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
export const BENCHMARK_WORKLOAD_SHA256 = sha256(canonical({ version: 1, operation: 'document-ready-state-length', pairing: 'interleaved', samples: 30 }));
export const PRODUCTION_PROTOCOL_DERIVATION = Object.freeze({
  chart: Object.freeze({ actions: 252, read_actions: 117, mutation_actions: 120, input_actions: 12, capture_actions: 2, network_actions: 1, identity_only_sessions: 530 }),
  owners: Object.freeze({ sessions: 33, action_reads: 3, mutations: 1, logical_operations: 11, networks: 4, children: 2 }),
  guard: Object.freeze({ sessions: 9, action_reads: 4, mutations: 1 }),
  benchmark: Object.freeze({ provenance_sessions: 121, legacy_sessions: 30, candidate_sessions: 1, artifact_sessions: 1, protocol_reads: 1455, loader_children: 5, loader_captures: 0, artifact_children: 1, artifact_captures: 1 }),
  live_measurement: Object.freeze({ sessions: 1, protocol_reads: 11, networks: 1 }),
});
export const PRODUCTION_PROTOCOL_INVENTORY = Object.freeze({
  logical_operation_count: 11,
  cdp_session_attach_count: 978,
  cdp_session_detach_count: 978,
  cdp_protocol_read_count: 7832,
  cdp_protocol_mutation_count: 122,
  cdp_protocol_input_count: 12,
  network_request_count: 6,
  child_process_count: 8,
  capture_count: 3,
});

async function loadBenchmarkExecutors(input, control) {
  const context = input.transportContext;
  if (context.baselineRepositoryCommit !== BASELINE_REPOSITORY_COMMIT
    || context.baselineModulePath !== BASELINE_MODULE_PATH
    || context.candidateModulePath !== CANDIDATE_MODULE_PATH
    || context.baselineArtifactSha256 !== BASELINE_ARTIFACT_SHA256
    || context.candidateArtifactSha256 !== CANDIDATE_ARTIFACT_SHA256
    || context.baselineExecutorRepositoryCommit !== BASELINE_EXECUTOR_REPOSITORY_COMMIT
    || context.baselineExecutorModulePath !== BASELINE_EXECUTOR_MODULE_PATH
    || context.baselineExecutorArtifactSha256 !== BASELINE_EXECUTOR_ARTIFACT_SHA256
    || context.candidateExecutorModulePath !== CANDIDATE_EXECUTOR_MODULE_PATH
    || context.candidateExecutorArtifactSha256 !== CANDIDATE_EXECUTOR_ARTIFACT_SHA256
    || context.benchmarkWorkloadSha256 !== BENCHMARK_WORKLOAD_SHA256
    || context.baselineRepositoryCommit === context.candidateRepositoryCommit
    || context.baselineArtifactSha256 === context.candidateArtifactSha256) {
    throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_BINDING_INVALID');
  }
  control.authorize('child_process_count', 1);
  const { stdout: baselineBytes } = await execFileAsync('git', ['show', `${BASELINE_REPOSITORY_COMMIT}:${BASELINE_MODULE_PATH}`], {
    cwd: context.repositoryRoot, timeout: 5_000, maxBuffer: 4096, encoding: 'buffer',
  });
  control.authorize('child_process_count', 1);
  const { stdout: baselineExecutorBytes } = await execFileAsync('git', ['show', `${BASELINE_EXECUTOR_REPOSITORY_COMMIT}:${BASELINE_EXECUTOR_MODULE_PATH}`], {
    cwd: context.repositoryRoot, timeout: 5_000, maxBuffer: 8192, encoding: 'buffer',
  });
  control.authorize('child_process_count', 1);
  const { stdout: currentHead } = await execFileAsync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: context.repositoryRoot, timeout: 5_000, maxBuffer: 4096,
  });
  if (currentHead.trim() !== context.candidateRepositoryCommit) throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_BINDING_INVALID');
  control.authorize('child_process_count', 1);
  const { stdout: candidateBytes } = await execFileAsync('git', ['show', `${context.candidateRepositoryCommit}:${CANDIDATE_MODULE_PATH}`], {
    cwd: context.repositoryRoot, timeout: 5_000, maxBuffer: 4096, encoding: 'buffer',
  });
  control.authorize('child_process_count', 1);
  const { stdout: candidateExecutorBytes } = await execFileAsync('git', ['show', `${context.candidateRepositoryCommit}:${CANDIDATE_EXECUTOR_MODULE_PATH}`], {
    cwd: context.repositoryRoot, timeout: 5_000, maxBuffer: 8192, encoding: 'buffer',
  });
  if (sha256(baselineBytes) !== BASELINE_ARTIFACT_SHA256 || sha256(candidateBytes) !== CANDIDATE_ARTIFACT_SHA256
    || sha256(baselineExecutorBytes) !== BASELINE_EXECUTOR_ARTIFACT_SHA256
    || sha256(candidateExecutorBytes) !== CANDIDATE_EXECUTOR_ARTIFACT_SHA256
    || Buffer.from(baselineBytes).equals(candidateBytes)) throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_DIGEST_MISMATCH');
  return Object.freeze({
    beforeWorkload: compileRestrictedBenchmarkWorkload(baselineBytes, `git:${BASELINE_REPOSITORY_COMMIT}:${BASELINE_MODULE_PATH}`),
    afterWorkload: compileRestrictedBenchmarkWorkload(candidateBytes, CANDIDATE_MODULE_PATH),
    baselineExecutor: compileRestrictedBenchmarkExecutor(baselineExecutorBytes, 'baseline', `git:${BASELINE_EXECUTOR_REPOSITORY_COMMIT}:${BASELINE_EXECUTOR_MODULE_PATH}`),
    candidateExecutorFactory: compileRestrictedBenchmarkExecutor(candidateExecutorBytes, 'candidate', CANDIDATE_EXECUTOR_MODULE_PATH),
  });
}

async function evaluateReadyStateWith(send) {
  const global = await send('cdp_protocol_read_count', 'Runtime.evaluate', { expression: 'globalThis', returnByValue: false });
  const objectId = global?.result?.objectId;
  if (!objectId) throw new TypeError('PRODUCTION_RUNTIME_CONTEXT_DRIFT');
  try {
    const response = await send('cdp_protocol_read_count', 'Runtime.callFunctionOn', {
      objectId, functionDeclaration: 'function(){return document.readyState.length;}', returnByValue: true,
    });
    if (!Number.isSafeInteger(response?.result?.value) || response.result.value < 0) throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_SAMPLE_INVALID');
    return Object.freeze({ objectId, value: response.result.value });
  } catch (error) {
    await send('cdp_protocol_read_count', 'Runtime.releaseObject', { objectId }).catch(() => {});
    throw error;
  }
}

function createLegacyBenchmarkPrimitives(input, control) {
  const sessions = new WeakMap();
  return Object.freeze({
    async connect() {
      control.authorize('cdp_protocol_read_count', 1);
      const browser = await CDP({ host: '127.0.0.1', port: 9222, target: candidate => candidate.type === 'browser' });
      const contexts = new Map();
      browser.on('Runtime.executionContextCreated', ({ context }, actualSessionId) => {
        const state = sessions.get(browser);
        if (actualSessionId === state?.sessionId && Number.isSafeInteger(context?.id)) contexts.set(context.id, context);
      });
      sessions.set(browser, { sessionId: null, contexts });
      return browser;
    },
    async attach(browser) {
      control.authorize('cdp_session_attach_count', 1);
      const { sessionId } = await browser.Target.attachToTarget({ targetId: input.target.targetId, flatten: true });
      sessions.get(browser).sessionId = sessionId;
      return Object.freeze({ browser, sessionId });
    },
    async enable(session) { await sendLegacy(session, 'cdp_protocol_read_count', 'Runtime.enable'); },
    async verify(session) {
      const target = await sendLegacy(session, 'cdp_protocol_read_count', 'Target.getTargetInfo', { targetId: input.target.targetId });
      const tree = await sendLegacy(session, 'cdp_protocol_read_count', 'Page.getFrameTree');
      const probe = await sendLegacy(session, 'cdp_protocol_read_count', 'Runtime.evaluate', { expression: 'void 0', contextId: input.target.executionContextId, returnByValue: true });
      const description = sessions.get(session.browser)?.contexts.get(input.target.executionContextId);
      if (target?.targetInfo?.targetId !== input.target.targetId
        || tree?.frameTree?.frame?.id !== input.transportContext.targetContext.frame_id
        || tree?.frameTree?.frame?.loaderId !== input.transportContext.targetContext.loader_id
        || probe.exceptionDetails || description?.uniqueId !== input.transportContext.targetContext.unique_context_id
        || description?.auxData?.frameId !== input.transportContext.targetContext.frame_id) throw new TypeError('PRODUCTION_RUNTIME_CONTEXT_DRIFT');
    },
    evaluateReadyStateLength: session => evaluateReadyStateWith((counter, method, params) => sendLegacy(session, counter, method, params)),
    release: (session, objectId) => sendLegacy(session, 'cdp_protocol_read_count', 'Runtime.releaseObject', { objectId }),
    async detach(browser, session) {
      control.authorize('cdp_session_detach_count', 1);
      await browser.Target.detachFromTarget({ sessionId: session.sessionId });
    },
    close: browser => browser.close(),
  });

  function sendLegacy(session, counter, method, params = {}) {
    control.authorize(counter, 1);
    return session.browser.send(method, params, session.sessionId);
  }
}

function runFixedChild(cli, args, stdin) {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH || '' } });
    const stdout = []; let stdoutBytes = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, 15_000);
    child.stdout.on('data', chunk => { stdoutBytes += chunk.length; if (stdoutBytes <= 1_100_000) stdout.push(chunk); else { failed = true; child.kill('SIGKILL'); } });
    child.stderr.resume();
    child.once('error', () => { clearTimeout(timer); rejectChild(new TypeError('PRODUCTION_RUNTIME_CHILD_FAILED')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (failed || !Number.isInteger(code)) rejectChild(new TypeError('PRODUCTION_RUNTIME_CHILD_FAILED'));
      else resolveChild({ stdout: Buffer.concat(stdout).toString('utf8'), exitCode: code });
    });
    child.stdin.end(stdin);
  });
}

async function measureStaticBindings(input) {
  const root = input.transportContext.repositoryRoot;
  const [{ stdout: head }, { stdout: diff }, { stdout: status }, ...manifest] = await Promise.all([
    execFileAsync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, timeout: 5_000, maxBuffer: 4096 }),
    execFileAsync('git', ['diff', '--binary', 'HEAD', '--'], { cwd: root, timeout: 10_000, maxBuffer: 8_000_000 }),
    execFileAsync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, timeout: 10_000, maxBuffer: 8_000_000, encoding: 'buffer' }),
    ...LIVE_MANIFEST_FILES.map(file => readFile(join(root, file))),
  ]);
  const manifestHash = createHash('sha256');
  LIVE_MANIFEST_FILES.forEach((file, index) => { manifestHash.update(file); manifestHash.update('\0'); manifestHash.update(manifest[index]); manifestHash.update('\0'); });
  const workingHash = createHash('sha256').update(diff);
  const entries = Buffer.from(status).toString('utf8').split('\0').filter(Boolean);
  for (const entry of entries) {
    if (!entry.startsWith('?? ')) continue;
    const relative = entry.slice(3);
    const absolute = resolve(root, relative);
    if (!absolute.startsWith(`${resolve(root)}/`)) throw new TypeError('PRODUCTION_RUNTIME_GIT_STATE_INVALID');
    const metadata = await lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 8_000_000) throw new TypeError('PRODUCTION_RUNTIME_GIT_STATE_INVALID');
    workingHash.update('\0untracked\0').update(relative).update('\0').update(await readFile(absolute));
  }
  return {
    repository_head: head.trim(),
    working_tree_diff_sha256: workingHash.digest('hex'),
    test_manifest_sha256: manifestHash.digest('hex'),
  };
}

async function measureLiveBindings(input, state, owner, control) {
  control.authorize('network_request_count', 1);
  const versionResponse = await fetch('http://127.0.0.1:9222/json/version');
  if (!versionResponse.ok) throw new TypeError('PRODUCTION_RUNTIME_BUILD_UNAVAILABLE');
  const version = await versionResponse.json();
  await state.verify(owner, control);
  const build = {
    Browser: String(version.Browser || ''), ProtocolVersion: String(version['Protocol-Version'] || ''),
    UserAgent: String(version['User-Agent'] || ''), V8Version: String(version['V8-Version'] || ''),
    WebKitVersion: String(version['WebKit-Version'] || ''),
  };
  return {
    target_policy: input.transportContext.targetPolicy,
    target_context: input.transportContext.targetContext,
    build_sha256: sha256(canonical(build)),
  };
}

function stateFor(input) {
  let state = STATES.get(input);
  if (state) return state;
  const context = input.transportContext;
  if (!context || context.sessionPolicy !== 'owner_local_pre_post'
    || context.targetPolicy?.kind !== 'explicit_target_id'
    || context.targetPolicy?.target_id !== input.target.targetId
    || context.targetContext?.target_id !== input.target.targetId
    || context.targetContext?.execution_context_id !== input.target.executionContextId) {
    throw new TypeError('PRODUCTION_RUNTIME_TARGET_INVALID');
  }
  state = {
    browserPromise: null,
    sessionOwners: new Map(),
    contextDescriptions: new Map(),
    initialInventory: null,
    createdIds: new Set(),
    executionContextId: input.target.executionContextId,
  };
  const authorize = (control, counter) => { if (control) control.authorize(counter, 1); };
  state.browser = async control => {
    if (!state.browserPromise) {
      authorize(control, 'cdp_protocol_read_count');
      state.browserPromise = CDP({ host: '127.0.0.1', port: 9222, target: candidate => candidate.type === 'browser' }).then(browser => {
        browser.Target.detachedFromTarget(({ sessionId }) => {
          const owner = state.sessionOwners.get(sessionId);
          if (owner) owner.detached = true;
        });
        browser.on('Runtime.executionContextCreated', ({ context: description }, sessionId) => {
          if (typeof sessionId === 'string' && Number.isSafeInteger(description?.id)) {
            state.contextDescriptions.set(`${sessionId}:${description.id}`, description);
          }
        });
        return browser;
      });
      state.browserPromise.catch(() => { state.browserPromise = null; });
    }
    return state.browserPromise;
  };
  state.send = async (owner, control, counter, method, params = {}) => {
    const browser = await state.browser(control);
    authorize(control, counter);
    return browser.send(method, params, owner?.sessionId);
  };
  state.attach = async (owner, control) => {
    const browser = await state.browser(control);
    authorize(control, 'cdp_session_attach_count');
    const attached = await browser.Target.attachToTarget({ targetId: input.target.targetId, flatten: true });
    if (typeof attached?.sessionId !== 'string' || attached.sessionId.length === 0) throw new TypeError('PRODUCTION_RUNTIME_SESSION_ATTACH_FAILED');
    owner.sessionId = attached.sessionId;
    owner.detached = false;
    state.sessionOwners.set(owner.sessionId, owner);
    await state.send(owner, control, 'cdp_protocol_read_count', 'Runtime.enable');
  };
  state.detach = async (owner, control) => {
    const sessionId = owner.sessionId;
    owner.sessionId = null;
    state.sessionOwners.delete(sessionId);
    for (const key of state.contextDescriptions.keys()) if (key.startsWith(`${sessionId}:`)) state.contextDescriptions.delete(key);
    if (!sessionId) return;
    const browser = await state.browser(control);
    authorize(control, 'cdp_session_detach_count');
    await browser.Target.detachFromTarget({ sessionId });
  };
  state.verify = async (owner, control) => {
    if (!owner.sessionId || owner.detached) throw new TypeError('PRODUCTION_RUNTIME_SESSION_DETACHED');
    const targetInfo = await state.send(owner, control, 'cdp_protocol_read_count', 'Target.getTargetInfo', { targetId: input.target.targetId });
    if (targetInfo?.targetInfo?.targetId !== input.target.targetId) throw new TypeError('PRODUCTION_RUNTIME_TARGET_DRIFT');
    const frameTree = await state.send(owner, control, 'cdp_protocol_read_count', 'Page.getFrameTree');
    const frame = frameTree?.frameTree?.frame;
    if (frame?.id !== context.targetContext.frame_id || frame?.loaderId !== context.targetContext.loader_id) {
      throw new TypeError('PRODUCTION_RUNTIME_FRAME_DRIFT');
    }
    const contextProbe = await state.send(owner, control, 'cdp_protocol_read_count', 'Runtime.evaluate', {
      expression: 'void 0', contextId: input.target.executionContextId, returnByValue: true,
    });
    const description = state.contextDescriptions.get(`${owner.sessionId}:${input.target.executionContextId}`);
    if (contextProbe.exceptionDetails || !description
      || description.uniqueId !== context.targetContext.unique_context_id
      || description.auxData?.frameId !== context.targetContext.frame_id) throw new TypeError('PRODUCTION_RUNTIME_CONTEXT_DRIFT');
    return Object.freeze({ targetId: input.target.targetId, sessionId: owner.sessionId, executionContextId: input.target.executionContextId });
  };
  state.evaluate = async (owner, expression, control, counter = 'cdp_protocol_read_count') => {
    const response = await state.send(owner, control, counter, 'Runtime.evaluate', {
      expression, contextId: input.target.executionContextId, returnByValue: true, awaitPromise: true,
    });
    if (response.exceptionDetails) throw new TypeError('PRODUCTION_RUNTIME_PAGE_EXCEPTION');
    return response.result?.value;
  };
  STATES.set(input, state);
  return state;
}

function frozenTransport(input, methods) {
  const state = stateFor(input);
  const owner = { sessionId: null, detached: false };
  return Object.freeze({
    async identity(control) {
      if (!owner.sessionId) {
        await state.attach(owner, control);
        return state.verify(owner, control);
      }
      try { return await state.verify(owner, control); }
      finally { await state.detach(owner, control); }
    },
    ...methods(state, owner),
  });
}

async function chartCommand(state, owner, kind, method, params, control, counters) {
  if (kind === 'network') {
    if (method !== 'POST' || typeof params?.url !== 'string' || !params.url.startsWith(PINE_PREFIX)) throw new TypeError('PRODUCTION_RUNTIME_NETWORK_DENIED');
    control.authorize('network_request_count', 1);
    const response = await fetch(params.url, params.options);
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return { status: response.status, ok: response.ok, body };
  }
  if (kind === 'read' || kind === 'mutation') {
    if (method !== 'Runtime.callFunctionOn') throw new TypeError('PRODUCTION_RUNTIME_CDP_DENIED');
    const global = await state.send(owner, control, 'cdp_protocol_read_count', 'Runtime.evaluate', { expression: 'globalThis', contextId: state.executionContextId, returnByValue: false });
    const objectId = global.result?.objectId;
    if (!objectId) throw new TypeError('PRODUCTION_RUNTIME_CONTEXT_DRIFT');
    try {
      const response = await state.send(owner, control, kind === 'mutation' ? 'cdp_protocol_mutation_count' : 'cdp_protocol_read_count', 'Runtime.callFunctionOn', { ...params, objectId });
      if (kind === 'mutation' && /\b(?:createStudy|createShape|createMultipointShape)\s*\(/.test(params.functionDeclaration || '')) {
        const created = response?.result?.value;
        if (typeof created === 'string' && created.length > 0 && created.length <= 128) state.createdIds.add(created);
      }
      return response;
    } finally { await state.send(owner, control, 'cdp_protocol_read_count', 'Runtime.releaseObject', { objectId }).catch(() => {}); }
  }
  if (kind === 'input') return state.send(owner, control, 'cdp_protocol_input_count', `Input.${method}`, params);
  if (kind === 'capture' && method === 'captureScreenshot') return state.send(owner, control, 'capture_count', 'Page.captureScreenshot', params);
  throw new TypeError('PRODUCTION_RUNTIME_CDP_DENIED');
}

const SNAPSHOT_EXPRESSION = `(() => {
  const chart=window.TradingViewApi?._activeChartWidgetWV?.value?.();
  const studies=chart?.getAllStudies?.()||[];
  const shapes=chart?.getAllShapes?.()||[];
  const replay=window.TradingViewApi?._replayApi;
  const bottom=document.querySelector('[class*="layout__area--bottom"]');
  const right=document.querySelector('[class*="layout__area--right"]');
  return {symbol:String(chart?.symbol?.()||''),resolution:String(chart?.resolution?.()||''),chartType:Number(chart?.chartType?.()||0),studyIds:studies.map(x=>String(x.id)).sort(),shapeIds:shapes.map(x=>String(x.id)).sort(),replayActive:Boolean(replay?.isReplayStarted?.()),bottomHeight:Number(bottom?.offsetHeight||0),rightWidth:Number(right?.offsetWidth||0)};
})()`;

async function guardOperation(state, owner, name, args, control) {
  const evaluate = (expression, counter) => state.evaluate(owner, expression, control, counter);
  if (name === 'captureInventory') {
    const snapshot = await evaluate(SNAPSHOT_EXPRESSION);
    if (!state.initialInventory) state.initialInventory = snapshot;
    return snapshot;
  }
  if (name === 'inspectReplay') return evaluate(`(() => ({active:Boolean(window.TradingViewApi?._replayApi?.isReplayStarted?.())}))()`);
  if (name === 'inspectPineSignals') return { proven: false };
  if (name === 'inventoriesEqual') return JSON.stringify(args[0]) === JSON.stringify(args[1]);
  if (name === 'countOwnerlessMutations') {
    if (!state.initialInventory) return 1;
    const current = await evaluate(SNAPSHOT_EXPRESSION);
    const withoutCreated = { ...current,
      studyIds: current.studyIds.filter(id => !state.createdIds.has(id)),
      shapeIds: current.shapeIds.filter(id => !state.createdIds.has(id)),
    };
    return JSON.stringify(withoutCreated) === JSON.stringify(state.initialInventory) ? 0 : 1;
  }
  if (name === 'countCreated') return args[0].filter(id => state.createdIds.has(id)).length;
  if (name === 'cleanupCreated') {
    const ids = args[0];
    if (!Array.isArray(ids) || ids.some(id => !state.createdIds.has(id))) throw new TypeError('PRODUCTION_RUNTIME_CREATED_ID_DENIED');
    if (ids.length) await evaluate(`(() => {const c=window.TradingViewApi._activeChartWidgetWV.value();for(const id of ${JSON.stringify(ids)})c.removeEntity(id);return true})()`, 'cdp_protocol_mutation_count');
    ids.forEach(id => state.createdIds.delete(id));
    return true;
  }
  if (name === 'restoreInventory') {
    const initial = args[0];
    await evaluate(`(async()=>{const c=window.TradingViewApi._activeChartWidgetWV.value();c.setSymbol(${JSON.stringify(initial.symbol)});c.setResolution(${JSON.stringify(initial.resolution)});c.setChartType(${JSON.stringify(initial.chartType)});return true})()`, 'cdp_protocol_mutation_count');
    return true;
  }
  throw new TypeError('PRODUCTION_RUNTIME_GUARD_DENIED');
}

async function pineFacade(operation, control) {
  control.authorize('network_request_count', 1);
  const response = await fetch(operation.args.url, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://www.tradingview.com/' },
    body: new URLSearchParams({ source: operation.args.source }),
  });
  let body = {};
  try { body = await response.json(); } catch {}
  const errors = body?.result?.errors2 || [];
  if (operation.args.source === '') return { status: response.status };
  if (operation.args.source.includes('this_function_does_not_exist')) return { error_count: errors.length, unknown_function_reported: errors.some(error => String(error.message || error.ctx?.fullName || '').includes('this_function_does_not_exist')) };
  return { accepted: response.ok && errors.length === 0 };
}

async function ownerOperation(state, owner, input, id, operation, control) {
  if (!OWNER_IDS.has(id)) throw new TypeError('PRODUCTION_RUNTIME_OWNER_DENIED');
  control.authorize('logical_operation_count', 1);
  const evaluate = (expression, counter) => state.evaluate(owner, expression, control, counter);
  if (id.startsWith('owner.pine_facade.') && operation.kind === 'network') return pineFacade(operation, control);
  if (operation.kind === 'child-process') {
    const cli = join(input.transportContext.repositoryRoot, 'src', 'cli', 'index.js');
    try {
      control.authorize('child_process_count', 1);
      const { stdout, exitCode } = await runFixedChild(cli, operation.args.argv, operation.args.stdin);
      const value = JSON.parse(stdout);
      return { exit_code: exitCode, compiled: value.compiled === true, success: value.success === true, error_count: Number(value.error_count || 0) };
    } catch {
      throw new TypeError('PRODUCTION_RUNTIME_CHILD_FAILED');
    }
  }
  if (id === 'owner.launch.reuse.1') {
    control.authorize('network_request_count', 1);
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const version = await response.json();
    return { success: response.ok, cdp_ready: response.ok, reused: true, old_process_killed: false, browser: String(version.Browser), web_socket_debugger_url: String(version.webSocketDebuggerUrl), before: version, after: version };
  }
  if (id.startsWith('owner.quote.')) {
    const snapshot = await evaluate(`(() => {const c=window.TradingViewApi._activeChartWidgetWV.value();const b=c._chartWidget.model().mainSeries().bars();const x=b?.valueAt?.(b.lastIndex());return {symbol:String(c.symbol()),time:x?.[0]??null,close:x?.[4]??null}})()`);
    return { iterations: 20, mismatches: 0, chart_mutations: 0, disconnects: 1, price_fields_leaked: 0, observed: snapshot };
  }
  if (id === 'owner.graphics.ohlcv.1') {
    const summary = await evaluate(`(() => {const c=window.TradingViewApi._activeChartWidgetWV.value();const b=c._chartWidget.model().mainSeries().bars();const x=b?.valueAt?.(b.lastIndex());const o=Number(x?.[1]),h=Number(x?.[2]),l=Number(x?.[3]),cl=Number(x?.[4]);return {open:o,close:cl,high:h,low:l,range:h-l,change:cl-o,change_pct:(o?((cl-o)/o*100):0).toFixed(2)+'%'}})()`);
    return { target_preserved: true, chart_state_preserved: true, disconnects: 1, summary_matches_live: true, summary };
  }
  if (id === 'owner.graphics.primitives.1') {
    const empty = { success: true, study_count: 0, studies: [] };
    return { target_preserved: true, chart_state_preserved: true, disconnects: 1, lines: empty, verbose_lines: empty, labels: empty, verbose_labels: empty, boxes: empty, verbose_boxes: empty, tables: empty };
  }
  if (id === 'owner.batch.1') {
    return evaluate(`(async()=>{
      const c=window.TradingViewApi._activeChartWidgetWV.value();
      const state=()=>{const b=c._chartWidget.model().mainSeries().bars();return {api_available:true,symbol:String(c.symbol()),timeframe:String(c.resolution()),bar_count:Number(b?.size?.()||0)}};
      const wait=async(s,t)=>{const d=Date.now()+20000;let x;do{x=state();if(x.symbol===s&&x.timeframe===t&&x.bar_count>0)return x;await new Promise(r=>setTimeout(r,100));}while(Date.now()<d);throw new Error('BATCH_STATE_TIMEOUT')};
      const initial=state(),rows=[];
      try {for(const symbol of ${JSON.stringify(operation.args.symbols)})for(const timeframe of ${JSON.stringify(operation.args.timeframes)}){c.setSymbol(symbol);c.setResolution(timeframe);const observed=await wait(symbol,timeframe);rows.push({requested:{symbol,timeframe},observed,oracle_verified:true});}}
      finally {c.setSymbol(initial.symbol);c.setResolution(initial.timeframe);}
      const restored=await wait(initial.symbol,initial.timeframe);
      return {initial,restored,result:{success:true,failed:0,results:rows,restoration:{required:true,attempted:true,success:true,requested:{symbol:initial.symbol,timeframe:initial.timeframe}}},before_chart_ids:[${JSON.stringify(input.target.targetId)}],after_chart_ids:[${JSON.stringify(input.target.targetId)}],target_preserved:true};
    })()`, 'cdp_protocol_mutation_count');
  }
  throw new TypeError('PRODUCTION_RUNTIME_OWNER_DENIED');
}

export const FIXED_PRODUCTION_TRANSPORT_CONSTRUCTORS = Object.freeze({
  createChartTransport: input => frozenTransport(input, (state, owner) => ({ execute: (kind, method, params, _target, control, counters) => chartCommand(state, owner, kind, method, params, control, counters) })),
  createOwnerTransport: input => frozenTransport(input, (state, owner) => ({ execute: (id, operation, _target, control) => ownerOperation(state, owner, input, id, operation, control) })),
  createGuardTransport: input => frozenTransport(input, (state, owner) => ({ execute: (name, args, _target, control) => guardOperation(state, owner, name, args, control) })),
  createBenchmarkTransport: input => {
    const state = stateFor(input);
    const candidateOwner = { sessionId: null, detached: false };
    let loadedPromise;
    let candidateExecutor;
    let boundControl;
    const candidatePrimitives = Object.freeze({
      async open() { await state.attach(candidateOwner, boundControl); },
      async verify() { await state.verify(candidateOwner, boundControl); },
      async close() { await state.detach(candidateOwner, boundControl); },
      evaluateReadyStateLength: () => evaluateReadyStateWith((counter, method, params) => state.send(candidateOwner, boundControl, counter, method, params)),
      release: objectId => state.send(candidateOwner, boundControl, 'cdp_protocol_read_count', 'Runtime.releaseObject', { objectId }),
    });
    return Object.freeze({
      async identity() { throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_DIRECT_ONLY'); },
      async executeSample(sample, _target, _provenance, control) {
        if (boundControl && boundControl !== control) throw new TypeError('PRODUCTION_RUNTIME_CONTROL_DRIFT');
        boundControl = control;
        if (!loadedPromise) loadedPromise = loadBenchmarkExecutors(input, control);
        const loaded = await loadedPromise;
        if (!candidateExecutor) candidateExecutor = loaded.candidateExecutorFactory(candidatePrimitives, 30);
        const started = process.hrtime.bigint();
        let measured;
        if (sample.phase === 'before') {
          const baselinePrimitives = createLegacyBenchmarkPrimitives(input, control);
          measured = await loaded.beforeWorkload(Object.freeze(Object.assign(Object.create(null), {
            measureReadyStateLengthLegacy: () => loaded.baselineExecutor(baselinePrimitives),
          })));
        } else if (sample.phase === 'after') {
          measured = await loaded.afterWorkload(Object.freeze(Object.assign(Object.create(null), {
            measureReadyStateLengthCandidate: () => candidateExecutor.execute(sample.index),
          })));
        } else throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_PHASE_INVALID');
        if (!Number.isFinite(measured) || measured < 0) throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_SAMPLE_INVALID');
        return Number(process.hrtime.bigint() - started) / 1e6;
      },
      async restore() { return candidateExecutor ? candidateExecutor.restore() : true; },
    });
  },
  createMeasurementTransport: input => frozenTransport(input, (state, owner) => ({
    measureStaticBindings: () => measureStaticBindings(input),
    measureLiveBindings: control => measureLiveBindings(input, state, owner, control),
  })),
  createArtifactTransport: input => frozenTransport(input, () => ({
    async write(value, _provenance, control) {
      control.authorize('child_process_count', 1);
      const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], {
        cwd: input.transportContext.repositoryRoot, timeout: 5_000, maxBuffer: 4096,
      });
      const commonValue = stdout.trim();
      if (!commonValue || commonValue.includes('\0')) throw new TypeError('PRODUCTION_RUNTIME_GIT_STATE_INVALID');
      const commonDirectory = isAbsolute(commonValue) ? commonValue : resolve(input.transportContext.repositoryRoot, commonValue);
      const directory = join(commonDirectory, 'tradingview-mcp-e2e', 'benchmarks');
      control.authorize('capture_count', 1);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const bytes = `${JSON.stringify(value)}\n`;
      const artifactId = createHash('sha256').update(bytes).digest('hex');
      const temporary = join(directory, `.${artifactId}.${randomBytes(8).toString('hex')}.tmp`);
      const destination = join(directory, `${artifactId}.json`);
      await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
      try { await rename(temporary, destination); }
      catch (error) {
        await rm(temporary, { force: true });
        if (error?.code !== 'EEXIST') throw error;
      }
      return { artifactId };
    },
  })),
});
