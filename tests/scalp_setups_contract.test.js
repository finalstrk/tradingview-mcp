// Offline contract tests for the 2026-07-17 research-derived scalp setups.
// Guards: registry consistency, DT label contract presence, file layout,
// strategy conventions, spec files, and the PINE_CONVENTIONS allowlist.
// These setups are candidates only; nothing here may become adopted without
// backtest evidence recorded through the setup-verify flow.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP_IDS = ['torb', 'intraday_momo', 'intraday_momo_pure', 'noise_break', 'vwap_rsi_pullback'];

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'journal', 'registry.json'), 'utf8'));

test('registry setup ids are unique', () => {
  const ids = registry.setups.map((s) => s.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate setup ids in registry');
});

test('registry contains the four research-derived setups as candidates', () => {
  const REQUIRED_MARKETS = ['fx', 'futures', 'stocks_us', 'stocks_jp'];
  for (const id of SETUP_IDS) {
    const setup = registry.setups.find((s) => s.id === id);
    assert.ok(setup, `registry entry missing for ${id}`);
    assert.strictEqual(setup.status, 'candidate', `${id} setup status must be candidate`);
    for (const marketKey of REQUIRED_MARKETS) {
      assert.ok(setup.markets[marketKey], `${id} missing market ${marketKey}`);
    }
    for (const [marketKey, market] of Object.entries(setup.markets)) {
      assert.notStrictEqual(market.status, 'adopted', `${id}/${marketKey} must not be adopted without backtest evidence`);
      assert.ok(Array.isArray(market.evidence), `${id}/${marketKey} evidence must be an array`);
      assert.ok(Array.isArray(market.timeframes) && market.timeframes.length > 0, `${id}/${marketKey} timeframes required`);
    }
    assert.ok(setup.pine_indicator.startsWith(`pine/setups/${id}/`), `${id} indicator path convention`);
    assert.ok(setup.pine_strategy.startsWith(`pine/setups/${id}/`), `${id} strategy path convention`);
  }
});

test('setup files exist with required layout', () => {
  for (const id of SETUP_IDS) {
    for (const rel of [
      `pine/setups/${id}/${id}_indicator.pine`,
      `pine/setups/${id}/${id}_strategy.pine`,
      `pine/setups/${id}/README.md`,
      `journal/specs/${id}_spec.json`,
    ]) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
    }
  }
});

test('indicators honor the DT label contract', () => {
  for (const id of SETUP_IDS) {
    const src = fs.readFileSync(path.join(ROOT, `pine/setups/${id}/${id}_indicator.pine`), 'utf8');
    assert.match(src, /^\/\/@version=6/m, `${id} indicator must be Pine v6`);
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'));
    const code = codeLines.join('\n');
    assert.ok(code.includes(`"DT|${id}|"`), `${id} indicator must build the DT|${id}| label prefix in code`);
    const prefixLineIdx = codeLines.findIndex((l) => l.includes(`"DT|${id}|"`));
    const labelExpr = codeLines.slice(prefixLineIdx, prefixLineIdx + 3).join(' ');
    const fieldOrder = ['"|entry="', '"|sl="', '"|tp1="', '"|tp2="'];
    let cursor = 0;
    for (const field of fieldOrder) {
      const at = labelExpr.indexOf(field, cursor);
      assert.ok(at >= 0, `${id} indicator label must concatenate ${field} after the previous field`);
      cursor = at + field.length;
    }
    assert.ok(labelExpr.includes('format.mintick'), `${id} indicator label expression must format prices with format.mintick`);
    assert.ok(src.includes('label.delete'), `${id} indicator must manage a single label via label.delete`);
    assert.ok(src.includes('alertcondition'), `${id} indicator must expose alertconditions`);
    for (const line of src.split('\n')) {
      if (line.includes('barmerge.lookahead_on') && !line.trim().startsWith('//')) {
        assert.ok(line.includes('request.security') && line.includes('[1]'),
          `${id}: lookahead_on is only allowed in the documented non-repainting [1]-offset request.security idiom`);
      }
    }
  }
});

test('strategies follow the DT strategy conventions', () => {
  for (const id of SETUP_IDS) {
    const src = fs.readFileSync(path.join(ROOT, `pine/setups/${id}/${id}_strategy.pine`), 'utf8');
    assert.match(src, /^\/\/@version=6/m, `${id} strategy must be Pine v6`);
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(code.includes('process_orders_on_close=true'), `${id} strategy must process orders on close`);
    assert.ok(code.includes('strategy.close_all'), `${id} strategy must flatten at session end (non-comment code)`);
    for (const line of src.split('\n')) {
      if (line.includes('barmerge.lookahead_on') && !line.trim().startsWith('//')) {
        assert.ok(line.includes('request.security') && line.includes('[1]'),
          `${id}: lookahead_on is only allowed in the documented non-repainting [1]-offset request.security idiom`);
      }
    }
  }
});

test('strategy spec files parse and match their setup ids', () => {
  for (const id of SETUP_IDS) {
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, `journal/specs/${id}_spec.json`), 'utf8'));
    assert.strictEqual(spec.id, id, `spec id mismatch for ${id}`);
  }
});

test('PINE_CONVENTIONS setup_id allowlist includes the new setups', () => {
  const conventions = fs.readFileSync(path.join(ROOT, 'pine/PINE_CONVENTIONS.md'), 'utf8');
  const allowlistLine = conventions.split('\n').find((l) => l.includes('`setup_id`:'));
  assert.ok(allowlistLine, 'PINE_CONVENTIONS setup_id allowlist line not found');
  for (const id of SETUP_IDS) {
    assert.ok(allowlistLine.includes(`\`${id}\``), `PINE_CONVENTIONS allowlist line missing ${id}`);
  }
});
