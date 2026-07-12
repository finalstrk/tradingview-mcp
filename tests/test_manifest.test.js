import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOCKED_EXTERNAL_NETWORK_CODE,
  OFFLINE_NETWORK_GUARD_SYMBOL,
  isOfflineNetworkGuardInstalled,
} from './offline_network_guard.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);
const PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ALL_TESTS = readdirSync(TEST_DIR)
  .filter(name => name.endsWith('.test.js'))
  .map(name => `tests/${name}`)
  .sort();

function isLiveTest(file) {
  const name = file.slice('tests/'.length);
  return name === 'e2e.test.js' || name.endsWith('_e2e.test.js');
}

const LIVE_TESTS = ALL_TESTS.filter(isLiveTest);
const UNIT_TESTS = ALL_TESTS.filter(file => !isLiveTest(file));
const PINE_FACADE_E2E = 'tests/pine_facade_e2e.test.js';

const REMOTE_INTEGRATION_PATTERNS = [
  {
    kind: 'direct Pine facade fetch',
    pattern: /\bfetch\s*\(\s*['"`]https:\/\/pine-facade\.tradingview\.com\b/g,
  },
  {
    kind: 'CLI pine check',
    pattern: /\brun\s*\(\s*\[\s*['"`]pine['"`]\s*,\s*['"`]check['"`]/g,
  },
];

function tokenize(script) {
  return (script.match(/"[^"]*"|'[^']*'|\S+/g) || [])
    .map(token => token.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2'));
}

function globPattern(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll('*', '[^/]*').replaceAll('?', '[^/]')}$`);
}

function selectedTests(scriptName) {
  const script = PACKAGE.scripts?.[scriptName];
  assert.equal(typeof script, 'string', `missing package script: ${scriptName}`);
  const selected = [];

  for (const token of tokenize(script)) {
    if (!token.startsWith('tests/') || !token.endsWith('.test.js')) continue;
    if (token.includes('*') || token.includes('?')) {
      const pattern = globPattern(token);
      selected.push(...ALL_TESTS.filter(file => pattern.test(file)));
    } else {
      selected.push(token);
    }
  }

  return selected;
}

function configuredConcurrency(scriptName) {
  const tokens = tokenize(PACKAGE.scripts[scriptName]);
  for (let index = 0; index < tokens.length; index++) {
    const inline = tokens[index].match(/^--test-concurrency=(\d+)$/);
    if (inline) return Number(inline[1]);
    if (tokens[index] === '--test-concurrency') return Number(tokens[index + 1]);
  }
  return null;
}

function configuredImports(scriptName) {
  const tokens = tokenize(PACKAGE.scripts[scriptName]);
  const imports = [];
  for (let index = 0; index < tokens.length; index++) {
    const inline = tokens[index].match(/^--import=(.+)$/);
    if (inline) imports.push(inline[1]);
    if (tokens[index] === '--import') imports.push(tokens[index + 1]);
  }
  return imports.map(file => file.replace(/^\.\//, ''));
}

function remoteIntegrationCases(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const cases = [];

  for (const { kind, pattern } of REMOTE_INTEGRATION_PATTERNS) {
    const matcher = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = matcher.exec(source)) !== null) {
      cases.push({
        file,
        line: source.slice(0, match.index).split('\n').length,
        kind,
      });
    }
  }

  return cases;
}

function assertExactSelection(scriptName, expected) {
  const selected = selectedTests(scriptName);
  const unique = [...new Set(selected)].sort();
  const duplicates = selected.filter((file, index) => selected.indexOf(file) !== index);

  assert.deepEqual(unique, [...expected].sort(), `${scriptName} selected the wrong test files`);
  assert.deepEqual(duplicates, [], `${scriptName} selected duplicate test files`);
}

describe('test manifest — classification', () => {
  it('partitions every test file into exactly one unit or live set', () => {
    assert.deepEqual([...UNIT_TESTS, ...LIVE_TESTS].sort(), ALL_TESTS);
    assert.equal(UNIT_TESTS.some(isLiveTest), false);
    assert.equal(LIVE_TESTS.every(isLiveTest), true);
    assert.ok(UNIT_TESTS.includes('tests/replay.test.js'));
    assert.ok(UNIT_TESTS.includes('tests/sanitization.test.js'));
    assert.ok(UNIT_TESTS.includes('tests/test_manifest.test.js'));
  });

  it('keeps every detected remote integration case out of unit files', () => {
    const violations = UNIT_TESTS.flatMap(remoteIntegrationCases);
    assert.deepEqual(violations, []);
  });

  it('keeps all five Pine facade integration cases in an explicit live file', () => {
    assert.ok(LIVE_TESTS.includes(PINE_FACADE_E2E), `${PINE_FACADE_E2E} must be classified as live`);
    assert.equal(remoteIntegrationCases(PINE_FACADE_E2E).length, 5);
  });
});

describe('test manifest — package gates', () => {
  it('test:unit selects every unit test exactly once', () => {
    assertExactSelection('test:unit', UNIT_TESTS);
  });

  it('test:e2e selects every live test exactly once', () => {
    assertExactSelection('test:e2e', LIVE_TESTS);
  });

  it('primary test selects every test exactly once', () => {
    assertExactSelection('test', ALL_TESTS);
  });

  it('test:all selects every test exactly once', () => {
    assertExactSelection('test:all', ALL_TESTS);
  });

  it('every multi-live gate fixes Node test-file concurrency at one', () => {
    for (const scriptName of ['test', 'test:e2e', 'test:all']) {
      assert.ok(LIVE_TESTS.length > 1, 'fixture must contain multiple live test files');
      assert.equal(configuredConcurrency(scriptName), 1, `${scriptName} must use --test-concurrency=1`);
    }
  });

  it('every gate containing VM-module tests enables the required Node runtime flag', () => {
    for (const scriptName of ['test', 'test:unit', 'test:all']) {
      assert.ok(
        tokenize(PACKAGE.scripts[scriptName]).includes('--experimental-vm-modules'),
        `${scriptName} must use --experimental-vm-modules`,
      );
    }
  });

  it('test:unit preloads the offline network guard', () => {
    assert.ok(
      configuredImports('test:unit').includes('tests/offline_network_guard.js'),
      'test:unit must preload tests/offline_network_guard.js',
    );
  });

  it('preserves the useful focused helper scripts', () => {
    for (const scriptName of ['test:cli', 'test:verbose', 'test:count']) {
      assert.equal(typeof PACKAGE.scripts?.[scriptName], 'string', `missing helper script: ${scriptName}`);
    }
  });
});

describe('test manifest — offline unit gate', () => {
  it('blocks external fetch in the test process and inherited Node children', async () => {
    assert.equal(isOfflineNetworkGuardInstalled(), true);
    const remoteUrl = ['https:', '', ['pine-facade', 'tradingview', 'com'].join('.'), 'unit-guard-probe'].join('/');

    await assert.rejects(
      globalThis.fetch(remoteUrl),
      error => error?.code === BLOCKED_EXTERNAL_NETWORK_CODE,
    );

    const childScript = `
      const installed = globalThis[Symbol.for(${JSON.stringify(OFFLINE_NETWORK_GUARD_SYMBOL)})] === true;
      if (!installed) process.exit(41);
      try {
        await fetch(${JSON.stringify(remoteUrl)});
        process.exit(42);
      } catch (error) {
        if (error?.code !== ${JSON.stringify(BLOCKED_EXTERNAL_NETWORK_CODE)}) process.exit(43);
      }
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', childScript], {
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, `offline guard child probe failed: ${child.stderr}`);
  });
});
