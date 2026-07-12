import { types as utilTypes } from 'node:util';

const READ_FAILED = Object.freeze({
  ok: false,
  code: 'PINE_DISCOVERY_READ_FAILED',
  editor: null,
  chart: null,
});

function readFailed() {
  return READ_FAILED;
}

const EDITOR_SCHEMA = Object.freeze({
  modelAvailable: ['boolean'],
  markerCount: ['integer', 0, 10_000],
  sourceAvailable: ['boolean'],
  consoleAvailable: ['boolean'],
  toolbarDetected: ['boolean'],
});

const CHART_SCHEMA = Object.freeze({
  symbol: ['string', 1, 256],
  interval: ['string', 1, 32],
  replayActive: ['boolean'],
  studyCount: ['integer', 0, 10_000],
  shapeCount: ['integer', 0, 10_000],
});

function sanitizeProjection(value, schema) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;

  const seen = new Set();
  let nodes = 0;
  let stringUnits = 0;

  function inspect(current, depth) {
    nodes += 1;
    if (nodes > 32 || depth > 3 || utilTypes.isProxy(current)) return false;
    if (seen.has(current)) return false;
    seen.add(current);

    let keys;
    let descriptors;
    try {
      keys = Reflect.ownKeys(current);
      descriptors = Object.getOwnPropertyDescriptors(current);
    } catch {
      return false;
    }
    if (keys.length > 16 || keys.some(key => typeof key !== 'string')) return false;

    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      const item = descriptor.value;
      if (typeof item === 'string') {
        stringUnits += item.length;
        if (stringUnits > 1_024) return false;
      } else if (item && typeof item === 'object') {
        if (!inspect(item, depth + 1)) return false;
      } else if (
        typeof item === 'function'
        || typeof item === 'symbol'
        || typeof item === 'bigint'
        || (typeof item === 'number' && !Number.isFinite(item))
      ) {
        return false;
      }
    }
    return true;
  }

  if (!inspect(value, 0)) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.some(key => !Object.hasOwn(schema, key))) return null;

  const copy = {};
  for (const key of keys) {
    const item = descriptors[key].value;
    const rule = schema[key];
    if (rule[0] === 'boolean') {
      if (typeof item !== 'boolean') return null;
    } else if (rule[0] === 'string') {
      if (typeof item !== 'string' || item.length < rule[1] || item.length > rule[2]) return null;
    } else if (
      rule[0] === 'integer'
      && (!Number.isInteger(item) || item < rule[1] || item > rule[2])
    ) {
      return null;
    }
    copy[key] = item;
  }
  return Object.freeze(copy);
}

function frozenResult({ ok, code, editor, chart }) {
  return Object.freeze({ ok, code, editor, chart });
}

/**
 * Read Pine discovery state only when the editor is already visible.
 *
 * The reader is deliberately capability-limited: this function calls only
 * its three read methods. In particular, it never opens the editor or invokes
 * UI, keyboard, Input-domain, or network capabilities supplied by a caller.
 */
export async function discoverOpenPineEditorReadOnly(reader) {
  if (
    !reader
    || typeof reader.readEditorVisibility !== 'function'
    || typeof reader.readEditorProjection !== 'function'
    || typeof reader.readChartProjection !== 'function'
  ) {
    return readFailed();
  }

  try {
    const editorOpen = await reader.readEditorVisibility();
    if (typeof editorOpen !== 'boolean') return readFailed();

    if (!editorOpen) {
      const chart = sanitizeProjection(await reader.readChartProjection(), CHART_SCHEMA);
      if (chart === null) return readFailed();
      return frozenResult({
        ok: false,
        code: 'PINE_EDITOR_UNAVAILABLE',
        editor: null,
        chart,
      });
    }

    const editor = sanitizeProjection(await reader.readEditorProjection(), EDITOR_SCHEMA);
    if (editor === null) return readFailed();
    const chart = sanitizeProjection(await reader.readChartProjection(), CHART_SCHEMA);
    if (chart === null) return readFailed();
    return frozenResult({
      ok: true,
      code: 'PINE_EDITOR_READ_ONLY',
      editor,
      chart,
    });
  } catch {
    return readFailed();
  }
}
