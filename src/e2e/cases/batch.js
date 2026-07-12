import assert from 'node:assert/strict';
import { runFixedCase } from './fixed_result.js';

export const BATCH_CASE_IDS = Object.freeze(['batch_1']);

export function createBatchCaseOwner({ operationBridge } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (caseId !== 'batch_1' || typeof operationBridge?.execute !== 'function') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const report = await operationBridge.execute('owner.batch.1');
        assert.equal(report.initial.api_available, true);
        assert.ok(report.initial.bar_count > 0);
        assert.equal(report.result.success, true);
        assert.equal(report.result.failed, 0);
        assert.equal(report.result.results.length, 4);
        assert.deepEqual(report.result.restoration, {
          required: true, attempted: true, success: true,
          requested: { symbol: report.initial.symbol, timeframe: report.initial.timeframe },
        });
        for (const row of report.result.results) {
          assert.equal(row.requested.symbol, row.observed.symbol);
          assert.equal(row.requested.timeframe, row.observed.timeframe);
          assert.ok(row.observed.bar_count > 0);
          assert.equal(row.oracle_verified, true);
        }
        assert.deepEqual(
          { symbol: report.restored.symbol, timeframe: report.restored.timeframe },
          { symbol: report.initial.symbol, timeframe: report.initial.timeframe },
        );
        assert.ok(report.restored.bar_count > 0);
        assert.deepEqual(report.after_chart_ids, report.before_chart_ids);
        assert.equal(report.target_preserved, true);
      });
    },
  });
}
