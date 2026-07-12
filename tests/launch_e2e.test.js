import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { launch, probeCdpEndpoint } from '../src/core/health.js';

describe('tv_launch — non-destructive live reuse', () => {
  it('reuses the running localhost CDP browser session with kill_existing:false', async () => {
    const before = await probeCdpEndpoint({ port: 9222, timeout_ms: 1500 });
    assert.ok(before, 'localhost:9222 must already expose a healthy CDP endpoint');

    const result = await launch({
      port: 9222,
      kill_existing: false,
      request_timeout_ms: 1500,
      overall_timeout_ms: 3000,
    });
    const after = await probeCdpEndpoint({ port: 9222, timeout_ms: 1500 });

    assert.equal(result.success, true);
    assert.equal(result.cdp_ready, true);
    assert.equal(result.reused, true);
    assert.equal(result.old_process_killed, false);
    assert.equal(result.browser, before.Browser);
    assert.equal(result.web_socket_debugger_url, before.webSocketDebuggerUrl);
    assert.equal(after?.Browser, before.Browser);
    assert.equal(after?.webSocketDebuggerUrl, before.webSocketDebuggerUrl);
  });
});
