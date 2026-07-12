import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/pine.js';

function pineError(err, extra = {}) {
  return {
    success: false,
    ...extra,
    error: err?.message || String(err),
    ...(err?.code === undefined ? {} : { code: err.code }),
    ...(err?.operation === undefined ? {} : { operation: err.operation }),
    ...(err?.timeoutMs === undefined ? {} : { timeout_ms: err.timeoutMs }),
    ...(err?.ambiguous === undefined ? {} : { ambiguous: err.ambiguous }),
    ...(err?.retryable === undefined ? {} : { retryable: err.retryable }),
  };
}

export function registerPineTools(server, coreApi = core) {
  server.tool('pine_get_source', 'Get current Pine Script source code from the editor', {}, async () => {
    try { return jsonResult(await coreApi.getSource()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_set_source', 'Set Pine Script source code in the editor', {
    source: z.string().describe('Pine Script source code to inject'),
  }, async ({ source }) => {
    try { return jsonResult(await coreApi.setSource({ source })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_compile', 'Compile / add the current Pine Script to the chart', {}, async (_args, { signal } = {}) => {
    try { return jsonResult(await coreApi.compile({ signal })); }
    catch (err) { return jsonResult(pineError(err), true); }
  });

  server.tool('pine_get_errors', 'Get Pine Script compilation errors from Monaco markers', {}, async () => {
    try { return jsonResult(await coreApi.getErrors()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_save', 'Save the current Pine Script (Ctrl+S)', {}, async (_args, { signal } = {}) => {
    try { return jsonResult(await coreApi.save({ signal })); }
    catch (err) { return jsonResult(pineError(err), true); }
  });

  server.tool('pine_get_console', 'Read Pine Script console/log output (compile messages, log.info(), errors)', {}, async () => {
    try { return jsonResult(await coreApi.getConsole()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_smart_compile', 'Intelligent compile: detects button, compiles, checks errors, reports study changes', {}, async (_args, { signal } = {}) => {
    try { return jsonResult(await coreApi.smartCompile({ signal })); }
    catch (err) { return jsonResult(pineError(err), true); }
  });

  server.tool('pine_new', 'Create a new blank Pine Script', {
    type: z.enum(['indicator', 'strategy', 'library']).describe('Type of script to create'),
  }, async ({ type }) => {
    try { return jsonResult(await coreApi.newScript({ type })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_open', 'Open a saved Pine Script by name', {
    name: z.string().describe('Name of the saved script to open (case-insensitive match)'),
  }, async ({ name }, { signal }) => {
    try { return jsonResult(await coreApi.openScript({ name, signal })); }
    catch (err) { return jsonResult({ success: false, source: 'internal_api', error: err.message }, true); }
  });

  server.tool('pine_list_scripts', 'List saved Pine Scripts', {}, async (_args, { signal }) => {
    try { return jsonResult(await coreApi.listScripts({ signal })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_analyze', 'Run static analysis on Pine Script code WITHOUT compiling — catches array out-of-bounds, unguarded array.first()/last(), bad loop bounds, and implicit bool casts. Works offline, no TradingView connection needed.', {
    source: z.string().describe('Pine Script source code to analyze'),
  }, async ({ source }) => {
    try { return jsonResult(coreApi.analyze({ source })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('pine_check', 'Compile Pine Script via TradingView\'s server API without needing the chart open. Returns compilation errors/warnings. Useful for validating code before injecting into the chart.', {
    source: z.string().describe('Pine Script source code to compile/validate'),
  }, async ({ source }) => {
    try { return jsonResult(await coreApi.check({ source })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });
}
