#!/usr/bin/env node

import { disconnect, evaluate, getClient } from '../src/connection.js';

function parseIterations(argv) {
  const index = argv.indexOf('--iterations');
  if (index === -1) return 50;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('--iterations must be a positive integer');
  }
  return value;
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

const iterations = parseIterations(process.argv.slice(2));
const latenciesMs = [];
let commandCalls = 0;
let responseMismatches = 0;
let errors = 0;
let client;
let originalEvaluate;

try {
  await disconnect();
  client = await getClient();
  originalEvaluate = client.Runtime.evaluate.bind(client.Runtime);
  client.Runtime.evaluate = async (...args) => {
    commandCalls += 1;
    return originalEvaluate(...args);
  };

  const cpuStart = process.cpuUsage();
  for (let index = 0; index < iterations; index += 1) {
    const start = process.hrtime.bigint();
    try {
      const value = await evaluate('21 * 2');
      if (value !== 42) responseMismatches += 1;
    } catch {
      errors += 1;
    }
    latenciesMs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const cpu = process.cpuUsage(cpuStart);

  const summary = {
    iterations,
    command_calls: commandCalls,
    calls_per_op: commandCalls / iterations,
    latency_ms: {
      p50: percentile(latenciesMs, 0.5),
      p95: percentile(latenciesMs, 0.95),
    },
    cpu_us_per_op: (cpu.user + cpu.system) / iterations,
    response_mismatches: responseMismatches,
    errors,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  if (client && originalEvaluate) client.Runtime.evaluate = originalEvaluate;
  await disconnect();
}
