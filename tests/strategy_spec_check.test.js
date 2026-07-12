/**
 * Strategy spec checker tests — no TradingView connection needed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStrategySpecMarkdown,
  checkStrategyDocument,
  checkStrategySpec,
  strategySpecTemplate,
} from '../scripts/strategy_spec_check.js';

describe('strategy spec checker — deterministic gate', () => {
  it('marks a complete spec as paper/watch only, never live-order ready', () => {
    const result = checkStrategySpec(strategySpecTemplate());

    assert.equal(result.complete, true);
    assert.equal(result.paper_candidate, true);
    assert.equal(result.next_action, 'watch');
    assert.equal(result.live_order_allowed, false);
    assert.deepEqual(result.missing, []);
  });

  it('blocks underspecified ideas with no-action when critical fields are missing', () => {
    const result = checkStrategySpec({
      id: 'ai_theme_momentum',
      market: 'stocks_jp',
      timeframe: 'D',
      entry: 'AI theme looks strong',
    });

    assert.equal(result.complete, false);
    assert.equal(result.next_action, 'no-action');
    assert.equal(result.live_order_allowed, false);
    assert.ok(result.critical_missing.includes('take_profit'));
    assert.ok(result.critical_missing.includes('stop_loss'));
    assert.ok(result.critical_missing.includes('position_size'));
    assert.ok(result.critical_missing.includes('human_confirmation'));
  });

  it('routes non-critical gaps to research rather than act', () => {
    const spec = strategySpecTemplate();
    delete spec.backtest_period;
    delete spec.paper_trade_period;
    delete spec.validation.holdout_period;
    delete spec.execution.stress_fill_model;

    const result = checkStrategySpec(spec);

    assert.equal(result.complete, false);
    assert.equal(result.next_action, 'research');
    assert.deepEqual(result.critical_missing, []);
    assert.ok(result.missing.includes('backtest_period'));
    assert.ok(result.missing.includes('paper_trade_period'));
    assert.ok(result.missing.includes('holdout_period'));
    assert.ok(result.missing.includes('stress_fill_model'));
  });

  it('requires a positive candidate count so parameter search is recorded', () => {
    const spec = strategySpecTemplate();
    spec.validation.candidate_count = 0;

    const result = checkStrategySpec(spec);

    assert.equal(result.complete, false);
    assert.equal(result.next_action, 'research');
    assert.deepEqual(result.critical_missing, []);
    assert.ok(result.missing.includes('candidate_count'));
  });

  it('uses concrete illustrative values so the printed template is strict-valid but not live-ready', () => {
    const template = strategySpecTemplate();
    const result = checkStrategySpec(template);

    assert.equal(result.complete, true);
    assert.equal(result.paper_candidate, true);
    assert.equal(result.next_action, 'watch');
    assert.equal(result.live_order_allowed, false);
    assert.equal(result.validation.periods_ordered_non_overlapping, true);
    assert.match(template.entry[0], /Illustrative only/);
    assert.match(template.benchmark[0], /TOPIX/);
  });

  it('rejects placeholders in benchmark, validation, execution, and robustness gates', () => {
    const cases = [
      ['benchmark', spec => { spec.benchmark = 'as applicable'; }],
      ['in_sample_period', spec => { spec.validation.in_sample_period = 'YYYY-MM-DD..YYYY-MM-DD'; }],
      ['out_of_sample_period', spec => { spec.validation.out_of_sample_period = 'Define the OOS range'; }],
      ['holdout_period', spec => { spec.validation.holdout_period = 'YYYY-MM-DD..YYYY-MM-DD'; }],
      ['parameter_freeze', spec => { spec.validation.parameter_freeze = 'Define the freeze rule'; }],
      ['primary_fill_model', spec => { spec.execution.primary_fill_model = 'Define the fill model'; }],
      ['stress_fill_model', spec => { spec.execution.stress_fill_model = 'as applicable'; }],
      ['commission', spec => { spec.execution.commission = 'as applicable'; }],
      ['spread', spec => { spec.execution.spread = 'YYYY-MM-DD'; }],
      ['slippage', spec => { spec.execution.slippage = 'Define slippage'; }],
      ['top_trade_removal', spec => { spec.robustness.top_trade_removal = 'Define top-trade removal'; }],
      ['regime_splits', spec => { spec.robustness.regime_splits = ['as applicable']; }],
      ['long_short_decomposition', spec => { spec.robustness.long_short_decomposition = 'Define long/short decomposition'; }],
    ];

    for (const [id, mutate] of cases) {
      const spec = strategySpecTemplate();
      mutate(spec);
      const result = checkStrategySpec(spec);
      assert.ok(result.missing.includes(id), `${id} should reject placeholders`);
      assert.equal(result.paper_candidate, false, `${id} must not produce a paper candidate`);
    }
  });

  it('requires explicit ISO ranges and ordered, non-overlapping IS/OOS/holdout periods', () => {
    const invalidDate = strategySpecTemplate();
    invalidDate.validation.in_sample_period = '2024-02-30..2024-03-31';
    const invalidDateResult = checkStrategySpec(invalidDate);
    assert.equal(invalidDateResult.validation.periods_ordered_non_overlapping, false);
    assert.ok(invalidDateResult.missing.includes('in_sample_period'));

    const overlap = strategySpecTemplate();
    overlap.validation.in_sample_period = '2018-01-01..2022-12-31';
    overlap.validation.out_of_sample_period = '2022-12-31..2023-12-31';
    const overlapResult = checkStrategySpec(overlap);
    assert.equal(overlapResult.validation.periods_ordered_non_overlapping, false);
    assert.equal(overlapResult.complete, false);
    assert.ok(overlapResult.missing.includes('out_of_sample_period'));

    const reversed = strategySpecTemplate();
    reversed.validation.in_sample_period = '2023-01-01..2023-12-31';
    reversed.validation.out_of_sample_period = '2022-01-01..2022-12-31';
    const reversedResult = checkStrategySpec(reversed);
    assert.equal(reversedResult.validation.periods_ordered_non_overlapping, false);
    assert.ok(reversedResult.missing.includes('holdout_period'));
  });

  it('fails closed for cost, fill, and robustness prose without measurable semantics', () => {
    const spec = strategySpecTemplate();
    spec.execution.primary_fill_model = 'declared model';
    spec.execution.stress_fill_model = 'conservative model';
    spec.execution.commission = 'instrument-specific commission assumption';
    spec.execution.spread = 'session spread assumption';
    spec.execution.slippage = 'adverse slippage case';
    spec.robustness.top_trade_removal = 'review winners';
    spec.robustness.regime_splits = ['market conditions'];
    spec.robustness.long_short_decomposition = 'long and short';

    const result = checkStrategySpec(spec);

    for (const id of [
      'primary_fill_model',
      'stress_fill_model',
      'commission',
      'spread',
      'slippage',
      'top_trade_removal',
      'regime_splits',
      'long_short_decomposition',
    ]) {
      assert.ok(result.missing.includes(id), `${id} should fail closed`);
    }
    assert.equal(result.paper_candidate, false);
  });

  it('skips invalid aliases and accepts the first valid alias', () => {
    const spec = strategySpecTemplate();
    spec.benchmark = 'as applicable';
    spec.validation.benchmark = 'TOPIX buy-and-hold';
    spec.validation.candidate_count = 0;
    spec.search = { candidate_count: 2 };
    spec.execution.commission = 'commission as applicable';
    spec.costs = { commission: '0.10% per side' };

    const result = checkStrategySpec(spec);

    assert.equal(result.complete, true);
    assert.equal(result.checks.find(check => check.id === 'benchmark').path, 'validation.benchmark');
    assert.equal(result.checks.find(check => check.id === 'candidate_count').path, 'search.candidate_count');
    assert.equal(result.checks.find(check => check.id === 'commission').path, 'costs.commission');
  });

  it('normalizes documents with multiple strategies', () => {
    const report = checkStrategyDocument({
      strategies: [
        strategySpecTemplate(),
        { id: 'loose_idea', market: 'fx', timeframe: '5', entry: 'RSI bounce' },
      ],
    });

    assert.equal(report.total, 2);
    assert.equal(report.complete, 1);
    assert.equal(report.live_order_allowed, false);
    assert.equal(report.by_next_action.watch, 1);
    assert.equal(report.by_next_action['no-action'], 1);
  });

  it('renders markdown with boundary and missing requirements', () => {
    const report = checkStrategyDocument([{ id: 'loose_idea' }]);
    const markdown = buildStrategySpecMarkdown(report);

    assert.match(markdown, /Read-only check only/);
    assert.match(markdown, /Complete specs are paper\/review candidates/);
    assert.match(markdown, /live_gate:/);
    assert.match(markdown, /critical_missing:/);
    assert.doesNotMatch(markdown, /Live order allowed: yes/);
  });
});
