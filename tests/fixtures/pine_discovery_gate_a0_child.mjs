import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod, lstat, mkdir, mkdtemp, open, readFile, readlink, rm, stat, unlink, writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import vm from 'node:vm';

const realProcess = process;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const mode = realProcess.argv[2];
const artifactPath = fileURLToPath(new URL('../../scripts/pine_discovery_gate_a1.mjs', import.meta.url));
const artifactUrl = new URL('../../scripts/pine_discovery_gate_a1.mjs', import.meta.url).href;
const source = await readFile(artifactPath, 'utf8');
const digest = createHash('sha256').update(Buffer.from(source)).digest('hex');
const sentinel = `GATE_A0_RUNTIME_SENTINEL_${mode}`;
const approvalDirectory = await mkdtemp('/tmp/tradingview-a1-child-approval-');
const approvalPath = resolve(approvalDirectory, 'approval.json');
const approvalNow = Date.now();
const approvalNonce = createHash('sha256').update(`${approvalDirectory}:${mode}`).digest('hex');
const approvalNonceHash = createHash('sha256').update(approvalNonce).digest('hex');
const childSpentPath = resolve(
  new URL('../../.git/tradingview-mcp-gate-a1/spent/', import.meta.url).pathname,
  `${approvalNonceHash}.json`,
);
await writeFile(approvalPath, JSON.stringify({
  schema_version: 1,
  nonce: approvalNonce,
  bundle_sha256: digest,
  target_id: '119DB9629A03197CFB120366EA6729CC',
  exact_command: `node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=${digest}`,
  issued_at: new Date(approvalNow - 1000).toISOString(),
  expires_at: new Date(approvalNow + 60_000).toISOString(),
  initial_tuple: {
    symbol: 'FX:USDJPY', resolution: '15', chart_type: 1, study_count: 12,
    shape_count: 0, replay_started: false, bottom_widget_open: false,
    pine_editor_open: false,
  },
  budgets: { open: 1, probe: 1, close: 1, retry: 0, fallback: 0 },
}), { mode: 0o600 });
await chmod(approvalPath, 0o600);

const allowedModes = new Set([
  'protocol',
  'page',
  'late',
  'list-hang',
  'connect-hang',
  'enable-hang',
  'frame-tree-hang',
  'context-wait-hang',
  'loader-hang',
  'open-hang',
  'probe-hang',
  'close-hang',
  'work-abort',
  'hard-during-cleanup',
  'matrix-invalid',
]);

if (!allowedModes.has(mode)) realProcess.exit(98);

const calls = {
  close: 0,
  exits: 0,
  open: 0,
  probe: 0,
  release: 0,
  stderr: [],
  stdout: [],
};

const keepAlive = globalThis.setInterval(() => {}, 1000);

function mappedDelay(delay) {
  if (mode === 'hard-during-cleanup') {
    if (delay === 1000) return 100;
    if (delay === 20000) return 30;
    if (delay === 10000) return 100;
    if (delay === 30000) return 50;
    if (delay === 100) return 1;
  }
  if (delay === 1000) return 5;
  if (delay === 20000) return 20;
  if (delay === 10000) return 10;
  if (delay === 30000) return 30;
  if (delay === 100) return 2;
  if (delay === 200) return 2;
  return Math.min(Number(delay) || 0, 5);
}

function mappedSetTimeout(callback, delay, ...args) {
  return realSetTimeout(callback, mappedDelay(delay), ...args);
}

function mappedClearTimeout(handle) {
  return realClearTimeout(handle);
}

function countsAreValid() {
  const expected = {
    protocol: [1, 1, 1],
    page: [1, 1, 1],
    late: [1, 1, 1],
    'list-hang': [0, 0, 0],
    'connect-hang': [0, 0, 0],
    'enable-hang': [0, 0, 0],
    'frame-tree-hang': [0, 0, 0],
    'context-wait-hang': [0, 0, 0],
    'loader-hang': [0, 0, 0],
    'open-hang': [1, 0, 1],
    'probe-hang': [1, 1, 1],
    'close-hang': [1, 1, 1],
    'work-abort': [1, 0, 1],
    'hard-during-cleanup': [1, 1, 1],
    'matrix-invalid': [1, 1, 0],
  }[mode];
  return expected
    && calls.open === expected[0]
    && calls.probe === expected[1]
    && calls.close === expected[2];
}

let exitStarted = false;

async function finalExit(code) {
  if (exitStarted) return;
  exitStarted = true;
  calls.exits += 1;
  if (calls.exits !== 1
    || calls.stdout.length !== 1
    || calls.stderr.length !== 0
    || !countsAreValid()) {
    globalThis.clearInterval(keepAlive);
    await unlink(childSpentPath).catch(() => {});
    await rm(approvalDirectory, { recursive: true, force: true });
    realProcess.exit(99);
    return;
  }
  await unlink(childSpentPath).catch(() => {});
  await rm(approvalDirectory, { recursive: true, force: true });
  realProcess.stdout.write(calls.stdout[0], () => {
    globalThis.clearInterval(keepAlive);
    realProcess.exit(code);
  });
}

const processStub = Object.freeze({
  argv: Object.freeze([
    realProcess.execPath,
    artifactPath,
    `--bundle-sha256=${digest}`,
  ]),
  env: Object.freeze({ PINE_DISCOVERY_APPROVAL_FILE: approvalPath }),
  execPath: realProcess.execPath,
  stdout: Object.freeze({
    write(chunk, encoding, callback) {
      calls.stdout.push(String(chunk));
      const completion = typeof encoding === 'function' ? encoding : callback;
      if (typeof completion === 'function') queueMicrotask(completion);
      return true;
    },
  }),
  stderr: Object.freeze({
    write(chunk) {
      calls.stderr.push(String(chunk));
      return true;
    },
  }),
  exit: finalExit,
});

const staticExports = Object.freeze({
  'node:crypto': Object.freeze({ createHash, timingSafeEqual }),
  'node:fs': Object.freeze({ constants }),
  'node:fs/promises': Object.freeze({ lstat, mkdir, open, readFile, readlink, stat }),
  'node:path': Object.freeze({ basename, dirname, resolve }),
  'node:url': Object.freeze({ fileURLToPath }),
  'node:util': Object.freeze({ types }),
});

async function syntheticBuiltin(context, specifier) {
  const values = staticExports[specifier];
  if (!values) throw new Error('fixture static import rejected');
  const names = Object.keys(values);
  const module = new vm.SyntheticModule(names, function setExports() {
    for (const name of names) this.setExport(name, values[name]);
  }, { context, identifier: `synthetic:${specifier}` });
  await module.link(() => { throw new Error('fixture synthetic dependency rejected'); });
  await module.evaluate();
  return module;
}

function neverSettles() {
  return new Promise(() => { void sentinel; });
}

function rawRejection() {
  return {
    message: sentinel,
    stack: sentinel,
    cause: { message: sentinel },
    request: { params: { sentinel } },
  };
}

function validProbeResult() {
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
  const valueTypes = ['object', 'string', 'number', 'number', 'string', 'string', 'boolean', 'boolean', 'string', 'boolean', 'string'];
  return {
    contract: 'gate-a0-v1',
    success: true,
    editor_found: true,
    candidate_count: paths.length,
    candidates: paths.map(([signal, owner, member], index) => ({
      signal,
      owner,
      member,
      available: true,
      value_type: valueTypes[index],
      stable: true,
      read_count: 2,
      error_code: 'NONE',
    })),
    error_code: null,
  };
}

function classify(functionDeclaration) {
  if (functionDeclaration.includes('pineSignalDiscoveryMainWorld')) return 'probe';
  if (functionDeclaration.includes('gate-a0-preflight-v1')) return 'preflight';
  if (functionDeclaration.includes('gate-a1-close-capability-v1')) return 'close-capability';
  if (functionDeclaration.includes('gate-a1-open-capability-v1')) return 'open-capability';
  if (functionDeclaration.includes('gate-a0-open-v1')) return 'open';
  if (functionDeclaration.includes('gate-a0-close-v1')) return 'close';
  if (functionDeclaration.includes('gate-a0-postflight-v1')) return 'postflight';
  if (functionDeclaration.includes('gate-a0-visibility-v1')) return 'visibility';
  return 'unknown';
}

function createFakeCdp() {
  const listTarget = {
    id: '119DB9629A03197CFB120366EA6729CC',
    type: 'page',
    url: 'https://www.tradingview.com/chart/gate-a0/',
  };
  const protocolTarget = {
    targetId: listTarget.id,
    type: listTarget.type,
    url: listTarget.url,
  };
  const frame = { id: 'frame-main', loaderId: 'loader-main' };
  const contextIdentity = {
    id: 7,
    uniqueId: 'unique-main',
    auxData: { isDefault: true, frameId: frame.id },
  };
  const listeners = new Map();
  let visibilityPhase = 'initial';
  let visibilityReads = 0;
  let probeFailed = false;
  let postProbeTargetReads = 0;
  let workDelayRemaining = 0;

  function emit(name, payload) {
    for (const handler of [...(listeners.get(name) ?? [])]) handler(payload);
  }

  function maybeDelayIdentity() {
    if (mode === 'work-abort' && workDelayRemaining > 0) {
      workDelayRemaining -= 1;
      return new Promise((resolvePromise) => realSetTimeout(resolvePromise, 3));
    }
    if (mode === 'hard-during-cleanup' && calls.probe === 1 && visibilityPhase !== 'after-close') {
      return new Promise((resolvePromise) => realSetTimeout(resolvePromise, 3));
    }
    return undefined;
  }

  const Runtime = {
    async enable() {
      if (mode === 'enable-hang') return neverSettles();
      if (mode !== 'context-wait-hang') {
        emit('Runtime.executionContextCreated', { context: { ...contextIdentity } });
      }
    },
    async callFunctionOn(params) {
      const action = classify(params.functionDeclaration);
      if (action === 'preflight') return { result: { type: 'boolean', value: true } };
      if (action === 'close-capability') return { result: { type: 'boolean', value: true } };
      if (action === 'open-capability') return { result: { type: 'boolean', value: true } };
      if (action === 'open') {
        calls.open += 1;
        visibilityPhase = 'after-open';
        visibilityReads = 0;
        if (mode === 'work-abort') workDelayRemaining = 2;
        if (mode === 'open-hang') return neverSettles();
        return { result: { type: 'boolean', value: true } };
      }
      if (action === 'probe') {
        calls.probe += 1;
        if (mode === 'protocol' || mode === 'matrix-invalid') {
          probeFailed = true;
          return Promise.reject(rawRejection());
        }
        if (mode === 'page') {
          return {
            exceptionDetails: {
              text: sentinel,
              exception: { description: sentinel, value: sentinel },
              stackTrace: { callFrames: [{ functionName: sentinel }] },
            },
          };
        }
        if (mode === 'late') {
          return new Promise((_, reject) => {
            realSetTimeout(() => reject(rawRejection()), 6);
          });
        }
        if (mode === 'probe-hang') return neverSettles();
        return { result: { type: 'object', value: validProbeResult() } };
      }
      if (action === 'close') {
        calls.close += 1;
        visibilityPhase = 'after-close';
        visibilityReads = 0;
        if (mode === 'close-hang') return neverSettles();
        return { result: { type: 'boolean', value: true } };
      }
      if (action === 'postflight') return { result: { type: 'boolean', value: true } };
      if (action === 'visibility') {
        visibilityReads += 1;
        if (visibilityPhase === 'after-open') {
          if (mode === 'work-abort') return { result: { type: 'boolean', value: visibilityReads >= 8 } };
          if (mode === 'hard-during-cleanup') return { result: { type: 'boolean', value: visibilityReads >= 5 } };
          return { result: { type: 'boolean', value: true } };
        }
        return { result: { type: 'boolean', value: false } };
      }
      return Promise.reject(rawRejection());
    },
    async releaseObjectGroup() {
      calls.release += 1;
      if (mode === 'hard-during-cleanup') return neverSettles();
    },
  };
  const Page = {
    async enable() {},
    async getFrameTree() {
      if (mode === 'frame-tree-hang') return neverSettles();
      await maybeDelayIdentity();
      return { frameTree: { frame: { ...frame } } };
    },
  };
  const Target = {
    async getTargetInfo() {
      await maybeDelayIdentity();
      if (mode === 'matrix-invalid' && probeFailed) {
        postProbeTargetReads += 1;
        if (postProbeTargetReads > 1) {
          return { targetInfo: { ...protocolTarget, url: 'https://evil.example/chart/' } };
        }
      }
      return { targetInfo: { ...protocolTarget } };
    },
  };
  const client = {
    Runtime,
    Page,
    Target,
    on(name, handler) {
      const handlers = listeners.get(name) ?? [];
      handlers.push(handler);
      listeners.set(name, handlers);
      return this;
    },
    removeListener(name, handler) {
      const handlers = listeners.get(name) ?? [];
      listeners.set(name, handlers.filter((candidate) => candidate !== handler));
      return this;
    },
    async close() {
      if (mode === 'hard-during-cleanup') return neverSettles();
    },
  };
  async function cdp() {
    if (mode === 'connect-hang') return neverSettles();
    return client;
  }
  cdp.List = async () => {
    if (mode === 'list-hang') return neverSettles();
    return [{ ...listTarget }];
  };
  return cdp;
}

async function dynamicCdpModule(context) {
  if (mode === 'loader-hang') return new Promise(() => { void sentinel; });
  const cdp = createFakeCdp();
  const module = new vm.SyntheticModule(['default'], function setDefault() {
    this.setExport('default', cdp);
  }, { context, identifier: 'synthetic:chrome-remote-interface' });
  await module.link(() => { throw new Error('fixture dynamic dependency rejected'); });
  await module.evaluate();
  return module;
}

const context = vm.createContext({
  AbortController,
  Buffer,
  TextDecoder,
  TextEncoder,
  URL,
  clearTimeout: mappedClearTimeout,
  process: processStub,
  queueMicrotask,
  setTimeout: mappedSetTimeout,
});

const artifact = new vm.SourceTextModule(source, {
  context,
  identifier: artifactUrl,
  initializeImportMeta(meta) {
    meta.url = artifactUrl;
  },
  async importModuleDynamically(specifier) {
    if (specifier !== 'chrome-remote-interface') throw new Error('fixture dynamic import rejected');
    return dynamicCdpModule(context);
  },
});

await artifact.link((specifier) => syntheticBuiltin(context, specifier));
await artifact.evaluate();
