import assert from 'node:assert/strict';
import { runFixedCase } from './fixed_result.js';

export const LAUNCH_CASE_IDS = Object.freeze(['launch_reuse_1']);

export function createLaunchCaseOwner({ operationBridge } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (caseId !== 'launch_reuse_1' || typeof operationBridge?.execute !== 'function') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const report = await operationBridge.execute('owner.launch.reuse.1');
        assert.equal(report.success, true);
        assert.equal(report.cdp_ready, true);
        assert.equal(report.reused, true);
        assert.equal(report.old_process_killed, false);
        assert.equal(report.after.Browser, report.before.Browser);
        assert.equal(report.after.webSocketDebuggerUrl, report.before.webSocketDebuggerUrl);
        assert.equal(report.browser, report.before.Browser);
        assert.equal(report.web_socket_debugger_url, report.before.webSocketDebuggerUrl);
      });
    },
  });
}
