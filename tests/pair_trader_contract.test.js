import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function frontmatterTools(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  assert.ok(match, 'missing frontmatter');

  const lines = match[1].split('\n');
  const toolsIndex = lines.findIndex(line => line === 'tools:');
  assert.notEqual(toolsIndex, -1, 'missing tools frontmatter');

  const tools = [];
  for (const line of lines.slice(toolsIndex + 1)) {
    const item = line.match(/^  - (.+)$/);
    if (!item) break;
    tools.push(item[1]);
  }
  return tools;
}

function markdownSection(source, heading) {
  const start = source.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const next = source.indexOf('\n## ', start + 4);
  return source.slice(start, next === -1 ? source.length : next);
}

const orchestrator = read('.claude/agents/pair-trader-orchestrator.md');
const watcher = read('.claude/agents/market-watcher.md');
const command = read('.claude/commands/pair-session.md');
const docs = read('docs/pair-trader.md');
const setupAnalyst = read('.claude/agents/setup-analyst.md');
const riskOfficer = read('.claude/agents/risk-officer.md');

describe('Pair-Trader contract closure', () => {
  it('pins the exact orchestrator and watcher tool boundaries', () => {
    assert.deepEqual(frontmatterTools(orchestrator), [
      'Read',
      'Agent(market-watcher, setup-analyst, risk-officer, journal-scribe)',
      'mcp__tradingview__tv_health_check',
      'mcp__tradingview__chart_set_symbol',
      'mcp__tradingview__chart_set_timeframe',
      'mcp__tradingview__chart_get_state',
      'mcp__tradingview__capture_screenshot',
    ]);
    assert.deepEqual(frontmatterTools(watcher), [
      'mcp__tradingview__chart_get_state',
      'mcp__tradingview__quote_get',
      'mcp__tradingview__data_get_study_values',
      'mcp__tradingview__data_get_pine_labels',
      'mcp__tradingview__data_get_pine_lines',
      'mcp__tradingview__data_get_pine_tables',
      'mcp__tradingview__data_get_ohlcv',
    ]);
  });

  it('initializes the zero summary before health and defines bounded zero-cycle end', () => {
    const zeroSummary = '{"judgement_count":0,"verdict_counts":{"GO":0,"WAIT":0,"NO-GO":0},"judgement_ids":[]}';
    const startup = command.indexOf('## Startup');
    const summaryIndex = command.indexOf(zeroSummary);
    const healthIndex = command.indexOf('tv_health_check', startup);

    assert.ok(summaryIndex >= 0, 'missing exact zero summary initialization');
    assert.ok(summaryIndex < healthIndex, 'summary initialization must precede health');
    assert.match(command, /bounded\s+`end` after a health failure or zero completed cycles[\s\S]*zero summary[\s\S]*without calling health, chart, registry, tools, or workers/i);
    assert.match(orchestrator, /initialize[\s\S]*zero summary[\s\S]*before[\s\S]*tool/i);
  });

  it('gates bounded start and next health before registry, chart, or agent reads', () => {
    const gate = markdownSection(command, 'Bounded Start/Next Gate');
    const contractRead = gate.indexOf('Read this command contract');
    const zeroInitialization = gate.indexOf('Initialize the exact zero');
    const health = gate.indexOf('mcp__tradingview__tv_health_check');

    assert.ok(contractRead >= 0, 'missing required command-contract Read');
    assert.ok(contractRead < zeroInitialization, 'command contract must be read before zero initialization');
    assert.ok(zeroInitialization < health, 'health must follow zero initialization');
    assert.match(gate, /very next tool call MUST be `mcp__tradingview__tv_health_check`/);
    assert.match(gate, /Bounded `next` always performs this fresh health check before any Watch Cycle read/);
    assert.match(gate, /MUST NOT read `.claude\/agents\/\*\.md`[\s\S]*`journal\/registry\.json`[\s\S]*chart state[\s\S]*MUST NOT call Agent or[\s\S]*any other MCP tool/i);
    assert.match(gate, /Bounded `end`[\s\S]*perform no Read and no tool call/i);

    const agentRead = orchestrator.indexOf('.claude/commands/pair-session.md');
    const agentZero = orchestrator.indexOf('Immediately initialize');
    const agentHealth = orchestrator.indexOf('mcp__tradingview__tv_health_check', agentZero);
    assert.ok(agentRead >= 0 && agentRead < agentZero && agentZero < agentHealth);
    assert.match(orchestrator, /MAIN never pre-reads project agent markdown[\s\S]*already loaded by the runtime/i);
    assert.match(orchestrator, /For `end`[\s\S]*do not Read any file and do not call any tool/i);
  });

  it('pins the exact bounded final object and forbids aliases, prose, and fences', () => {
    const finalSection = markdownSection(command, 'Bounded Final Object');
    assert.equal((command.match(/^## Bounded Final Object$/gm) || []).length, 1);
    assert.match(finalSection, /one raw JSON object[\s\S]*no prose,\s*heading,\s*markdown fence,\s*alias,\s*or extra field/i);

    const exampleMatch = finalSection.match(/```json\n([^\n]+)\n```/);
    assert.ok(exampleMatch, 'missing canonical bounded final JSON object');
    const example = JSON.parse(exampleMatch[1]);
    const exactKeys = [
      'action',
      'cycle_id',
      'cycle_seq',
      'status',
      'cycle_completed',
      'health',
      'snapshot_status',
      'registry_status',
      'journal_status',
      'judgement_id',
      'analysis_mode',
      'ended',
      'summary',
    ];
    assert.deepEqual(Object.keys(example), exactKeys);
    assert.equal(example.action, 'start');
    assert.equal(example.cycle_seq, 1);
    assert.deepEqual({
      status: example.status,
      cycle_completed: example.cycle_completed,
      health: example.health,
      snapshot_status: example.snapshot_status,
      registry_status: example.registry_status,
      journal_status: example.journal_status,
      judgement_id: example.judgement_id,
      analysis_mode: example.analysis_mode,
      ended: example.ended,
    }, {
      status: 'health_failed',
      cycle_completed: false,
      health: 'failed',
      snapshot_status: 'not_applicable',
      registry_status: 'not_checked',
      journal_status: 'not_applicable',
      judgement_id: null,
      analysis_mode: 'not_applicable',
      ended: false,
    });
    assert.deepEqual(Object.keys(example.summary), [
      'judgement_count', 'verdict_counts', 'judgement_ids',
    ]);
    assert.deepEqual(Object.keys(example.summary.verdict_counts), ['GO', 'WAIT', 'NO-GO']);
    assert.deepEqual(example.summary, {
      judgement_count: 0,
      verdict_counts: { GO: 0, WAIT: 0, 'NO-GO': 0 },
      judgement_ids: [],
    });
    for (const forbidden of ['required_cycle_id', 'required_cycle_seq', 'session_summary', 'note']) {
      assert.equal(Object.hasOwn(example, forbidden), false, `${forbidden} must not be an output key`);
    }
    assert.match(finalSection, /`required_cycle_id` and `required_cycle_seq` are input names only/i);
    assert.match(finalSection, /Copy their\s+values exactly to output `cycle_id` and `cycle_seq`/i);
    assert.match(finalSection, /`session_summary` and `note` are forbidden output keys/i);
    assert.match(finalSection, /verdict counts sum to `judgement_count`[\s\S]*length of `judgement_ids` equals `judgement_count`[\s\S]*unique nonempty string/i);

    for (const source of [orchestrator, docs]) {
      assert.match(source, /one raw JSON object only[\s\S]*no prose,\s*heading,\s*markdown fence,\s*alias,\s*or extra field/i);
      assert.match(source, /`action`[\s\S]*`cycle_id`[\s\S]*`cycle_seq`[\s\S]*`summary`/i);
      assert.match(source, /`session_summary` and `note`[\s\S]*forbidden/i);
    }
  });

  it('separates no_signal from live_ineligible in main state mapping', () => {
    for (const source of [orchestrator, command, docs]) {
      assert.match(source, /outside `forming\|triggered`[\s\S]*`no_signal`/i);
      assert.match(source, /forming[^\n]*triggered[\s\S]*non-adopted[\s\S]*`live_ineligible`[\s\S]*`NOT-ELIGIBLE`/i);
    }
    assert.match(command, /zero matching DT labels[\s\S]*`status: no_signal`/i);
  });

  it('requires every complete snapshot criterion and fail-closes before judgement', () => {
    assert.match(watcher, /observed symbol and timeframe[\s\S]*expected chart context/i);
    assert.match(watcher, /usable current quote/i);
    assert.match(watcher, /successful DT-label read[\s\S]*study_filter: "DT "/i);
    assert.match(watcher, /zero matching labels[\s\S]*`no_signal`/i);
    assert.match(watcher, /successful OHLCV summary[\s\S]*summary: true[\s\S]*count: 20/i);
    assert.match(watcher, /fresh ISO-8601 timestamp[\s\S]*current tool responses[\s\S]*current cycle/i);
    assert.match(watcher, /missing, stale, mismatched, or unusable[\s\S]*snapshot_status: incomplete/i);
    assert.match(watcher, /do not fabricate[\s\S]*timestamp/i);
    assert.match(command, /snapshot_status: incomplete[\s\S]*status: `snapshot_failed`[\s\S]*before registry, analysis, screenshot, or journal/i);
  });

  it('gates completed status and summary updates on exact final-line verification', () => {
    assert.match(command, /final_line_verification[\s\S]*verified=true[\s\S]*expected_id=true[\s\S]*shape_valid=true[\s\S]*exact_object_match=true/i);
    assert.match(command, /journal_status=appended[\s\S]*status=completed[\s\S]*increment/i);
    assert.match(command, /journal_failed[\s\S]*planned judgement id[\s\S]*does not\s+increment/i);
    assert.match(command, /do not delete, rewrite, or retry[\s\S]*stop\s+further live judgements until repaired/i);
    assert.match(docs, /verified=true[\s\S]*expected id[\s\S]*shape[\s\S]*exact object[\s\S]*status=completed/i);
  });

  it('documents capability semantics and pins read-only companion invocation', () => {
    assert.match(docs, /plugin `--tools`[\s\S]*limits built-in tools/i);
    assert.match(docs, /verified agent frontmatter[\s\S]*exact MCP and subagent capability boundary/i);
    assert.match(docs, /`allowedTools`[\s\S]*preapproves permissions[\s\S]*does not\s+define tool availability/i);
    assert.match(docs, /child worker's Bash[\s\S]*residual/i);
    assert.match(docs, /does not[\s\S]*hard no-order\s+enforcement/i);

    for (const [name, source] of [['setup-analyst', setupAnalyst], ['risk-officer', riskOfficer]]) {
      const invocation = source.match(/\/usr\/bin\/node "\$COMPANION" task --fresh \\\n\s+--model gpt-5\.6-sol --effort high -- "\$prompt"/);
      assert.ok(invocation, `${name} must invoke gpt-5.6-sol at high effort`);
      assert.doesNotMatch(invocation[0], /--write/, `${name} invocation must omit --write`);
    }
  });
});
