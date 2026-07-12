/**
 * Core health/discovery/launch logic.
 */
import { getClient, getTargetInfo, evaluate } from '../connection.js';
import { accessSync, constants as fsConstants, existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { get as httpGet } from 'http';

const DEFAULT_PROBE_TIMEOUT = 1000;
const DEFAULT_LAUNCH_TIMEOUT = 15000;
const DEFAULT_POLL_INTERVAL = 1000;
const DEFAULT_HANDOFF_GRACE = 3000;

export async function probeCdpEndpoint({ port = 9222, timeout_ms = DEFAULT_PROBE_TIMEOUT, signal, _deps } = {}) {
  const get = _deps?.httpGet || httpGet;
  const schedule = _deps?.setTimeout || setTimeout;
  const cancel = _deps?.clearTimeout || clearTimeout;
  const timeout = Math.max(1, Number(timeout_ms) || DEFAULT_PROBE_TIMEOUT);

  return new Promise((resolve) => {
    let settled = false;
    let request;
    let timer;

    const onAbort = () => {
      try { request?.destroy(new Error('CDP readiness probe cancelled')); } catch {}
      finish(null);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) cancel(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };

    if (signal?.aborted) {
      finish(null);
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    timer = schedule(() => {
      try { request?.destroy(new Error('CDP readiness probe timed out')); } catch {}
      finish(null);
    }, timeout);

    try {
      request = get(`http://localhost:${port}/json/version`, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('error', () => finish(null));
        response.on('end', () => {
          try {
            const info = JSON.parse(data);
            finish(response.statusCode === 200 && info?.Browser && info?.webSocketDebuggerUrl ? info : null);
          } catch {
            finish(null);
          }
        });
      });
      request.setTimeout?.(timeout, () => {
        try { request.destroy(new Error('CDP readiness probe timed out')); } catch {}
        finish(null);
      });
      request.on('error', () => finish(null));
    } catch {
      finish(null);
    }
  });
}

function launchFailure({ phase, port, oldProcessKilled, error, action, message, binary, pid }) {
  return {
    success: false,
    cdp_ready: false,
    phase,
    cdp_port: port,
    old_process_killed: oldProcessKilled,
    error,
    recovery: { action, message },
    ...(binary && { binary }),
    ...(pid && { pid }),
  };
}

function readyLaunchResult({ info, port, platform, binary, pid, reused, oldProcessKilled, launcherHandoff = false }) {
  return {
    success: true,
    cdp_ready: true,
    phase: reused ? 'reuse' : 'ready',
    reused,
    old_process_killed: oldProcessKilled,
    launcher_handoff: launcherHandoff,
    platform,
    binary: binary || null,
    pid: pid || null,
    cdp_port: port,
    cdp_url: `http://localhost:${port}`,
    browser: info.Browser,
    user_agent: info['User-Agent'],
    web_socket_debugger_url: info.webSocketDebuggerUrl,
  };
}

export async function healthCheck() {
  await getClient();
  const target = await getTargetInfo();

  const state = await evaluate(`
    (function() {
      var result = { url: window.location.href, title: document.title };
      try {
        var chart = window.TradingViewApi._activeChartWidgetWV.value();
        result.symbol = chart.symbol();
        result.resolution = chart.resolution();
        result.chartType = chart.chartType();
        result.apiAvailable = true;
      } catch(e) {
        result.symbol = 'unknown';
        result.resolution = 'unknown';
        result.chartType = null;
        result.apiAvailable = false;
        result.apiError = e.message;
      }
      return result;
    })()
  `);

  return {
    success: true,
    cdp_connected: true,
    target_id: target.id,
    target_url: target.url,
    target_title: target.title,
    chart_symbol: state?.symbol || 'unknown',
    chart_resolution: state?.resolution || 'unknown',
    chart_type: state?.chartType ?? null,
    api_available: state?.apiAvailable ?? false,
  };
}

export async function discover() {
  const paths = await evaluate(`
    (function() {
      var results = {};
      try {
        var chart = window.TradingViewApi._activeChartWidgetWV.value();
        var methods = [];
        for (var k in chart) { if (typeof chart[k] === 'function') methods.push(k); }
        results.chartApi = { available: true, path: 'window.TradingViewApi._activeChartWidgetWV.value()', methodCount: methods.length, methods: methods.slice(0, 50) };
      } catch(e) { results.chartApi = { available: false, error: e.message }; }
      try {
        var col = window.TradingViewApi._chartWidgetCollection;
        var colMethods = [];
        for (var k in col) { if (typeof col[k] === 'function') colMethods.push(k); }
        results.chartWidgetCollection = { available: !!col, path: 'window.TradingViewApi._chartWidgetCollection', methodCount: colMethods.length, methods: colMethods.slice(0, 30) };
      } catch(e) { results.chartWidgetCollection = { available: false, error: e.message }; }
      try {
        var ws = window.ChartApiInstance;
        var wsMethods = [];
        for (var k in ws) { if (typeof ws[k] === 'function') wsMethods.push(k); }
        results.chartApiInstance = { available: !!ws, path: 'window.ChartApiInstance', methodCount: wsMethods.length, methods: wsMethods.slice(0, 30) };
      } catch(e) { results.chartApiInstance = { available: false, error: e.message }; }
      try {
        var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
        var bwbMethods = [];
        if (bwb) { for (var k in bwb) { if (typeof bwb[k] === 'function') bwbMethods.push(k); } }
        results.bottomWidgetBar = { available: !!bwb, path: 'window.TradingView.bottomWidgetBar', methodCount: bwbMethods.length, methods: bwbMethods.slice(0, 20) };
      } catch(e) { results.bottomWidgetBar = { available: false, error: e.message }; }
      try {
        var replay = window.TradingViewApi._replayApi;
        results.replayApi = { available: !!replay, path: 'window.TradingViewApi._replayApi' };
      } catch(e) { results.replayApi = { available: false, error: e.message }; }
      try {
        var alerts = window.TradingViewApi._alertService;
        results.alertService = { available: !!alerts, path: 'window.TradingViewApi._alertService' };
      } catch(e) { results.alertService = { available: false, error: e.message }; }
      return results;
    })()
  `);

  const available = Object.values(paths).filter(v => v.available).length;
  const total = Object.keys(paths).length;

  return { success: true, apis_available: available, apis_total: total, apis: paths };
}

export async function uiState() {
  const state = await evaluate(`
    (function() {
      var ui = {};
      var bottom = document.querySelector('[class*="layout__area--bottom"]');
      ui.bottom_panel = { open: !!(bottom && bottom.offsetHeight > 50), height: bottom ? bottom.offsetHeight : 0 };
      var right = document.querySelector('[class*="layout__area--right"]');
      ui.right_panel = { open: !!(right && right.offsetWidth > 50), width: right ? right.offsetWidth : 0 };
      var monacoEl = document.querySelector('.monaco-editor.pine-editor-monaco');
      ui.pine_editor = { open: !!monacoEl, width: monacoEl ? monacoEl.offsetWidth : 0, height: monacoEl ? monacoEl.offsetHeight : 0 };
      var stratPanel = document.querySelector('[data-name="backtesting"]') || document.querySelector('[class*="strategyReport"]');
      ui.strategy_tester = { open: !!(stratPanel && stratPanel.offsetParent) };
      var widgetbar = document.querySelector('[data-name="widgetbar-wrap"]');
      ui.widgetbar = { open: !!(widgetbar && widgetbar.offsetWidth > 50) };
      ui.buttons = {};
      var btns = document.querySelectorAll('button');
      var seen = {};
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.offsetParent === null || b.offsetWidth < 15) continue;
        var text = b.textContent.trim();
        var aria = b.getAttribute('aria-label') || '';
        var dn = b.getAttribute('data-name') || '';
        var label = text || aria || dn;
        if (!label || label.length > 60) continue;
        var key = label.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 40);
        if (seen[key]) continue;
        seen[key] = true;
        var rect = b.getBoundingClientRect();
        var region = 'other';
        if (rect.y < 50) region = 'top_bar';
        else if (rect.y < 90 && rect.x < 650) region = 'toolbar';
        else if (rect.x < 45) region = 'left_sidebar';
        else if (rect.x > 650 && rect.y < 100) region = 'pine_header';
        else if (rect.y > 750) region = 'bottom_bar';
        if (!ui.buttons[region]) ui.buttons[region] = [];
        ui.buttons[region].push({ label: label.substring(0, 40), disabled: b.disabled, x: Math.round(rect.x), y: Math.round(rect.y) });
      }
      ui.key_buttons = {};
      var keyLabels = {
        'add_to_chart': /add to chart/i, 'save_and_add': /save and add/i,
        'update_on_chart': /update on chart/i, 'save': /^Save(Save)?$/,
        'saved': /^Saved/, 'publish_script': /publish script/i,
        'compile_errors': /error/i, 'unsaved_version': /unsaved version/i,
      };
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.offsetParent === null) continue;
        var text = b.textContent.trim();
        for (var k in keyLabels) {
          if (keyLabels[k].test(text)) {
            ui.key_buttons[k] = { text: text.substring(0, 40), disabled: b.disabled, visible: b.offsetWidth > 0 };
          }
        }
      }
      try {
        var chart = window.TradingViewApi._activeChartWidgetWV.value();
        ui.chart = { symbol: chart.symbol(), resolution: chart.resolution(), chartType: chart.chartType(), study_count: chart.getAllStudies().length };
      } catch(e) { ui.chart = { error: e.message }; }
      try {
        var replay = window.TradingViewApi._replayApi;
        function unwrap(v) { return (v && typeof v === 'object' && typeof v.value === 'function') ? v.value() : v; }
        ui.replay = { available: unwrap(replay.isReplayAvailable()), started: unwrap(replay.isReplayStarted()) };
      } catch(e) { ui.replay = { error: e.message }; }
      return ui;
    })()
  `);

  return { success: true, ...state };
}

export async function launch({
  port,
  kill_existing,
  request_timeout_ms,
  overall_timeout_ms,
  poll_interval_ms,
  handoff_grace_ms,
  _deps,
} = {}) {
  const fileExists = _deps?.existsSync || existsSync;
  const fileAccess = _deps?.accessSync || accessSync;
  const runSync = _deps?.execSync || execSync;
  const spawnProcess = _deps?.spawn || spawn;
  const probe = _deps?.probeCdpEndpoint || probeCdpEndpoint;
  const sleep = _deps?.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const schedule = _deps?.setTimeout || setTimeout;
  const cancel = _deps?.clearTimeout || clearTimeout;
  const now = _deps?.now || Date.now;
  const platform = _deps?.platform || process.platform;
  const env = _deps?.env || process.env;
  const cdpPort = port === undefined ? 9222 : Number(port);
  const killFirst = kill_existing !== false;
  const requestTimeout = Math.max(1, Number(request_timeout_ms) || DEFAULT_PROBE_TIMEOUT);
  const overallTimeout = Math.max(1, Number(overall_timeout_ms) || DEFAULT_LAUNCH_TIMEOUT);
  const pollInterval = Math.max(1, Number(poll_interval_ms) || DEFAULT_POLL_INTERVAL);
  const handoffGrace = Math.max(1, Number(handoff_grace_ms) || DEFAULT_HANDOFF_GRACE);
  const startedAt = now();
  const overallDeadline = startedAt + overallTimeout;
  let oldProcessKilled = false;

  const failure = (phase, error, action, message, extra = {}) => launchFailure({
    phase,
    port: cdpPort,
    oldProcessKilled,
    error,
    action,
    message,
    ...extra,
  });

  if (!Number.isInteger(cdpPort) || cdpPort < 1 || cdpPort > 65535) {
    return failure(
      'preflight',
      `Invalid CDP port: ${port}`,
      'choose_valid_port',
      'Use an integer localhost port between 1 and 65535.',
    );
  }

  const probeReady = async (signal, deadline = overallDeadline) => {
    const remaining = Math.min(overallDeadline, deadline) - now();
    if (remaining <= 0) return null;
    try {
      return await probe({
        port: cdpPort,
        timeout_ms: Math.min(requestTimeout, remaining),
        signal,
        _deps,
      });
    } catch {
      return null;
    }
  };

  const existing = await probeReady();
  if (existing) {
    return readyLaunchResult({
      info: existing,
      port: cdpPort,
      platform,
      reused: true,
      oldProcessKilled: false,
    });
  }

  const pathMap = {
    darwin: [
      '/Applications/TradingView.app/Contents/MacOS/TradingView',
      `${env.HOME}/Applications/TradingView.app/Contents/MacOS/TradingView`,
    ],
    win32: [
      `${env.LOCALAPPDATA}\\TradingView\\TradingView.exe`,
      `${env.PROGRAMFILES}\\TradingView\\TradingView.exe`,
      `${env['PROGRAMFILES(X86)']}\\TradingView\\TradingView.exe`,
    ],
    linux: [
      '/opt/TradingView/tradingview',
      '/opt/TradingView/TradingView',
      `${env.HOME}/.local/share/TradingView/TradingView`,
      '/usr/bin/tradingview',
      '/snap/tradingview/current/tradingview',
    ],
  };

  let tvPath = null;
  const candidates = pathMap[platform] || pathMap.linux;
  for (const candidate of candidates) {
    if (candidate && fileExists(candidate)) {
      tvPath = candidate;
      break;
    }
  }

  if (!tvPath) {
    try {
      const command = platform === 'win32' ? 'where TradingView.exe' : 'which tradingview';
      const located = runSync(command, { timeout: Math.min(3000, Math.max(1, overallDeadline - now())) })
        .toString().trim().split('\n')[0];
      if (located && fileExists(located)) tvPath = located;
    } catch { /* not found on PATH */ }
  }

  if (!tvPath && platform === 'darwin') {
    try {
      const found = runSync('mdfind "kMDItemFSName == TradingView.app" | head -1', {
        timeout: Math.min(5000, Math.max(1, overallDeadline - now())),
      }).toString().trim();
      const candidate = found ? `${found}/Contents/MacOS/TradingView` : null;
      if (candidate && fileExists(candidate)) tvPath = candidate;
    } catch { /* not found by Spotlight */ }
  }

  if (!tvPath) {
    return failure(
      'preflight',
      `TradingView not found on ${platform}. Searched: ${candidates.join(', ')}`,
      'locate_tradingview_binary',
      `Install TradingView or launch it manually with --remote-debugging-port=${cdpPort}.`,
    );
  }

  try {
    fileAccess(tvPath, platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK);
  } catch (err) {
    return failure(
      'preflight',
      `TradingView launch prerequisite failed for ${tvPath}: ${err.message}`,
      'fix_binary_permissions',
      `Make the TradingView binary executable, then retry with --remote-debugging-port=${cdpPort}.`,
      { binary: tvPath },
    );
  }

  if (now() >= overallDeadline) {
    return failure(
      'preflight',
      'Launch deadline expired during prerequisite checks.',
      'retry_launch',
      'Retry after confirming the TradingView binary and localhost CDP port are available.',
      { binary: tvPath },
    );
  }

  if (killFirst) {
    try {
      if (platform === 'win32') runSync('taskkill /F /IM TradingView.exe', { timeout: Math.min(5000, Math.max(1, overallDeadline - now())) });
      else runSync('pkill -f TradingView', { timeout: Math.min(5000, Math.max(1, overallDeadline - now())) });
      oldProcessKilled = true;
      const remaining = overallDeadline - now();
      if (remaining > 0) await sleep(Math.min(1500, remaining));
    } catch { /* no existing process, continue with launch */ }
  }

  if (now() >= overallDeadline) {
    return failure(
      'kill',
      'Launch deadline expired after stopping the previous TradingView process.',
      'launch_manually',
      `Launch TradingView manually with --remote-debugging-port=${cdpPort}.`,
      { binary: tvPath },
    );
  }

  let child;
  try {
    child = spawnProcess(tvPath, [`--remote-debugging-port=${cdpPort}`], { detached: true, stdio: 'ignore' });
  } catch (err) {
    return failure(
      'spawn',
      `TradingView spawn failed: ${err.message}`,
      'launch_manually',
      `Launch ${tvPath} manually with --remote-debugging-port=${cdpPort}.`,
      { binary: tvPath },
    );
  }

  let childError = null;
  let childExit = null;
  let childExitAt = null;
  let activeProbe = null;

  const shortenActiveProbeDeadline = (deadline) => {
    if (!activeProbe || deadline >= activeProbe.deadline) return;
    activeProbe.deadline = deadline;
    if (activeProbe.timer) cancel(activeProbe.timer);
    const delay = deadline - now();
    if (delay <= 0) {
      activeProbe.controller.abort();
      return;
    }
    activeProbe.timer = schedule(() => activeProbe?.controller.abort(), delay);
  };

  const onChildError = err => {
    childError = err;
    activeProbe?.controller.abort();
  };
  const onChildExit = (code, signal) => {
    childExit = { code, signal };
    childExitAt = now();
    shortenActiveProbeDeadline(Math.min(overallDeadline, childExitAt + handoffGrace));
  };
  child.once('error', onChildError);
  child.once('exit', onChildExit);

  const runReadinessProbe = async () => {
    const controller = new AbortController();
    let onAbort;
    const aborted = new Promise(resolve => {
      onAbort = () => resolve(null);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const deadline = Math.min(
      overallDeadline,
      now() + requestTimeout,
      childExitAt === null ? Infinity : childExitAt + handoffGrace,
    );
    const probeState = { controller, deadline: Infinity, timer: null };
    activeProbe = probeState;
    shortenActiveProbeDeadline(deadline);

    try {
      return await Promise.race([
        probeReady(controller.signal, deadline),
        aborted,
      ]);
    } finally {
      controller.signal.removeEventListener('abort', onAbort);
      if (probeState.timer) cancel(probeState.timer);
      if (activeProbe === probeState) activeProbe = null;
    }
  };

  try {
    child.unref();

    while (now() < overallDeadline) {
      if (childError) {
        return failure(
          'spawn',
          `TradingView spawn failed: ${childError.message}`,
          'launch_manually',
          `Launch ${tvPath} manually with --remote-debugging-port=${cdpPort}.`,
          { binary: tvPath, pid: child.pid },
        );
      }

      const info = await runReadinessProbe();
      if (info) {
        return readyLaunchResult({
          info,
          port: cdpPort,
          platform,
          binary: tvPath,
          pid: child.pid,
          reused: false,
          oldProcessKilled,
          launcherHandoff: childExit !== null,
        });
      }

      if (childError) continue;

      const readinessDeadline = childExitAt === null
        ? overallDeadline
        : Math.min(overallDeadline, childExitAt + handoffGrace);
      const remaining = readinessDeadline - now();
      if (remaining <= 0) break;
      await sleep(Math.min(pollInterval, remaining));
    }

    if (childError) {
      return failure(
        'spawn',
        `TradingView spawn failed: ${childError.message}`,
        'launch_manually',
        `Launch ${tvPath} manually with --remote-debugging-port=${cdpPort}.`,
        { binary: tvPath, pid: child.pid },
      );
    }

    if (childExit) {
      const detail = `code=${childExit.code ?? 'null'}, signal=${childExit.signal ?? 'null'}`;
      return failure(
        'child_exit',
        `TradingView launcher exited before CDP became ready (${detail}).`,
        'verify_launcher_handoff',
        `Confirm no TradingView process is still starting, then launch it with --remote-debugging-port=${cdpPort}.`,
        { binary: tvPath, pid: child.pid },
      );
    }

    return failure(
      'readiness',
      `TradingView did not expose a healthy CDP endpoint within ${overallTimeout}ms.`,
      'check_cdp_then_retry',
      `Check http://localhost:${cdpPort}/json/version, then retry tv_health_check or launch TradingView manually with --remote-debugging-port=${cdpPort}.`,
      { binary: tvPath, pid: child.pid },
    );
  } catch (err) {
    return failure(
      'spawn',
      `TradingView child lifecycle failed: ${err.message}`,
      'launch_manually',
      `Launch ${tvPath} manually with --remote-debugging-port=${cdpPort}.`,
      { binary: tvPath, pid: child.pid },
    );
  } finally {
    activeProbe?.controller.abort();
    if (activeProbe?.timer) cancel(activeProbe.timer);
    child.removeListener('error', onChildError);
    child.removeListener('exit', onChildExit);
  }
}
