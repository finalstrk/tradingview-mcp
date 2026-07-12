import { assertSafeArgument, executeTransportCall, fail, normalizeOptions } from './safe_adapter.js';

const ALLOWED_METHODS = new Set([
  'DOM.getDocument',
  'DOM.querySelector',
  'Runtime.evaluate',
  'Runtime.callFunctionOn',
  'Runtime.getProperties',
]);

export function createCdpReadAdapter(options) {
  const normalized = normalizeOptions(options);
  return Object.freeze({
    async read(method, params = {}) {
      if (!ALLOWED_METHODS.has(method)) throw fail('E2E_ADAPTER_CAPABILITY_DENIED');
      assertSafeArgument(params);
      return executeTransportCall(
        normalized,
        'call',
        [method, params, normalized.expectedContext],
        true,
      );
    },
  });
}
