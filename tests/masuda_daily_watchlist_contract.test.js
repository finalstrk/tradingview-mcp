import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const SOURCE_URL = new URL('../pine/screeners/masuda_daily_watchlist.pine', import.meta.url);

async function source() {
  return readFile(SOURCE_URL, 'utf8');
}

describe('増田式 daily watchlist Pine Screener contract', () => {
  it('stays within Pine Screener compatibility limits', async () => {
    const pine = await source();

    assert.match(pine, /^\/\/@version=6/m);
    assert.match(pine, /indicator\("増田式 Daily Watchlist v1", overlay=false\)/);
    assert.doesNotMatch(pine, /\brequest\./);
    assert.doesNotMatch(pine, /input\.(?:timeframe|symbol|time)\s*\(/);
    assert.equal((pine.match(/^plot\(/gm) || []).length, 10);
    assert.equal((pine.match(/^alertcondition\(/gm) || []).length, 2);
    assert.match(pine, /plot\(compositeState, "Composite State"/);
    assert.match(pine, /plot\(barDayUtc, "Bar Day UTC"/);
    assert.match(pine, /barDayUtc = int\(math\.floor\(time_close \/ 86400000\)\)/);
  });

  it('emits only confirmed daily long and short events', async () => {
    const pine = await source();

    assert.match(pine, /dailyReady = timeframe\.isdaily and barstate\.isconfirmed/);
    assert.match(pine, /MASUDA_DAILY\|v=1\|setup=masuda_daily\|dir=long\|state=triggered/);
    assert.match(pine, /MASUDA_DAILY\|v=1\|setup=masuda_daily\|dir=short\|state=triggered/);
  });
});
