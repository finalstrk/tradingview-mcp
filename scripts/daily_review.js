#!/usr/bin/env node
/**
 * Read-only daily TradingView review.
 *
 * This script intentionally reads chart/journal state only. It does not launch
 * TradingView, mutate chart state, place orders, or touch broker credentials.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { healthCheck } from '../src/core/health.js';
import { getState } from '../src/core/chart.js';
import {
  getOhlcv,
  getPineLabels,
  getPineLines,
  getPineTables,
  getQuote,
  getStudyValues,
} from '../src/core/data.js';
import { get as getWatchlist } from '../src/core/watchlist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    bars: 100,
    dtFilter: 'DT ',
    json: false,
    maxLabels: 20,
    out: null,
    watchlist: true,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--no-watchlist') opts.watchlist = false;
    else if (arg === '--bars') opts.bars = Number(argv[++i]);
    else if (arg === '--dt-filter') opts.dtFilter = argv[++i] ?? opts.dtFilter;
    else if (arg === '--max-labels') opts.maxLabels = Number(argv[++i]);
    else if (arg === '--out') opts.out = argv[++i] ?? null;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(opts.bars) || opts.bars < 5 || opts.bars > 500) {
    throw new Error('--bars must be a number between 5 and 500');
  }
  if (!Number.isFinite(opts.maxLabels) || opts.maxLabels < 1 || opts.maxLabels > 100) {
    throw new Error('--max-labels must be a number between 1 and 100');
  }

  return opts;
}

function usage() {
  return `Usage: node scripts/daily_review.js [options]\n\n` +
    `Read-only daily TradingView/DT evidence review. Outputs markdown by default.\n\n` +
    `Options:\n` +
    `  --json                 Output the raw collected payload as JSON\n` +
    `  --out <path>           Write markdown/JSON output to a file\n` +
    `  --bars <n>             OHLCV bars for summary, 5-500 (default: 100)\n` +
    `  --dt-filter <text>     Pine drawing study filter (default: "DT ")\n` +
    `  --max-labels <n>       Max labels per DT study, 1-100 (default: 20)\n` +
    `  --no-watchlist         Skip watchlist panel read\n` +
    `  -h, --help             Show help\n`;
}

async function collect(name, fn) {
  try {
    const data = await fn();
    return { name, ok: true, data };
  } catch (err) {
    return { name, ok: false, error: err?.message || String(err) };
  }
}

function readOnlyBoundary() {
  return [
    '発注しません。証券口座・銀行・決済UIを操作しません。',
    '売買方向・サイズ・注文タイミング・SL/TP・kill switch は人間と事前定義ルールの領域です。',
    'TradingView/LLM/SNS由来の情報は仮説入力であり、投資 thesis の証明ではありません。',
  ];
}

export function summarizeRegistry(registry) {
  const setups = Array.isArray(registry?.setups) ? registry.setups : [];
  const marketRows = [];
  const counts = {};

  for (const setup of setups) {
    const markets = setup.markets || {};
    for (const [market, cfg] of Object.entries(markets)) {
      const status = cfg?.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      marketRows.push({
        setup: setup.id,
        setup_name: setup.name,
        market,
        status,
        bt_winrate: cfg?.bt_winrate ?? null,
        bt_pf: cfg?.bt_pf ?? null,
        evidence_count: Array.isArray(cfg?.evidence) ? cfg.evidence.length : 0,
        updated: cfg?.updated ?? null,
      });
    }
  }

  return {
    version: registry?.version ?? null,
    updated: registry?.updated ?? null,
    setup_count: setups.length,
    market_count: marketRows.length,
    counts,
    adopted: marketRows.filter(r => r.status === 'adopted'),
    candidate: marketRows.filter(r => r.status === 'candidate'),
    rejected: marketRows.filter(r => r.status === 'rejected'),
    insufficient_data: marketRows.filter(r => r.status === 'insufficient_data'),
    retired: marketRows.filter(r => r.status === 'retired'),
  };
}

async function readRegistry(registryPath = path.join(REPO_ROOT, 'journal', 'registry.json')) {
  const text = await readFile(registryPath, 'utf8');
  const registry = JSON.parse(text);
  return summarizeRegistry(registry);
}

async function readStats(statsPath = path.join(REPO_ROOT, 'journal', 'stats', 'setup_stats.json')) {
  if (!existsSync(statsPath)) return { exists: false, groups: [] };
  const stats = JSON.parse(await readFile(statsPath, 'utf8'));
  const groups = [];
  for (const [setup, markets] of Object.entries(stats.setups || {})) {
    for (const [market, modes] of Object.entries(markets || {})) {
      for (const [mode, metrics] of Object.entries(modes || {})) {
        groups.push({ setup, market, mode, ...metrics });
      }
    }
  }
  return { exists: true, groups };
}

function flattenDtLabels(labelsResult) {
  const studies = labelsResult?.studies || [];
  return studies.flatMap(study => (study.labels || []).map(label => ({
    study: study.name,
    text: label.text || '',
    price: label.price ?? null,
  })));
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000000) / 1000000);
  return String(value);
}

function formatMarketRow(row) {
  const pieces = [`${row.setup}/${row.market}`, row.status];
  if (row.bt_winrate !== null) pieces.push(`WR=${formatValue(row.bt_winrate)}`);
  if (row.bt_pf !== null) pieces.push(`PF=${formatValue(row.bt_pf)}`);
  if (row.evidence_count) pieces.push(`evidence=${row.evidence_count}`);
  return pieces.join(' | ');
}

function listOrNone(items, mapFn = x => x, limit = 12) {
  if (!items || items.length === 0) return ['- なし'];
  const lines = items.slice(0, limit).map(item => `- ${mapFn(item)}`);
  if (items.length > limit) lines.push(`- ...ほか ${items.length - limit} 件`);
  return lines;
}

function section(title, lines) {
  return [`## ${title}`, '', ...lines, ''];
}

function connectionOk(payload) {
  return payload.cdp?.ok && payload.cdp?.data?.cdp_connected;
}

export function buildMarkdownReport(payload) {
  const generated = payload.generated_at || new Date().toISOString();
  const lines = [`# Daily TradingView Read-only Review — ${generated.slice(0, 10)}`, ''];

  lines.push(...section('Read-only boundary', readOnlyBoundary().map(x => `- ${x}`)));

  const blockers = [];
  if (!connectionOk(payload)) {
    blockers.push(`TradingView CDP unavailable: ${payload.cdp?.error || 'unknown connection state'}`);
  }

  const chart = payload.chart?.data || {};
  const quote = payload.quote?.data || {};
  const ohlcv = payload.ohlcv?.data || {};
  lines.push(...section('Current chart', [
    `- CDP: ${connectionOk(payload) ? 'connected' : 'unavailable'}`,
    `- Symbol: ${formatValue(chart.symbol || quote.symbol || payload.cdp?.data?.chart_symbol)}`,
    `- Timeframe: ${formatValue(chart.resolution || payload.cdp?.data?.chart_resolution)}`,
    `- Studies: ${Array.isArray(chart.studies) ? chart.studies.length : 'n/a'}`,
    `- Quote: last=${formatValue(quote.last || quote.close)}, volume=${formatValue(quote.volume)}, description=${formatValue(quote.description)}`,
    `- OHLCV(${payload.options?.bars || 'n/a'}): change=${formatValue(ohlcv.change)} (${formatValue(ohlcv.change_pct)}), high=${formatValue(ohlcv.high)}, low=${formatValue(ohlcv.low)}, avg_volume=${formatValue(ohlcv.avg_volume)}`,
  ]));

  if (payload.chart && !payload.chart.ok) blockers.push(`chart state: ${payload.chart.error}`);
  if (payload.quote && !payload.quote.ok) blockers.push(`quote: ${payload.quote.error}`);
  if (payload.ohlcv && !payload.ohlcv.ok) blockers.push(`ohlcv: ${payload.ohlcv.error}`);

  const labels = payload.dt_labels?.ok ? flattenDtLabels(payload.dt_labels.data) : [];
  if (payload.dt_labels && !payload.dt_labels.ok) blockers.push(`DT labels: ${payload.dt_labels.error}`);
  lines.push(...section('Visible DT signals / labels', labels.length === 0
    ? ['- DT labels not detected. Interpretation: no-action until a visible, parseable setup appears.']
    : listOrNone(labels, label => `${label.study}: ${label.text || '(no text)'}${label.price !== null ? ` @ ${label.price}` : ''} → interpretation: watch / human review required`, 20)));

  const values = payload.study_values?.data?.studies || [];
  if (payload.study_values && !payload.study_values.ok) blockers.push(`study values: ${payload.study_values.error}`);
  const valueLines = values.flatMap(study => {
    const pairs = Object.entries(study.values || {}).slice(0, 6).map(([k, v]) => `${k}=${v}`);
    return [`- ${study.name}: ${pairs.length ? pairs.join(', ') : 'values unavailable'}`];
  });
  lines.push(...section('Indicator context', valueLines.length ? valueLines.slice(0, 20) : ['- Visible study values unavailable or empty.']));

  const dtTables = payload.dt_tables?.data?.studies || [];
  const tableLines = dtTables.flatMap(study => (study.tables || []).flatMap(table =>
    (table.rows || []).slice(0, 6).map(row => `- ${study.name}: ${row}`)
  ));
  lines.push(...section('DT tables', tableLines.length ? tableLines.slice(0, 20) : ['- DT table data not detected.']));

  const dtLines = payload.dt_lines?.data?.studies || [];
  const lineLines = dtLines.map(study => `- ${study.name}: levels=${(study.horizontal_levels || []).slice(0, 12).join(', ') || 'none'}`);
  lines.push(...section('DT levels', lineLines.length ? lineLines : ['- DT line levels not detected.']));

  const registry = payload.registry?.data;
  if (payload.registry && !payload.registry.ok) blockers.push(`registry: ${payload.registry.error}`);
  if (registry) {
    const gate = registry.adopted.length > 0
      ? `${registry.adopted.length} adopted setup x market found; still human-only execution.`
      : 'No adopted setup x market; live judgement remains gated.';
    lines.push(...section('Local evidence gate', [
      `- Registry updated: ${formatValue(registry.updated)}`,
      `- Setup count: ${formatValue(registry.setup_count)}, market entries: ${formatValue(registry.market_count)}`,
      `- Status counts: ${Object.entries(registry.counts || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a'}`,
      `- Gate result: ${gate}`,
      '',
      '### Adopted',
      ...listOrNone(registry.adopted, formatMarketRow, 10),
      '',
      '### Candidate',
      ...listOrNone(registry.candidate, formatMarketRow, 10),
      '',
      '### Rejected',
      ...listOrNone(registry.rejected, formatMarketRow, 10),
    ]));
  } else {
    lines.push(...section('Local evidence gate', ['- Registry unavailable; treat all chart signals as no-action until evidence is checked.']));
  }

  const stats = payload.stats?.data;
  if (stats?.exists && stats.groups.length) {
    lines.push(...section('Trade stats snapshot', listOrNone(stats.groups, g => `${g.setup}/${g.market}/${g.mode}: n=${formatValue(g.n)}, win_rate=${formatValue(g.win_rate)}, avg_r=${formatValue(g.avg_r)}, plan=${formatValue(g.plan_adherence)}`, 12)));
  } else {
    lines.push(...section('Trade stats snapshot', ['- No generated trade stats detected or no trade groups available.']));
  }

  const watchlist = payload.watchlist?.data;
  if (payload.watchlist && !payload.watchlist.ok) blockers.push(`watchlist: ${payload.watchlist.error}`);
  lines.push(...section('Watchlist snapshot', watchlist
    ? [`- Source: ${formatValue(watchlist.source)}`, `- Count: ${formatValue(watchlist.count)}`, ...listOrNone(watchlist.symbols || [], s => `${s.symbol}${s.last ? ` last=${s.last}` : ''}${s.change_percent ? ` change=${s.change_percent}` : ''}`, 20)]
    : ['- Watchlist read skipped or unavailable.']));

  if (payload.dt_tables && !payload.dt_tables.ok) blockers.push(`DT tables: ${payload.dt_tables.error}`);
  if (payload.dt_lines && !payload.dt_lines.ok) blockers.push(`DT lines: ${payload.dt_lines.error}`);
  if (payload.stats && !payload.stats.ok) blockers.push(`stats: ${payload.stats.error}`);

  lines.push(...section('Blockers / uncertainty', blockers.length ? blockers.map(b => `- ${b}`) : ['- なし。ただし、このレポートは仮説整理であり売買判断ではない。']));

  const next = [];
  if (!connectionOk(payload)) next.push('TradingView Desktop を CDP 付きで起動し、`node src/cli/index.js status` を確認する。');
  if (registry && registry.adopted.length === 0) next.push('adopted がないため、次は `/setup-verify` または replay 練習で evidence を増やす。');
  if (labels.length > 0) next.push('DT label が出ている銘柄は、registry gate と一次情報/相場環境を確認して `watch` か `research` に分類する。');
  if (next.length === 0) next.push('今日の出力が判断ノイズを減らしたかだけを確認する。不要なら report 項目を削る。');
  lines.push(...section('Next verification actions', next.map(x => `- ${x}`)));

  return lines.join('\n');
}

export async function collectDailyReview(options = {}) {
  const opts = {
    bars: options.bars ?? 100,
    dtFilter: options.dtFilter ?? 'DT ',
    maxLabels: options.maxLabels ?? 20,
    watchlist: options.watchlist !== false,
  };
  const payload = {
    generated_at: new Date().toISOString(),
    mode: 'read-only',
    options: opts,
    boundary: readOnlyBoundary(),
  };

  payload.registry = await collect('registry', () => readRegistry());
  payload.stats = await collect('stats', () => readStats());
  payload.cdp = await collect('cdp', () => healthCheck());

  if (connectionOk(payload)) {
    payload.chart = await collect('chart', () => getState());
    payload.quote = await collect('quote', () => getQuote());
    payload.ohlcv = await collect('ohlcv', () => getOhlcv({ count: opts.bars, summary: true }));
    payload.study_values = await collect('study_values', () => getStudyValues());
    payload.dt_labels = await collect('dt_labels', () => getPineLabels({ study_filter: opts.dtFilter, max_labels: opts.maxLabels }));
    payload.dt_tables = await collect('dt_tables', () => getPineTables({ study_filter: opts.dtFilter }));
    payload.dt_lines = await collect('dt_lines', () => getPineLines({ study_filter: opts.dtFilter }));
    if (opts.watchlist) payload.watchlist = await collect('watchlist', () => getWatchlist());
  }

  return payload;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const payload = await collectDailyReview(options);
  const output = options.json
    ? `${JSON.stringify(payload, null, 2)}\n`
    : `${buildMarkdownReport(payload)}\n`;

  if (options.out) {
    const outPath = path.resolve(process.cwd(), options.out);
    await writeFile(outPath, output, 'utf8');
    process.stdout.write(`${outPath}\n`);
  } else {
    process.stdout.write(output);
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(err => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
  });
}
