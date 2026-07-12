import { CASE_FAILED, CASE_OK } from './fixed_result.js';

const GROUPS = Object.freeze([
  'health', 'chart', 'data', 'pine', 'drawing', 'ui', 'replay',
  'alerts', 'watchlist', 'indicators', 'batch', 'capture', 'context_size',
]);

export const CHART_SUITE_CASE_IDS = Object.freeze(
  GROUPS.map(group => `chart_suite_${group}_1`),
);

const CASE_TO_GROUP = new Map(CHART_SUITE_CASE_IDS.map((caseId, index) => [caseId, GROUPS[index]]));

function isOperation(value) {
  return typeof value === 'function';
}

/**
 * Owns a single original e2e.test.js hierarchy at a time. The coordinator
 * supplies fixed group operations; the child can select only a fixed case ID.
 * Capture/cleanup/restore/verification never cross the IPC result boundary.
 */
export function createChartSuiteCaseOwner(options = {}) {
  const {
    captureGroup,
    executeGroup,
    cleanupGroup,
    restoreGroup,
    verifyGroup,
  } = options;
  const configured = [captureGroup, executeGroup, cleanupGroup, restoreGroup, verifyGroup].every(isOperation);

  return Object.freeze({
    async run(caseId) {
      const group = CASE_TO_GROUP.get(caseId);
      if (!group || !configured) return CASE_FAILED;

      let captured;
      let passed = false;
      try {
        captured = await captureGroup(group);
        await executeGroup(group, captured);
        passed = true;
      } catch {
        passed = false;
      } finally {
        try {
          await cleanupGroup(group, captured);
        } catch {
          passed = false;
        }
        try {
          await restoreGroup(group, captured);
        } catch {
          passed = false;
        }
        try {
          if (await verifyGroup(group, captured) !== true) passed = false;
        } catch {
          passed = false;
        }
      }
      return passed ? CASE_OK : CASE_FAILED;
    },
  });
}
