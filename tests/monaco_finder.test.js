import test from 'node:test';
import assert from 'node:assert';
import { PINE_MONACO_CANDIDATES, FIND_VISIBLE_PINE_MONACO, FIND_MONACO } from '../src/core/monaco.js';

// Regression for 2026-07-17 bug: the TradingView page holds TWO
// '.monaco-editor.pine-editor-monaco' nodes — a hidden 0x0 template and the
// real editor. querySelector grabbed the template first, so every pine_* tool
// failed with "Monaco not found in React fiber tree" even with the editor open.

function makeNode({ width = 0, height = 0, fiber = null, name = 'node' } = {}) {
  const node = {
    name,
    offsetWidth: width,
    offsetHeight: height,
    parentElement: null,
    getBoundingClientRect() { return { width, height }; },
  };
  if (fiber) node['__reactFiber$test'] = fiber;
  return node;
}

function evalSnippet(snippet, nodes) {
  const document = {
    querySelectorAll(sel) {
      return sel === '.monaco-editor.pine-editor-monaco' ? nodes : [];
    },
  };
  return new Function('document', 'return (' + snippet + ');')(document);
}

test('PINE_MONACO_CANDIDATES orders visible node before hidden 0x0 template', () => {
  const template = makeNode({ width: 0, height: 0, name: 'template' });
  const real = makeNode({ width: 800, height: 400, name: 'real' });
  const result = evalSnippet(PINE_MONACO_CANDIDATES, [template, real]);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, 'real');
  assert.strictEqual(result[1].name, 'template');
});

test('PINE_MONACO_CANDIDATES treats zero-offset node with non-zero rect as visible', () => {
  const node = makeNode({ width: 0, height: 0, name: 'rect-only' });
  node.getBoundingClientRect = () => ({ width: 640, height: 320 });
  const result = evalSnippet(PINE_MONACO_CANDIDATES, [node]);
  assert.strictEqual(result[0].name, 'rect-only');
});

test('FIND_VISIBLE_PINE_MONACO returns the visible node, skipping the template', () => {
  const template = makeNode({ name: 'template' });
  const real = makeNode({ width: 800, height: 400, name: 'real' });
  const result = evalSnippet(FIND_VISIBLE_PINE_MONACO, [template, real]);
  assert.strictEqual(result.name, 'real');
});

test('FIND_VISIBLE_PINE_MONACO returns null when only hidden templates exist', () => {
  const template = makeNode({ name: 'template' });
  const result = evalSnippet(FIND_VISIBLE_PINE_MONACO, [template]);
  assert.strictEqual(result, null);
});

test('FIND_MONACO reaches the editor via the visible node when a fiberless template comes first', () => {
  const editorObj = { id: 'the-editor' };
  const fiber = {
    memoizedProps: {
      value: {
        monacoEnv: {
          editor: { getEditors: () => [editorObj] },
        },
      },
    },
    return: null,
  };
  const template = makeNode({ name: 'template' }); // hidden, no fiber
  const real = makeNode({ width: 800, height: 400, fiber, name: 'real' });
  const result = evalSnippet(FIND_MONACO, [template, real]);
  assert.ok(result, 'expected editor to be found');
  assert.strictEqual(result.editor, editorObj);
});

test('FIND_MONACO falls back to hidden candidates if no visible node yields a fiber', () => {
  const editorObj = { id: 'hidden-editor' };
  const fiber = {
    memoizedProps: {
      value: { monacoEnv: { editor: { getEditors: () => [editorObj] } } },
    },
    return: null,
  };
  const hiddenWithFiber = makeNode({ fiber, name: 'hidden-with-fiber' });
  const visibleNoFiber = makeNode({ width: 800, height: 400, name: 'visible-no-fiber' });
  const result = evalSnippet(FIND_MONACO, [visibleNoFiber, hiddenWithFiber]);
  assert.ok(result, 'expected fallback to hidden candidate');
  assert.strictEqual(result.editor, editorObj);
});

test('FIND_MONACO returns null when no candidates exist', () => {
  const result = evalSnippet(FIND_MONACO, []);
  assert.strictEqual(result, null);
});
