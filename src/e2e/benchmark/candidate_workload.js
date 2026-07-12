export const workloadId = 'tradingview-ready-state-length-v1';

export async function execute(capability) {
  const measured = await capability.measureReadyStateLengthCandidate();
  return measured;
}
