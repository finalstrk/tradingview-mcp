import { createProductionRuntimeBroker as createFixedBroker } from './production_runtime_broker.js';

/** Fixed, non-injectable production broker entry used only by Gate B. */
export function createProductionRuntimeBroker(configuration) {
  return createFixedBroker(configuration);
}
