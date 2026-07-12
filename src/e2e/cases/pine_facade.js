import assert from 'node:assert/strict';
import { runFixedCase } from './fixed_result.js';

export const PINE_FACADE_CASE_IDS = Object.freeze(['pine_facade_1', 'pine_facade_2', 'pine_facade_3', 'pine_facade_4', 'pine_facade_5']);
const IDS = Object.freeze(Object.fromEntries(PINE_FACADE_CASE_IDS.map((id, index) => [id, `owner.pine_facade.${index + 1}`])));

export function createPineFacadeCaseOwner({ operationBridge } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (!IDS[caseId] || typeof operationBridge?.execute !== 'function') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const result = await operationBridge.execute(IDS[caseId]);
        if (caseId === 'pine_facade_1') assert.equal(result.accepted, true);
        else if (caseId === 'pine_facade_2') { assert.ok(result.error_count > 0); assert.equal(result.unknown_function_reported, true); }
        else if (caseId === 'pine_facade_3') assert.ok(result.status === 400 || result.status === 200);
        else if (caseId === 'pine_facade_4') { assert.equal(result.exit_code, 0); assert.equal(result.success, true); assert.equal(result.compiled, true); }
        else { assert.equal(result.exit_code, 0); assert.equal(result.compiled, false); assert.ok(result.error_count > 0); }
      });
    },
  });
}
