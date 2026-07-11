#!/usr/bin/env node
/**
 * Deterministic strategy specification gate.
 *
 * This checker is deliberately read-only. It validates whether a strategy idea
 * is specified enough for research/paper review, not whether it should trade.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const HUMAN_CONFIRMATION_RE = /human|manual|confirm|approval|hitl|人間|手動|確認|承認/i;

export const REQUIRED_REQUIREMENTS = [
  {
    id: 'id',
    label: 'strategy id',
    paths: [['id'], ['setup'], ['name']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'market',
    label: 'market / universe',
    paths: [['market'], ['universe'], ['symbol_universe']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'timeframe',
    label: 'timeframe',
    paths: [['timeframe'], ['resolution'], ['bar_interval']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'data_source',
    label: 'data source',
    paths: [['data_source'], ['data', 'source'], ['source']],
    category: 'validation',
  },
  {
    id: 'entry',
    label: 'entry condition',
    paths: [['entry'], ['entry_condition'], ['rules', 'entry']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'take_profit',
    label: 'take-profit condition',
    paths: [['exit_take_profit'], ['take_profit'], ['exit', 'take_profit'], ['rules', 'exit_take_profit']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'stop_loss',
    label: 'stop-loss condition',
    paths: [['exit_stop_loss'], ['stop_loss'], ['exit', 'stop_loss'], ['rules', 'exit_stop_loss']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'position_size',
    label: 'position sizing rule',
    paths: [['position_size'], ['position_sizing'], ['risk', 'position_size'], ['rules', 'position_size']],
    category: 'risk',
    critical: true,
  },
  {
    id: 'max_risk_per_trade',
    label: 'max risk per trade',
    paths: [['risk', 'max_risk_per_trade'], ['risk', 'per_trade'], ['max_risk_per_trade']],
    category: 'risk',
  },
  {
    id: 'daily_loss_limit',
    label: 'daily loss limit',
    paths: [['risk', 'daily_loss_limit'], ['daily_loss_limit']],
    category: 'risk',
  },
  {
    id: 'max_concurrent_positions',
    label: 'max concurrent positions',
    paths: [['risk', 'max_concurrent_positions'], ['max_concurrent_positions']],
    category: 'risk',
  },
  {
    id: 'backtest_period',
    label: 'backtest period',
    paths: [['backtest_period'], ['validation', 'backtest_period'], ['backtest', 'period']],
    category: 'validation',
  },
  {
    id: 'paper_trade_period',
    label: 'paper-trade period',
    paths: [['paper_trade'], ['paper_trade_period'], ['validation', 'paper_trade_period']],
    category: 'validation',
  },
  {
    id: 'kill_switch',
    label: 'kill switch',
    paths: [['kill_switch'], ['risk', 'kill_switch']],
    category: 'risk',
  },
  {
    id: 'review_cadence',
    label: 'review cadence',
    paths: [['review_cadence'], ['review', 'cadence']],
    category: 'validation',
  },
  {
    id: 'edge_death_condition',
    label: 'edge death / falsification condition',
    paths: [['edge_death_condition'], ['falsification'], ['kill_condition'], ['review', 'edge_death_condition']],
    category: 'validation',
  },
  {
    id: 'human_confirmation',
    label: 'human confirmation boundary',
    paths: [['human_confirmation'], ['human_approval'], ['execution', 'human_confirmation']],
    category: 'permission',
    critical: true,
    predicate: confirmsHumanBoundary,
  },
];

export function strategySpecTemplate() {
  return {
    id: 'example_setup',
    market: 'stocks_jp',
    timeframe: 'D',
    data_source: 'TradingView OHLCV + official IR/news verification',
    entry: ['Define the exact indicator/price/volume conditions here.'],
    exit_take_profit: ['Define target, R multiple, or invalidation of upside thesis.'],
    exit_stop_loss: ['Define stop level and whether it is close-based or intraday.'],
    position_size: 'Risk at most 0.5% of equity per trade.',
    risk: {
      max_risk_per_trade: '0.5% equity',
      daily_loss_limit: '1.0% equity; stop reviewing new entries after hit',
      max_concurrent_positions: 3,
      kill_switch: ['API/data failure', 'rule drift', 'manual override required'],
    },
    backtest_period: 'YYYY-MM-DD..YYYY-MM-DD, out-of-sample included',
    paper_trade_period: 'At least 1-3 months before any small-live discussion',
    review_cadence: 'weekly paper review; monthly parameter review',
    edge_death_condition: ['PF < 1.0 OOS', 'live/paper gap persists', 'regime mismatch'],
    human_confirmation: {
      required: true,
      live_orders: 'manual only; this spec checker never places orders',
    },
  };
}

function valueAt(obj, pathParts) {
  let cur = obj;
  for (const part of pathParts) {
    if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function meaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === 'object') return Object.values(value).some(meaningful);
  return false;
}

function firstMatchingValue(spec, requirement) {
  for (const p of requirement.paths) {
    const value = valueAt(spec, p);
    if (meaningful(value)) return { path: p.join('.'), value };
  }
  return { path: null, value: undefined };
}

export function confirmsHumanBoundary(value) {
  if (value === true) return true;
  if (typeof value === 'string') return HUMAN_CONFIRMATION_RE.test(value);
  if (Array.isArray(value)) return value.some(confirmsHumanBoundary);
  if (value && typeof value === 'object') {
    if (value.required === true || value.manual_only === true || value.hitl === true) return true;
    return Object.values(value).some(confirmsHumanBoundary);
  }
  return false;
}

function strategyId(spec, index) {
  return String(spec?.id || spec?.setup || spec?.name || `strategy_${index + 1}`);
}

export function checkStrategySpec(spec, index = 0) {
  const checks = REQUIRED_REQUIREMENTS.map(req => {
    const found = firstMatchingValue(spec, req);
    const ok = found.path !== null && (req.predicate ? req.predicate(found.value) : true);
    return {
      id: req.id,
      label: req.label,
      category: req.category,
      critical: Boolean(req.critical),
      ok,
      path: found.path,
    };
  });

  const missing = checks.filter(c => !c.ok);
  const criticalMissing = missing.filter(c => c.critical);
  const complete = missing.length === 0;
  const nextAction = criticalMissing.length ? 'no-action' : complete ? 'watch' : 'research';

  return {
    id: strategyId(spec, index),
    next_action: nextAction,
    live_order_allowed: false,
    live_gate: 'blocked: human confirmation and deterministic risk controls required before any broker action',
    paper_candidate: complete,
    complete,
    missing: missing.map(c => c.id),
    critical_missing: criticalMissing.map(c => c.id),
    checks,
  };
}

export function normalizeStrategySpecs(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.strategies)) return input.strategies;
  if (input && typeof input === 'object') return [input];
  return [];
}

export function checkStrategyDocument(input) {
  const strategies = normalizeStrategySpecs(input);
  const results = strategies.map((spec, i) => checkStrategySpec(spec, i));
  const byNextAction = results.reduce((acc, r) => {
    acc[r.next_action] = (acc[r.next_action] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    mode: 'read-only-strategy-spec-gate',
    total: results.length,
    complete: results.filter(r => r.complete).length,
    live_order_allowed: false,
    by_next_action: byNextAction,
    results,
  };
}

function requirementLines(result) {
  return result.checks.map(c => `- [${c.ok ? 'x' : ' '}] ${c.id} (${c.label})${c.path ? ` via \`${c.path}\`` : ''}`);
}

export function buildStrategySpecMarkdown(report) {
  const lines = [
    `# Strategy Spec Check — ${report.generated_at.slice(0, 10)}`,
    '',
    '## Boundary',
    '',
    '- Read-only check only. This script never places orders, mutates charts, or touches broker credentials.',
    '- Complete specs are paper/review candidates, not live-trade approval.',
    '- LLM output stays in research/review; trade direction, size, order timing, SL/TP, and kill switches remain deterministic + human-reviewed.',
    '',
    '## Summary',
    '',
    `- Strategies: ${report.total}`,
    `- Complete specs: ${report.complete}`,
    `- Live order allowed: ${report.live_order_allowed ? 'yes' : 'no'}`,
    `- Next actions: ${Object.entries(report.by_next_action).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a'}`,
    '',
  ];

  for (const result of report.results) {
    lines.push(
      `## ${result.id}`,
      '',
      `- next_action: ${result.next_action}`,
      `- paper_candidate: ${result.paper_candidate ? 'yes' : 'no'}`,
      `- live_gate: ${result.live_gate}`,
      `- missing: ${result.missing.length ? result.missing.join(', ') : 'none'}`,
      `- critical_missing: ${result.critical_missing.length ? result.critical_missing.join(', ') : 'none'}`,
      '',
      '### Requirements',
      '',
      ...requirementLines(result),
      '',
    );
  }

  if (report.total === 0) {
    lines.push('## No strategies found', '', '- Provide a JSON object, JSON array, or `{ "strategies": [...] }` document.', '');
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const opts = { file: null, json: false, out: null, template: false, strict: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--template') opts.template = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--out') opts.out = argv[++i] ?? null;
    else if (!opts.file) opts.file = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

function usage() {
  return `Usage: node scripts/strategy_spec_check.js <spec.json> [options]\n\n` +
    `Deterministic read-only gate for trading strategy specifications.\n\n` +
    `Options:\n` +
    `  --template      Print a JSON template instead of checking a file\n` +
    `  --json          Output raw check result as JSON\n` +
    `  --out <path>    Write output to a file\n` +
    `  --strict        Exit 1 when any spec is incomplete or critically missing\n` +
    `  -h, --help      Show help\n`;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }

  if (opts.template) {
    process.stdout.write(`${JSON.stringify(strategySpecTemplate(), null, 2)}\n`);
    return;
  }

  if (!opts.file) throw new Error('Missing <spec.json>. Use --template to print a starter spec.');

  const text = await readFile(path.resolve(process.cwd(), opts.file), 'utf8');
  const report = checkStrategyDocument(JSON.parse(text));
  const output = opts.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : buildStrategySpecMarkdown(report);

  if (opts.out) await writeFile(path.resolve(process.cwd(), opts.out), output, 'utf8');
  else process.stdout.write(output);

  if (opts.strict && report.results.some(r => !r.complete)) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(err => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
  });
}
