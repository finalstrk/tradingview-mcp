import { assertSafeArgument, executeTransportCall, fail, normalizeOptions } from './safe_adapter.js';

const ALLOWED_METHODS = new Set([
  'Input.dispatchKeyEvent',
  'Runtime.callFunctionOn',
]);

export function createCdpMutationAdapter(options) {
  const normalized = normalizeOptions(options);
  return Object.freeze({
    async mutate(method, params = {}) {
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
