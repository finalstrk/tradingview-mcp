import { createGateBLedgerClient } from '../gate_b_loopback_ipc.js';

export function createFixedCaseChildClient(environment = process.env) {
  const runId = environment.TRADINGVIEW_MCP_GATE_B_RUN_ID;
  const capabilityToken = environment.TRADINGVIEW_MCP_GATE_B_CAPABILITY_TOKEN;
  const port = Number(environment.TRADINGVIEW_MCP_GATE_B_PORT);
  if (typeof runId !== 'string' || typeof capabilityToken !== 'string' || !Number.isSafeInteger(port)) return null;
  return createGateBLedgerClient({ runId, capabilityToken, port });
}
