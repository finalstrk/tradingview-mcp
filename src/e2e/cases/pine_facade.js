import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runFixedCase } from './fixed_result.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'cli', 'index.js');
const ENDPOINT = 'https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000';
export const PINE_FACADE_CASE_IDS = Object.freeze([
  'pine_facade_1', 'pine_facade_2', 'pine_facade_3',
  'pine_facade_4', 'pine_facade_5',
]);

function postOptions(source) {
  const formData = new URLSearchParams();
  formData.append('source', source);
  return {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://www.tradingview.com/',
    },
    body: formData,
  };
}

function defaultRunCli(source) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, 'pine', 'check'], {
      encoding: 'utf8', timeout: 15_000, input: source,
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', exitCode: error.status };
  }
}

export function createPineFacadeCaseOwner({ fetchImpl = globalThis.fetch, runCli = defaultRunCli } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (!PINE_FACADE_CASE_IDS.includes(caseId)) {
        return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      }
      return runFixedCase(async () => {
        if (caseId === 'pine_facade_1') {
          const source = '//@version=6\nindicator("API Test", overlay=true)\nplot(close, "Close", color=color.blue)';
          const response = await fetchImpl(ENDPOINT, postOptions(source));
          assert.ok(response.ok, `API returned ${response.status}`);
          const result = await response.json();
          assert.ok(result.result || result.error === undefined);
          return;
        }
        if (caseId === 'pine_facade_2') {
          const source = '//@version=6\nindicator("Bad")\nthis_function_does_not_exist()';
          const response = await fetchImpl(ENDPOINT, postOptions(source));
          assert.ok(response.ok, `API returned ${response.status}`);
          const result = await response.json();
          const errors = result?.result?.errors2 || [];
          assert.ok(errors.length > 0);
          const message = errors[0].message || '';
          const context = errors[0].ctx || {};
          assert.ok(message.includes('this_function_does_not_exist') || context.fullName === 'this_function_does_not_exist');
          return;
        }
        if (caseId === 'pine_facade_3') {
          const response = await fetchImpl(ENDPOINT, postOptions(''));
          assert.ok(response.status === 400 || response.status === 200);
          return;
        }
        if (caseId === 'pine_facade_4') {
          const result = runCli('//@version=6\nindicator("test")\nplot(close)');
          assert.equal(result.exitCode, 0);
          const parsed = JSON.parse(result.stdout);
          assert.equal(parsed.success, true);
          assert.equal(parsed.compiled, true);
          return;
        }
        if (caseId === 'pine_facade_5') {
          const result = runCli('//@version=6\nindicator("test")\nplot(nonexistent_var)');
          assert.equal(result.exitCode, 0);
          const parsed = JSON.parse(result.stdout);
          assert.equal(parsed.compiled, false);
          assert.ok(parsed.error_count > 0);
          return;
        }
      });
    },
  });
}
