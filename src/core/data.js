/**
 * Core data access logic.
 */
import { evaluate, evaluateAsync, KNOWN_PATHS, safeString } from '../connection.js';

const MAX_OHLCV_BARS = 500;
const MAX_TRADES = 20;
const CHART_API = KNOWN_PATHS.chartApi;
const BARS_PATH = KNOWN_PATHS.mainSeriesBars;
const SAFE_INTERNAL_ERROR = 'TradingView returned an internal data error.';

function resolveEvaluate(deps) {
  return deps?.evaluate || evaluate;
}

function throwOnInternalError(result) {
  if (result == null || !Object.prototype.hasOwnProperty.call(result, 'error')) return;
  const message = typeof result.error === 'string' && result.error.trim()
    ? result.error.trim()
    : SAFE_INTERNAL_ERROR;
  throw new Error(message);
}

function buildGraphicsJS(kind, filter, { verbose = false, limit = 50 } = {}) {
  const configs = {
    lines: { collectionName: 'dwglines', mapKey: 'lines' },
    labels: { collectionName: 'dwglabels', mapKey: 'labels' },
    tables: { collectionName: 'dwgtablecells', mapKey: 'tableCells' },
    boxes: { collectionName: 'dwgboxes', mapKey: 'boxes' },
  };
  const config = configs[kind];
  if (!config) throw new Error(`Unknown graphics projection: ${kind}`);
  return `
    (function() {
      var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      var filter = ${safeString(filter || '')};
      var kind = ${safeString(kind)};
      var verbose = ${verbose ? 'true' : 'false'};
      var limit = ${JSON.stringify(limit)};
      function finite(value) {
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      }
      function publicValue(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string' || typeof value === 'boolean') return value;
        return null;
      }
      function textValue(value) {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'boolean') return String(value);
        return '';
      }
      function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      }
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = typeof meta.description === 'string' ? meta.description
            : (typeof meta.shortDescription === 'string' ? meta.shortDescription : '');
          if (!name) continue;
          if (filter && name.indexOf(filter) === -1) continue;
          var g = s._graphics;
          if (!g || !g._primitivesCollection) continue;
          var pc = g._primitivesCollection;
          var items = [];
          try {
            var outer = pc.${config.collectionName};
            if (outer) {
              var inner = outer.get('${config.mapKey}');
              if (inner) {
                var coll = inner.get(false);
                if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {
                  coll._primitivesDataById.forEach(function(v, id) { items.push({id: id, raw: v}); });
                }
              }
            }
          } catch(e) {}
          if (items.length === 0 && kind === 'tables') {
            try {
              var tcOuter = pc.dwgtablecells;
              if (tcOuter) {
                var tcColl = tcOuter.get('tableCells');
                if (tcColl && typeof tcColl.get === 'function') tcColl = tcColl.get(false);
                if (tcColl && tcColl._primitivesDataById && tcColl._primitivesDataById.size > 0) {
                  tcColl._primitivesDataById.forEach(function(v, id) { items.push({id: id, raw: v}); });
                }
              }
            } catch(e) {}
          }
          if (items.length === 0) continue;

          if (kind === 'lines') {
            var levels = [];
            var seenLevels = Object.create(null);
            var allLines = [];
            for (var li = 0; li < items.length; li++) {
              var lineItem = items[li];
              var line = lineItem.raw || {};
              var y1 = finite(line.y1);
              var y2 = finite(line.y2);
              var horizontal = y1 !== null && y2 !== null && y1 === y2;
              if (verbose) {
                allLines.push({
                  id: publicValue(lineItem.id), y1: y1, y2: y2,
                  x1: finite(line.x1), x2: finite(line.x2), horizontal: horizontal,
                  style: publicValue(line.st), width: publicValue(line.w), color: publicValue(line.ci),
                });
              }
              if (horizontal) {
                var levelKey = String(y1);
                if (!hasOwn(seenLevels, levelKey)) { levels.push(y1); seenLevels[levelKey] = true; }
              }
            }
            levels.sort(function(a, b) { return b - a; });
            var lineResult = {name: name, total_lines: items.length, horizontal_levels: levels};
            if (verbose) lineResult.all_lines = allLines;
            results.push(lineResult);
          } else if (kind === 'labels') {
            var labels = [];
            for (var la = 0; la < items.length; la++) {
              var labelItem = items[la];
              var label = labelItem.raw || {};
              var text = textValue(label.t);
              var price = finite(label.y);
              if (!text && price === null) continue;
              if (verbose) {
                labels.push({
                  id: publicValue(labelItem.id), text: text, price: price,
                  x: finite(label.x), yloc: publicValue(label.yl), size: publicValue(label.sz),
                  textColor: publicValue(label.tci), color: publicValue(label.ci),
                });
              } else {
                labels.push({text: text, price: price});
              }
            }
            if (labels.length > limit) labels = labels.slice(-limit);
            results.push({name: name, total_labels: items.length, showing: labels.length, labels: labels});
          } else if (kind === 'tables') {
            var tables = Object.create(null);
            for (var ti = 0; ti < items.length; ti++) {
              var cell = items[ti].raw || {};
              var row = finite(cell.row);
              var col = finite(cell.col);
              if (row === null || col === null) continue;
              var tableId = publicValue(cell.tid);
              if (tableId === null || tableId === '') tableId = 0;
              if (!hasOwn(tables, tableId)) tables[tableId] = Object.create(null);
              if (!hasOwn(tables[tableId], row)) tables[tableId][row] = Object.create(null);
              tables[tableId][row][col] = textValue(cell.t);
            }
            var tableList = Object.entries(tables).map(function(entry) {
              var rows = entry[1];
              var rowNums = Object.keys(rows).map(Number).sort(function(a, b) { return a - b; });
              var formatted = rowNums.map(function(rowNumber) {
                var cols = rows[rowNumber];
                var colNums = Object.keys(cols).map(Number).sort(function(a, b) { return a - b; });
                return colNums.map(function(colNumber) { return cols[colNumber]; }).filter(Boolean).join(' | ');
              }).filter(Boolean);
              return {rows: formatted};
            });
            results.push({name: name, tables: tableList});
          } else if (kind === 'boxes') {
            var zones = [];
            var seenZones = Object.create(null);
            var allBoxes = [];
            for (var bi = 0; bi < items.length; bi++) {
              var boxItem = items[bi];
              var box = boxItem.raw || {};
              var boxY1 = finite(box.y1);
              var boxY2 = finite(box.y2);
              var high = boxY1 !== null && boxY2 !== null ? Math.max(boxY1, boxY2) : null;
              var low = boxY1 !== null && boxY2 !== null ? Math.min(boxY1, boxY2) : null;
              if (verbose) {
                allBoxes.push({
                  id: publicValue(boxItem.id), high: high, low: low,
                  x1: finite(box.x1), x2: finite(box.x2),
                  borderColor: publicValue(box.c), bgColor: publicValue(box.bc),
                });
              }
              if (high !== null && low !== null) {
                var zoneKey = String(high) + ':' + String(low);
                if (!hasOwn(seenZones, zoneKey)) { zones.push({high: high, low: low}); seenZones[zoneKey] = true; }
              }
            }
            zones.sort(function(a, b) { return b.high - a.high; });
            var boxResult = {name: name, total_boxes: items.length, zones: zones};
            if (verbose) boxResult.all_boxes = allBoxes;
            results.push(boxResult);
          }
        } catch(e) {}
      }
      return results;
    })()
  `;
}

export async function getOhlcv({ count, summary } = {}) {
  const limit = Math.min(count || 100, MAX_OHLCV_BARS);
  let data;
  try {
    data = await evaluate(`
      (function() {
        var bars = ${BARS_PATH};
        if (!bars || typeof bars.lastIndex !== 'function') return null;
        var result = [];
        var end = bars.lastIndex();
        var start = Math.max(bars.firstIndex(), end - ${limit} + 1);
        for (var i = start; i <= end; i++) {
          var v = bars.valueAt(i);
          if (v) result.push({time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0});
        }
        return {bars: result, total_bars: bars.size(), source: 'direct_bars'};
      })()
    `);
  } catch { data = null; }

  if (!data || !data.bars || data.bars.length === 0) {
    throw new Error('Could not extract OHLCV data. The chart may still be loading.');
  }

  if (summary) {
    const bars = data.bars;
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const volumes = bars.map(b => b.volume);
    const first = bars[0];
    const last = bars[bars.length - 1];
    return {
      success: true, bar_count: bars.length,
      period: { from: first.time, to: last.time },
      open: first.open, close: last.close,
      high: Math.max(...highs), low: Math.min(...lows),
      range: Math.max(...highs) - Math.min(...lows),
      change: last.close - first.open,
      change_pct: Math.round(((last.close - first.open) / first.open) * 10000) / 100 + '%',
      avg_volume: Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length),
      last_5_bars: bars.slice(-5),
    };
  }

  return { success: true, bar_count: data.bars.length, total_available: data.total_bars, source: data.source, bars: data.bars };
}

export async function getIndicator({ entity_id }) {
  const data = await evaluate(`
    (function() {
      var api = ${CHART_API};
      var study = api.getStudyById(${safeString(entity_id)});
      if (!study) return { error: 'Study not found: ' + ${safeString(entity_id)} };
      var result = { name: null, inputs: null, visible: null };
      try { result.visible = study.isVisible(); } catch(e) {}
      try { result.inputs = study.getInputValues(); } catch(e) { result.inputs_error = e.message; }
      return result;
    })()
  `);

  if (data?.error) throw new Error(data.error);

  let inputs = data?.inputs;
  if (Array.isArray(inputs)) {
    inputs = inputs.filter(inp => {
      if (inp.id === 'text' && typeof inp.value === 'string' && inp.value.length > 200) return false;
      if (typeof inp.value === 'string' && inp.value.length > 500) return false;
      return true;
    });
  }
  return { success: true, entity_id, visible: data?.visible, inputs };
}

export async function getStrategyResults({ _deps } = {}) {
  const runEvaluate = resolveEvaluate(_deps);
  const results = await runEvaluate(`
    (function() {
      try {
        var chart = ${CHART_API}._chartWidget;
        var sources = chart.model().model().dataSources();
        function isStrategySource(s) {
          return !!(s && (s.reportData || s.ordersData || s.tradesData || s.equityData || s._reportData || s._reportDataBuffer || s._strategyOrdersPaneView || s._orders));
        }
        var strat = null;
        for (var i = 0; i < sources.length; i++) {
          var s = sources[i];
          if (s.metaInfo && isStrategySource(s)) { strat = s; break; }
        }
        if (!strat) return {metrics: {}, source: 'internal_api', error: 'No strategy found on chart. Add a strategy indicator first.'};
        function pct(v) { return typeof v === 'number' ? Math.round(v * 10000) / 100 : null; }
        function roundNum(v) { return typeof v === 'number' ? Math.round(v * 1000000) / 1000000 : v; }
        function summarizeSide(side) {
          side = side || {};
          return {
            total_trades: side.totalTrades ?? null,
            winning_trades: side.numberOfWiningTrades ?? null,
            losing_trades: side.numberOfLosingTrades ?? null,
            winrate: roundNum(side.percentProfitable ?? null),
            winrate_pct: pct(side.percentProfitable),
            profit_factor: roundNum(side.profitFactor ?? null),
            net_profit: roundNum(side.netProfit ?? null),
            net_profit_pct: pct(side.netProfitPercent),
            gross_profit: roundNum(side.grossProfit ?? null),
            gross_loss: roundNum(side.grossLoss ?? null),
            avg_trade: roundNum(side.avgTrade ?? null),
            avg_trade_pct: pct(side.avgTradePercent),
          };
        }
        function periodFromReport(rd) {
          var range = rd && rd.settings && rd.settings.dateRange;
          var bt = range && range.backtest;
          var tr = range && range.trade;
          return {
            backtest_from: bt && bt.from ? new Date(bt.from).toISOString() : null,
            backtest_to: bt && bt.to ? new Date(bt.to).toISOString() : null,
            trade_from: tr && tr.from ? new Date(tr.from).toISOString() : null,
            trade_to: tr && tr.to ? new Date(tr.to).toISOString() : null,
          };
        }
        var metrics = {};
        if (strat.reportData) {
          var rd = typeof strat.reportData === 'function' ? strat.reportData() : strat.reportData;
          if (rd && typeof rd === 'object') {
            if (typeof rd.value === 'function') rd = rd.value();
            if (rd && rd.performance) {
              var p = rd.performance;
              var all = summarizeSide(p.all);
              metrics = {
                name: strat.metaInfo().description || strat.metaInfo().shortDescription || null,
                currency: rd.currency || null,
                period: periodFromReport(rd),
                trade_count: Array.isArray(rd.trades) ? rd.trades.length : all.total_trades,
                filled_order_count: Array.isArray(rd.filledOrders) ? rd.filledOrders.length : null,
                winrate: all.winrate,
                winrate_pct: all.winrate_pct,
                pf: all.profit_factor,
                max_dd: roundNum(p.maxStrategyDrawDown ?? null),
                max_dd_pct: pct(p.maxStrategyDrawDownPercent),
                net_profit: all.net_profit,
                net_profit_pct: all.net_profit_pct,
                avg_trade: all.avg_trade,
                sharpe: roundNum(p.sharpeRatio ?? null),
                sortino: roundNum(p.sortinoRatio ?? null),
                all: all,
                long: summarizeSide(p.long),
                short: summarizeSide(p.short),
              };
            }
          }
        }
        if (Object.keys(metrics).length === 0 && strat.performance) {
          var perf = strat.performance();
          if (perf && typeof perf.value === 'function') perf = perf.value();
          if (perf && typeof perf === 'object') { var pkeys = Object.keys(perf); for (var pi = 0; pi < pkeys.length; pi++) { var pval = perf[pkeys[pi]]; if (pval !== null && pval !== undefined && typeof pval !== 'function') metrics[pkeys[pi]] = pval; } }
        }
        return {metrics: metrics, source: 'internal_api'};
      } catch(e) { return {metrics: {}, source: 'internal_api', error: e.message}; }
    })()
  `);
  throwOnInternalError(results);
  return { success: true, metric_count: Object.keys(results?.metrics || {}).length, source: results?.source, metrics: results?.metrics || {} };
}

export async function getTrades({ max_trades, _deps } = {}) {
  const limit = Math.min(max_trades || 20, MAX_TRADES);
  const runEvaluate = resolveEvaluate(_deps);
  const trades = await runEvaluate(`
    (function() {
      try {
        var chart = ${CHART_API}._chartWidget;
        var sources = chart.model().model().dataSources();
        function isStrategySource(s) {
          return !!(s && (s.reportData || s.ordersData || s.tradesData || s.equityData || s._reportData || s._reportDataBuffer || s._strategyOrdersPaneView || s._orders));
        }
        var strat = null;
        for (var i = 0; i < sources.length; i++) {
          var s = sources[i];
          if (s.metaInfo && isStrategySource(s)) { strat = s; break; }
        }
        if (!strat) return {trades: [], source: 'internal_api', error: 'No strategy found on chart.'};
        var orders = null;
        if (strat.reportData) {
          var rd = typeof strat.reportData === 'function' ? strat.reportData() : strat.reportData;
          if (rd && typeof rd.value === 'function') rd = rd.value();
          if (rd && Array.isArray(rd.trades)) orders = rd.trades;
        }
        if (!orders && strat.ordersData) { orders = typeof strat.ordersData === 'function' ? strat.ordersData() : strat.ordersData; if (orders && typeof orders.value === 'function') orders = orders.value(); }
        if (!orders || !Array.isArray(orders)) {
          if (strat._orders) orders = strat._orders;
          else if (strat.tradesData) { orders = typeof strat.tradesData === 'function' ? strat.tradesData() : strat.tradesData; if (orders && typeof orders.value === 'function') orders = orders.value(); }
        }
        if (!orders || !Array.isArray(orders)) return {trades: [], source: 'internal_api', error: 'ordersData() returned non-array.'};
        var result = [];
        for (var t = 0; t < Math.min(orders.length, ${limit}); t++) {
          var o = orders[t];
          if (typeof o === 'object' && o !== null) {
            var trade = {};
            if (o.e || o.x) {
              trade.entry_id = o.e && o.e.c;
              trade.entry_price = o.e && o.e.p;
              trade.entry_time = o.e && o.e.tm ? new Date(o.e.tm).toISOString() : null;
              trade.entry_bar = o.e && o.e.b;
              trade.entry_type = o.e && o.e.tp;
              trade.exit_id = o.x && o.x.c;
              trade.exit_price = o.x && o.x.p;
              trade.exit_time = o.x && o.x.tm ? new Date(o.x.tm).toISOString() : null;
              trade.exit_bar = o.x && o.x.b;
              trade.exit_type = o.x && o.x.tp;
              trade.qty = o.q;
              trade.profit = o.tp && o.tp.v;
              trade.profit_pct = o.tp && o.tp.p;
              trade.cum_profit = o.cp && o.cp.v;
              trade.runup = o.rn && o.rn.v;
              trade.drawdown = o.dd && o.dd.v;
              trade.value = o.v;
            } else {
              var okeys = Object.keys(o);
              for (var k = 0; k < okeys.length; k++) { var v = o[okeys[k]]; if (v !== null && v !== undefined && typeof v !== 'function' && typeof v !== 'object') trade[okeys[k]] = v; }
            }
            result.push(trade);
          }
        }
        return {trades: result, source: 'internal_api'};
      } catch(e) { return {trades: [], source: 'internal_api', error: e.message}; }
    })()
  `);
  throwOnInternalError(trades);
  return { success: true, trade_count: trades?.trades?.length || 0, source: trades?.source, trades: trades?.trades || [] };
}

export async function getEquity({ _deps } = {}) {
  const runEvaluate = resolveEvaluate(_deps);
  const equity = await runEvaluate(`
    (function() {
      try {
        var chart = ${CHART_API}._chartWidget;
        var sources = chart.model().model().dataSources();
        function isStrategySource(s) {
          return !!(s && (s.reportData || s.ordersData || s.tradesData || s.equityData || s._reportData || s._reportDataBuffer || s._strategyOrdersPaneView || s._orders));
        }
        var strat = null;
        for (var i = 0; i < sources.length; i++) {
          var s = sources[i];
          if (s.metaInfo && isStrategySource(s)) { strat = s; break; }
        }
        if (!strat) return {data: [], source: 'internal_api', error: 'No strategy found on chart.'};
        var data = [];
        if (strat.equityData) {
          var eq = typeof strat.equityData === 'function' ? strat.equityData() : strat.equityData;
          if (eq && typeof eq.value === 'function') eq = eq.value();
          if (Array.isArray(eq)) data = eq;
        }
        if (data.length === 0 && strat.bars) {
          var bars = typeof strat.bars === 'function' ? strat.bars() : strat.bars;
          if (bars && typeof bars.lastIndex === 'function') {
            var end = bars.lastIndex(); var start = bars.firstIndex();
            for (var i = start; i <= end; i++) { var v = bars.valueAt(i); if (v) data.push({time: v[0], equity: v[1], drawdown: v[2] || null}); }
          }
        }
        if (data.length === 0) {
          var perfData = {};
          var perf = null;
          if (strat.reportData) {
            var rd = typeof strat.reportData === 'function' ? strat.reportData() : strat.reportData;
            if (rd && typeof rd.value === 'function') rd = rd.value();
            if (rd && rd.performance) perf = rd.performance;
          }
          if (!perf && strat.performance) {
            perf = strat.performance();
            if (perf && typeof perf.value === 'function') perf = perf.value();
          }
          if (perf && typeof perf === 'object') {
            var pkeys = Object.keys(perf);
            for (var p = 0; p < pkeys.length; p++) { if (/equity|drawdown|profit|net|runup|return/i.test(pkeys[p])) perfData[pkeys[p]] = perf[pkeys[p]]; }
            if (perf.all) {
              perfData.netProfit = perf.all.netProfit;
              perfData.netProfitPercent = perf.all.netProfitPercent;
              perfData.totalTrades = perf.all.totalTrades;
              perfData.profitFactor = perf.all.profitFactor;
              perfData.percentProfitable = perf.all.percentProfitable;
            }
          }
          if (Object.keys(perfData).length > 0) return {data: [], equity_summary: perfData, source: 'internal_api', note: 'Full equity curve not available via API; equity summary metrics returned instead.'};
        }
        return {data: data, source: 'internal_api'};
      } catch(e) { return {data: [], source: 'internal_api', error: e.message}; }
    })()
  `);
  throwOnInternalError(equity);
  return { success: true, data_points: equity?.data?.length || 0, source: equity?.source, data: equity?.data || [], equity_summary: equity?.equity_summary, note: equity?.note };
}

export async function getQuote({ symbol, _deps } = {}) {
  const runEvaluate = resolveEvaluate(_deps);
  const data = await runEvaluate(`
    (function() {
      var api = ${CHART_API};
      var requested = ${safeString(symbol || '')};
      var ext = {};
      try { ext = api.symbolExt() || {}; } catch(e) {}
      var activeSymbol = '';
      try { activeSymbol = api.symbol() || ''; } catch(e) {}
      var observed = activeSymbol || ext.pro_name || ext.full_name || ext.symbol || ext.ticker || ext.name || '';

      function normalizeSymbol(value) {
        var full = String(value || '').trim().toUpperCase().replace(/\\s+/g, '');
        var colon = full.lastIndexOf(':');
        return {
          full: full,
          prefix: colon === -1 ? '' : full.slice(0, colon),
          ticker: colon === -1 ? full : full.slice(colon + 1),
        };
      }
      function sameInstrument(left, right) {
        var a = normalizeSymbol(left);
        var b = normalizeSymbol(right);
        if (!a.full || !b.full) return false;
        if (a.full === b.full) return true;
        if (a.ticker !== b.ticker) return false;
        if (!a.prefix) return true;
        return !!b.prefix && a.prefix === b.prefix;
      }

      if (requested) {
        var candidates = [activeSymbol, ext.pro_name, ext.full_name, ext.symbol, ext.ticker, ext.name];
        var canonicalTicker = normalizeSymbol(ext.symbol || ext.ticker || '').ticker;
        if (canonicalTicker && ext.exchange) candidates.push(ext.exchange + ':' + canonicalTicker);
        if (canonicalTicker && ext.listed_exchange) candidates.push(ext.listed_exchange + ':' + canonicalTicker);
        var matched = false;
        for (var i = 0; i < candidates.length; i++) {
          if (sameInstrument(requested, candidates[i])) { matched = true; break; }
        }
        if (!matched) {
          return {
            success: false,
            code: 'QUOTE_SYMBOL_MISMATCH',
            error: 'Requested symbol "' + requested + '" does not match active chart symbol "' + observed + '".',
            requested_symbol: requested,
            observed_symbol: observed,
          };
        }
      }

      var bars = ${BARS_PATH};
      var quote = { symbol: requested || observed };
      if (bars && typeof bars.lastIndex === 'function') {
        var last = bars.valueAt(bars.lastIndex());
        if (last) { quote.time = last[0]; quote.open = last[1]; quote.high = last[2]; quote.low = last[3]; quote.close = last[4]; quote.last = last[4]; quote.volume = last[5] || 0; }
      }
      try {
        var bidEl = document.querySelector('[class*="bid"] [class*="price"], [class*="dom-"] [class*="bid"]');
        var askEl = document.querySelector('[class*="ask"] [class*="price"], [class*="dom-"] [class*="ask"]');
        if (bidEl) quote.bid = parseFloat(bidEl.textContent.replace(/[^0-9.\\-]/g, ''));
        if (askEl) quote.ask = parseFloat(askEl.textContent.replace(/[^0-9.\\-]/g, ''));
      } catch(e) {}
      try {
        var hdr = document.querySelector('[class*="headerRow"] [class*="last-"]');
        if (hdr) { var hdrPrice = parseFloat(hdr.textContent.replace(/[^0-9.\\-]/g, '')); if (!isNaN(hdrPrice)) quote.header_price = hdrPrice; }
      } catch(e) {}
      if (ext.description) quote.description = ext.description;
      if (ext.exchange) quote.exchange = ext.exchange;
      if (ext.type) quote.type = ext.type;
      return quote;
    })()
  `);
  if (data?.code === 'QUOTE_SYMBOL_MISMATCH') {
    const error = new Error(data.error);
    error.name = 'QuoteSymbolMismatchError';
    error.code = data.code;
    error.requested_symbol = data.requested_symbol;
    error.observed_symbol = data.observed_symbol;
    throw error;
  }
  if (!data || (!data.last && !data.close)) throw new Error('Could not retrieve quote. The chart may still be loading.');
  return { success: true, ...data };
}

export async function getDepth() {
  const data = await evaluate(`
    (function() {
      var domPanel = document.querySelector('[class*="depth"]')
        || document.querySelector('[class*="orderBook"]')
        || document.querySelector('[class*="dom-"]')
        || document.querySelector('[class*="DOM"]')
        || document.querySelector('[data-name="dom"]');
      if (!domPanel) return { found: false, error: 'DOM / Depth of Market panel not found.' };
      var bids = [], asks = [];
      var rows = domPanel.querySelectorAll('[class*="row"], tr');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var priceEl = row.querySelector('[class*="price"]');
        var sizeEl = row.querySelector('[class*="size"], [class*="volume"], [class*="qty"]');
        if (!priceEl) continue;
        var price = parseFloat(priceEl.textContent.replace(/[^0-9.\\-]/g, ''));
        var size = sizeEl ? parseFloat(sizeEl.textContent.replace(/[^0-9.\\-]/g, '')) : 0;
        if (isNaN(price)) continue;
        var rowClass = row.className || '';
        var rowHTML = row.innerHTML || '';
        if (/bid|buy/i.test(rowClass) || /bid|buy/i.test(rowHTML)) bids.push({ price, size });
        else if (/ask|sell/i.test(rowClass) || /ask|sell/i.test(rowHTML)) asks.push({ price, size });
        else if (i < rows.length / 2) asks.push({ price, size });
        else bids.push({ price, size });
      }
      if (bids.length === 0 && asks.length === 0) {
        var cells = domPanel.querySelectorAll('[class*="cell"], td');
        var prices = [];
        cells.forEach(function(c) { var val = parseFloat(c.textContent.replace(/[^0-9.\\-]/g, '')); if (!isNaN(val) && val > 0) prices.push(val); });
        if (prices.length > 0) return { found: true, raw_values: prices.slice(0, 50), bids: [], asks: [], note: 'Could not classify bid/ask levels.' };
      }
      bids.sort(function(a, b) { return b.price - a.price; });
      asks.sort(function(a, b) { return a.price - b.price; });
      var spread = null;
      if (asks.length > 0 && bids.length > 0) spread = +(asks[0].price - bids[0].price).toFixed(6);
      return { found: true, bids: bids, asks: asks, spread: spread };
    })()
  `);

  if (!data || !data.found) throw new Error(data?.error || 'DOM panel not found.');
  return { success: true, bid_levels: data.bids?.length || 0, ask_levels: data.asks?.length || 0, spread: data.spread, bids: data.bids || [], asks: data.asks || [], raw_values: data.raw_values, note: data.note };
}

export async function getStudyValues() {
  const data = await evaluate(`
    (function() {
      var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
      var model = chart.model();
      var sources = model.model().dataSources();
      var results = [];
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s.metaInfo) continue;
        try {
          var meta = s.metaInfo();
          var name = meta.description || meta.shortDescription || '';
          if (!name) continue;
          var values = {};
          try {
            var dwv = s.dataWindowView();
            if (dwv) {
              var items = dwv.items();
              if (items) {
                for (var i = 0; i < items.length; i++) {
                  var item = items[i];
                  if (item._value && item._value !== '∅' && item._title) values[item._title] = item._value;
                }
              }
            }
          } catch(e) {}
          if (Object.keys(values).length > 0) results.push({ name: name, values: values });
        } catch(e) {}
      }
      return results;
    })()
  `);
  return { success: true, study_count: data?.length || 0, studies: data || [] };
}

export async function getPineLines({ study_filter, verbose } = {}) {
  const filter = study_filter || '';
  const studies = await evaluate(buildGraphicsJS('lines', filter, { verbose }));
  if (!studies || studies.length === 0) return { success: true, study_count: 0, studies: [] };
  return { success: true, study_count: studies.length, studies };
}

export async function getPineLabels({ study_filter, max_labels, verbose } = {}) {
  const filter = study_filter || '';
  const limit = max_labels || 50;
  const studies = await evaluate(buildGraphicsJS('labels', filter, { verbose, limit }));
  if (!studies || studies.length === 0) return { success: true, study_count: 0, studies: [] };
  return { success: true, study_count: studies.length, studies };
}

export async function getPineTables({ study_filter } = {}) {
  const filter = study_filter || '';
  const studies = await evaluate(buildGraphicsJS('tables', filter));
  if (!studies || studies.length === 0) return { success: true, study_count: 0, studies: [] };
  return { success: true, study_count: studies.length, studies };
}

export async function getPineBoxes({ study_filter, verbose } = {}) {
  const filter = study_filter || '';
  const studies = await evaluate(buildGraphicsJS('boxes', filter, { verbose }));
  if (!studies || studies.length === 0) return { success: true, study_count: 0, studies: [] };
  return { success: true, study_count: studies.length, studies };
}
