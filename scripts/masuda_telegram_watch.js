#!/usr/bin/env node
/**
 * Poll TradingView's active alerts once and emit a Telegram-ready message only
 * when a MASUDA shadow alert has a new last_fired timestamp.
 *
 * The script never places orders. Hermes cron owns delivery; empty stdout means
 * silent. Alert state is persisted outside the repository by default.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { disconnect } from '../src/connection.js';
import { list as listAlerts } from '../src/core/alerts.js';
import { getOhlcv, getStudyValues } from '../src/core/data.js';
import { focus as focusPane, list as listPanes } from '../src/core/pane.js';

const __filename = fileURLToPath(import.meta.url);
const MASUDA_PREFIX = 'MASUDA|';
const STATE_VERSION = 1;
const RELEVANT_RESOLUTIONS = ['D', '60', '15', '5'];

function defaultStatePath() {
  const base = process.env.HERMES_HOME
    || path.join(os.homedir(), '.hermes');
  return path.join(base, 'state', 'masuda-telegram-watch.json');
}

export function parseMasudaMessage(message) {
  if (typeof message !== 'string' || !message.startsWith(MASUDA_PREFIX)) return null;
  const fields = {};
  for (const segment of message.split('|').slice(1)) {
    const separator = segment.indexOf('=');
    if (separator <= 0) continue;
    fields[segment.slice(0, separator)] = segment.slice(separator + 1);
  }
  if (fields.setup !== 'masuda_scalp' || !fields.dir || !fields.state) return null;
  return fields;
}

function firedKey(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

export function selectNewEvents(alerts, previousState = {}, { prime = false } = {}) {
  const seen = { ...(previousState.alerts || {}) };
  const events = [];

  for (const alert of alerts || []) {
    const event = parseMasudaMessage(alert?.message);
    if (!event) continue;
    const id = String(alert.alert_id ?? '');
    const fired = firedKey(alert.last_fired);
    const previous = firedKey(seen[id]);

    if (!prime && fired !== null && fired !== previous) {
      events.push({ alert, event });
    }
    seen[id] = fired;
  }

  return {
    events,
    state: {
      version: STATE_VERSION,
      alerts: seen,
      updated_at: new Date().toISOString(),
    },
  };
}

function round(value, digits = 5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'n/a';
  return String(Number(number.toFixed(digits)));
}

function formatFireTime(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value || 'n/a');
  const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function normalizedSymbol(value) {
  const symbol = String(value || '');
  return symbol.split(':').pop().replace(/[^A-Za-z0-9!._-]/g, '');
}

function paneMatchesSymbol(paneSymbol, alertSymbol) {
  const pane = normalizedSymbol(paneSymbol);
  const alert = normalizedSymbol(alertSymbol);
  return !alert || pane === alert;
}

function summarizeStudies(result) {
  const relevant = (result?.studies || []).filter(study =>
    /増田|ADX|MACD|RSI|TDI|Bollinger|BB\+RSI/i.test(study.name || '')
  );
  const lines = [];
  for (const study of relevant.slice(0, 6)) {
    const values = Object.entries(study.values || {})
      .slice(0, 6)
      .map(([key, value]) => `${key}=${value}`);
    if (values.length) lines.push(`${study.name}: ${values.join(', ')}`);
  }
  return lines;
}

export async function collectMtfContext(alert, dependencies = {}) {
  const panesFn = dependencies.listPanes || listPanes;
  const focusFn = dependencies.focusPane || focusPane;
  const ohlcvFn = dependencies.getOhlcv || getOhlcv;
  const studiesFn = dependencies.getStudyValues || getStudyValues;
  const delay = dependencies.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));

  const layout = await panesFn();
  const originalIndex = layout.active_index;
  const candidates = (layout.panes || [])
    .filter(pane => RELEVANT_RESOLUTIONS.includes(String(pane.resolution)))
    .filter(pane => paneMatchesSymbol(pane.symbol, alert.symbol))
    .sort((a, b) => RELEVANT_RESOLUTIONS.indexOf(String(a.resolution))
      - RELEVANT_RESOLUTIONS.indexOf(String(b.resolution)));
  const snapshots = [];

  try {
    for (const pane of candidates) {
      try {
        await focusFn({ index: pane.index });
        await delay(250);
        const [ohlcv, studies] = await Promise.all([
          ohlcvFn({ count: 20, summary: true }),
          studiesFn(),
        ]);
        snapshots.push({
          index: pane.index,
          symbol: pane.symbol,
          resolution: String(pane.resolution),
          ohlcv,
          studies: summarizeStudies(studies),
        });
      } catch (error) {
        snapshots.push({
          index: pane.index,
          symbol: pane.symbol,
          resolution: String(pane.resolution),
          error: error?.message || String(error),
        });
      }
    }
  } finally {
    if (originalIndex !== null && originalIndex !== undefined) {
      await focusFn({ index: originalIndex }).catch(() => {});
    }
  }

  return {
    layout: layout.layout_name || layout.layout,
    original_index: originalIndex,
    snapshots,
  };
}

function directionLabel(direction) {
  if (direction === 'long') return 'LONG候補';
  if (direction === 'short') return 'SHORT候補';
  return direction || '不明';
}

function stateLabel(state) {
  if (state === 'forming') return '形成中';
  if (state === 'triggered') return 'バー確定で成立';
  if (state === 'invalidated') return '無効化';
  return state || '不明';
}

export function buildTelegramMessage({ alert, event, context, generatedAt = new Date().toISOString() }) {
  const lines = [
    '【Flamme｜増田式 shadow通知】',
    `イベント: ${event.kind || 'composite'} / ${directionLabel(event.dir)} / ${stateLabel(event.state)}`,
    `銘柄・時間足: ${alert.symbol || event.ticker || 'n/a'} / ${alert.resolution || event.tf || 'n/a'}`,
    `TradingView発火: ${formatFireTime(alert.last_fired)}`,
    `確認時刻: ${generatedAt}`,
    '',
    '■ マルチタイムフレーム（直近20本）',
  ];

  if (!context?.snapshots?.length) {
    lines.push('- 取得不可。TradingView Desktop/CDPまたは4画面レイアウトを確認。');
  } else {
    for (const snapshot of context.snapshots) {
      if (snapshot.error) {
        lines.push(`- ${snapshot.resolution}: 取得失敗 (${snapshot.error})`);
        continue;
      }
      const data = snapshot.ohlcv || {};
      lines.push(
        `- ${snapshot.resolution}: close=${round(data.close)}, change=${data.change_pct || 'n/a'}, `
        + `high=${round(data.high)}, low=${round(data.low)}`
      );
      for (const study of snapshot.studies || []) lines.push(`  ${study}`);
    }
  }

  lines.push(
    '',
    '判定境界: これは監視通知で、売買推奨・発注ではありません。',
    'masuda_scalpはregistry未採用のため、正式なGO判定には使いません。',
    '次: バー確定、MTF整合、無効化条件、スプレッドを人間が確認。'
  );
  return `${lines.join('\n')}\n`;
}

async function readState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: STATE_VERSION, alerts: {} };
    throw error;
  }
}

async function writeState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporary, statePath);
}

function parseArgs(argv) {
  const options = { prime: false, statePath: defaultStatePath(), help: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prime') options.prime = true;
    else if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/masuda_telegram_watch.js [--prime] [--state PATH]',
    '',
    'Poll MASUDA TradingView alerts once. Empty stdout means no new event.',
    '--prime records current last_fired values without emitting notifications.',
    '',
  ].join('\n');
}

export async function runWatcher(options, dependencies = {}) {
  const listFn = dependencies.listAlerts || listAlerts;
  const readFn = dependencies.readState || readState;
  const writeFn = dependencies.writeState || writeState;
  const contextFn = dependencies.collectMtfContext || collectMtfContext;
  const now = dependencies.now || (() => new Date().toISOString());

  const previousState = await readFn(options.statePath);
  const response = await listFn();
  if (!response?.success || response.error) {
    throw new Error(response?.error || 'Could not list TradingView alerts.');
  }

  const selected = selectNewEvents(response.alerts, previousState, { prime: options.prime });
  const messages = [];
  for (const item of selected.events) {
    let context;
    try {
      context = await contextFn(item.alert);
    } catch (error) {
      context = { snapshots: [], error: error?.message || String(error) };
    }
    messages.push(buildTelegramMessage({ ...item, context, generatedAt: now() }));
  }

  await writeFn(options.statePath, selected.state);
  return messages.join('\n');
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  try {
    const output = await runWatcher(options);
    if (output) process.stdout.write(output);
  } finally {
    await disconnect();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(error => {
    process.stderr.write(`${error?.message || String(error)}\n`);
    process.exit(1);
  });
}
