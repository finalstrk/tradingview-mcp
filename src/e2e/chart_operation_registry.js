import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';

const DEFINITIONS = [
  {
    "id": "chart.op.001",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){try{if(p0==='chart')return window.TradingViewApi._activeChartWidgetWV.value()!=null;if(p0==='bottom_bar')return window.TradingView.bottomWidgetBar!=null;if(p0==='replay')return window.TradingViewApi._replayApi!=null;return false;}catch(e){return false;}}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.002",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var result = { url: window.location.href, title: document.title };\n          try {\n            var chart = window.TradingViewApi._activeChartWidgetWV.value();\n            result.symbol = chart.symbol();\n            result.resolution = chart.resolution();\n            result.chartType = chart.chartType();\n            result.apiAvailable = true;\n          } catch(e) {\n            result.apiAvailable = false;\n            result.apiError = e.message;\n          }\n          return result;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.003",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var ui = {};\n          var bottom = document.querySelector('[class*=\"layout__area--bottom\"]');\n          ui.bottom_panel = { height: bottom ? bottom.offsetHeight : 0 };\n          var right = document.querySelector('[class*=\"layout__area--right\"]');\n          ui.right_panel = { width: right ? right.offsetWidth : 0 };\n          ui.button_count = document.querySelectorAll('button').length;\n          return ui;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.004",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().symbol());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.005",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().resolution());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.006",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().chartType());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.007",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setSymbol(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.008",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setResolution(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.009",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setChartType(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.010",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var chart = window.TradingViewApi._activeChartWidgetWV.value();\n          var studies = chart.getAllStudies().map(function(s) {\n            return { id: s.id, name: s.name || s.title || 'unknown' };\n          });\n          return {\n            symbol: chart.symbol(),\n            resolution: chart.resolution(),\n            chartType: chart.chartType(),\n            studies: studies,\n          };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.011",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().setSymbol('AAPL', {}));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.012",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().symbol());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.013",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().setResolution('D', {}));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.014",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().resolution());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.015",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().setChartType(2));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.016",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().chartType());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.017",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().map(function(s) { return s.id; }));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.018",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().createStudy('Volume', false, false, []));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.019",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().map(function(s) { return s.id; }));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.020",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().removeEntity(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.021",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().map(function(s) { return s.id; }));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.022",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().createStudy('Volume', false, false, []));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.023",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().map(function(s) { return s.id; }));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.024",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().removeEntity(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.025",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().map(function(s) { return s.id; }));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.026",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getVisibleRange());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.027",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var m = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model();\n          var ts = m.timeScale();\n          var bars = m.mainSeries().bars();\n          var endIdx = bars.lastIndex();\n          var startIdx = Math.max(bars.firstIndex(), endIdx - 20);\n          ts.zoomToBarsRange(startIdx, endIdx);\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.028",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getVisibleRange());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.029",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().resolution());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.030",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var m = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model();\n          var ts = m.timeScale();\n          var bars = m.mainSeries().bars();\n          var midIdx = Math.floor((bars.firstIndex() + bars.lastIndex()) / 2);\n          ts.zoomToBarsRange(midIdx - 25, midIdx + 25);\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.031",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var chart = window.TradingViewApi._activeChartWidgetWV.value();\n          var ext = chart.symbolExt();\n          return {\n            symbol: ext.symbol,\n            full_name: ext.full_name,\n            exchange: ext.exchange,\n            description: ext.description,\n            type: ext.type,\n          };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.032",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var btn = document.querySelector('[aria-label=\"Change symbol\"]')\n                 || document.querySelector('[data-name=\"symbol-button\"]');\n          if (btn) btn.click();\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.033",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var rows = document.querySelectorAll('[data-role=\"list-item\"], .symbolRow-pnIJWxyD, .listRow, [class*=\"listRow\"]');\n          var out = [];\n          for (var i = 0; i < Math.min(rows.length, 5); i++) {\n            var symbolEl = rows[i].querySelector('[class*=\"symbolNameText\"], [class*=\"bold\"], .highlight-GZaJnFcP')\n                        || rows[i].querySelector('span:first-child');\n            if (symbolEl) out.push(symbolEl.textContent.trim());\n          }\n          return out;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.034",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          if (!bars || typeof bars.lastIndex !== 'function') return null;\n          var result = [];\n          var end = bars.lastIndex();\n          var start = Math.max(bars.firstIndex(), end - 4);\n          for (var i = start; i <= end; i++) {\n            var v = bars.valueAt(i);\n            if (v) result.push({time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0});\n          }\n          return {bars: result, total_bars: bars.size()};\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.035",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          if (!bars || typeof bars.lastIndex !== 'function') return null;\n          var result = [];\n          var end = bars.lastIndex();\n          var start = Math.max(bars.firstIndex(), end - 99);\n          for (var i = start; i <= end; i++) {\n            var v = bars.valueAt(i);\n            if (v) result.push({time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] || 0});\n          }\n          if (result.length === 0) return null;\n          var closes = result.map(function(b) { return b.close; });\n          var highs = result.map(function(b) { return b.high; });\n          var lows = result.map(function(b) { return b.low; });\n          var first = result[0], last = result[result.length - 1];\n          return {\n            bar_count: result.length,\n            open: first.open,\n            close: last.close,\n            high: Math.max.apply(null, highs),\n            low: Math.min.apply(null, lows),\n          };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.036",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s.metaInfo) continue;\n            try {\n              var dwv = s.dataWindowView();\n              if (!dwv) continue;\n              var items = dwv.items();\n              if (!items) continue;\n              var vals = {};\n              for (var j = 0; j < items.length; j++) {\n                if (items[j]._value && items[j]._value !== '∅' && items[j]._title) {\n                  vals[items[j]._title] = items[j]._value;\n                }\n              }\n              if (Object.keys(vals).length > 0) {\n                results.push({ name: s.metaInfo().description, values: vals });\n              }\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.037",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.038",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function() {\n          var study = window.TradingViewApi._activeChartWidgetWV.value().getStudyById(p0);\n          if (!study) return { error: 'not found' };\n          var result = {};\n          try { result.visible = study.isVisible(); } catch(e) {}\n          try { result.inputs = study.getInputValues(); } catch(e) {}\n          return result;\n        })());}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.039",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var coll = s._graphics._primitivesCollection.dwglines.get('lines').get(false);\n              if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {\n                var prices = [];\n                var seen = {};\n                coll._primitivesDataById.forEach(function(v) {\n                  var y = v.y1 != null && v.y1 === v.y2 ? Math.round(v.y1 * 100) / 100 : null;\n                  if (y != null && !seen[y]) { prices.push(y); seen[y] = true; }\n                });\n                prices.sort(function(a,b) { return b - a; });\n                var name = '';\n                try { name = s.metaInfo().description; } catch(e) {}\n                results.push({ name: name, horizontal_levels: prices });\n              }\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.040",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var coll = s._graphics._primitivesCollection.dwglabels.get('labels').get(false);\n              if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {\n                var labels = [];\n                coll._primitivesDataById.forEach(function(v) {\n                  if (v.t || v.y != null) labels.push({ text: v.t || '', price: v.y != null ? Math.round(v.y * 100) / 100 : null });\n                });\n                if (labels.length > 50) labels = labels.slice(-50);\n                var name = '';\n                try { name = s.metaInfo().description; } catch(e) {}\n                results.push({ name: name, labels: labels });\n              }\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.041",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var found = false;\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var coll = s._graphics._primitivesCollection.dwgtablecells.get('tableCells');\n              if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {\n                found = true;\n                break;\n              }\n            } catch(e) {}\n          }\n          return { path_accessible: true, has_data: found };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.042",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var coll = s._graphics._primitivesCollection.dwgboxes.get('boxes').get(false);\n              if (coll && coll._primitivesDataById && coll._primitivesDataById.size > 0) {\n                var zones = [];\n                coll._primitivesDataById.forEach(function(v) {\n                  if (v.y1 != null && v.y2 != null) {\n                    zones.push({ high: Math.max(v.y1, v.y2), low: Math.min(v.y1, v.y2) });\n                  }\n                });\n                var name = '';\n                try { name = s.metaInfo().description; } catch(e) {}\n                results.push({ name: name, zones: zones });\n              }\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.043",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          var result = { symbol: window.TradingViewApi._activeChartWidgetWV.value().symbol() };\n          if (bars && typeof bars.lastIndex === 'function') {\n            var last = bars.valueAt(bars.lastIndex());\n            if (last) {\n              result.time = last[0]; result.open = last[1]; result.high = last[2];\n              result.low = last[3]; result.close = last[4]; result.last = last[4];\n              result.volume = last[5] || 0;\n            }\n          }\n          return result;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.044",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var domPanel = document.querySelector('[class*=\"depth\"]')\n            || document.querySelector('[class*=\"orderBook\"]')\n            || document.querySelector('[data-name=\"dom\"]');\n          return { panel_found: !!domPanel };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.045",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.showWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.046",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var panel = document.querySelector('[data-name=\"backtesting\"]')\n            || document.querySelector('[class*=\"strategyReport\"]');\n          return { panel_found: !!panel };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.047",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.hideWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.048",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.showWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.049",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[data-name=\"backtesting\"]') || document.querySelector('[class*=\"strategyReport\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.050",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.hideWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.051",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.showWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.052",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[data-name=\"backtesting\"]') || document.querySelector('[class*=\"strategyReport\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.053",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.hideWidget('backtesting'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.054",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "async function(){for(var i=0;i<50;i++){if(document.querySelector('.monaco-editor.pine-editor-monaco'))return true;await new Promise(function(resolve){setTimeout(resolve,200);});}return false;}",
      "argument_names": [],
      "awaitPromise": true,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.055",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.hideWidget('pine-editor'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.056",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){/* chart.op.056 */return (!!document.querySelector('.monaco-editor.pine-editor-monaco'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.057",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bwb = window.TradingView && window.TradingView.bottomWidgetBar;\n          if (bwb && typeof bwb.activateScriptEditorTab === 'function') bwb.activateScriptEditorTab();\n          else if (bwb && typeof bwb.showWidget === 'function') bwb.showWidget('pine-editor');\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.058",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){/* chart.op.058 */return (!!document.querySelector('.monaco-editor.pine-editor-monaco'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.059",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var m = \n      (function findMonacoEditor() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        if (!container) return null;\n        var el = container;\n        var fiberKey;\n        for (var i = 0; i < 20; i++) {\n          if (!el) break;\n          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (fiberKey) break;\n          el = el.parentElement;\n        }\n        if (!fiberKey) return null;\n        var current = el[fiberKey];\n        for (var d = 0; d < 15; d++) {\n          if (!current) break;\n          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {\n            var env = current.memoizedProps.value.monacoEnv;\n            if (env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return { editor: editors[0], env: env };\n            }\n          }\n          current = current.return;\n        }\n        return null;\n      })()\n    ;\n          if (!m) return null;\n          return m.editor.getValue();\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.060",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function() {\n          var m = \n      (function findMonacoEditor() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        if (!container) return null;\n        var el = container;\n        var fiberKey;\n        for (var i = 0; i < 20; i++) {\n          if (!el) break;\n          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (fiberKey) break;\n          el = el.parentElement;\n        }\n        if (!fiberKey) return null;\n        var current = el[fiberKey];\n        for (var d = 0; d < 15; d++) {\n          if (!current) break;\n          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {\n            var env = current.memoizedProps.value.monacoEnv;\n            if (env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return { editor: editors[0], env: env };\n            }\n          }\n          current = current.return;\n        }\n        return null;\n      })()\n    ;\n          if (!m) return false;\n          m.editor.setValue(p0);\n          return true;\n        })());}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.061",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() { var m = \n      (function findMonacoEditor() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        if (!container) return null;\n        var el = container;\n        var fiberKey;\n        for (var i = 0; i < 20; i++) {\n          if (!el) break;\n          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (fiberKey) break;\n          el = el.parentElement;\n        }\n        if (!fiberKey) return null;\n        var current = el[fiberKey];\n        for (var d = 0; d < 15; d++) {\n          if (!current) break;\n          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {\n            var env = current.memoizedProps.value.monacoEnv;\n            if (env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return { editor: editors[0], env: env };\n            }\n          }\n          current = current.return;\n        }\n        return null;\n      })()\n    ; return m ? m.editor.getValue() : null; })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.062",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var btns = document.querySelectorAll('button');\n          var found = [];\n          for (var i = 0; i < btns.length; i++) {\n            var text = btns[i].textContent.trim();\n            if (/add to chart|update on chart|save and add/i.test(text)) {\n              found.push(text);\n            }\n          }\n          return found;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.063",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var m = \n      (function findMonacoEditor() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        if (!container) return null;\n        var el = container;\n        var fiberKey;\n        for (var i = 0; i < 20; i++) {\n          if (!el) break;\n          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (fiberKey) break;\n          el = el.parentElement;\n        }\n        if (!fiberKey) return null;\n        var current = el[fiberKey];\n        for (var d = 0; d < 15; d++) {\n          if (!current) break;\n          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {\n            var env = current.memoizedProps.value.monacoEnv;\n            if (env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return { editor: editors[0], env: env };\n            }\n          }\n          current = current.return;\n        }\n        return null;\n      })()\n    ;\n          if (!m) return [];\n          var model = m.editor.getModel();\n          if (!model) return [];\n          return m.env.editor.getModelMarkers({ resource: model.uri }).length;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.064",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var m = \n      (function findMonacoEditor() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        if (!container) return null;\n        var el = container;\n        var fiberKey;\n        for (var i = 0; i < 20; i++) {\n          if (!el) break;\n          fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (fiberKey) break;\n          el = el.parentElement;\n        }\n        if (!fiberKey) return null;\n        var current = el[fiberKey];\n        for (var d = 0; d < 15; d++) {\n          if (!current) break;\n          if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {\n            var env = current.memoizedProps.value.monacoEnv;\n            if (env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return { editor: editors[0], env: env };\n            }\n          }\n          current = current.return;\n        }\n        return null;\n      })()\n    ;\n          if (!m) return [];\n          var model = m.editor.getModel();\n          if (!model) return [];\n          return m.env.editor.getModelMarkers({ resource: model.uri }).map(function(mk) {\n            return { line: mk.startLineNumber, message: mk.message, severity: mk.severity };\n          });\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.065",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var rows = document.querySelectorAll('[class*=\"consoleRow\"], [class*=\"log-\"], [class*=\"consoleLine\"]');\n          return rows.length;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.066",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[class*=\"pine-editor\"] [class*=\"toolbar\"]')\n          || document.querySelector('[class*=\"editorToolbar\"]')\n          || document.querySelector('[class*=\"layout__area--bottom\"] [class*=\"toolbar\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.067",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!document.querySelector('[class*=\"layout__area--bottom\"]'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.068",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var area = document.querySelector('[class*=\"layout__area--bottom\"]');\n          return area ? area.querySelectorAll('button').length : 0;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.069",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().removeAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.070",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          var last = bars.valueAt(bars.lastIndex());\n          return last ? { time: last[0], price: last[4] } : null;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.071",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0,p1){return ((function() {\n          var api = window.TradingViewApi._activeChartWidgetWV.value();\n          var id = api.createShape(\n            { time: p0, price: p1 },\n            { shape: 'horizontal_line', overrides: {} }\n          );\n          return { entity_id: id };\n        })());}",
      "argument_names": [
        "p0",
        "p1"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.072",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var all = window.TradingViewApi._activeChartWidgetWV.value().getAllShapes();\n          return all.map(function(s) { return { id: s.id, name: s.name }; });\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.073",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.074",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function() {\n          var api = window.TradingViewApi._activeChartWidgetWV.value();\n          var shape = api.getShapeById(p0);\n          if (!shape) return { error: 'not found' };\n          var props = {};\n          try { props.points = shape.getPoints(); } catch(e) {}\n          try { props.visible = shape.isVisible(); } catch(e) {}\n          return props;\n        })());}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.075",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.076",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().removeEntity(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.077",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.078",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          var last = bars.valueAt(bars.lastIndex());\n          return last ? { time: last[0], price: last[4] } : null;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.079",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0,p1){return (window.TradingViewApi._activeChartWidgetWV.value().createShape({ time: p0, price: p1 }, { shape: 'horizontal_line' }));}",
      "argument_names": [
        "p0",
        "p1"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.080",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().removeAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.081",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllShapes());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.082",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          // Find any visible button we can safely click (like a toolbar button)\n          var el = document.querySelector('[aria-label=\"Undo\"]');\n          return { found: !!el };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.083",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingView.bottomWidgetBar.showWidget('pine-editor'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.084",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){/* chart.op.084 */return (!!document.querySelector('.monaco-editor.pine-editor-monaco'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.085",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bwb = window.TradingView.bottomWidgetBar;\n          if (typeof bwb.hideWidget === 'function') return bwb.hideWidget('pine-editor');\n          if (typeof bwb.hide === 'function') return bwb.hide();\n          if (typeof bwb.close === 'function') return bwb.close();\n          return null;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.086",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!document.querySelector('[data-name=\"header-toolbar-fullscreen\"]'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.087",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var el = document.querySelector('button');\n          if (!el) return null;\n          var rect = el.getBoundingClientRect();\n          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.088",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var el = document.querySelector('canvas');\n          if (!el) return { x: 500, y: 400 };\n          var rect = el.getBoundingClientRect();\n          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.089",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var el = document.querySelector('canvas');\n          if (!el) return { x: 500, y: 400 };\n          var rect = el.getBoundingClientRect();\n          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.090",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var found = [];\n          var all = document.querySelectorAll('button');\n          for (var i = 0; i < all.length && found.length < 5; i++) {\n            var text = all[i].textContent.trim();\n            if (text && text.length < 50 && all[i].offsetParent !== null) {\n              found.push({ text: text, tag: 'button' });\n            }\n          }\n          return found;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.091",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (1 + 1);}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.092",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[data-name=\"save-load-menu\"]')\n          || document.querySelector('[aria-label=\"Manage layouts\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.093",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[data-name=\"save-load-menu\"]')\n          || document.querySelector('[aria-label=\"Manage layouts\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.094",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.095",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.stopReplay());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.096",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.goToRealtime());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.097",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.hideReplayToolbar());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.098",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayAvailable();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.099",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.showReplayToolbar());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.100",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.selectFirstAvailableDate());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.101",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.102",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.103",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.doStep());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.104",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.currentDate();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.105",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.106",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.toggleAutoplay());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.107",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isAutoplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.108",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.toggleAutoplay());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.109",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.110",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.buy());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.111",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.position();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.112",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._replayApi.closePosition());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.113",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var r = window.TradingViewApi._replayApi;\n          function unwrap(v) { return (v && typeof v === 'object' && typeof v.value === 'function') ? v.value() : v; }\n          return {\n            is_replay_available: unwrap(r.isReplayAvailable()),\n            is_replay_started: unwrap(r.isReplayStarted()),\n          };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.114",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.115",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() { window.TradingViewApi._replayApi.stopReplay(); return true; })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.116",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() { window.TradingViewApi._replayApi.goToRealtime(); return true; })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.117",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() { window.TradingViewApi._replayApi.hideReplayToolbar(); return true; })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.118",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function(){var v=window.TradingViewApi._replayApi.isReplayStarted();return(v&&typeof v==='object'&&typeof v.value==='function')?v.value():v;})());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.119",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!(document.querySelector('[aria-label=\"Create Alert\"]')\n          || document.querySelector('[data-name=\"alerts\"]')));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.120",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var result = [];\n          var els = document.querySelectorAll('[class*=\"alert-item\"], [class*=\"alertItem\"], [class*=\"listItem\"]');\n          els.forEach(function(item) {\n            var text = item.textContent.trim();\n            if (text) result.push(text.substring(0, 100));\n          });\n          return result;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.121",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (!!document.querySelector('[data-name=\"alerts\"]'));}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.122",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var btn = document.querySelector('[data-name=\"base-watchlist-widget-button\"]')\n            || document.querySelector('[aria-label=\"Watchlist\"]');\n          if (btn) btn.click();\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.123",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var results = [];\n          var symbolEls = document.querySelectorAll('[data-symbol-full]');\n          for (var i = 0; i < Math.min(symbolEls.length, 10); i++) {\n            var sym = symbolEls[i].getAttribute('data-symbol-full');\n            if (sym) results.push(sym);\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.124",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var btn = document.querySelector('[data-name=\"add-symbol-button\"]');\n          if (btn) return 'data-name';\n          var container = document.querySelector('[data-name=\"symbol-list-wrap\"]')\n            || document.querySelector('[class*=\"layout__area--right\"]');\n          if (container) {\n            var buttons = container.querySelectorAll('button');\n            for (var i = 0; i < buttons.length; i++) {\n              var ariaLabel = buttons[i].getAttribute('aria-label') || '';\n              if (/add.*symbol/i.test(ariaLabel)) return 'aria-label';\n            }\n          }\n          return null;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.125",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.126",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function() {\n          var study = window.TradingViewApi._activeChartWidgetWV.value().getStudyById(p0);\n          if (!study) return { error: 'not found' };\n          var was = study.isVisible();\n          study.setVisible(!was);\n          var now = study.isVisible();\n          study.setVisible(was); // restore\n          return { was: was, toggled: now, restored: study.isVisible() };\n        })());}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.127",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().getAllStudies());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.128",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function() {\n          var study = window.TradingViewApi._activeChartWidgetWV.value().getStudyById(p0);\n          if (!study) return { error: 'not found' };\n          var inputs = study.getInputValues();\n          return { input_count: inputs.length, first_input: inputs[0] || null };\n        })());}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.129",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (window.TradingViewApi._activeChartWidgetWV.value().symbol());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.130",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (typeof window.TradingViewApi._activeChartWidgetWV.value().setSymbol === 'function');}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.131",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return (typeof window.TradingViewApi._activeChartWidgetWV.value().setResolution === 'function');}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.132",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var el = document.querySelector('[data-name=\"pane-canvas\"]')\n            || document.querySelector('canvas');\n          if (!el) return null;\n          var rect = el.getBoundingClientRect();\n          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.133",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          var result = { symbol: window.TradingViewApi._activeChartWidgetWV.value().symbol() };\n          var last = bars.valueAt(bars.lastIndex());\n          if (last) {\n            result.time = last[0]; result.open = last[1]; result.high = last[2];\n            result.low = last[3]; result.close = last[4]; result.volume = last[5] || 0;\n          }\n          var ext = {};\n          try { ext = window.TradingViewApi._activeChartWidgetWV.value().symbolExt(); } catch(e) {}\n          if (ext.description) result.description = ext.description;\n          if (ext.exchange) result.exchange = ext.exchange;\n          return result;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.134",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s.metaInfo) continue;\n            try {\n              var dwv = s.dataWindowView();\n              if (!dwv) continue;\n              var items = dwv.items();\n              if (!items) continue;\n              var vals = {};\n              for (var j = 0; j < items.length; j++) {\n                if (items[j]._value && items[j]._value !== '∅' && items[j]._title) {\n                  vals[items[j]._title] = items[j]._value;\n                }\n              }\n              if (Object.keys(vals).length > 0) {\n                results.push({ name: s.metaInfo().description, values: vals });\n              }\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.135",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var name = s.metaInfo().description || '';\n              var coll = s._graphics._primitivesCollection.dwglines.get('lines').get(false);\n              if (!coll || !coll._primitivesDataById || coll._primitivesDataById.size === 0) continue;\n              var seen = {}, prices = [];\n              coll._primitivesDataById.forEach(function(v) {\n                var y = v.y1 != null && v.y1 === v.y2 ? Math.round(v.y1 * 100) / 100 : null;\n                if (y != null && !seen[y]) { prices.push(y); seen[y] = true; }\n              });\n              prices.sort(function(a,b) { return b - a; });\n              results.push({ name: name, horizontal_levels: prices });\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.136",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var sources = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().model().dataSources();\n          var results = [];\n          for (var i = 0; i < sources.length; i++) {\n            var s = sources[i];\n            if (!s._graphics || !s._graphics._primitivesCollection) continue;\n            try {\n              var name = s.metaInfo().description || '';\n              var coll = s._graphics._primitivesCollection.dwglabels.get('labels').get(false);\n              if (!coll || !coll._primitivesDataById || coll._primitivesDataById.size === 0) continue;\n              var labels = [];\n              coll._primitivesDataById.forEach(function(v) {\n                if (v.t || v.y != null) labels.push({ text: v.t || '', price: v.y != null ? Math.round(v.y * 100) / 100 : null });\n              });\n              if (labels.length > 50) labels = labels.slice(-50);\n              results.push({ name: name, labels: labels });\n            } catch(e) {}\n          }\n          return results;\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.137",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n          var bars = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars();\n          if (!bars) return null;\n          var result = [];\n          var end = bars.lastIndex();\n          var start = Math.max(bars.firstIndex(), end - 99);\n          for (var i = start; i <= end; i++) {\n            var v = bars.valueAt(i);\n            if (v) result.push({o: v[1], h: v[2], l: v[3], c: v[4], vol: v[5] || 0});\n          }\n          if (result.length === 0) return null;\n          var first = result[0], last = result[result.length - 1];\n          return {\n            bar_count: result.length,\n            open: first.o, close: last.c,\n            high: Math.max.apply(null, result.map(function(b) { return b.h; })),\n            low: Math.min.apply(null, result.map(function(b) { return b.l; })),\n          };\n        })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.138",
    "kind": "read",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n      var chart = window.TradingViewApi._activeChartWidgetWV.value();\n      var replay = window.TradingViewApi._replayApi;\n      function unwrap(v) { return v && typeof v.value === 'function' ? v.value() : v; }\n      function pineSource() {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        var el = container;\n        for (var i = 0; el && i < 20; i++, el = el.parentElement) {\n          var key = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (!key) continue;\n          for (var fiber = el[key], d = 0; fiber && d < 15; fiber = fiber.return, d++) {\n            var env = fiber.memoizedProps && fiber.memoizedProps.value && fiber.memoizedProps.value.monacoEnv;\n            if (env && env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) return editors[0].getValue();\n            }\n          }\n        }\n        return null;\n      }\n      return {\n        symbol: chart.symbol(), resolution: chart.resolution(), chartType: chart.chartType(),\n        replayStarted: !!unwrap(replay.isReplayStarted()),\n        pineOpen: !!document.querySelector('.monaco-editor.pine-editor-monaco'),\n        pineSource: pineSource(),\n      };\n    })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_read_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.139",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setSymbol(p0, {}));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.140",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setResolution(p0, {}));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.141",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return (window.TradingViewApi._activeChartWidgetWV.value().setChartType(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.142",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){return ((function() {\n        var r = window.TradingViewApi._replayApi;\n        try { r.stopReplay(); } catch(e) {}\n        try { r.goToRealtime(); } catch(e) {}\n        try { r.hideReplayToolbar(); } catch(e) {}\n      })());}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.143",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(){try { window.TradingView.bottomWidgetBar.hideWidget('pine-editor'); } catch(e) {};return null;}",
      "argument_names": [],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.op.144",
    "kind": "mutation",
    "method": "Runtime.callFunctionOn",
    "params": {
      "functionDeclaration": "function(p0){return ((function(source) {\n        var container = document.querySelector('.monaco-editor.pine-editor-monaco');\n        for (var el = container, i = 0; el && i < 20; i++, el = el.parentElement) {\n          var key = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });\n          if (!key) continue;\n          for (var fiber = el[key], d = 0; fiber && d < 15; fiber = fiber.return, d++) {\n            var env = fiber.memoizedProps && fiber.memoizedProps.value && fiber.memoizedProps.value.monacoEnv;\n            if (env && env.editor && typeof env.editor.getEditors === 'function') {\n              var editors = env.editor.getEditors();\n              if (editors.length > 0) { editors[0].setValue(source); return true; }\n            }\n          }\n        }\n        return false;\n      })(p0));}",
      "argument_names": [
        "p0"
      ],
      "awaitPromise": false,
      "returnByValue": true
    },
    "budget_key": "cdp_mutation_count",
    "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.insert_aapl", "kind": "input", "method": "insertText",
    "params": { "argument_names": [], "request": { "text": "AAPL" } },
    "budget_key": "text_input_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.escape_down", "kind": "input", "method": "dispatchKeyEvent",
    "params": { "argument_names": [], "request": { "type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27 } },
    "budget_key": "key_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.escape_up", "kind": "input", "method": "dispatchKeyEvent",
    "params": { "argument_names": [], "request": { "type": "keyUp", "key": "Escape", "code": "Escape" } },
    "budget_key": "key_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.save_down", "kind": "input", "method": "dispatchKeyEvent",
    "params": { "argument_names": [], "request": { "type": "keyDown", "modifiers": 2, "key": "s", "code": "KeyS", "windowsVirtualKeyCode": 83 } },
    "budget_key": "ctrl_s_chord_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.save_up", "kind": "input", "method": "dispatchKeyEvent",
    "params": { "argument_names": [], "request": { "type": "keyUp", "key": "s", "code": "KeyS" } },
    "budget_key": "key_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.mouse_move", "kind": "input", "method": "dispatchMouseEvent",
    "params": { "argument_names": ["x", "y"], "request": { "type": "mouseMoved", "x": { "$argument": "x" }, "y": { "$argument": "y" } } },
    "budget_key": "mouse_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.mouse_wheel", "kind": "input", "method": "dispatchMouseEvent",
    "params": { "argument_names": ["x", "y"], "request": { "type": "mouseWheel", "x": { "$argument": "x" }, "y": { "$argument": "y" }, "deltaX": 0, "deltaY": 100 } },
    "budget_key": "mouse_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.mouse_press", "kind": "input", "method": "dispatchMouseEvent",
    "params": { "argument_names": ["x", "y"], "request": { "type": "mousePressed", "x": { "$argument": "x" }, "y": { "$argument": "y" }, "button": "left", "clickCount": 1 } },
    "budget_key": "mouse_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.input.mouse_release", "kind": "input", "method": "dispatchMouseEvent",
    "params": { "argument_names": ["x", "y"], "request": { "type": "mouseReleased", "x": { "$argument": "x" }, "y": { "$argument": "y" }, "button": "left" } },
    "budget_key": "mouse_event_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.capture.full_png", "kind": "capture", "method": "captureScreenshot",
    "params": { "argument_names": [], "request": { "format": "png" } },
    "budget_key": "capture_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.capture.clip_png", "kind": "capture", "method": "captureScreenshot",
    "params": { "argument_names": ["height", "width", "x", "y"], "request": { "format": "png", "clip": { "x": { "$argument": "x" }, "y": { "$argument": "y" }, "width": { "$argument": "width" }, "height": { "$argument": "height" }, "scale": 1 } } },
    "budget_key": "capture_count", "result_schema": "json_value_v1"
  },
  {
    "id": "chart.network.pine_check", "kind": "network", "method": "POST",
    "params": { "argument_names": [], "request": { "url": "https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000", "options": { "method": "POST", "headers": { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.tradingview.com/" }, "body": "source=%2F%2F%40version%3D6%0Aindicator%28%22API+Test%22%2C+overlay%3Dtrue%29%0Aplot%28close%29" } } },
    "budget_key": "pine_facade_post_count", "result_schema": "json_value_v1"
  }
];

function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }
function canonicalJson(value){if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';return JSON.stringify(value);}
export const CHART_OPERATION_REGISTRY=deepFreeze(Object.fromEntries(DEFINITIONS.map(({id,...entry})=>[id,entry])));
export const CHART_OPERATION_REGISTRY_SHA256=createHash('sha256').update(canonicalJson(CHART_OPERATION_REGISTRY)).digest('hex');
class ChartOperationError extends Error{constructor(code){super(code);this.name='ChartOperationError';this.code=code;}}
const fail=code=>new ChartOperationError(code);
function exactArgs(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||utilTypes.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;let d;try{d=Object.getOwnPropertyDescriptors(value)}catch{return false}const keys=Reflect.ownKeys(d).sort();return keys.length===names.length&&keys.every((k,i)=>k===names[i])&&keys.every(k=>d[k].enumerable&&Object.hasOwn(d[k],'value'));}
function safeValue(value) {
  const seen = new Set();
  let nodes = 0;
  let units = 0;
  function visit(current, depth) {
    if (current === null || typeof current === 'boolean' || typeof current === 'undefined') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw fail('CHART_OPERATION_RESULT_INVALID');
      return current;
    }
    if (typeof current === 'string') {
      units += current.length;
      if (units > 1_100_000) throw fail('CHART_OPERATION_RESULT_INVALID');
      return current;
    }
    if (typeof current !== 'object' || utilTypes.isProxy(current) || seen.has(current)
      || depth > 8 || ++nodes > 2_048) throw fail('CHART_OPERATION_RESULT_INVALID');
    seen.add(current);
    const array = Array.isArray(current);
    const prototype = Object.getPrototypeOf(current);
    if (!array && prototype !== Object.prototype && prototype !== null) {
      throw fail('CHART_OPERATION_RESULT_INVALID');
    }
    const descriptors = Object.getOwnPropertyDescriptors(current);
    const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
    if (keys.some(key => typeof key !== 'string')
      || keys.some(key => !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value'))
      || (array && (keys.length !== current.length || keys.some((key, index) => key !== String(index))))) {
      throw fail('CHART_OPERATION_RESULT_INVALID');
    }
    const output = array ? [] : {};
    for (const key of keys) output[key] = visit(descriptors[key].value, depth + 1);
    return Object.freeze(output);
  }
  return visit(value, 0);
}
function adapters(value){for(const k of ['capture','input','mutate','network','read'])if(typeof value?.[k]!=='function')throw fail('CHART_OPERATION_CONFIGURATION_INVALID');return value;}
function materialize(value, args) {
  if (Array.isArray(value)) return value.map(item => materialize(item, args));
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '$argument') return args[value.$argument];
  return Object.fromEntries(keys.map(key => [key, materialize(value[key], args)]));
}
function safeArgument(value) {
  try { return safeValue(value); } catch { throw fail('CHART_OPERATION_ARGUMENT_INVALID'); }
}
export function createChartOperationBridge({reviewedAdapters}={}) {
  const a = adapters(reviewedAdapters);
  return Object.freeze({
    async execute(operationId, args={}) {
      const op = CHART_OPERATION_REGISTRY[operationId];
      if (!op) throw fail('CHART_OPERATION_DENIED');
      const names = op.params.argument_names;
      if (!exactArgs(args, names)) throw fail('CHART_OPERATION_ARGUMENT_INVALID');
      const cleanArgs = Object.fromEntries(names.map(name => [name, safeArgument(args[name])]));
      try {
        let raw;
        if (op.kind === 'read' || op.kind === 'mutation') {
          const {argument_names, ...fixed} = op.params;
          const argumentsList = names.map(name => Object.freeze({value: cleanArgs[name]}));
          const params = {...structuredClone(fixed), arguments: structuredClone(argumentsList)};
          raw = op.kind === 'read'
            ? await a.read(op.method, params)
            : await a.mutate(op.method, params);
        } else {
          const request = materialize(op.params.request, cleanArgs);
          if (op.kind === 'input') raw = await a.input(op.method, request);
          else if (op.kind === 'capture') raw = await a.capture(op.method, request);
          else if (op.kind === 'network') raw = await a.network(request);
          else throw fail('CHART_OPERATION_DENIED');
        }
        const value = raw && typeof raw === 'object' && raw.result && typeof raw.result === 'object'
          && Object.hasOwn(raw.result, 'value') ? raw.result.value : raw;
        return safeValue(value);
      } catch(error) {
        if (error instanceof ChartOperationError) throw error;
        throw fail('CHART_OPERATION_EXECUTION_FAILED');
      }
    },
  });
}
