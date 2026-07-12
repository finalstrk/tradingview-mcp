import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/batch.js';

const nonBlankSymbol = z.string().refine(value => value.trim().length > 0, {
  message: 'Symbol must be non-empty after trimming',
});
const nonBlankTimeframe = z.string().refine(value => value.trim().length > 0, {
  message: 'Timeframe must be non-empty after trimming',
});

export function registerBatchTools(server, coreApi = core) {
  server.tool('batch_run', 'Run an action across multiple symbols and/or timeframes', {
    symbols: z.array(nonBlankSymbol).min(1).describe('Array of symbols to iterate (e.g., ["BTCUSD", "ETHUSD", "AAPL"])'),
    timeframes: z.array(nonBlankTimeframe).min(1).optional().describe('Array of timeframes (e.g., ["D", "60", "15"])'),
    action: z.string().describe('Action to run: screenshot, get_ohlcv, get_strategy_results'),
    delay_ms: z.coerce.number().optional().describe('Optional delay after readiness in ms (default 0; condition polling is used instead)'),
    ohlcv_count: z.coerce.number().optional().describe('Bar count for get_ohlcv action (default 100)'),
  }, async ({ symbols, timeframes, action, delay_ms, ohlcv_count }, extra = {}) => {
    try {
      const result = await coreApi.batchRun({
        symbols,
        timeframes,
        action,
        delay_ms,
        ohlcv_count,
        signal: extra.signal,
      });
      const isError = result?.success === false || result?.cancelled === true;
      return { ...jsonResult(result, isError), isError };
    } catch (err) {
      return jsonResult({
        success: false,
        error: err.message,
        ...(err.code ? { code: err.code } : {}),
      }, true);
    }
  });
}
