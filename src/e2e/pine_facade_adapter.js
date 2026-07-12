import { assertSafeArgument, executeTransportCall, fail, normalizeOptions } from './safe_adapter.js';

const ALLOWED_OPERATIONS = new Set(['check', 'translate']);

export function createPineFacadeAdapter(options) {
  const normalized = normalizeOptions(options);
  return Object.freeze({
    async request(operation, payload = {}) {
      if (!ALLOWED_OPERATIONS.has(operation)) throw fail('E2E_ADAPTER_CAPABILITY_DENIED');
      assertSafeArgument(payload);
      return executeTransportCall(
        normalized,
        'request',
        [operation, payload, normalized.expectedContext],
        false,
      );
    },
  });
}
