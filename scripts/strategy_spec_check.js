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
const PLACEHOLDER_RE = /(?:YYYY\s*[-/]\s*MM\s*[-/]\s*DD|define\b|as\s+applicable|tbd|todo|placeholder|fill\s+in|to\s+be\s+determined|your\s+(?:value|rule|condition|assumption)|example\s+(?:value|rule|condition|assumption))/i;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_RANGE_RE = /^\s*(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to)\s*(\d{4}-\d{2}-\d{2})\s*$/i;

function textValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
}

function hasConcreteValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0 && !PLACEHOLDER_RE.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasConcreteValue);
  if (typeof value === 'object') return Object.values(value).some(hasConcreteValue);
  return false;
}

function hasText(value, pattern) {
  return textValues(value).some(text => {
    if (PLACEHOLDER_RE.test(text)) return false;
    return typeof pattern === 'function' ? pattern(text) : pattern.test(text);
  });
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(ISO_DATE_RE);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return { iso: `${year}-${month}-${day}`, time: date.getTime() };
}

export function parseISODateRange(value) {
  let start;
  let end;
  if (typeof value === 'string') {
    const match = value.match(ISO_RANGE_RE);
    if (!match) return null;
    [, start, end] = match;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    start = value.start ?? value.from;
    end = value.end ?? value.to;
  } else {
    return null;
  }
  const parsedStart = parseISODate(start);
  const parsedEnd = parseISODate(end);
  if (!parsedStart || !parsedEnd || parsedStart.time > parsedEnd.time) return null;
  return { start: parsedStart.iso, end: parsedEnd.iso, start_time: parsedStart.time, end_time: parsedEnd.time };
}

function dateRange(value) {
  return parseISODateRange(value) !== null;
}

function benchmark(value) {
  return hasText(value, /(?:benchmark|baseline|buy\s*[- ]?and\s*[- ]?hold|cash|index|etf|topix|nikkei|s\s*&?\s*p|msci|market\s+(?:return|index)|reference|risk\s*[- ]?free)/i);
}

function parameterFreeze(value) {
  return hasText(value, /(?:freeze|frozen|lock(?:ed)?|fixed|no\s+(?:further\s+)?(?:parameter|rule|model)\s+(?:change|tuning|optimization))/i)
    && hasText(value, /(?:parameter|rule|model|tuning|configuration)/i)
    && hasText(value, /(?:before|prior\s+to|pre[- ]?holdout|holdout)/i);
}

function fillModel(value) {
  return hasText(value, /(?:bar\s+(?:open|close)|next[- ]?bar\s+(?:open|close)|market(?:\s+order)?|limit(?:\s+order)?|bid|ask|mid|vwap|ohlc|\b(?:open|close)\b)/i);
}

function stressFillModel(value) {
  return fillModel(value) && hasText(value, /(?:stress|conservative|adverse|delay(?:ed)?|worse|worst|one[- ]?bar)/i);
}

const COST_UNIT_RE = /(?:%|bps?|basis\s+points?|ticks?|pips?|points?|(?:usd|jpy|eur|gbp|cents?)\b|per\s+(?:share|contract|unit|order|side|trade)|price\s+units?)/i;
const NUMBER_RE = /(?:\d+(?:\.\d+)?|zero|none|free)/i;

function costAssumption(value) {
  return hasText(value, text => NUMBER_RE.test(text) && COST_UNIT_RE.test(text));
}

function topTradeRemoval(value) {
  return hasText(value, /(?:remove|removal|exclude|drop|without|recompute)/i)
    && hasText(value, /(?:top|largest|winner|winning\s+trade|best\s+trade)/i)
    && hasText(value, /(?:trade|win|winner|\d+\s*%)/i);
}

function regimeSplits(value) {
  const text = textValues(value).filter(text => !PLACEHOLDER_RE.test(text)).join(' ');
  if (!text) return false;
  const concepts = text.match(/(?:trend|range|volatility|risk\s*[- ]?on|risk\s*[- ]?off|bull|bear|session|high|low|breakout|mean\s*reversion)/gi) || [];
  return concepts.length >= 2 && /(?:split|regime|\/|versus|\bvs\.?\b|high\s*[-/]\s*low|risk\s*[- ]?on\s*[-/]\s*risk\s*[- ]?off)/i.test(text);
}

function longShortDecomposition(value) {
  const text = textValues(value).filter(text => !PLACEHOLDER_RE.test(text)).join(' ');
  if (!text) return false;
  const hasLong = /\blong\b/i.test(text);
  const hasShort = /\bshort\b/i.test(text);
  const hasPlan = /(?:separate|decompos|report|metric|split|n\/a|not\s+applicable|reason|long\s*[- ]?only)/i.test(text);
  return hasLong && (hasShort || /long\s*[- ]?only/i.test(text)) && hasPlan;
}

function paperTradePeriod(value) {
  return dateRange(value) || hasText(value, /\d+(?:\.\d+)?\s*(?:day|week|month|year)s?/i);
}


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
    predicate: dateRange,
  },
  {
    id: 'benchmark',
    label: 'pre-declared benchmark',
    paths: [['benchmark'], ['validation', 'benchmark'], ['backtest', 'benchmark']],
    category: 'validation',
    predicate: benchmark,
  },
  {
    id: 'candidate_count',
    label: 'candidate / parameter search count',
    paths: [['candidate_count'], ['validation', 'candidate_count'], ['search', 'candidate_count']],
    category: 'overfit_guard',
    predicate: positiveInteger,
  },
  {
    id: 'in_sample_period',
    label: 'in-sample period',
    paths: [['in_sample_period'], ['validation', 'in_sample_period'], ['validation', 'is_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'out_of_sample_period',
    label: 'out-of-sample period',
    paths: [['out_of_sample_period'], ['validation', 'out_of_sample_period'], ['validation', 'oos_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'holdout_period',
    label: 'untouched final holdout period',
    paths: [['holdout_period'], ['validation', 'holdout_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'parameter_freeze',
    label: 'parameter-freeze rule before holdout',
    paths: [['parameter_freeze'], ['validation', 'parameter_freeze'], ['validation', 'freeze_rule']],
    category: 'overfit_guard',
    predicate: parameterFreeze,
  },
  {
    id: 'primary_fill_model',
    label: 'primary fill model',
    paths: [['primary_fill_model'], ['execution', 'primary_fill_model'], ['execution', 'primary_fill']],
    category: 'execution',
    predicate: fillModel,
  },
  {
    id: 'stress_fill_model',
    label: 'conservative stress fill model',
    paths: [['stress_fill_model'], ['execution', 'stress_fill_model'], ['execution', 'stress_fill']],
    category: 'execution',
    predicate: stressFillModel,
  },
  {
    id: 'commission',
    label: 'commission assumption',
    paths: [['commission'], ['execution', 'commission'], ['costs', 'commission']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'spread',
    label: 'spread assumption',
    paths: [['spread'], ['execution', 'spread'], ['costs', 'spread']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'slippage',
    label: 'slippage assumption',
    paths: [['slippage'], ['execution', 'slippage'], ['costs', 'slippage']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'top_trade_removal',
    label: 'top 1% / 5% trade-removal check',
    paths: [['top_trade_removal'], ['robustness', 'top_trade_removal']],
    category: 'robustness',
    predicate: topTradeRemoval,
  },
  {
    id: 'regime_splits',
    label: 'regime-split plan',
    paths: [['regime_splits'], ['robustness', 'regime_splits']],
    category: 'robustness',
    predicate: regimeSplits,
  },
  {
    id: 'long_short_decomposition',
    label: 'long / short decomposition',
    paths: [['long_short_decomposition'], ['robustness', 'long_short_decomposition']],
    category: 'robustness',
    predicate: longShortDecomposition,
  },
  {
    id: 'paper_trade_period',
    label: 'paper-trade period',
    paths: [['paper_trade'], ['paper_trade_period'], ['validation', 'paper_trade_period']],
    category: 'validation',
    predicate: paperTradePeriod,
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
    entry: ['Illustrative only: enter long when the 20-day SMA crosses above the 50-day SMA on a daily close and volume is at least its 20-day average.'],
    exit_take_profit: ['Illustrative only: take profit at +2R or when the 20-day SMA closes back below the 50-day SMA.'],
    exit_stop_loss: ['Illustrative only: exit at a close below the entry minus 1 ATR(14); no intraday stop is assumed.'],
    position_size: 'Risk at most 0.5% of equity per trade.',
    risk: {
      max_risk_per_trade: '0.5% equity',
      daily_loss_limit: '1.0% equity; stop reviewing new entries after hit',
      max_concurrent_positions: 3,
      kill_switch: ['API/data failure', 'rule drift', 'manual override required'],
    },
    backtest_period: '2018-01-01..2025-12-31',
    benchmark: ['TOPIX total-return buy-and-hold over the same dates', 'cash at 0% annual return'],
    validation: {
      candidate_count: 1,
      in_sample_period: '2018-01-01..2021-12-31',
      out_of_sample_period: '2022-01-01..2023-12-31',
      holdout_period: '2024-01-01..2025-12-31',
      parameter_freeze: 'Illustrative only: freeze rules and parameters before opening the final holdout; no holdout-driven retuning.',
    },
    execution: {
      primary_fill_model: 'Illustrative only: fill at the next daily bar open after a signal close.',
      stress_fill_model: 'Illustrative only: conservative one-bar-delayed fill at the following bar open.',
      commission: 'Illustrative only: 0.05% per side primary and 0.10% per side stress.',
      spread: 'Illustrative only: 2 bps primary and 5 bps adverse stress.',
      slippage: 'Illustrative only: 1 tick primary and 3 ticks adverse stress.',
    },
    robustness: {
      top_trade_removal: 'Illustrative only: recompute after removing the largest win and the top 1% and 5% winning trades.',
      regime_splits: ['trend/range', 'high/low volatility', 'risk-on/risk-off'],
      long_short_decomposition: 'Illustrative only: report long and short metrics separately; use n/a with a documented reason for long-only systems.',
    },
    paper_trade_period: '2026-01-01..2026-03-31',
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

function requirementValueValid(value, requirement) {
  if (!meaningful(value) || !hasConcreteValue(value)) return false;
  return requirement.predicate ? requirement.predicate(value) : true;
}

function firstMatchingValue(spec, requirement) {
  for (const p of requirement.paths) {
    const value = valueAt(spec, p);
    if (requirementValueValid(value, requirement)) return { path: p.join('.'), value };
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

function validationPeriod(spec, id) {
  const requirement = REQUIRED_REQUIREMENTS.find(req => req.id === id);
  const found = requirement ? firstMatchingValue(spec, requirement) : { path: null, value: undefined };
  return found.path ? parseISODateRange(found.value) : null;
}

function orderedValidationPeriods(spec) {
  const periods = ['in_sample_period', 'out_of_sample_period', 'holdout_period']
    .map(id => validationPeriod(spec, id));
  if (periods.some(period => !period)) return false;
  for (let i = 1; i < periods.length; i += 1) {
    // Ranges are inclusive. The next period must start after the prior end.
    if (periods[i].start_time <= periods[i - 1].end_time) return false;
  }
  return true;
}

export function checkStrategySpec(spec, index = 0) {
  const checks = REQUIRED_REQUIREMENTS.map(req => {
    const found = firstMatchingValue(spec, req);
    const ok = found.path !== null;
    return {
      id: req.id,
      label: req.label,
      category: req.category,
      critical: Boolean(req.critical),
      ok,
      path: found.path,
    };
  });

  const periodsOrdered = orderedValidationPeriods(spec);
  if (!periodsOrdered) {
    for (const check of checks) {
      if (['in_sample_period', 'out_of_sample_period', 'holdout_period'].includes(check.id)) check.ok = false;
    }
  }

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
    validation: {
      periods_ordered_non_overlapping: periodsOrdered,
    },
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
