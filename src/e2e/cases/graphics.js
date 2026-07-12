import assert from 'node:assert/strict';
import { runFixedCase } from './fixed_result.js';

export const GRAPHICS_CASE_IDS = Object.freeze(['graphics_ohlcv_1', 'graphics_primitives_1']);

function assertFiniteOrNull(value) { assert.ok(value === null || Number.isFinite(value)); }
function assertGraphicsSchema(result, kind, verbose = false) {
  assert.equal(result.success, true);
  assert.equal(result.study_count, result.studies.length);
  for (const study of result.studies) {
    assert.equal(typeof study.name, 'string');
    if (kind === 'lines') {
      assert.ok(Number.isInteger(study.total_lines));
      for (const level of study.horizontal_levels) assert.ok(Number.isFinite(level));
      if (verbose) {
        assert.ok(study.all_lines.length <= study.total_lines);
        for (const line of study.all_lines) {
          assert.deepEqual(Object.keys(line), ['id', 'y1', 'y2', 'x1', 'x2', 'horizontal', 'style', 'width', 'color']);
          assertFiniteOrNull(line.y1); assertFiniteOrNull(line.y2);
        }
      }
    } else if (kind === 'labels') {
      assert.ok(Number.isInteger(study.total_labels));
      assert.equal(study.showing, study.labels.length);
      for (const label of study.labels) { assert.equal(typeof label.text, 'string'); assertFiniteOrNull(label.price); }
    } else if (kind === 'boxes') {
      assert.ok(Number.isInteger(study.total_boxes));
      for (const zone of study.zones) { assert.ok(Number.isFinite(zone.high)); assert.ok(Number.isFinite(zone.low)); }
      if (verbose) {
        assert.ok(study.all_boxes.length <= study.total_boxes);
        for (const box of study.all_boxes) {
          assert.deepEqual(Object.keys(box), ['id', 'high', 'low', 'x1', 'x2', 'borderColor', 'bgColor']);
          assertFiniteOrNull(box.high); assertFiniteOrNull(box.low);
        }
      }
    } else if (kind === 'tables') for (const table of study.tables) for (const row of table.rows) assert.equal(typeof row, 'string');
  }
}

export function createGraphicsCaseOwner({ operationBridge } = {}) {
  return Object.freeze({
    async run(caseId) {
      if (!GRAPHICS_CASE_IDS.includes(caseId) || typeof operationBridge?.execute !== 'function') return Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
      return runFixedCase(async () => {
        const report = await operationBridge.execute(caseId === 'graphics_ohlcv_1' ? 'owner.graphics.ohlcv.1' : 'owner.graphics.primitives.1');
        assert.equal(report.target_preserved, true);
        assert.equal(report.chart_state_preserved, true);
        assert.equal(report.disconnects, 1);
        if (caseId === 'graphics_ohlcv_1') {
          for (const key of ['open', 'close', 'high', 'low', 'range', 'change']) assert.ok(Number.isFinite(report.summary[key]));
          assert.equal(report.summary_matches_live, true);
          assert.match(report.summary.change_pct, /^-?\d+(?:\.\d+)?%$/);
        } else {
          assertGraphicsSchema(report.lines, 'lines');
          assertGraphicsSchema(report.verbose_lines, 'lines', true);
          assertGraphicsSchema(report.labels, 'labels');
          assertGraphicsSchema(report.verbose_labels, 'labels', true);
          assertGraphicsSchema(report.boxes, 'boxes');
          assertGraphicsSchema(report.verbose_boxes, 'boxes', true);
          assertGraphicsSchema(report.tables, 'tables');
        }
      });
    },
  });
}
