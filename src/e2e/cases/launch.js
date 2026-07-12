import assert from 'node:assert/strict';

import { launch, probeCdpEndpoint } from '../../core/health.js';
import { runFixedCase } from './fixed_result.js';

export const LAUNCH_CASE_IDS = Object.freeze(['launch_reuse_1']);

export function createLaunchCaseOwner({ probe = probeCdpEndpoint, launchImpl = launch } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (caseId !== 'launch_reuse_1') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const before = await probe({ port: 9222, timeout_ms: 1500 });
        assert.ok(before, 'localhost:9222 must already expose a healthy CDP endpoint');
        const result = await launchImpl({
          port: 9222,
          kill_existing: false,
          request_timeout_ms: 1500,
          overall_timeout_ms: 3000,
        });
        const after = await probe({ port: 9222, timeout_ms: 1500 });
        assert.equal(result.success, true);
        assert.equal(result.cdp_ready, true);
        assert.equal(result.reused, true);
        assert.equal(result.old_process_killed, false);
        assert.equal(result.browser, before.Browser);
        assert.equal(result.web_socket_debugger_url, before.webSocketDebuggerUrl);
        assert.equal(after?.Browser, before.Browser);
        assert.equal(after?.webSocketDebuggerUrl, before.webSocketDebuggerUrl);
      });
    },
  });
}
