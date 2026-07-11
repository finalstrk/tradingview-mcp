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

    const result = checkStrategySpec(spec);

    assert.equal(result.complete, false);
    assert.equal(result.next_action, 'research');
    assert.deepEqual(result.critical_missing, []);
    assert.ok(result.missing.includes('backtest_period'));
    assert.ok(result.missing.includes('paper_trade_period'));
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
