export const workloadId = 'tradingview-ready-state-length-v1';

export async function execute(capability) {
  return capability.measureReadyStateLengthLegacy();
}
