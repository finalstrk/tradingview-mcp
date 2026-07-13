import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadUi(pageSandbox) {
  const context = vm.createContext({});
  const connection = new vm.SyntheticModule(
    ['evaluate', 'evaluateAsync', 'getClient'],
    function initialize() {
      this.setExport('evaluate', async source => vm.runInNewContext(source, pageSandbox));
      this.setExport('evaluateAsync', async source => vm.runInNewContext(source, pageSandbox));
      this.setExport('getClient', async () => ({}));
    },
    { context },
  );
  const source = await readFile(new URL('../src/core/ui.js', import.meta.url), 'utf8');
  const ui = new vm.SourceTextModule(source, {
    context,
    identifier: new URL('../src/core/ui.js', import.meta.url).href,
  });
  await ui.link(async specifier => {
    if (specifier === '../connection.js') return connection;
    throw new Error(`Unexpected UI dependency: ${specifier}`);
  });
  await ui.evaluate();
  return ui.namespace;
}

function page(bottomWidgetBar, { editorOpen = true } = {}) {
  return {
    window: { TradingView: { bottomWidgetBar } },
    document: {
      querySelector(selector) {
        if (selector.includes('layout__area--bottom')) return { offsetHeight: editorOpen ? 315 : 38 };
        if (selector === '.monaco-editor.pine-editor-monaco') return editorOpen ? {} : null;
        return null;
      },
    },
  };
}

test('bottom-panel close uses callable close() when hideWidget is absent', async () => {
  const calls = [];
  const { openPanel } = await loadUi(page({ close(...args) { calls.push(args); } }));

  const result = await openPanel({ panel: 'pine-editor', action: 'close' });

  assert.equal(result.performed, 'closed');
  assert.deepEqual(calls, [[]], 'close must be invoked exactly once with no arguments');
});

test('bottom-panel toggle closes through callable close() when the panel is open', async () => {
  let closeCalls = 0;
  const { openPanel } = await loadUi(page({ close() { closeCalls += 1; } }));

  const result = await openPanel({ panel: 'pine-editor', action: 'toggle' });

  assert.equal(result.performed, 'closed');
  assert.equal(closeCalls, 1);
});

test('bottom-panel close never reports closed when no callable close path exists', async () => {
  const { openPanel } = await loadUi(page({}));

  await assert.rejects(
    openPanel({ panel: 'pine-editor', action: 'close' }),
    /bottomWidgetBar close not available/,
  );
});
