/**
 * Shared Monaco locator snippets injected into the TradingView page.
 *
 * The page can contain TWO '.monaco-editor.pine-editor-monaco' nodes: a
 * hidden 0x0 template and the real editor. A plain querySelector can grab
 * the template, making every pine_* tool fail with "Monaco not found in
 * React fiber tree" even when the editor is visibly open. All lookups here
 * therefore iterate every candidate, visible (non-zero size) nodes first.
 */

const IS_VISIBLE_FN = `function isVisible(el) {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) return true;
      if (typeof el.getBoundingClientRect === 'function') {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
      return false;
    }`;

/** All '.monaco-editor.pine-editor-monaco' nodes, visible ones first. */
export const PINE_MONACO_CANDIDATES = `
  (function pineMonacoCandidates() {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('.monaco-editor.pine-editor-monaco'));
    ${IS_VISIBLE_FN}
    var visible = [];
    var hidden = [];
    for (var i = 0; i < nodes.length; i++) {
      (isVisible(nodes[i]) ? visible : hidden).push(nodes[i]);
    }
    return visible.concat(hidden);
  })()
`;

/** First visible '.monaco-editor.pine-editor-monaco' node, or null. */
export const FIND_VISIBLE_PINE_MONACO = `
  (function findVisiblePineMonaco() {
    var nodes = document.querySelectorAll('.monaco-editor.pine-editor-monaco');
    ${IS_VISIBLE_FN}
    for (var i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) return nodes[i];
    }
    return null;
  })()
`;

/**
 * Walks the React fiber tree from each candidate container (visible first)
 * until a Monaco editor instance is found. Returns { editor, env } or null.
 */
export const FIND_MONACO = `
  (function findMonacoEditor() {
    var candidates = ${PINE_MONACO_CANDIDATES};
    for (var c = 0; c < candidates.length; c++) {
      var el = candidates[c];
      var fiberKey;
      for (var i = 0; i < 20; i++) {
        if (!el) break;
        fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });
        if (fiberKey) break;
        el = el.parentElement;
      }
      if (!fiberKey) continue;
      var current = el[fiberKey];
      for (var d = 0; d < 15; d++) {
        if (!current) break;
        if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {
          var env = current.memoizedProps.value.monacoEnv;
          if (env.editor && typeof env.editor.getEditors === 'function') {
            var editors = env.editor.getEditors();
            if (editors.length > 0) return { editor: editors[0], env: env };
          }
        }
        current = current.return;
      }
    }
    return null;
  })()
`;
