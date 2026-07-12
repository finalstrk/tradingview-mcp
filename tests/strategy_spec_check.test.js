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
    delete spec.validation.negative_result_log;
    delete spec.validation.diagnostic_test;
    delete spec.validation.point_in_time_data;
    delete spec.execution.stress_fill_model;
    delete spec.execution.leverage_funding;
    delete spec.robustness.concentration_check;

    const result = checkStrategySpec(spec);

    assert.equal(result.complete, false);
    assert.equal(result.next_action, 'research');
    assert.deepEqual(result.critical_missing, []);
    assert.ok(result.missing.includes('backtest_period'));
    assert.ok(result.missing.includes('paper_trade_period'));
    assert.ok(result.missing.includes('holdout_period'));
    assert.ok(result.missing.includes('negative_result_log'));
    assert.ok(result.missing.includes('diagnostic_test'));
    assert.ok(result.missing.includes('point_in_time_data'));
    assert.ok(result.missing.includes('stress_fill_model'));
    assert.ok(result.missing.includes('leverage_funding'));
    assert.ok(result.missing.includes('concentration_check'));
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
      ['negative_result_log', spec => { spec.validation.negative_result_log = 'Define failed results'; }],
      ['diagnostic_test', spec => { spec.validation.diagnostic_test = 'Define the diagnostic'; }],
      ['point_in_time_data', spec => { spec.validation.point_in_time_data = 'as applicable'; }],
      ['primary_fill_model', spec => { spec.execution.primary_fill_model = 'Define the fill model'; }],
      ['stress_fill_model', spec => { spec.execution.stress_fill_model = 'as applicable'; }],
      ['commission', spec => { spec.execution.commission = 'as applicable'; }],
      ['spread', spec => { spec.execution.spread = 'YYYY-MM-DD'; }],
      ['slippage', spec => { spec.execution.slippage = 'Define slippage'; }],
      ['leverage_funding', spec => { spec.execution.leverage_funding = 'as applicable'; }],
      ['top_trade_removal', spec => { spec.robustness.top_trade_removal = 'Define top-trade removal'; }],
      ['regime_splits', spec => { spec.robustness.regime_splits = ['as applicable']; }],
      ['long_short_decomposition', spec => { spec.robustness.long_short_decomposition = 'Define long/short decomposition'; }],
      ['concentration_check', spec => { spec.robustness.concentration_check = 'Define concentration'; }],
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
    spec.benchmark = 'market idea';
    spec.execution.primary_fill_model = 'fill model';
    spec.execution.stress_fill_model = 'conservative model';
    spec.execution.commission = 'instrument-specific commission assumption';
    spec.execution.spread = 'session spread assumption';
    spec.execution.slippage = 'adverse slippage case';
    spec.execution.leverage_funding = 'use reasonable leverage and funding';
    spec.robustness.top_trade_removal = 'review winners';
    spec.robustness.regime_splits = ['market conditions'];
    spec.robustness.long_short_decomposition = 'long and short';
    spec.robustness.concentration_check = 'review concentration';
    spec.validation.negative_result_log = 'review failed ideas';
    spec.validation.diagnostic_test = 'improve the strategy';
    spec.validation.point_in_time_data = 'current universe and data';

    const result = checkStrategySpec(spec);

    for (const id of [
      'benchmark',
      'primary_fill_model',
      'stress_fill_model',
      'commission',
      'spread',
      'slippage',
      'leverage_funding',
      'top_trade_removal',
      'regime_splits',
      'long_short_decomposition',
      'concentration_check',
      'negative_result_log',
      'diagnostic_test',
      'point_in_time_data',
    ]) {
      assert.ok(result.missing.includes(id), `${id} should fail closed`);
    }
    assert.equal(result.paper_candidate, false);
  });

  it('requires per-variant negative-result evidence, observed diagnostics, and point-in-time controls', () => {
    const valid = strategySpecTemplate();
    valid.validation.negative_result_log = 'For each rejected candidate, preserve its parameters and metrics/results.';
    valid.validation.diagnostic_test = 'Diagnose the failure cause, run a one-variable ablation test, and report the observed result.';
    valid.validation.point_in_time_data = 'Use point-in-time historical universe membership including delistings and apply publication lag at the decision timestamp.';
    assert.equal(checkStrategySpec(valid).complete, true);

    const singleAsset = strategySpecTemplate();
    singleAsset.validation.point_in_time_data = 'Single-asset system: n/a for universe membership; OHLCV bars are available at decision time.';
    assert.equal(checkStrategySpec(singleAsset).complete, true);

    const singleSecurity = strategySpecTemplate();
    singleSecurity.validation.point_in_time_data = 'Single security system: n/a universe; bars available at decision time.';
    assert.equal(checkStrategySpec(singleSecurity).complete, true);

    const invalid = strategySpecTemplate();
    invalid.validation.negative_result_log = 'Preserve failed strategy variants; metrics unavailable and no parameters.';
    invalid.validation.diagnostic_test = 'Diagnose the failure cause and run a test; result unavailable.';
    invalid.validation.point_in_time_data = 'Point-in-time historical universe without publication lag; lookahead remains.';
    const result = checkStrategySpec(invalid);
    for (const id of ['negative_result_log', 'diagnostic_test', 'point_in_time_data']) {
      assert.ok(result.missing.includes(id), `${id} must reject incomplete evidence`);
    }

    const unscoped = strategySpecTemplate();
    unscoped.validation.negative_result_log = 'Preserve failed results and every variant parameters and metrics.';
    assert.ok(checkStrategySpec(unscoped).missing.includes('negative_result_log'));

    const noObservation = strategySpecTemplate();
    noObservation.validation.diagnostic_test = 'Diagnose the failure cause and run a one-variable ablation test.';
    assert.ok(checkStrategySpec(noObservation).missing.includes('diagnostic_test'));

    const unavailableLag = strategySpecTemplate();
    unavailableLag.validation.point_in_time_data = 'Point-in-time historical universe with publication lag not applied.';
    assert.ok(checkStrategySpec(unavailableLag).missing.includes('point_in_time_data'));
  });

  it('requires explicit leverage/funding values and measurable concentration controls', () => {
    const positives = [
      spec => { spec.execution.leverage_funding = '1.5x leverage with funding 12 bps.'; },
      spec => { spec.execution.leverage_funding = '1x leverage with funding none for cash equities.'; },
      spec => { spec.robustness.concentration_check = 'HHI threshold <= 0.18; report the metric.'; },
      spec => { spec.robustness.concentration_check = 'top1=20%; sector max 50%.'; },
    ];
    for (const mutate of positives) {
      const spec = strategySpecTemplate();
      mutate(spec);
      assert.equal(checkStrategySpec(spec).complete, true);
    }

    const negatives = [
      ['leverage_funding', '1x leverage; no funding data available.'],
      ['leverage_funding', '1x leverage; funding unknown.'],
      ['leverage_funding', 'leverage unknown; funding 0 bps.'],
      ['concentration_check', 'top1 and sector exposure are reviewed.'],
      ['concentration_check', 'HHI unknown.'],
    ];
    for (const [id, value] of negatives) {
      const spec = strategySpecTemplate();
      if (id === 'leverage_funding') spec.execution.leverage_funding = value;
      else spec.robustness.concentration_check = value;
      assert.ok(checkStrategySpec(spec).missing.includes(id), `${id} must fail closed for ${value}`);
    }
  });

  it('rejects contradictory or non-per-variant negative-result retention rules', () => {
    const negatives = [
      'Preserve every failed variant, but discard its parameters.',
      'Retain every rejected candidate, then drop its metrics/results.',
      'Keep each losing run but delete the recorded parameters and outcomes.',
      'Preserve every failed variant, then discard its parameters and results.',
      'Retain each rejected candidate but do-not-store its metrics.',
      'Do not store per-variant configuration or outcomes for losing runs.',
      'For each failed variant, ignore it but store its parameters and metrics.',
      'For each failed variant, exclude it but retain its parameters and metrics.',
      'Omit failed strategy versions and do-not-store their metrics.',
      'Never retain negative variants or their params and results.',
      'Record failed variants globally; do not store per-variant parameters or metrics.',
      'Preserve failed results and every variant parameters and metrics.',
      'Preserve every failed variant with parameters, but never retain its results.',
      'For each failed variant, preserve parameters and metrics but not results.',
      'For each failed variant, store params but not metrics.',
      'For each failed variant, keep metrics but not parameters.',
      'For each failed variant, do not discard parameters but do not store metrics.',
      'For each failed variant, don’t discard parameters but don’t store metrics.',
      'For each failed variant, never discard params and do not store metrics.',
      'For each failed variant, do not remove params but remove metrics; preserve results.',
      'For each failed variant, don’t remove params but remove metrics/results; retain outcomes.',
      'For each failed variant, retain params metrics/results; keep only aggregate metrics.',
      'For each failed variant, preserve params and metrics; aggregate-only.',
      'For each failed variant, preserve params and metrics; aggregate metrics only.',
      'For each failed variant, preserve params and metrics; global metrics only.',
      'For each failed variant, preserve params and metrics; overall metrics only.',
      'For each failed variant, preserve params and metrics; summary-only.',
      'For each failed variant, preserve params and metrics; aggregate results only.',
      'For each failed variant, preserve params and metrics; metrics retained only in aggregate.',
      'Retain params and metrics; aggregate metrics.',
      'For each failed variant, retain params metrics/results; only metrics are aggregate.',
      'For each failed variant, retain params metrics/results; results are global.',
      'For each failed variant, retain params metrics/results; results are overall.',
      'For each failed variant, retain params metrics/results; metrics are summary.',
    ];

    for (const value of negatives) {
      const spec = strategySpecTemplate();
      spec.validation.negative_result_log = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('negative_result_log'),
        `negative_result_log must reject: ${value}`,
      );
    }

    const positives = [
      'For each rejected candidate, retain its parameters and metrics/results.',
      'Preserve every failed strategy variant with its params and measured outcomes.',
      'Log per-variant losing runs, including configuration, performance metrics, and results.',
      'Record failed variant parameters and metrics per candidate.',
      'Preserve failed candidates per variant with parameters and metrics/results.',
      'For each failed variant, do not discard params but retain metrics/results.',
      'For each failed variant, do not remove params but retain metrics/results.',
      'For each failed variant, retain params metrics/results; log aggregate metrics per variant.',
      'Every failed variant: parameters retained; metrics retained; results retained.',
      'For each failed variant, retain parameters; record metrics/results per variant.',
      'Failed variants are each preserved with parameters and metrics/results.',
    ];
    for (const value of positives) {
      const spec = strategySpecTemplate();
      spec.validation.negative_result_log = value;
      assert.equal(checkStrategySpec(spec).missing.includes('negative_result_log'), false, value);
    }
  });

  it('requires an executable one-variable diagnostic and an observed result', () => {
    const negatives = [
      'Diagnose the failure cause and plan a one-variable ablation; report the expected result.',
      'Diagnose the failure cause, run a one-variable ablation, and report the planned result.',
      'Diagnose the failure cause, execute a one-variable inversion, but do-not-report the observed result.',
      'Diagnose the root cause, run a one-variable inversion, and report the planned outcome.',
      'Diagnose the regime mismatch, execute one-variable removal, but do-not-report the result.',
      'Diagnose the failure cause, perform one-variable comparison, with no observation.',
      'Diagnose the failure cause and run a one-variable falsification; reject the measured result.',
      'Counter-thesis documented; one-variable ablation is anticipated and results are not available.',
      'Diagnose the failure cause; one-variable ablation test is merely planned.',
      'Diagnose failure; plan a one-variable ablation; report observed result.',
      'Diagnose failure; one-variable ablation is planned; report observed result.',
      'Diagnose failure; one-variable ablation test; report observed result.',
      'Diagnose failure; invert one variable; report observed effect but not result.',
      'Diagnose failure; invert one variable; report result but not outcome.',
      'Diagnose failure; run one-variable ablation; observed result was not recorded.',
      'Diagnose failure; run one-variable ablation; report says result: N/A.',
      'Diagnose failure; do not run one-variable ablation; report observed result.',
      'Diagnose failure; never execute one-variable inversion; report observed result.',
      'Diagnose failure; run one-variable ablation; observed result was rejected.',
      'Diagnose failure; run one-variable ablation only hypothetically; observed result.',
      'Diagnose failure; not run one-variable ablation; report observed result.',
      'Diagnose failure; without perform one-variable inversion; report observed result.',
      'Diagnose failure; not to run one-variable ablation; observed result.',
      'Diagnose failure; without having run one-variable ablation; observed result.',
      'Diagnose failure; did not actually run one-variable ablation; observed result.',
      'Diagnose failure; never actually run one-variable ablation; observed result.',
      'Diagnose failure; do not actually run one-variable ablation; observed result.',
      'Diagnose failure; not yet run one-variable ablation; observed result.',
      'Diagnose failure; run one-variable ablation but it was not executed; observed result.',
      'Diagnose failure; not-run one-variable ablation; observed result.',
      'Diagnose failure; run one-variable ablation; simulated result recorded.',
      "Diagnose failure; didn't actually run one-variable ablation; observed result.",
      'Diagnose failure; run one-variable data collection; report observed result.',
      'Diagnose failure; compare one-variable data; report observed result.',
      'Diagnose failure; run a report about one-variable historical data; report observed result.',
    ];
    for (const value of negatives) {
      const spec = strategySpecTemplate();
      spec.validation.diagnostic_test = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('diagnostic_test'),
        `diagnostic_test must reject: ${value}`,
      );
    }

    const positives = [
      'Diagnose the failure cause, execute one-variable inversion, and record the observed result.',
      'Write the counter-thesis, run one-variable ablation, then report the measured outcome and effect.',
      'Document the root cause; perform a one-variable drop test and log the actual result.',
      'Counter-thesis: invert one variable; report observed effect.',
      'Diagnose failure; run one-variable ablation; result recorded.',
    ];
    for (const value of positives) {
      const spec = strategySpecTemplate();
      spec.validation.diagnostic_test = value;
      assert.equal(checkStrategySpec(spec).missing.includes('diagnostic_test'), false, value);
    }
  });

  it('rejects missing, conditional, or biased point-in-time controls', () => {
    const negatives = [
      'Use the current universe and publication lag at the decision timestamp.',
      'Point-in-time universe with present-bias and publication lag controls.',
      'Use current point-in-time membership with publication lag.',
      'Use current factor values; historical universe and release lag.',
      'Use current indicator signals with point-in-time universe and publication lag.',
      'Historical membership; current prices; release lag.',
      'Historical universe; current factor values; publication lag.',
      'Point-in-time membership; current indicators; release lag.',
      'Historical universe not point-in-time; publication lag is documented.',
      'Historical universe with delistings excluded; apply release lag at decision time.',
      'Historical universe with delistings omitted; apply publication lag.',
      'Historical universe and survivorship control only if data is available, with release lag.',
      'Historical universe with publication lag when available at decision time.',
      'Historical universe with publication lag when-available at decision time.',
      'Historical universe with publication lag not required.',
      'Historical universe with publication lag not-required.',
      'Historical universe without publication lag at the decision timestamp.',
      'Historical universe with no release lag.',
      'Historical universe with unknown publication lag.',
      'Historical universe with missing decision availability.',
      'Historical universe membership including delistings; publication lag 0 at decision timestamp.',
      'Historical universe membership including delistings; publication lag -1 day at decision timestamp.',
      'Historical universe membership including delistings; release lag zero.',
      'Historical universe; ignore publication lag and use decision timestamps.',
      'Point-in-time universe, but current data remains in the replay.',
      'Point-in-time data with publication lag at decision timestamp.',
      'Point-in-time factor values with publication lag.',
      'Point-in-time rule and lag.',
      'Point-in-time universe; factor values are current; publication lag at the decision timestamp.',
      'Point-in-time universe; prices are current; publication lag at the decision timestamp.',
      'Point-in-time universe; indicators are current; publication lag at the decision timestamp.',
      'Point-in-time universe; values are current; publication lag at the decision timestamp.',
      'Point-in-time universe; factors current; publication lag at the decision timestamp.',
      'Point-in-time universe; currently published factors; publication lag at the decision timestamp.',
      'Point-in-time universe; latest factor values; publication lag at the decision timestamp.',
      'Ignore survivorship; publication lag is applied at the decision timestamp.',
      'Omit survivorship; publication lag is applied at the decision timestamp.',
      'Skip survivorship; publication lag is applied at the decision timestamp.',
      'Without survivorship; publication lag is applied at the decision timestamp.',
      'No survivorship; publication lag is applied at the decision timestamp.',
      'Exclude survivorship; publication lag is applied at the decision timestamp.',
      'Ignore delistings; publication lag is applied at the decision timestamp.',
      'Single-asset system: n/a universe; bars unavailable at decision time.',
      'Single-asset system: n/a universe; bars not available at decision time.',
      'Single-asset system: n/a universe; OHLCV bars available at decision time; no availability.',
      'Single-asset system: n/a universe; no OHLCV bars available at decision time.',
      'Single-asset system: n/a universe; bars available at decision time; no data.',
      'Historical universe membership; release lag before decision time; data missing.',
    ];
    for (const value of negatives) {
      const spec = strategySpecTemplate();
      spec.validation.point_in_time_data = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('point_in_time_data'),
        `point_in_time_data must reject: ${value}`,
      );
    }

    const positives = [
      'Use point-in-time historical universe membership including delistings and survivorship-safe controls; apply publication lag at the decision timestamp.',
      'Historical universe membership retains delisted names and uses release lag before the decision time.',
      'Survivorship-bias control uses point-in-time universe data and available-at timestamps.',
      'Point-in-time universe membership uses publication lag at the decision timestamp.',
    ];
    for (const value of positives) {
      const spec = strategySpecTemplate();
      spec.validation.point_in_time_data = value;
      assert.equal(checkStrategySpec(spec).missing.includes('point_in_time_data'), false, value);
    }
  });

  it('accepts only strictly positive leverage and explicit funding outcomes', () => {
    const leverageNegatives = [
      '0x leverage with funding none.',
      'leverage = 0x; funding none.',
      '-1x leverage with funding 0 bps.',
      'leverage = 0.0; funding none.',
      'leverage = -0.5; funding 12 bps.',
      'leverage unknown; funding 0 bps.',
      '1x leverage; leverage unknown; funding 0 bps.',
      '1x leverage; leverage missing; funding 0 bps.',
      '1x leverage; leverage unavailable; funding 0 bps.',
      '1x leverage; leverage not specified; funding 0 bps.',
      '1x leverage; leverage absent; funding 0 bps.',
      '1x leverage; leverage unspecified; funding 0 bps.',
      '1x leverage; leverage not measured; funding 0 bps.',
      '1x leverage; leverage not given; funding 0 bps.',
      '1x leverage; leverage not provided; funding 0 bps.',
      '1x leverage; leverage not reported; funding 0 bps.',
      '1x leverage; leverage unreported; funding 0 bps.',
      '1x leverage; leverage unprovided; funding 0 bps.',
      '1x leverage; leverage unmeasured; funding 0 bps.',
      '1x leverage; leverage unobserved; funding 0 bps.',
      '1x leverage; leverage not recorded; funding 0 bps.',
      '1x leverage; leverage not known; funding 0 bps.',
      '1x leverage; leverage outcome unmeasured; funding 0 bps.',
      '1x leverage; leverage outcome not recorded; funding 0 bps.',
      '1x leverage; leverage undefined; funding 0 bps.',
      'leverage x; funding 0 bps.',
    ];
    for (const value of leverageNegatives) {
      const spec = strategySpecTemplate();
      spec.execution.leverage_funding = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('leverage_funding'),
        `leverage_funding must reject: ${value}`,
      );
    }

    const fundingNegatives = [
      '1x leverage with unknown funding.',
      '1x leverage with no funding.',
      '1x leverage with missing funding data.',
      '1x leverage with no funding data available.',
      '1x leverage; funding rate not available.',
      '1x leverage; funding follows leverage 1x.',
      '1x leverage; funding via 12-month futures.',
      '1x leverage; funding 12.',
      '1x leverage; funding 12 months.',
      '1x leverage; funding absent.',
      '1x leverage; funding unspecified.',
      '1x leverage; funding not measured.',
      '1x leverage; funding not given.',
      '1x leverage; funding not provided.',
      '1x leverage; funding not specified.',
      '1x leverage; funding not available.',
      '1x leverage; funding not reported.',
      '1x leverage; funding unreported.',
      '1x leverage; funding unprovided.',
      '1x leverage; funding unmeasured.',
      '1x leverage; funding unobserved.',
      '1x leverage; funding not recorded.',
      '1x leverage; funding not known.',
      '1x leverage; funding outcome unobserved.',
      '1x leverage; funding outcome not known.',
      '1x leverage; funding undefined.',
    ];
    for (const value of fundingNegatives) {
      const spec = strategySpecTemplate();
      spec.execution.leverage_funding = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('leverage_funding'),
        `leverage_funding must reject: ${value}`,
      );
    }

    const positives = [
      '1.5x leverage with funding 12 bps.',
      'leverage = 1x; no funding cost for cash equities.',
      '2x gross leverage with funding none.',
      'leverage 0.25x with funding zero.',
      'leverage = 1; funding -0.01% is explicitly measured.',
      '1x leverage; funding no cost',
      '1x leverage; no funding costs',
    ];
    for (const value of positives) {
      const spec = strategySpecTemplate();
      spec.execution.leverage_funding = value;
      assert.equal(checkStrategySpec(spec).missing.includes('leverage_funding'), false, value);
    }
  });

  it('requires concentration targets to be tied to a quantity or measured limit', () => {
    const negatives = [
      'Report exposure.',
      'Exposure metric.',
      'Concentration max.',
      'Top1 percentage.',
      'Top name report.',
      'Sector exposure check.',
      'HHI metric.',
      'Sector concentration limit.',
      'Top 1 PnL contribution unknown.',
      'Report exposure. Use an unrelated threshold of 0.5 for another metric.',
      'Report exposure, use an unrelated threshold of 0.5 for another metric.',
      'Report exposure and unrelated threshold <= 0.5 for another metric.',
      'Report exposure, threshold <= 0.5 for different metric.',
      'Report exposure, max=0.5 for different metric.',
      'Report exposure, threshold <= 0.5 for different control.',
      'Report exposure, max=0.5 for different field.',
      'Report exposure, max=0.5 for other metric.',
      'top1=-20%.',
      'HHI -0.18.',
      'sector max -50%.',
      'top1-20%.',
      'top1−20%.',
      'HHI-0.18.',
      'HHI−0.18.',
      'sector max-50%.',
      'sector max−50%.',
      'top-1-20%.',
      'Report exposure, threshold <= 0.5 for Sharpe ratio.',
      'Report exposure, threshold <= 0.5 for different drawdown.',
      'Report exposure, threshold <= 0.5 for independent Sharpe ratio.',
      'Report exposure, threshold <= 0.5 for other exposure.',
    ];
    for (const value of negatives) {
      const spec = strategySpecTemplate();
      spec.robustness.concentration_check = value;
      assert.ok(
        checkStrategySpec(spec).missing.includes('concentration_check'),
        `concentration_check must reject: ${value}`,
      );
    }

    const positives = [
      'HHI threshold <= 0.18; report the measured metric.',
      'Report HHI value.',
      'Measure and report HHI value for each portfolio snapshot.',
      'sector max 50%.',
      'sector maximum 50%.',
      'top 1 weight 20%.',
      'top1 20%.',
      'top 1 percentage 20%.',
      'HHI metric 0.18.',
      'HHI 0.18.',
      'top1=20%; sector max 50%.',
      'Report top 1, top 3, and top 5 name PnL contribution and sector exposure with a fixed concentration limit.',
      'Measure exposure cap at 10% per name and 50% per sector.',
      'top-1 20%.',
      'top-1 PnL contribution.',
      'top-3 weight 25%.',
    ];
    for (const value of positives) {
      const spec = strategySpecTemplate();
      spec.robustness.concentration_check = value;
      assert.equal(checkStrategySpec(spec).missing.includes('concentration_check'), false, value);
    }
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
