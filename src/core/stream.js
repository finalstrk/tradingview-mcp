/**
 * Core streaming logic — real-time JSONL output from TradingView.
 * Uses efficient poll + dedup: only emits when data changes.
 */
import { evaluate } from '../connection.js';

const CHART_API = 'window.TradingViewApi._activeChartWidgetWV.value()';
const MODEL = `${CHART_API}._chartWidget.model()`;

/**
 * Generic poll-and-diff loop.
 * Calls fetcher(), compares to last value, emits JSONL on change.
 * Writes to stdout directly for pipe-friendliness.
 */
export async function pollLoop(fetcher, {
  interval = 500,
  dedupe = true,
  label = 'stream',
  signal,
  processRef = process,
  fetchTimeoutMs = Math.max(1000, Math.min(10000, interval * 4)),
} = {}) {
  let lastHash = null;
  const controller = new AbortController();

  const stop = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason || new Error(`stream:${label} stopped`));
    }
  };
  signal?.addEventListener('abort', stop, { once: true });
  processRef.on('SIGINT', stop);
  processRef.on('SIGTERM', stop);
  if (signal?.aborted) stop();

  // Emit header with compliance notice
  const start = Date.now();
  processRef.stderr.write(`\u26A0  tradingview-mcp  |  Unofficial tool. Not affiliated with TradingView Inc. or Anthropic.\n`);
  processRef.stderr.write(`   Streams from your locally running TradingView Desktop instance only.\n`);
  processRef.stderr.write(`   Does not connect to TradingView servers. Requires --remote-debugging-port=9222.\n`);
  processRef.stderr.write(`   Ensure your usage complies with TradingView's Terms of Use.\n`);
  processRef.stderr.write(`[stream:${label}] started, interval=${interval}ms, Ctrl+C to stop\n`);

  try {
    while (!controller.signal.aborted) {
      try {
        const fetchController = new AbortController();
        const onStreamAbort = () => {
          if (!fetchController.signal.aborted) {
            fetchController.abort(controller.signal.reason || new Error(`stream:${label} stopped`));
          }
        };
        controller.signal.addEventListener('abort', onStreamAbort, { once: true });

        try {
          const fetchPromise = Promise.resolve().then(() => fetcher({
            signal: fetchController.signal,
            timeoutMs: fetchTimeoutMs,
          }));
          const data = await raceWithAbort(
            fetchPromise,
            controller.signal,
            label,
            fetchTimeoutMs,
            timeoutError => {
              if (!fetchController.signal.aborted) fetchController.abort(timeoutError);
            },
          );
          if (!data) {
            await sleep(interval, controller.signal);
            continue;
          }

          const hash = dedupe ? JSON.stringify(data) : null;
          if (!dedupe || hash !== lastHash) {
            lastHash = hash;
            const line = JSON.stringify({ ...data, _ts: Date.now(), _stream: label });
            processRef.stdout.write(line + '\n');
          }
        } finally {
          controller.signal.removeEventListener('abort', onStreamAbort);
        }
      } catch (err) {
        if (controller.signal.aborted) break;
        // Connection errors — retry silently
        if (/CDP|ECONNREFUSED/i.test(err.message)) {
          await sleep(2000, controller.signal);
          continue;
        }
        processRef.stderr.write(`[stream:${label}] error: ${err.message}\n`);
      }
      await sleep(interval, controller.signal);
    }
  } finally {
    processRef.stderr.write(`[stream:${label}] stopped after ${((Date.now() - start) / 1000).toFixed(1)}s\n`);
    signal?.removeEventListener('abort', stop);
    processRef.removeListener('SIGINT', stop);
    processRef.removeListener('SIGTERM', stop);
  }
}

function raceWithAbort(promise, signal, label, timeoutMs, onTimeout) {
  if (signal.aborted) return Promise.reject(signal.reason || new Error(`stream:${label} stopped`));
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, signal.reason || new Error(`stream:${label} stopped`));
    signal.addEventListener('abort', onAbort, { once: true });
    const boundedTimeout = Math.max(1, Number(timeoutMs) || 1);
    timer = setTimeout(() => {
      const timeoutError = new Error(`stream:${label} fetch timed out after ${boundedTimeout}ms`);
      try { onTimeout?.(timeoutError); } catch {}
      finish(reject, timeoutError);
    }, boundedTimeout);
    Promise.resolve(promise).then(
      value => finish(resolve, value),
      error => finish(reject, error),
    );
  });
}

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let timer;
    const finish = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    signal?.addEventListener('abort', finish, { once: true });
    timer = setTimeout(finish, ms);
  });
}

// ── Stream: quote ──

async function fetchQuote(options) {
  return evaluate(`
    (function() {
      var chart = ${CHART_API};
      var m = ${MODEL};
      var bars = m.mainSeries().bars();
      var last = bars.lastIndex();
      var v = bars.valueAt(last);
      if (!v) return null;
      return {
        symbol: chart.symbol(),
        time: v[0],
        open: v[1],
        high: v[2],
        low: v[3],
        close: v[4],
        volume: v[5] || 0,
      };
    })()
  `, options);
}

export async function streamQuote({ interval, signal, fetchTimeoutMs } = {}) {
  return pollLoop(fetchQuote, { interval: interval || 300, label: 'quote', signal, fetchTimeoutMs });
}

// ── Stream: ohlcv (last N bars, emits on new bar) ──

async function fetchLastBar(options) {
  return evaluate(`
    (function() {
      var chart = ${CHART_API};
      var m = ${MODEL};
      var bars = m.mainSeries().bars();
      var last = bars.lastIndex();
      var v = bars.valueAt(last);
      if (!v) return null;
      return {
        symbol: chart.symbol(),
        resolution: chart.resolution(),
        bar_time: v[0],
        open: v[1],
        high: v[2],
        low: v[3],
        close: v[4],
        volume: v[5] || 0,
        bar_index: last,
      };
    })()
  `, options);
}

export async function streamBars({ interval, signal, fetchTimeoutMs } = {}) {
  return pollLoop(fetchLastBar, { interval: interval || 500, label: 'bars', signal, fetchTimeoutMs });
}

// ── Stream: indicator values ──

async function fetchValues(options) {
  return evaluate(`
    (function() {
      var chart = ${CHART_API};
      var m = ${MODEL};
      var studies = chart.getAllStudies();
      var results = [];
      for (var i = 0; i < studies.length; i++) {
        try {
          var study = chart.getStudyById(studies[i].id);
          if (!study || !study.isVisible()) continue;
          var src = study._study || study;
          var data = src._lastBarValues || src._data;
          if (!data) continue;
          var vals = {};
          if (typeof data === 'object') {
            for (var k in data) {
              if (typeof data[k] === 'number' && !isNaN(data[k])) vals[k] = data[k];
            }
          }
          if (Object.keys(vals).length > 0) results.push({ name: studies[i].name, values: vals });
        } catch(e) {}
      }
      return { symbol: chart.symbol(), study_count: results.length, studies: results };
    })()
  `, options);
}

export async function streamValues({ interval, signal, fetchTimeoutMs } = {}) {
  return pollLoop(fetchValues, { interval: interval || 500, label: 'values', signal, fetchTimeoutMs });
}

// ── Stream: pine lines ──

async function fetchLines(studyFilter, options) {
  const filter = studyFilter ? JSON.stringify(studyFilter) : 'null';
  return evaluate(`
    (function() {
      var filter = ${filter};
      var chart = ${CHART_API};
      var studies = chart.getAllStudies();
      var results = [];
      for (var i = 0; i < studies.length; i++) {
        var s = studies[i];
        if (filter && (s.name || '').toLowerCase().indexOf(filter.toLowerCase()) === -1) continue;
        try {
          var study = chart.getStudyById(s.id);
          if (!study) continue;
          var src = study._study || study;
          var g = src._graphics || (src._source && src._source._graphics);
          if (!g) continue;
          var pc = g._primitivesCollection;
          if (!pc || !pc.dwglines) continue;
          var linesMap = pc.dwglines.get('lines');
          if (!linesMap) continue;
          var data = linesMap.get(false);
          if (!data || !data._primitivesDataById) continue;
          var levels = [];
          var seen = {};
          data._primitivesDataById.forEach(function(line) {
            var p1 = line.points && line.points[0] ? line.points[0].price : null;
            var p2 = line.points && line.points[1] ? line.points[1].price : null;
            var price = (p1 !== null && p1 === p2) ? p1 : (p1 || p2);
            if (price !== null && !seen[price]) { seen[price] = true; levels.push(price); }
          });
          levels.sort(function(a, b) { return b - a; });
          if (levels.length > 0) results.push({ study: s.name, levels: levels });
        } catch(e) {}
      }
      return { symbol: chart.symbol(), study_count: results.length, studies: results };
    })()
  `, options);
}

export async function streamLines({ interval, filter, signal, fetchTimeoutMs } = {}) {
  return pollLoop(options => fetchLines(filter, options), {
    interval: interval || 1000,
    label: 'lines',
    signal,
    fetchTimeoutMs,
  });
}

// ── Stream: pine labels ──

async function fetchLabels(studyFilter, options) {
  const filterStr = studyFilter ? JSON.stringify(studyFilter) : 'null';
  return evaluate(`
    (function() {
      var filter = ${filterStr};
      var chart = ${CHART_API};
      var studies = chart.getAllStudies();
      var results = [];
      for (var i = 0; i < studies.length; i++) {
        var s = studies[i];
        if (filter && (s.name || '').toLowerCase().indexOf(filter.toLowerCase()) === -1) continue;
        try {
          var study = chart.getStudyById(s.id);
          if (!study) continue;
          var src = study._study || study;
          var g = src._graphics || (src._source && src._source._graphics);
          if (!g) continue;
          var pc = g._primitivesCollection;
          if (!pc || !pc.dwglabels) continue;
          var labelsMap = pc.dwglabels.get('labels');
          if (!labelsMap) continue;
          var data = labelsMap.get(false);
          if (!data || !data._primitivesDataById) continue;
          var labels = [];
          data._primitivesDataById.forEach(function(lbl) {
            var text = lbl.text || '';
            var price = lbl.points && lbl.points[0] ? lbl.points[0].price : null;
            if (text) labels.push({ text: text, price: price });
          });
          if (labels.length > 0) results.push({ study: s.name, labels: labels.slice(0, 50) });
        } catch(e) {}
      }
      return { symbol: chart.symbol(), study_count: results.length, studies: results };
    })()
  `, options);
}

export async function streamLabels({ interval, filter, signal, fetchTimeoutMs } = {}) {
  return pollLoop(options => fetchLabels(filter, options), {
    interval: interval || 1000,
    label: 'labels',
    signal,
    fetchTimeoutMs,
  });
}

// ── Stream: pine tables ──

async function fetchTables(studyFilter, options) {
  const filterStr = studyFilter ? JSON.stringify(studyFilter) : 'null';
  return evaluate(`
    (function() {
      var filter = ${filterStr};
      var chart = ${CHART_API};
      var studies = chart.getAllStudies();
      var results = [];
      for (var i = 0; i < studies.length; i++) {
        var s = studies[i];
        if (filter && (s.name || '').toLowerCase().indexOf(filter.toLowerCase()) === -1) continue;
        try {
          var study = chart.getStudyById(s.id);
          if (!study) continue;
          var src = study._study || study;
          var g = src._graphics || (src._source && src._source._graphics);
          if (!g) continue;
          var pc = g._primitivesCollection;
          if (!pc || !pc.ownFirstValue) continue;
          var tableMap = pc.ownFirstValue();
          if (!tableMap) continue;
          var tables = [];
          if (typeof tableMap.forEach === 'function') {
            tableMap.forEach(function(table) {
              if (!table || !table.data) return;
              var rows = [];
              for (var r = 0; r < table.data.length; r++) {
                var row = [];
                for (var c = 0; c < table.data[r].length; c++) {
                  row.push(table.data[r][c].text || '');
                }
                rows.push(row);
              }
              tables.push({ rows: rows });
            });
          }
          if (tables.length > 0) results.push({ study: s.name, tables: tables });
        } catch(e) {}
      }
      return { symbol: chart.symbol(), study_count: results.length, studies: results };
    })()
  `, options);
}

export async function streamTables({ interval, filter, signal, fetchTimeoutMs } = {}) {
  return pollLoop(options => fetchTables(filter, options), {
    interval: interval || 2000,
    label: 'tables',
    signal,
    fetchTimeoutMs,
  });
}

// ── Stream: all panes (multi-symbol) ──

const CWC = 'window.TradingViewApi._chartWidgetCollection';

async function fetchAllPanes(options) {
  return evaluate(`
    (function() {
      var cwc = ${CWC};
      var all = cwc.getAll();
      var layoutType = cwc._layoutType;
      if (typeof layoutType === 'object' && layoutType && typeof layoutType.value === 'function') layoutType = layoutType.value();
      var count = cwc.inlineChartsCount;
      if (typeof count === 'object' && count && typeof count.value === 'function') count = count.value();

      var panes = [];
      for (var i = 0; i < Math.min(all.length, count || all.length); i++) {
        try {
          var c = all[i];
          var model = c.model();
          var ms = model.mainSeries();
          var bars = ms.bars();
          var last = bars.lastIndex();
          var v = bars.valueAt(last);
          if (!v) { panes.push({ index: i, symbol: ms.symbol(), error: 'no bars' }); continue; }
          panes.push({
            index: i,
            symbol: ms.symbol(),
            resolution: ms.interval(),
            time: v[0],
            open: v[1],
            high: v[2],
            low: v[3],
            close: v[4],
            volume: v[5] || 0,
          });
        } catch(e) { panes.push({ index: i, error: e.message }); }
      }
      return { layout: layoutType, pane_count: panes.length, panes: panes };
    })()
  `, options);
}

export async function streamAllPanes({ interval, signal, fetchTimeoutMs } = {}) {
  return pollLoop(fetchAllPanes, {
    interval: interval || 500,
    label: 'all-panes',
    signal,
    fetchTimeoutMs,
  });
}
