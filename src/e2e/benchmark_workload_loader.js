import { Script, createContext } from 'node:vm';

export function compileRestrictedBenchmarkWorkload(bytes, filename = 'approved-benchmark-workload.js') {
  const source = Buffer.from(bytes).toString('utf8');
  if (source.length < 64 || source.length > 4096
    || /\b(?:import|require|process|globalThis|eval|Function|WebAssembly|fetch|constructor|prototype|__proto__)\b/.test(source)
    || !/^export const workloadId = 'tradingview-ready-state-length-v1';\n\nexport async function execute\(capability\) \{[\s\S]+\}\n$/.test(source)) {
    throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_MODULE_DENIED');
  }
  const transformed = source
    .replace('export const workloadId', 'const workloadId')
    .replace('export async function execute', 'async function execute')
    .concat('\n;({workloadId, execute});');
  const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  const namespace = new Script(transformed, { filename }).runInContext(context, { timeout: 100 });
  if (!namespace || namespace.workloadId !== 'tradingview-ready-state-length-v1' || typeof namespace.execute !== 'function') {
    throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_MODULE_DENIED');
  }
  return namespace.execute;
}

export function compileRestrictedBenchmarkExecutor(bytes, kind, filename = 'approved-benchmark-executor.js') {
  const source = Buffer.from(bytes).toString('utf8');
  const baseline = kind === 'baseline';
  const candidate = kind === 'candidate';
  const expectedId = baseline
    ? 'tradingview-ready-state-legacy-session-v1'
    : 'tradingview-ready-state-reused-session-v1';
  const entrypoint = baseline ? 'execute' : 'create';
  if ((!baseline && !candidate) || source.length < 512 || source.length > 8192
    || /\b(?:import|require|process|globalThis|eval|Function|WebAssembly|fetch|constructor|prototype|__proto__)\b/.test(source)
    || !source.startsWith(`export const executorId = '${expectedId}';\n`)
    || (source.match(/\bexport\b/g) || []).length !== 2
    || !source.includes(baseline ? 'export async function execute(capability)' : 'export function create(capability, sampleCount = 30)')) {
    throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_EXECUTOR_DENIED');
  }
  const transformed = source
    .replace('export const executorId', 'const executorId')
    .replace(baseline ? 'export async function execute' : 'export function create', baseline ? 'async function execute' : 'function create')
    .concat(`\n;({executorId, ${entrypoint}});`);
  const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  const namespace = new Script(transformed, { filename }).runInContext(context, { timeout: 100 });
  if (!namespace || namespace.executorId !== expectedId || typeof namespace[entrypoint] !== 'function') {
    throw new TypeError('PRODUCTION_RUNTIME_BENCHMARK_EXECUTOR_DENIED');
  }
  return namespace[entrypoint];
}
