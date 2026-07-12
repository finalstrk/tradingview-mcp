import { assembleProductionRuntimeBroker } from '../../src/e2e/production_runtime_broker_core.js';

// Offline tests alone may supply inert constructors. Production modules never
// import this helper and the production entry point has no constructor argument.
export function createTestProductionRuntimeBroker(configuration, constructors) {
  return assembleProductionRuntimeBroker(configuration, constructors);
}
