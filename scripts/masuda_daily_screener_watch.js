#!/usr/bin/env node
/**
 * Run the saved MASUDA daily Pine Screener once and emit only new,
 * symbol-identified daily triggers. Hermes cron delivers non-empty stdout.
 *
 * This script never places orders. It temporarily navigates the dedicated
 * TradingView chart tab to Pine Screener and verifies full chart restoration
 * before committing state or emitting a notification.
 */
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CDP from 'chrome-remote-interface';

const __filename = fileURLToPath(import.meta.url);
const STATE_VERSION = 1;
const SCREENER_URL = 'https://www.tradingview.com/pine-screener/';
const DEFAULT_CHART_URL = 'https://jp.tradingview.com/chart/wu1kDZvT/';
const DEFAULT_WATCHLIST = 'watchlist_formatted';
const DEFAULT_INDICATOR = '増田式 Daily Watchlist v1';
const DEFAULT_SCAN_TIMEOUT_MS = 105_000;
const EXPECTED_HEADERS = [
  'Symbol',
  'Long Trigger',
  'Short Trigger',
  'Composite State',
  'Buy Conditions',
  'Sell Conditions',
  'ADX',
  'RSI',
  'Stoch %K',
  'Stoch %D',
  'Bar Day UTC',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function hermesHome() {
  return process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
}

function defaultStatePath() {
  return path.join(hermesHome(), 'state', 'masuda-daily-screener-watch.json');
}

function defaultLockPath() {
  return path.join(hermesHome(), 'state', 'masuda-daily-screener-watch.lock');
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function parseNumeric(value) {
  const text = normalizeText(value).replace(/−/g, '-');
  if (!text || text === '—' || /^n\/?a$/i.test(text)) return null;
  const match = text.replace(/,/g, '').match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*([KMBT]))?$/i);
  if (!match) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[2]?.toUpperCase()] || 1;
  const number = Number(match[1]) * multiplier;
  return Number.isFinite(number) ? number : null;
}

export function symbolFromHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, 'https://www.tradingview.com/');
    const querySymbol = url.searchParams.get('symbol');
    if (querySymbol) return decodeURIComponent(querySymbol);
    const match = url.pathname.match(/\/symbols\/([^/]+)\/?$/i);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]);
    const exchange = normalizeText(url.searchParams.get('exchange'));
    if (exchange) return `${exchange}:${slug}`;
    const separator = slug.indexOf('-');
    return separator > 0 ? `${slug.slice(0, separator)}:${slug.slice(separator + 1)}` : slug;
  } catch {
    return null;
  }
}

function verifiedSymbol(rawRow) {
  const candidates = [
    rawRow.symbol_full,
    rawRow.data_symbol,
    symbolFromHref(rawRow.href),
  ].map(normalizeText).filter(Boolean);
  const symbol = candidates.find(candidate => candidate.includes(':')) || null;
  return symbol;
}

function valuesFromCells(cells) {
  const values = cells.map(parseNumeric);
  return {
    long_trigger: values[0],
    short_trigger: values[1],
    composite_state: values[2],
    buy_conditions: values[3],
    sell_conditions: values[4],
    adx: values[5],
    rsi: values[6],
    stoch_k: values[7],
    stoch_d: values[8],
    bar_day_utc: values[9] === null ? null : Math.trunc(values[9]),
  };
}

export function normalizeScreenerSnapshot(raw, {
  watchlist = DEFAULT_WATCHLIST,
  indicator = DEFAULT_INDICATOR,
} = {}) {
  const headers = (raw?.headers || []).map(normalizeText);
  while (headers.at(-1) === '') headers.pop();
  if (headers.length !== EXPECTED_HEADERS.length
      || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
    throw new Error(`Unexpected Pine Screener columns: ${JSON.stringify(headers)}`);
  }
  if (!normalizeText(raw?.watchlist).includes(watchlist)) {
    throw new Error(`Unexpected Pine Screener watchlist: ${normalizeText(raw?.watchlist) || '<missing>'}`);
  }
  if (normalizeText(raw?.indicator) !== indicator) {
    throw new Error(`Unexpected Pine Screener indicator: ${normalizeText(raw?.indicator) || '<missing>'}`);
  }
  if (!Array.isArray(raw?.rows) || raw.rows.length === 0) {
    throw new Error('Pine Screener returned no rows.');
  }

  const rows = raw.rows.map((rawRow, index) => {
    const identity = Array.isArray(rawRow.identity_lines)
      ? rawRow.identity_lines.map(normalizeText).filter(Boolean)
      : [];
    const cells = Array.isArray(rawRow.value_cells) ? [...rawRow.value_cells] : [];
    while (cells.length > EXPECTED_HEADERS.length - 1 && normalizeText(cells.at(-1)) === '') cells.pop();
    if (identity.length < 2) throw new Error(`Row ${index} has no ticker/timeframe identity.`);
    if (cells.length !== EXPECTED_HEADERS.length - 1) {
      throw new Error(`Row ${index} has ${cells.length} value cells; expected ${EXPECTED_HEADERS.length - 1}.`);
    }
    const ticker = identity[0];
    const intervalIndex = identity.findIndex((value, identityIndex) =>
      identityIndex > 0 && /^(?:1|5|15|30|60|120|240|D|1D|W|1W|M|1M)$/.test(value)
    );
    const intervalToken = intervalIndex === -1 ? null : identity[intervalIndex];
    if (intervalToken && intervalToken !== 'D' && intervalToken !== '1D') {
      throw new Error(`Row ${ticker} has explicit non-daily interval ${intervalToken}.`);
    }
    const interval = 'D';
    const name = identity.filter((_value, identityIndex) => identityIndex !== 0 && identityIndex !== intervalIndex).join(' ');
    return {
      ticker,
      name,
      interval,
      interval_verified: intervalToken === 'D' || intervalToken === '1D',
      symbol: verifiedSymbol(rawRow),
      href: rawRow.href || null,
      debug_html: rawRow.debug_html || null,
      ...valuesFromCells(cells),
    };
  });
  if (!rows.some(row => row.interval_verified)) {
    throw new Error('No Pine Screener row exposed a verified daily interval token.');
  }

  return {
    scanned_at: raw.scanned_at || new Date().toISOString(),
    watchlist,
    indicator,
    headers,
    rows,
    original_url: raw.original_url || null,
    pane_before: raw.pane_before || null,
    pane_after: raw.pane_after || null,
  };
}

function signalKey(signal) {
  return `${signal.symbol}|${signal.direction}|${signal.bar_day_utc}`;
}

function signalsFromRows(rows) {
  const signals = [];
  for (const row of rows) {
    for (const [direction, value] of [['long', row.long_trigger], ['short', row.short_trigger]]) {
      if (value === null || value < 0.5) continue;
      if (!row.symbol) {
        throw new Error(`Triggered row ${row.ticker} has no verified exchange-qualified symbol identity.`);
      }
      if (!Number.isInteger(row.bar_day_utc) || row.bar_day_utc <= 0) {
        throw new Error(`Triggered row ${row.symbol} has no valid Bar Day UTC.`);
      }
      signals.push({ ...row, direction, key: signalKey({ ...row, direction }) });
    }
  }
  return signals;
}

export function selectNewSignals(snapshot, previousState = {}, {
  prime = false,
  now = new Date().toISOString(),
} = {}) {
  const observed = signalsFromRows(snapshot.rows);
  const notified = { ...(previousState.notified || {}) };
  const maximumBarDay = Math.max(0, ...snapshot.rows
    .map(row => row.bar_day_utc)
    .filter(value => Number.isInteger(value)));

  if (maximumBarDay > 0) {
    for (const key of Object.keys(notified)) {
      const day = Number(key.split('|').at(-1));
      if (Number.isFinite(day) && day < maximumBarDay - 180) delete notified[key];
    }
  }

  const events = [];
  for (const signal of observed) {
    if (!prime && !notified[signal.key]) events.push(signal);
    notified[signal.key] = now;
  }

  return {
    events,
    observed,
    state: {
      version: STATE_VERSION,
      notified,
      last_scan: {
        scanned_at: snapshot.scanned_at,
        watchlist: snapshot.watchlist,
        indicator: snapshot.indicator,
        row_count: snapshot.rows.length,
        signal_count: observed.length,
        maximum_bar_day_utc: maximumBarDay || null,
      },
      updated_at: now,
    },
  };
}

function barDayLabel(day) {
  const date = new Date(Number(day) * 86_400_000);
  return Number.isNaN(date.getTime()) ? String(day) : date.toISOString().slice(0, 10);
}

function numberLabel(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : 'n/a';
}

export function buildTelegramMessage(events, snapshot, { maximumEvents = 24 } = {}) {
  const shown = events.slice(0, maximumEvents);
  const lines = [
    '【Flamme｜増田式 日足ウォッチ】',
    `確定日足の新規成立: ${events.length}件 / 走査: ${snapshot.rows.length}銘柄`,
    `Watchlist: ${snapshot.watchlist}`,
    `Scan: ${snapshot.scanned_at}`,
    '',
  ];

  for (const event of shown) {
    const direction = event.direction === 'long' ? 'LONG' : 'SHORT';
    lines.push(
      `• ${event.symbol} ${direction}｜bar=${barDayLabel(event.bar_day_utc)} UTC`,
      `  ADX=${numberLabel(event.adx)} RSI=${numberLabel(event.rsi)} Stoch=${numberLabel(event.stoch_k)}/${numberLabel(event.stoch_d)} `
        + `count=${numberLabel(event.buy_conditions, 0)}/${numberLabel(event.sell_conditions, 0)} state=${numberLabel(event.composite_state, 0)}`
    );
  }
  if (events.length > shown.length) lines.push(`…ほか${events.length - shown.length}件（stateには全件記録済み）`);
  lines.push(
    '',
    '境界: 日足確定時の機械的shadow通知で、売買推奨・発注ではありません。',
    '次: actではなくwatch。チャート、流動性、無効化条件を人間が確認。'
  );
  return `${lines.join('\n')}\n`;
}

export function selectChartTarget(targets, chartUrl = DEFAULT_CHART_URL) {
  const expected = new URL(chartUrl).pathname;
  const matches = (targets || []).filter(target =>
    target?.type === 'page' && new URL(target.url || 'about:blank').pathname === expected
  );
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one TradingView chart target for ${expected}; found ${matches.length}.`);
  }
  return matches[0];
}

async function evaluate(client, expression) {
  const response = await client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime.evaluate failed.');
  }
  return response.result?.value;
}

async function waitFor(client, expression, {
  timeoutMs = 30_000,
  intervalMs = 500,
  label = expression,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last)}`);
}

async function clickCenter(client, selector) {
  const bounds = await evaluate(client, `(function(){
    var el=document.querySelector(${JSON.stringify(selector)});
    if(!el)return null;
    var rect=el.getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:rect.width,height:rect.height};
  })()`);
  if (!bounds?.width || !bounds?.height) throw new Error(`Cannot click hidden selector: ${selector}`);
  await client.Input.dispatchMouseEvent({ type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', clickCount: 1 });
  await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', clickCount: 1 });
}

const PANE_STATE_EXPRESSION = `(function(){
  var api=window.TradingViewApi;
  if(!api||!api._chartWidgetCollection||!api._activeChartWidgetWV)return null;
  var cwc=api._chartWidgetCollection;
  var layout=cwc._layoutType;
  if(layout&&typeof layout.value==='function')layout=layout.value();
  var all=cwc.getAll();
  var active=api._activeChartWidgetWV.value();
  var activeIndex=null;
  var panes=[];
  for(var i=0;i<all.length;i++){
    try{
      var model=all[i].model();
      var series=model.mainSeries();
      panes.push({index:i,symbol:series.symbol(),resolution:series.interval()});
      if(active&&active._chartWidget&&all[i]===active._chartWidget)activeIndex=i;
    }catch(error){panes.push({index:i,error:error.message});}
  }
  return {layout:layout,active_index:activeIndex,panes:panes};
})()`;

function samePaneState(before, after) {
  if (!before || !after || before.layout !== after.layout || before.panes.length !== after.panes.length) return false;
  return before.panes.every((pane, index) =>
    pane.symbol === after.panes[index]?.symbol && String(pane.resolution) === String(after.panes[index]?.resolution)
  );
}

async function ensureWatchlist(client, watchlist) {
  const selector = '[data-name="pine-screener-watchlist-pill"]';
  const current = normalizeText(await evaluate(client, `(document.querySelector(${JSON.stringify(selector)})?.textContent||'')`));
  if (current.includes(watchlist)) return;
  await clickCenter(client, selector);
  await waitFor(client, `Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).some(el => (el.getAttribute('aria-label')||'').trim() === ${JSON.stringify(watchlist)})`, {
    timeoutMs: 15_000,
    label: `watchlist option ${watchlist}`,
  });
  await evaluate(client, `(function(){var el=Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).find(node=>(node.getAttribute('aria-label')||'').trim()===${JSON.stringify(watchlist)});el.click();return true;})()`);
  await waitFor(client, `(document.querySelector(${JSON.stringify(selector)})?.textContent||'').includes(${JSON.stringify(watchlist)})`, {
    timeoutMs: 15_000,
    label: `selected watchlist ${watchlist}`,
  });
}

async function ensureIndicator(client, indicator) {
  const selectedSelector = '[data-name="pine-screener-indicator-pill"]';
  const chooserSelector = '[data-qa-id="pine-screener-indicator-selector"]';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selected = normalizeText(await evaluate(client, `(document.querySelector(${JSON.stringify(selectedSelector)})?.textContent||'')`));
    if (selected === indicator) return;

    if (attempt === 0) {
      await clickCenter(client, chooserSelector);
    } else {
      await evaluate(client, `(function(){var el=document.querySelector(${JSON.stringify(chooserSelector)});if(!el)return false;el.click();return true;})()`);
    }

    try {
      await waitFor(client, `document.querySelectorAll('[data-qa-id="pine-screener-indicator-option"]').length > 0`, {
        timeoutMs: 12_000,
        intervalMs: 500,
        label: 'Pine Screener indicator menu',
      });
      const found = await evaluate(client, `Array.from(document.querySelectorAll('[data-qa-id="pine-screener-indicator-option"]')).some(el => (el.textContent||'').trim() === ${JSON.stringify(indicator)})`);
      if (found) {
        await evaluate(client, `(function(){var el=Array.from(document.querySelectorAll('[data-qa-id="pine-screener-indicator-option"]')).find(node=>(node.textContent||'').trim()===${JSON.stringify(indicator)});el.click();return true;})()`);
        await waitFor(client, `(document.querySelector(${JSON.stringify(selectedSelector)})?.textContent||'').trim() === ${JSON.stringify(indicator)}`, {
          timeoutMs: 20_000,
          label: `selected indicator ${indicator}`,
        });
        return;
      }
    } catch {
      // Retry through a different event path below.
    }

    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(2_000);
  }

  const diagnostics = await evaluate(client, `({
    chooser:!!document.querySelector(${JSON.stringify(chooserSelector)}),
    selected:(document.querySelector(${JSON.stringify(selectedSelector)})?.textContent||'').trim(),
    option_count:document.querySelectorAll('[data-qa-id="pine-screener-indicator-option"]').length,
    body_has_indicator:(document.body.innerText||'').includes(${JSON.stringify(indicator)})
  })`);
  throw new Error(`Could not select Pine Screener indicator ${indicator}: ${JSON.stringify(diagnostics)}`);
}

async function runScan(client, timeoutMs) {
  const selector = '[data-name="pine-screener-scan-btn"]';
  await waitFor(client, `document.querySelector(${JSON.stringify(selector)}) !== null`, { timeoutMs: 20_000, label: 'Pine Screener scan button' });
  await clickCenter(client, selector);
  await waitFor(client, `(document.querySelector(${JSON.stringify(selector)})?.textContent||'').trim() === 'Stop'`, {
    timeoutMs: 10_000,
    intervalMs: 100,
    label: 'Pine Screener scan start',
  });
  await waitFor(client, `(document.querySelector(${JSON.stringify(selector)})?.textContent||'').trim() === 'Scan' && (document.querySelector('[data-qa-id="pine-screener-snackbar-success"]')?.textContent||'').includes('Scan completed')`, {
    timeoutMs,
    intervalMs: 1_000,
    label: 'Pine Screener scan completion',
  });
}

async function extractRawSnapshot(client, metadata) {
  return evaluate(client, `(() => {
    const table=document.querySelector('main table');
    if(!table)return null;
    const headers=Array.from(table.querySelectorAll('thead th')).map(cell=>(cell.innerText||cell.textContent||'').trim());
    const rows=Array.from(table.querySelectorAll('tbody tr')).map(row=>{
      const cells=Array.from(row.querySelectorAll(':scope > td'));
      const identityCell=cells[0];
      const link=identityCell?.querySelector('a[href]');
      const symbolNode=row.querySelector('[data-symbol-full],[data-symbol]');
      return {
        identity_lines:(identityCell?.innerText||'').split('\\n').map(value=>value.trim()).filter(Boolean),
        value_cells:cells.slice(1).map(cell=>(cell.innerText||cell.textContent||'').trim()),
        href:link?.href||null,
        symbol_full:row.getAttribute('data-symbol-full')||symbolNode?.getAttribute('data-symbol-full')||null,
        data_symbol:row.getAttribute('data-symbol')||row.getAttribute('data-rowkey')||symbolNode?.getAttribute('data-symbol')||null,
        debug_html:link?null:row.outerHTML.slice(0,8000),
      };
    });
    return {
      headers,
      rows,
      watchlist:(document.querySelector('[data-name="pine-screener-watchlist-pill"]')?.textContent||'').trim(),
      indicator:(document.querySelector('[data-name="pine-screener-indicator-pill"]')?.textContent||'').trim(),
      scanned_at:new Date().toISOString(),
      original_url:${JSON.stringify(metadata.originalUrl)},
      pane_before:${JSON.stringify(metadata.paneBefore)},
    };
  })()`);
}

export async function scanTradingView({
  chartUrl = DEFAULT_CHART_URL,
  watchlist = DEFAULT_WATCHLIST,
  indicator = DEFAULT_INDICATOR,
  scanTimeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
  host = 'localhost',
  port = 9222,
} = {}, dependencies = {}) {
  const fetchFn = dependencies.fetch || fetch;
  const cdpFn = dependencies.cdp || CDP;
  const targets = await (await fetchFn(`http://${host}:${port}/json/list`)).json();
  const target = selectChartTarget(targets, chartUrl);
  const client = await cdpFn({ host, port, target: target.id });
  await client.Page.enable();
  await client.Runtime.enable();

  const originalUrl = await evaluate(client, 'location.href');
  await waitFor(client, `${PANE_STATE_EXPRESSION} !== null`, { timeoutMs: 20_000, label: 'original TradingView pane state' });
  const paneBefore = await evaluate(client, PANE_STATE_EXPRESSION);
  let snapshot;
  let primaryError;

  try {
    await client.Page.navigate({ url: SCREENER_URL });
    await waitFor(client, 'document.querySelector("[data-name=pine-screener-watchlist-pill]") !== null', {
      timeoutMs: 30_000,
      label: 'Pine Screener page',
    });
    await waitFor(client, '(document.querySelector("main")?.innerText||"").includes("Symbol")', {
      timeoutMs: 30_000,
      label: 'Pine Screener symbol table',
    });
    await sleep(2_000);
    await ensureWatchlist(client, watchlist);
    await ensureIndicator(client, indicator);
    await runScan(client, scanTimeoutMs);
    snapshot = await extractRawSnapshot(client, { originalUrl, paneBefore });
    if (!snapshot) throw new Error('Could not extract Pine Screener table.');
  } catch (error) {
    primaryError = error;
  }

  let restoreError;
  try {
    await client.Page.navigate({ url: originalUrl });
    await waitFor(client, `${PANE_STATE_EXPRESSION} !== null`, { timeoutMs: 30_000, label: 'restored TradingView chart' });
    const restoreDeadline = Date.now() + 20_000;
    let paneAfter;
    do {
      paneAfter = await evaluate(client, PANE_STATE_EXPRESSION);
      if (samePaneState(paneBefore, paneAfter)) break;
      await sleep(1_000);
    } while (Date.now() < restoreDeadline);
    if (!samePaneState(paneBefore, paneAfter)) {
      throw new Error(`TradingView pane restoration mismatch: before=${JSON.stringify(paneBefore)} after=${JSON.stringify(paneAfter)}`);
    }
    if (paneBefore.active_index !== null && paneAfter.active_index !== paneBefore.active_index) {
      await evaluate(client, `(function(){var all=window.TradingViewApi._chartWidgetCollection.getAll();var pane=all[${Number(paneBefore.active_index)}];if(pane&&pane._mainDiv)pane._mainDiv.click();return true;})()`);
      await sleep(500);
      paneAfter = await evaluate(client, PANE_STATE_EXPRESSION);
    }
    if (snapshot) snapshot.pane_after = paneAfter;
  } catch (error) {
    restoreError = error;
  } finally {
    await client.close();
  }

  if (restoreError) {
    const message = primaryError
      ? `${primaryError.message}; chart restoration also failed: ${restoreError.message}`
      : `Chart restoration failed: ${restoreError.message}`;
    throw new Error(message);
  }
  if (primaryError) throw primaryError;
  return snapshot;
}

async function readState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: STATE_VERSION, notified: {} };
    throw error;
  }
}

async function writeState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporary, statePath);
}

async function acquireLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(`${process.pid}\n`, 'utf8');
    await handle.close();
    return async () => { await unlink(lockPath).catch(() => {}); };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const info = await stat(lockPath).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 10 * 60_000) {
      await unlink(lockPath).catch(() => {});
      return acquireLock(lockPath);
    }
    return null;
  }
}

export async function runWatcher(options, dependencies = {}) {
  const scanFn = dependencies.scanTradingView || scanTradingView;
  const readFn = dependencies.readState || readState;
  const writeFn = dependencies.writeState || writeState;
  const now = dependencies.now || (() => new Date().toISOString());

  const raw = await scanFn(options);
  const snapshot = normalizeScreenerSnapshot(raw, options);
  const previous = await readFn(options.statePath);
  const selected = selectNewSignals(snapshot, previous, { prime: options.prime, now: now() });

  if (options.report) {
    return `${JSON.stringify({
      success: true,
      watchlist: snapshot.watchlist,
      indicator: snapshot.indicator,
      row_count: snapshot.rows.length,
      signal_count: selected.observed.length,
      new_signal_count: selected.events.length,
      verified_symbol_count: snapshot.rows.filter(row => row.symbol).length,
      unverified_symbols: snapshot.rows
        .filter(row => !row.symbol)
        .map(row => ({ ticker: row.ticker, name: row.name, href: row.href, debug_html: row.debug_html })),
      sample: snapshot.rows.slice(0, 5),
      signals: selected.observed,
      pane_before: snapshot.pane_before,
      pane_after: snapshot.pane_after,
    }, null, 2)}\n`;
  }

  await writeFn(options.statePath, selected.state);
  if (options.prime || selected.events.length === 0) return '';
  return buildTelegramMessage(selected.events, snapshot);
}

export function parseArgs(argv) {
  const options = {
    chartUrl: process.env.MASUDA_DAILY_CHART_URL || DEFAULT_CHART_URL,
    watchlist: process.env.MASUDA_DAILY_WATCHLIST || DEFAULT_WATCHLIST,
    indicator: process.env.MASUDA_DAILY_INDICATOR || DEFAULT_INDICATOR,
    statePath: process.env.MASUDA_DAILY_STATE_PATH || defaultStatePath(),
    lockPath: process.env.MASUDA_DAILY_LOCK_PATH || defaultLockPath(),
    scanTimeoutMs: DEFAULT_SCAN_TIMEOUT_MS,
    prime: false,
    report: false,
    help: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prime') options.prime = true;
    else if (arg === '--report') options.report = true;
    else if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--lock') options.lockPath = argv[++index];
    else if (arg === '--chart-url') options.chartUrl = argv[++index];
    else if (arg === '--watchlist') options.watchlist = argv[++index];
    else if (arg === '--indicator') options.indicator = argv[++index];
    else if (arg === '--scan-timeout-ms') options.scanTimeoutMs = Number(argv[++index]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.prime && options.report) throw new Error('--prime and --report cannot be combined.');
  if (!Number.isFinite(options.scanTimeoutMs) || options.scanTimeoutMs < 10_000 || options.scanTimeoutMs > 120_000) {
    throw new Error('--scan-timeout-ms must be between 10000 and 120000.');
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/masuda_daily_screener_watch.js [--prime | --report]',
    '       [--state PATH] [--chart-url URL] [--watchlist NAME] [--indicator NAME]',
    '',
    'Default mode emits Telegram-ready stdout only for new confirmed daily signals.',
    '--prime records current signals without emitting.',
    '--report runs a live scan and prints diagnostics without updating state.',
    '',
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const release = await acquireLock(options.lockPath);
  if (!release) return;
  try {
    const output = await runWatcher(options);
    if (output) process.stdout.write(output);
  } finally {
    await release();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(error => {
    process.stderr.write(`${error?.message || String(error)}\n`);
    process.exit(1);
  });
}
