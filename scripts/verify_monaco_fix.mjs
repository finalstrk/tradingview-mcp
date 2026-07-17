// Live verification of the visible-node Monaco fix (2026-07-17).
// Connects directly to TradingView via CDP (:9222) using THIS repo's code,
// so it works without restarting the MCP server.
// Usage: node scripts/verify_monaco_fix.mjs  (TradingView must be running with CDP)
import { evaluate, disconnect } from '../src/connection.js';
import { PINE_MONACO_CANDIDATES, FIND_MONACO } from '../src/core/monaco.js';
import { ensurePineEditorOpen, getErrors } from '../src/core/pine.js';

try {
  const nodes = await evaluate(`
    (function() {
      var c = ${PINE_MONACO_CANDIDATES};
      return c.map(function(el) { return { w: el.offsetWidth, h: el.offsetHeight }; });
    })()
  `);
  console.log('candidates (visible-first):', JSON.stringify(nodes));

  const found = await evaluate(`(function() { var m = ${FIND_MONACO}; return m !== null; })()`);
  console.log('FIND_MONACO found editor:', found);

  const oldPick = await evaluate(`
    (function() {
      var el = document.querySelector('.monaco-editor.pine-editor-monaco');
      return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    })()
  `);
  console.log('old querySelector pick (pre-fix behavior):', JSON.stringify(oldPick));

  const open = await ensurePineEditorOpen();
  console.log('ensurePineEditorOpen:', open);
  if (open) {
    const errs = await getErrors();
    console.log('pine_get_errors reachable:', JSON.stringify(errs).slice(0, 300));
  }
  if (!found || !open) process.exitCode = 1;
} finally {
  await disconnect();
}
