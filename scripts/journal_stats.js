#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(process.argv[1] || 'scripts/journal_stats.js');
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const tradesDir = path.join(repoRoot, 'journal', 'trades');
const statsDir = path.join(repoRoot, 'journal', 'stats');
const statsPath = path.join(statsDir, 'setup_stats.json');

function roundMetric(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value * 10000) / 10000;
}

function makeEmptyStats() {
    return {
        generated_at: new Date().toISOString(),
        group_by: ['setup', 'market', 'mode'],
        stats: {},
    };
}

function listTradeFiles() {
    if (!fs.existsSync(tradesDir)) {
        return [];
    }

    return fs.readdirSync(tradesDir)
        .filter((name) => name.endsWith('.jsonl'))
        .sort()
        .map((name) => path.join(tradesDir, name));
}

function readTrades() {
    const trades = [];

    for (const filePath of listTradeFiles()) {
        const relPath = path.relative(repoRoot, filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                return;
            }

            try {
                trades.push(JSON.parse(trimmed));
            } catch (error) {
                console.warn(`Warning: skipping invalid JSON in ${relPath}:${index + 1} (${error.message})`);
            }
        });
    }

    return trades;
}

function ensureGroup(acc, setup, market, mode) {
    if (!acc[setup]) {
        acc[setup] = {};
    }
    if (!acc[setup][market]) {
        acc[setup][market] = {};
    }
    if (!acc[setup][market][mode]) {
        acc[setup][market][mode] = {
            n: 0,
            wins: 0,
            sum_r: 0,
            followed_plan: 0,
        };
    }
    return acc[setup][market][mode];
}

function aggregateTrades(trades) {
    const acc = {};

    for (const trade of trades) {
        const setup = trade.setup || 'unknown';
        const market = trade.market || 'unknown';
        const mode = trade.mode || 'unknown';
        const rMultiple = Number(trade.r_multiple);
        const r = Number.isFinite(rMultiple) ? rMultiple : 0;
        const group = ensureGroup(acc, setup, market, mode);

        group.n += 1;
        group.wins += r > 0 ? 1 : 0;
        group.sum_r += r;
        group.followed_plan += trade.followed_plan === true ? 1 : 0;
    }

    const stats = {};
    for (const setup of Object.keys(acc).sort()) {
        stats[setup] = {};
        for (const market of Object.keys(acc[setup]).sort()) {
            stats[setup][market] = {};
            for (const mode of Object.keys(acc[setup][market]).sort()) {
                const group = acc[setup][market][mode];
                const avgR = group.n > 0 ? group.sum_r / group.n : 0;

                stats[setup][market][mode] = {
                    n: group.n,
                    wins: group.wins,
                    win_rate: roundMetric(group.n > 0 ? group.wins / group.n : 0),
                    avg_r: roundMetric(avgR),
                    expectancy: roundMetric(avgR),
                    plan_adherence: roundMetric(group.n > 0 ? group.followed_plan / group.n : 0),
                };
            }
        }
    }

    return stats;
}

function writeStats(stats) {
    fs.mkdirSync(statsDir, { recursive: true });
    const payload = {
        generated_at: new Date().toISOString(),
        group_by: ['setup', 'market', 'mode'],
        stats,
    };

    fs.writeFileSync(statsPath, `${JSON.stringify(payload, null, 2)}\n`);
    return payload;
}

function pad(value, width) {
    return String(value).padEnd(width, ' ');
}

function formatPct(value) {
    return `${(value * 100).toFixed(2)}%`;
}

function printTable(stats) {
    const rows = [];

    for (const setup of Object.keys(stats).sort()) {
        for (const market of Object.keys(stats[setup]).sort()) {
            for (const mode of Object.keys(stats[setup][market]).sort()) {
                const metric = stats[setup][market][mode];
                rows.push([
                    setup,
                    market,
                    mode,
                    metric.n,
                    metric.wins,
                    formatPct(metric.win_rate),
                    metric.avg_r.toFixed(4),
                    metric.expectancy.toFixed(4),
                    formatPct(metric.plan_adherence),
                ]);
            }
        }
    }

    if (rows.length === 0) {
        console.log('No trades recorded yet.');
        return;
    }

    const headers = ['setup', 'market', 'mode', 'n', 'wins', 'win_rate', 'avg_r', 'expectancy', 'plan_adherence'];
    const widths = headers.map((header, index) => {
        return Math.max(header.length, ...rows.map((row) => String(row[index]).length));
    });

    console.log(headers.map((header, index) => pad(header, widths[index])).join('  '));
    console.log(widths.map((width) => '-'.repeat(width)).join('  '));
    rows.forEach((row) => {
        console.log(row.map((value, index) => pad(value, widths[index])).join('  '));
    });
}

const trades = readTrades();
if (trades.length === 0) {
    const emptyStats = makeEmptyStats();
    fs.mkdirSync(statsDir, { recursive: true });
    fs.writeFileSync(statsPath, `${JSON.stringify(emptyStats, null, 2)}\n`);
    console.log('No trades recorded yet.');
} else {
    const stats = aggregateTrades(trades);
    writeStats(stats);
    printTable(stats);
}
