const PRODUCTION_TRANSPORTS = '/src/e2e/production_runtime_transports.js';

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.endsWith(PRODUCTION_TRANSPORTS)) {
    return { url: new URL('./gate_b_production_transports.mjs', import.meta.url).href, shortCircuit: true };
  }
  return resolved;
}
