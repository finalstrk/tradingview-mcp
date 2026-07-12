import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import * as health from '../src/core/health.js';
import { registerHealthTools } from '../src/tools/health.js';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

const READY = {
  Browser: 'TradingView/Test',
  'User-Agent': 'test-agent',
  webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test-session',
};

function fakeChild(onUnref) {
  const child = new EventEmitter();
  child.pid = 4242;
  child.unref = () => onUnref?.(child);
  return child;
}

function launchDeps(overrides = {}) {
  return {
    platform: 'linux',
    env: { HOME: '/home/test' },
    existsSync: path => path === '/opt/TradingView/tradingview',
    accessSync: () => {},
    execSync: () => Buffer.from(''),
    spawn: () => fakeChild(),
    probeCdpEndpoint: async () => null,
    sleep: async () => {},
    now: () => Date.now(),
    ...overrides,
  };
}

function assertFailure(result, phase, oldProcessKilled = false) {
  assert.equal(result.success, false);
  assert.equal(result.cdp_ready, false);
  assert.equal(result.phase, phase);
  assert.equal(result.old_process_killed, oldProcessKilled);
  assert.equal(typeof result.error, 'string');
  assert.equal(typeof result.recovery?.action, 'string');
  assert.equal(typeof result.recovery?.message, 'string');
}

describe('health launch — bounded CDP probe', () => {
  it('destroys a readiness response that never ends and settles within its deadline', async () => {
    assert.equal(typeof health.probeCdpEndpoint, 'function', 'probeCdpEndpoint must be exported');

    let destroyed = 0;
    const response = new EventEmitter();
    response.statusCode = 200;

    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = () => {
      destroyed++;
      request.emit('error', new Error('probe timed out'));
    };

    const startedAt = Date.now();
    const result = await health.probeCdpEndpoint({
      port: 9222,
      timeout_ms: 20,
      _deps: {
        httpGet: (_url, onResponse) => {
          queueMicrotask(() => onResponse(response));
          return request;
        },
      },
    });

    assert.equal(result, null);
    assert.equal(destroyed, 1);
    assert.ok(Date.now() - startedAt < 500, 'blackhole probe must settle promptly');
  });

  it('does not treat a non-200 version response as a healthy CDP endpoint', async () => {
    const response = new EventEmitter();
    response.statusCode = 503;
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = () => {};

    const resultPromise = health.probeCdpEndpoint({
      port: 9222,
      timeout_ms: 100,
      _deps: {
        httpGet: (_url, onResponse) => {
          queueMicrotask(() => {
            onResponse(response);
            response.emit('data', JSON.stringify(READY));
            response.emit('end');
          });
          return request;
        },
      },
    });

    assert.equal(await resultPromise, null);
  });
});

describe('health launch — failure-safe lifecycle', () => {
  it('reuses an existing healthy CDP endpoint without preflight, kill, or spawn', async () => {
    let prerequisiteChecks = 0;
    let killCalls = 0;
    let spawnCalls = 0;
    const result = await health.launch({
      port: 9222,
      _deps: launchDeps({
        probeCdpEndpoint: async () => READY,
        existsSync: () => { prerequisiteChecks++; return false; },
        accessSync: () => { prerequisiteChecks++; },
        execSync: () => { killCalls++; },
        spawn: () => { spawnCalls++; return fakeChild(); },
      }),
    });

    assert.equal(result.success, true);
    assert.equal(result.cdp_ready, true);
    assert.equal(result.reused, true);
    assert.equal(result.old_process_killed, false);
    assert.equal(result.web_socket_debugger_url, READY.webSocketDebuggerUrl);
    assert.equal(prerequisiteChecks, 0);
    assert.equal(killCalls, 0);
    assert.equal(spawnCalls, 0);
  });

  it('returns a preflight failure and performs zero kills when the binary is not executable', async () => {
    let killCalls = 0;
    let spawnCalls = 0;
    const deps = launchDeps({
      accessSync: () => { throw new Error('EACCES'); },
      execSync: command => {
        if (/pkill|taskkill/.test(command)) killCalls++;
        return Buffer.from('');
      },
      spawn: () => { spawnCalls++; return fakeChild(); },
    });

    const result = await health.launch({ port: 9222, _deps: deps });

    assertFailure(result, 'preflight');
    assert.equal(killCalls, 0);
    assert.equal(spawnCalls, 0);
  });

  it('handles an asynchronous spawn error without an uncaught exception', async () => {
    let killCalls = 0;
    const deps = launchDeps({
      execSync: command => {
        if (/pkill|taskkill/.test(command)) killCalls++;
        return Buffer.from('');
      },
      spawn: () => {
        const child = fakeChild(() => {
          queueMicrotask(() => child.emit('error', new Error('spawn EACCES')));
        });
        return child;
      },
      sleep: async () => { await Promise.resolve(); },
    });

    const result = await health.launch({ port: 9222, _deps: deps });

    assertFailure(result, 'spawn', true);
    assert.equal(killCalls, 1);
  });

  it('fails after bounded handoff grace when the launcher exits before CDP is ready', async () => {
    let now = 0;
    let probes = 0;
    const deps = launchDeps({
      now: () => now,
      sleep: async ms => { now += ms; await Promise.resolve(); },
      probeCdpEndpoint: async () => { probes++; return null; },
      spawn: () => {
        const child = fakeChild(() => queueMicrotask(() => child.emit('exit', 1, null)));
        return child;
      },
    });

    const result = await health.launch({
      port: 9222,
      kill_existing: false,
      overall_timeout_ms: 100,
      poll_interval_ms: 5,
      handoff_grace_ms: 20,
      _deps: deps,
    });

    assertFailure(result, 'child_exit');
    assert.ok(probes >= 2, 'CDP should still be probed during launcher handoff grace');
    assert.ok(now <= 30, `handoff failure exceeded grace: ${now}ms`);
  });

  it('cancels a blackholed readiness request when child handoff grace expires', async () => {
    const handoffGrace = 20;
    const schedulerMargin = 40;
    let requestCount = 0;
    let childExitAt = null;
    let readinessDestroyedAt = null;

    const deps = launchDeps({
      probeCdpEndpoint: health.probeCdpEndpoint,
      httpGet: (_url, onResponse) => {
        requestCount++;
        const currentRequest = requestCount;
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.destroy = () => {
          if (currentRequest === 2) readinessDestroyedAt = Date.now();
          request.emit('error', new Error('probe cancelled'));
        };

        if (currentRequest === 1) {
          queueMicrotask(() => request.emit('error', new Error('not ready')));
        } else {
          const response = new EventEmitter();
          response.statusCode = 200;
          queueMicrotask(() => onResponse(response));
        }
        return request;
      },
      spawn: () => {
        const child = fakeChild(() => {
          setTimeout(() => {
            childExitAt = Date.now();
            child.emit('exit', 0, null);
          }, 1);
        });
        return child;
      },
    });

    const startedAt = Date.now();
    const result = await health.launch({
      port: 9222,
      kill_existing: false,
      request_timeout_ms: 80,
      overall_timeout_ms: 200,
      poll_interval_ms: 5,
      handoff_grace_ms: handoffGrace,
      _deps: deps,
    });
    const settledAt = Date.now();

    assertFailure(result, 'child_exit');
    assert.equal(requestCount, 2);
    assert.ok(childExitAt !== null, 'child exit must occur during the readiness request');
    assert.ok(readinessDestroyedAt !== null, 'blackholed readiness request must be destroyed');
    assert.ok(
      readinessDestroyedAt - childExitAt <= handoffGrace + schedulerMargin,
      `readiness request outlived handoff grace: ${readinessDestroyedAt - childExitAt}ms`,
    );
    assert.ok(
      settledAt - startedAt <= handoffGrace + schedulerMargin,
      `launch outlived handoff grace: ${settledAt - startedAt}ms`,
    );
  });

  it('accepts launcher handoff when CDP becomes ready within the bounded grace', async () => {
    let now = 0;
    let probes = 0;
    const deps = launchDeps({
      now: () => now,
      sleep: async ms => { now += ms; await Promise.resolve(); },
      probeCdpEndpoint: async () => (++probes >= 3 ? READY : null),
      spawn: () => {
        const child = fakeChild(() => queueMicrotask(() => child.emit('exit', 0, null)));
        return child;
      },
    });

    const result = await health.launch({
      port: 9222,
      kill_existing: false,
      overall_timeout_ms: 100,
      poll_interval_ms: 5,
      handoff_grace_ms: 25,
      _deps: deps,
    });

    assert.equal(result.success, true);
    assert.equal(result.cdp_ready, true);
    assert.equal(result.reused, false);
    assert.equal(result.launcher_handoff, true);
    assert.ok(now <= 25);
  });

  it('enforces an overall deadline across repeated failed readiness probes', async () => {
    let now = 0;
    let probes = 0;
    const deps = launchDeps({
      now: () => now,
      sleep: async ms => { now += ms; },
      probeCdpEndpoint: async () => { probes++; return null; },
    });

    const result = await health.launch({
      port: 9222,
      kill_existing: false,
      overall_timeout_ms: 25,
      poll_interval_ms: 10,
      _deps: deps,
    });

    assertFailure(result, 'readiness');
    assert.ok(now <= 25, `overall deadline exceeded: ${now}ms`);
    assert.ok(probes >= 2);
  });

  it('attaches child lifecycle handlers before unref and cleans them after success', async () => {
    let probes = 0;
    let listenersAtUnref;
    const child = fakeChild(current => {
      listenersAtUnref = {
        error: current.listenerCount('error'),
        exit: current.listenerCount('exit'),
      };
    });
    const deps = launchDeps({
      probeCdpEndpoint: async () => (++probes >= 2 ? READY : null),
      spawn: () => child,
    });

    const result = await health.launch({ port: 9222, kill_existing: false, _deps: deps });

    assert.equal(result.success, true);
    assert.equal(result.cdp_ready, true);
    assert.deepEqual(listenersAtUnref, { error: 1, exit: 1 });
    assert.equal(child.listenerCount('error'), 0);
    assert.equal(child.listenerCount('exit'), 0);
    assert.equal(probes, 2, 'one preflight probe and one successful readiness probe');
  });
});

describe('health launch — MCP response', () => {
  it('documents reuse-first behavior and limits kill_existing to new-launch preflight', () => {
    let launchSchema;
    registerHealthTools({
      tool(name, _description, schema) {
        if (name === 'tv_launch') launchSchema = schema;
      },
    });

    assert.ok(launchSchema?.kill_existing, 'tv_launch must register kill_existing');
    assert.match(
      launchSchema.kill_existing.description,
      /healthy CDP endpoint.*always reused/i,
    );
    assert.match(
      launchSchema.kill_existing.description,
      /only before a new launch when no healthy CDP endpoint is available/i,
    );

    const help = spawnSync(process.execPath, [CLI, 'launch', '--help'], {
      encoding: 'utf8',
    });
    assert.equal(help.error, undefined);
    assert.equal(help.status, 0);
    assert.equal(help.stderr, '');
    assert.match(help.stdout, /healthy CDP endpoint.*always reused/i);
    assert.match(help.stdout, /new-launch preflight/i);
  });

  it('marks a structured launch failure as an MCP error result', async () => {
    let launchHandler;
    registerHealthTools({
      tool(name, _description, _schema, handler) {
        if (name === 'tv_launch') launchHandler = handler;
      },
    });

    const response = await launchHandler({ port: 0, kill_existing: false });
    const payload = JSON.parse(response.content[0].text);

    assert.equal(response.isError, true);
    assertFailure(payload, 'preflight');
  });
});

describe('health launch — CLI response', () => {
  it('exits nonzero while preserving the structured preflight failure payload', () => {
    const result = spawnSync(process.execPath, [CLI, 'launch', '--port', '0'], {
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');

    const payload = JSON.parse(result.stdout);
    assertFailure(payload, 'preflight');
    assert.equal(payload.cdp_port, 0);
    assert.equal(payload.recovery.action, 'choose_valid_port');
  });

  it('keeps a healthy endpoint reuse at exit zero', async (t) => {
    const server = createServer((_request, response) => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ...READY,
        webSocketDebuggerUrl: `ws://localhost:${address.port}/devtools/browser/test-session`,
      }));
    });
    server.listen(0);
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));

    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const result = await runCli(['launch', '--port', String(address.port), '--no-kill']);

    assert.equal(result.signal, null);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.success, true);
    assert.equal(payload.cdp_ready, true);
    assert.equal(payload.phase, 'reuse');
    assert.equal(payload.reused, true);
    assert.equal(payload.cdp_port, address.port);
    assert.equal(payload.old_process_killed, false);
  });
});
