import assert from 'node:assert/strict';
import { runFixedCase } from './fixed_result.js';

export const QUOTE_CASE_IDS = Object.freeze(['quote_1', 'quote_2']);

export function createQuoteCaseOwner({ operationBridge } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (!QUOTE_CASE_IDS.includes(caseId) || typeof operationBridge?.execute !== 'function') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const report = await operationBridge.execute(caseId === 'quote_1' ? 'owner.quote.1' : 'owner.quote.2');
        assert.equal(report.iterations, 20);
        assert.equal(report.mismatches, 0);
        assert.equal(report.chart_mutations, 0);
        assert.equal(report.disconnects, 1);
        assert.equal(report.price_fields_leaked, 0);
      });
    },
  });
}
