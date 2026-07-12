# Gate A0 Pine Signal Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Gate A1で一度だけ実行できる、fixed-target・unique-context・secret-safe・self-digest-boundなPine discovery probeを、A0では外部作用0の段階TDDで実装・検証・独立reviewし、review済みdigestとexact commandを確定する。

**Architecture:** scripts/pine_discovery_gate_a1.mjsを唯一のlive artifactとし、top-levelはNode builtinsだけ、valid self-digest後にだけchrome-remote-interfaceをdynamic importする。Live-capable executeMain/runCli/adapterはすべてmodule-localでexport 0、production DI/test hook 0とする。A0 testsはartifact bytesをvm.SourceTextModuleへ読み込み、Node builtinsをSyntheticModuleでlinkし、CLI用process stubのargvでauto-run guardを発火し、importModuleDynamically hook内だけでfake chrome-remote-interface SyntheticModuleを返す。

**Tech Stack:** Node.js ESM、node:test、node:assert/strict、node:vm、node:crypto、node:util、node:child_process、既存chrome-remote-interface

## Global Constraints

- Gate A0で許可するのはsingle probe artifact、専用offline spec/fixture、offline実行、独立read-only review、digest/exact command確定だけ。
- A0中のreal CRI import、CDP接続、TradingView/UI操作、non-loopback network、live test、npm test、save、reload、POST、tab/process操作は0。
- tests/offline_network_guard.jsのpreloadはA0 offline commandsだけで使う。このguardはfetch/http/httpsだけを防ぎ、CRI WebSocket/node:netを遮断するとは主張しない。
- exact Gate A1 commandにはoffline guardを含めない。形式はnode scripts/pine_discovery_gate_a1.mjs --bundle-sha256=の後ろへreviewed 64桁lowercase digestを直結した一行。
- src、package.json、package-lock.json、tests/test_manifest.test.js、既存production filesは変更しない。依存追加・更新、commitもしない。
- src/connection.jsとcreateConnectionManagerは再利用しない。先頭target、retry、raw cause/page exception漏えい経路を持ち込まない。
- implementationを一括投入しない。Stage AのGREEN後にStage BのREDを追加し、B GREEN後にC REDを追加する順序をStage Fまで守る。
- implementation中にreal chrome-remote-interface dynamic import、exact Gate A1 command、CDP/TradingView commandを実行しない。
- independent review後にartifactを1 byteでも変更した場合、offline gatesとreviewをやり直し、digestを再確定する。

---

## File Map

- Create: scripts/pine_discovery_gate_a1.mjs
  - constants、fixed closure、strict validator、argument/digest gate、internal adapter、effect orchestrator、safe result、CLI hard deadlineを所有する唯一のreview/live artifact。
- Create: tests/pine_discovery_gate_a0.spec.mjs
  - Stage A〜Fを順に追加するmanifest外offline test。
- Create: tests/fixtures/pine_discovery_gate_a0_child.mjs
  - Stage Fだけで追加するvm.SourceTextModule valid-digest CLI auto-run→internal adapter→fake CRI child fault/hang fixture。

## Exact Public Interfaces

scripts/pine_discovery_gate_a1.mjsのfinal module namespaceは次だけをexportする。

~~~javascript
export {
  PROBE_TARGET,
  PROBE_BUDGET,
  PROBE_CANDIDATE_PATHS,
  PROBE_CANDIDATE_VALUE_TYPES,
  PROBE_CANDIDATE_ERROR_CODES,
  PROBE_ERROR_CODES,
  PROBE_FUNCTION_DECLARATION,
  OPERATION_DEADLINE_MS,
  WORK_DEADLINE_MS,
  CLEANUP_RESERVE_MS,
  TOTAL_HARD_DEADLINE_MS,
  CLI_FLUSH_FALLBACK_MS,
  HARD_DEADLINE_EXIT_CODE,
  computeProbeSelfSha256,
  buildApprovalEnvelope,
  validateProbeResult,
};
~~~

executeMain、runCli、createLiveAdapter、orchestrator、target selector、context owner、CDP wrapper、SafeMain validatorはinternal onlyでexport 0。Module namespace testはmain、executeMain、runCli、createLiveAdapter、connect、openEditor、invokeProbe、closeEditor、sendCommandが存在しないことをassertする。Exported callableはpure helper 3個だけで、live-capable callable exportは0。

Pure helper exports computeProbeSelfSha256、buildApprovalEnvelope、validateProbeResult must have live capability0: calling them may use only their explicit value/readFileFn arguments and must never reach dynamic import、CDP、target/context code、stdout、exit、or timers。Module-namespace tests exercise each helper while asserting dynamicImportCount=0。

Exact signatures:

- computeProbeSelfSha256(readFileFn) -> Promise<string>
- buildApprovalEnvelope(readFileFn) -> Promise<ApprovalEnvelope>
- validateProbeResult(value) -> SafeProbeResult。invalidはfixed PINE_DISCOVERY_RESULT_INVALIDをthrowしraw cause 0。

computeProbeSelfSha256/buildApprovalEnvelopeのreadFileFnはpure helper test用だけ。Internal executeMainはこれらへcaller valueを渡さず、module-local actual node:fs/promises.readFile bindingを必ず使う。Internal executeMain/runCliはtarget、tuple、digest、module loader、readFile、timer、deadline、observerを引数/envから受け付けない。Production entrypointはargv/stdout/exitをglobal processからだけ取得し、external callerがlive pathを直接呼べるAPIを公開しない。

A0 test loader is test-side only and has exactly two process modes:

1. read actual artifact source bytes;
2. import-only mode creates vm.SourceTextModule with identifier equal to the actual artifact file URL and a frozen process stub whose argv[1] is a non-artifact test-host path。Evaluation must not trigger auto-run; this mode alone reads exported constants/pure helpers;
3. CLI mode uses the same identifier/source but a frozen process stub with argv exactly `[nodePath, actualArtifactPath, ...cliArgs]`。Its stdout.write and exit spies expose one write plus an exitPromise; evaluating the module must trigger the production auto-run guard and exercise internal runCli→executeMain without directly calling either function;
4. both modes use an isolated context containing Buffer、URL、TextEncoder/TextDecoder、AbortController、queueMicrotask。Test-side setTimeout maps 1000ms operation to 5ms、20000ms work to 20ms、10000ms cleanup reserve to 10ms、30000ms total hard to 30ms、100ms flush fallback to 2ms, and clamps any other delay to at most 5ms;
5. accept the exact static builtin specifier set node:crypto、node:fs/promises、node:path、node:url、node:util only。Create SyntheticModules exposing exactly createHash/timingSafeEqual、readFile、resolve、fileURLToPath、types respectively and no other named/default export;
6. reject every other static node: specifier, including node:net、node:tls、node:http、node:https、node:child_process、node:process、node:timers, before evaluation;
7. resolve importModuleDynamically only when specifier is chrome-remote-interface, returning the selected fake CDP SyntheticModule and incrementing dynamicImportCount;
8. reject every other dynamic specifier。

Invalid-digest CLI mode must leave dynamicImportCount=0; valid-digest CLI mode must make it exactly1。All valid/invalid digest、fake CDP、deadline、hard-deadline tests enter only through CLI-mode evaluation。They never call internal executeMain/runCli because those names are absent from the namespace。Child fixture uses the same loader, but its CLI-mode exit stub flushes the captured single JSON line and then delegates to the real process.exit so pending handles cannot keep the child alive。

Artifact static imports must equal this set and named bindings exactly:

~~~javascript
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
~~~

No default import、namespace import、additional builtin export、or sixth static specifier is allowed。

## Exact Constants and Schemas

~~~javascript
export const PROBE_TARGET = Object.freeze({
  id: '119DB9629A03197CFB120366EA6729CC',
  symbol: 'FX:USDJPY',
  resolution: '15',
  chart_type: 1,
  study_count: 12,
  shape_count: 0,
  replay_started: false,
  bottom_widget_open: false,
  pine_editor_open: false,
});

export const PROBE_BUDGET = Object.freeze({
  open: 1,
  probe: 1,
  close: 1,
  retry: 0,
  fallback: 0,
});

export const PROBE_CANDIDATE_PATHS = Object.freeze([
  Object.freeze(['model_uri', 'monaco_model', 'uri']),
  Object.freeze(['source_readability', 'monaco_model', 'getValue']),
  Object.freeze(['model_version', 'monaco_model', 'getVersionId']),
  Object.freeze(['model_alternative_version', 'monaco_model', 'getAlternativeVersionId']),
  Object.freeze(['script_id', 'react_value', 'scriptId']),
  Object.freeze(['script_id', 'react_value', '_scriptId']),
  Object.freeze(['dirty', 'react_value', 'dirty']),
  Object.freeze(['dirty', 'react_value', '_dirty']),
  Object.freeze(['persistence_mode', 'react_value', 'persistenceMode']),
  Object.freeze(['persistence_mode', 'react_value', 'autoSave']),
  Object.freeze(['cloud_version', 'react_value', 'cloudVersion']),
]);

export const PROBE_CANDIDATE_VALUE_TYPES = Object.freeze([
  Object.freeze(['object']),
  Object.freeze(['string']),
  Object.freeze(['number']),
  Object.freeze(['number']),
  Object.freeze(['string']),
  Object.freeze(['string']),
  Object.freeze(['boolean']),
  Object.freeze(['boolean']),
  Object.freeze(['string']),
  Object.freeze(['boolean']),
  Object.freeze(['string', 'number']),
]);

export const PROBE_CANDIDATE_ERROR_CODES = Object.freeze({
  NONE: 'NONE',
  MEMBER_MISSING: 'MEMBER_MISSING',
  ACCESSOR_SKIPPED: 'ACCESSOR_SKIPPED',
  READ_FAILED: 'READ_FAILED',
  VALUE_UNAVAILABLE: 'VALUE_UNAVAILABLE',
  UNSTABLE: 'UNSTABLE',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
});

export const PROBE_ERROR_CODES = Object.freeze({
  ARGUMENT: 'PINE_DISCOVERY_ARGUMENT',
  MODULE: 'PINE_DISCOVERY_MODULE',
  TARGET_REJECTED: 'PINE_DISCOVERY_TARGET_REJECTED',
  CONNECT: 'PINE_DISCOVERY_CONNECT',
  CONTEXT_CHANGED: 'PINE_DISCOVERY_CONTEXT_CHANGED',
  PREFLIGHT: 'PINE_DISCOVERY_PREFLIGHT',
  OPEN: 'PINE_DISCOVERY_OPEN',
  PROTOCOL: 'PINE_DISCOVERY_PROTOCOL',
  PAGE: 'PINE_DISCOVERY_PAGE',
  INVALID: 'PINE_DISCOVERY_RESULT_INVALID',
  CLOSE: 'PINE_DISCOVERY_CLOSE',
  POSTFLIGHT: 'PINE_DISCOVERY_POSTFLIGHT',
  DETACH: 'PINE_DISCOVERY_DETACH',
  DEADLINE: 'PINE_DISCOVERY_DEADLINE',
  HARD_DEADLINE: 'PINE_DISCOVERY_HARD_DEADLINE',
  INTERNAL: 'PINE_DISCOVERY_INTERNAL',
  DIGEST: 'PINE_DISCOVERY_DIGEST',
});

export const OPERATION_DEADLINE_MS = 1000;
export const WORK_DEADLINE_MS = 20000;
export const CLEANUP_RESERVE_MS = 10000;
export const TOTAL_HARD_DEADLINE_MS = 30000;
export const CLI_FLUSH_FALLBACK_MS = 100;
export const HARD_DEADLINE_EXIT_CODE = 70;
~~~

Phase error success valueはnull。phase error codeとしてNONEを使わない。

SafeProbeResult top-level keys are exactly:

- contract='gate-a0-v1'
- success boolean
- editor_found boolean
- candidate_count=PROBE_CANDIDATE_PATHS.length
- candidates exact ordered array
- error_code null or one fixed phase code

Allowed top-level combinations are exact:

- success=true requires editor_found=true、error_code=null、candidate_count=11、and every candidate matching the state matrix。
- success=false/editor_found=false requires error_code=PINE_DISCOVERY_PREFLIGHT and all 11 candidates in MEMBER_MISSING state。
- success=false/editor_found=true requires error_code=PINE_DISCOVERY_PAGE and all 11 candidates in READ_FAILED state。
- Any other success/editor_found/error_code/candidate-state combination is PINE_DISCOVERY_RESULT_INVALID。

Each candidate keys are exactly signal、owner、member、available、value_type、stable、read_count、error_code。signal-owner-member tupleは同じindexのPROBE_CANDIDATE_PATHSと完全一致し、順序変更、重複、欠落、追加をrejectする。

Allowed candidate state combinations:

| candidate error | available | value_type | stable | read_count |
|---|---:|---|---:|---:|
| NONE | true | exact index type from PROBE_CANDIDATE_VALUE_TYPES | true | 2 |
| MEMBER_MISSING | false | missing | false | 0 |
| ACCESSOR_SKIPPED | false | accessor | false | 0 |
| READ_FAILED | false | unavailable | false | 0 |
| VALUE_UNAVAILABLE | false | undefined | true | 2 |
| UNSTABLE | true | exact index type from PROBE_CANDIDATE_VALUE_TYPES | false | 2 |
| TYPE_MISMATCH | false | unavailable | false | 2 |

available means a safe readable and index-typed signal exists。Only NONE and UNSTABLE may set it true。Presence of a member/accessor alone is not availability。If the two reads have different types, or either type is outside that index's frozen allowed set, return TYPE_MISMATCH with available=false; never coerce。

SafeMain live payload keys are exactly success、error_code、editor_residual_state、ledger、probe。editor_residual_state is CLOSED、OPEN、UNKNOWN。ledger keys are editor_open_attempt_count、probe_invocation_count、editor_close_attempt_count、retry_count、fallback_count。

Ledger invariants are exact:

- all counters are integers;
- open/probe/close are each 0 or 1;
- probe <= open、close <= open;
- retry=0 and fallback=0 always;
- counters increment immediately before their external action and never roll back;
- the internal per-run progress record is created by runCli and passed only to module-local executeMain;
- a hard-deadline payload copies a fresh numeric snapshot of that same record。It must not construct replacement counters or reset them to zero。

SafeMain combination matrix:

| phase/outcome | error_code | open/probe/close | probe | residual |
|---|---|---|---|---|
| success | null | 1/1/1 | validated SafeProbeResult | CLOSED |
| parse/digest/module/selection/connect failure | ARGUMENT/DIGEST/MODULE/TARGET_REJECTED/CONNECT | 0/0/0 | null | UNKNOWN |
| observed preflight mismatch | PREFLIGHT | 0/0/0 | null | CLOSED only when the fixed visibility read proved false; otherwise UNKNOWN |
| context/work failure before open | CONTEXT_CHANGED/DEADLINE | 0/0/0 | null | CLOSED only when a fixed read proved false; otherwise UNKNOWN |
| open phase failure | OPEN/CONTEXT_CHANGED/DEADLINE | 1/0/0..1 | null | CLOSED only when close=1 and the fixed post-close read proved false; otherwise UNKNOWN |
| probe phase failure | PROTOCOL/PAGE/INVALID/CONTEXT_CHANGED/DEADLINE | 1/1/1 | null | CLOSED after a proved post-close false read, OPEN after a proved true read, otherwise UNKNOWN |
| close phase failure | CLOSE/CONTEXT_CHANGED/DEADLINE | 1/0..1/1 | null when probe=0 or probe failed; otherwise validated SafeProbeResult | OPEN after a proved true read, otherwise UNKNOWN |
| postflight failure | POSTFLIGHT/CONTEXT_CHANGED/DEADLINE | 1/1/1 | validated SafeProbeResult | OPEN after a proved true read, otherwise UNKNOWN |
| detach failure | DETACH/DEADLINE | any monotonic combination allowed by the ledger invariants | null or a validated SafeProbeResult only when probe=1 and validation completed | the last fixed read evidence; detach must never upgrade UNKNOWN/OPEN to CLOSED |
| hard kill | HARD_DEADLINE | current truthful monotonic snapshot | null | UNKNOWN |
| internal terminal | INTERNAL | any truthful monotonic snapshot; zero snapshot only when the ledger itself is corrupt | null | UNKNOWN |

CONTEXT_CHANGED and DEADLINE are accepted only in the row matching the phase where they occurred; they are not wildcard error codes。Internal validateLedgerSnapshot/validateSafeMainPayload reconstruct a fresh allowlisted payload and enforce this matrix before serialization。The hard builder calls the ledger validator on snapshotProgress(progress) and fixes probe=null/residual=UNKNOWN。

If validateSafeMainPayload detects a matrix-invalid provisional payload, it must not recursively feed a replacement through itself。It invokes a dedicated one-shot terminal serializer that writes exact SafeMain keys with success=false、error_code=INTERNAL、probe=null、residual=UNKNOWN and the current truthful validated ledger snapshot。If and only if validateLedgerSnapshot itself detects internal corruption, this terminal serializer may use a fresh all-zero ledger; that exception never applies to a valid hard-deadline snapshot and must never produce HARD_DEADLINE with replacement zeros。The terminal serializer stringifies no rejected value/raw cause and exits1 exactly once。

ApprovalEnvelope keys are exactly bundle_sha256、exact_command、target_id、initial_tuple、budgets、forbidden_effects、operation_deadline_ms、work_deadline_ms、cleanup_reserve_ms、total_hard_deadline_ms、hard_exit_cleanup_limit、tradingview_page_initiated_network。Deadline values are 1000/20000/10000/30000。hard_exit_cleanup_limit is the fixed enum PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN。Page-network value is always UNKNOWN。

---

### Task 1: Gate A0 staged TDD implementation

**Files:**
- Create/modify incrementally: scripts/pine_discovery_gate_a1.mjs
- Create/modify incrementally: tests/pine_discovery_gate_a0.spec.mjs
- Create only in Stage F: tests/fixtures/pine_discovery_gate_a0_child.mjs
- Do not modify: package.json
- Do not modify: tests/test_manifest.test.js
- Do not modify: src/**

### Stage A — Import boundary and constants

- [x] **A1 RED: add only import/constant/export tests**

Create tests/pine_discovery_gate_a0.spec.mjs with these tests only:

1. read the actual artifact source and evaluate it through the test-side vm.SourceTextModule/SyntheticModule loader defined in Exact Public Interfaces。
2. PROBE_TARGET deep-equals the exact tuple above and is frozen.
3. PROBE_BUDGET、PROBE_CANDIDATE_PATHS、PROBE_CANDIDATE_VALUE_TYPES、both error maps、all six timing/exit constants deep-equal the exact definitions above and are frozen recursively where applicable.
4. Object.keys(module namespace).sort() equals the public export list above.
5. parsed artifact static import specifiers equal exactly node:crypto、node:fs/promises、node:path、node:url、node:util and named bindings equal exactly createHash/timingSafeEqual、readFile、resolve、fileURLToPath、types。
6. VM linker accepts only those exact named exports。Table-test node:net、node:tls、node:http、node:https、node:child_process、node:process、node:timers and an unknown node: specifier; each is rejected before module evaluation。
7. process comes only from the frozen VM/global production process object, never an import。entrypoint uses globalThis.setTimeout/clearTimeout so the VM can clamp time without a production hook。
8. import-only evaluation and calling each pure helper keeps dynamicImportCount/CDP/network/stdout/exit/timer calls zero; auto-run does not fire in import-only mode.

Run:

~~~bash
node --import ./tests/offline_network_guard.js --experimental-vm-modules --test --test-concurrency=1 --test-reporter=tap tests/pine_discovery_gate_a0.spec.mjs
~~~

Expected RED: ERR_MODULE_NOT_FOUND for scripts/pine_discovery_gate_a1.mjs。No later-stage test exists yet。

- [x] **A2 GREEN: create constants-only safe module**

Create scripts/pine_discovery_gate_a1.mjs with only Node builtin imports、the exact constants、and named exports required by A1. Pure functions not yet behavior-complete return fixed ARGUMENT results without I/O。There are no exported live callables、production DI parameters、or test hooks。Do not add dynamic CRI import, fixed closure, adapter, orchestrator, or CLI auto-run in Stage A。

Run the Stage A command. Expected: Stage A tests all PASS。

### Stage B — Arguments, self-digest, envelope, and internal CLI gate

- [x] **B1 RED: add argument/digest/envelope tests after A is green**

Add tests:

1. CLI mode with no args、unknown arg、malformed digest、uppercase digest、duplicate digest、approval+digest together emits exactly one exit1/PINE_DISCOVERY_ARGUMENT JSON with dynamicImportCount=0。
2. evaluate only the actual artifact source bytes in CLI mode while module-local readFile also reads that same actual artifact。Independently compute its digest, change exactly one nibble to another lowercase hex digit while preserving 64-lowercase-hex shape, and pass that mismatching --bundle-sha256 value。It emits PINE_DISCOVERY_DIGEST/exit1 and leaves dynamicImportCount=0。
3. CLI mode --approval-envelope emits exit0 and the exact schema。
4. bundle_sha256 is 64 lowercase hex and equals independently computed SHA-256 of the artifact bytes。
5. exact_command equals 'node scripts/pine_discovery_gate_a1.mjs --bundle-sha256=' + bundle_sha256。It must not contain --import、tests/、offline_network_guard、environment assignment、quotes、or whitespace beyond the three command tokens。
6. envelope target/tuple/budgets are exact; deadline evidence is 1000/20000/10000/30000; hard_exit_cleanup_limit states process exit may interrupt finally and leave editor/session unknown; tradingview_page_initiated_network === 'UNKNOWN'。
7. valid-digest CLI mode reaches importModuleDynamically exactly once after digest comparison; the hook returns an invalid fake chrome-remote-interface SyntheticModule and internal execution emits PINE_DISCOVERY_MODULE/exit1 with raw module values absent。
8. every CLI-mode case observes exactly one stdout.write callback and one exitPromise resolution; stderr writes0。No test calls a namespace main/executeMain/runCli function。
9. the module namespace has no live-capable callable and source/API tests find no argv/env option for readFile、loader、target、tuple、timer、deadline、observer。Unknown CLI flags fail ARGUMENT rather than becoming a hook。

Every CLI-mode test in Stages B〜F evaluates the actual artifact source bytes unchanged。No source mutation/instrumentation is permitted; variation comes only from process argv/stdout behavior and the test-side dynamic import/CDP fake。

Expected RED: buildApprovalEnvelope/computeProbeSelfSha256 still have Stage A behavior and CLI auto-run is absent; the first CLI exitPromise/envelope assertion fails specifically。

- [x] **B2 GREEN: implement parser, digest, envelope, and internal CLI gate**

Import readFile as a module-local actualReadFile binding from node:fs/promises。Implement module-local executeMain/runCli and strict one-token parsing。Parse before actualReadFile。computeProbeSelfSha256 hashes the complete bytes supplied by its pure readFileFn, while executeMain hashes the actual artifact only with closed-over actualReadFile。executeMain must not call the exported helper with caller-controlled input。Digest compare uses equal-length Buffers and timingSafeEqual。Only a valid digest executes:

~~~javascript
const cdpModule = await import('chrome-remote-interface');
~~~

At Stage B, a module without callable default returns fixed MODULE。executeMain accepts only the module-local per-run progress record supplied by runCli; neither is exported and neither accepts a test dependency object。Do not build or call an adapter yet。buildApprovalEnvelope remains a pure helper, generates exact_command without the offline guard, and fixes page-initiated network to UNKNOWN。Add the production auto-run guard fileURLToPath(import.meta.url) === resolve(process.argv[1]); only that guard calls zero-argument internal runCli(), which reads argv/stdout/exit from global process。

Run Stage A+B tests. Expected: all existing tests PASS。

### Stage C — Fixed closure and strict validator

- [x] **C1 RED: add closure/validator tests after B is green**

Add tests:

1. PROBE_FUNCTION_DECLARATION names pineSignalDiscoveryMainWorld and contains no eval、Function constructor、dynamic path input、setValue、focus、click、save、fetch、XHR、WebSocket、storage write。
2. node:vm fake DOM/React/Monaco executes the closure with source、URI、script ID、version sentinels and observes mutation counters setValue/focus/click/fetch/storage setter all zero。
3. traversal calls are limited exactly to getEditors、getDomNode、getModel、getValue、getVersionId、getAlternativeVersionId。Any other function-valued member is not invoked。
4. parent DOM walk is <=20 and React return walk is <=15。
5. result contains no source/URI/identity/version values、length、hash、preview、raw error。
6. candidates exactly equal PROBE_CANDIDATE_PATHS by index and satisfy the state matrix。
7. PROBE_CANDIDATE_VALUE_TYPES is parallel、ordered、deep-frozen and each NONE/UNSTABLE value_type belongs to that exact index set。
8. two reads changing type、or a stable type outside the index set, produce TYPE_MISMATCH/available=false/read_count2 without coercion。
9. reordered、duplicate、missing、extra tuple、wrong count、unknown code、invalid candidate state、invalid top-level success/editor/error combination all return PINE_DISCOVERY_RESULT_INVALID。
10. Proxy is rejected via util.types.isProxy before traps。Accessor getter、toJSON、custom inspect are never invoked。
11. available=true is accepted only with index-typed NONE or UNSTABLE。ACCESSOR_SKIPPED、READ_FAILED、VALUE_UNAVAILABLE、TYPE_MISMATCH with available=true are invalid; their false forms pass。

Expected RED: PROBE_FUNCTION_DECLARATION/validateProbeResult are Stage A stubs; closure or strict schema assertion fails specifically。

- [x] **C2 GREEN: implement one self-contained synchronous closure and validator**

The closure accepts zero arguments and closes over nothing. It may:

- locate .monaco-editor.pine-editor-monaco;
- walk fixed DOM/React bounds;
- use owners react_value、monaco_env、monaco_editor、monaco_model only;
- call traversal/read methods getEditors、getDomNode、getModel、getValue、getVersionId、getAlternativeVersionId only;
- inspect the exact ordered PROBE_CANDIDATE_PATHS;
- read allowed data values twice locally and return only index-validated type/stability/count;
- return TYPE_MISMATCH/available=false on cross-read or index-type mismatch; never coerce;
- skip accessors/unknown functions;
- catch page exceptions into fixed candidate/phase codes without message/stack/value。

validateProbeResult first rejects util.types.isProxy。Then it reads own property descriptors, never spreads/stringifies/inspects unvalidated input, and reconstructs a new allowlisted object。

Run Stage A〜C tests. Expected: all existing tests PASS。

### Stage D — Orchestrator budgets and finally behavior

- [x] **D1 RED: add valid-digest internal-path budget tests after C is green**

All Stage D tests use CLI-mode vm.SourceTextModule evaluation。The actual artifact source is unchanged; process.argv contains the independently computed valid digest and importModuleDynamically resolves chrome-remote-interface to one fake SyntheticModule exporting a low-level fake CDP default function。Await the process-stub exitPromise and parse its single stdout line; never call a namespace main/executeMain/runCli function。Do not inject a high-level adapter/factory or production hook。

The minimal fake implements List、connect client、Target.getTargetInfo、Page.getFrameTree、Runtime.enable/events/callFunctionOn/releaseObjectGroup、client.close。Fixed closure contract markers are gate-a0-preflight-v1、gate-a0-open-v1、the exact PROBE_FUNCTION_DECLARATION、gate-a0-close-v1、gate-a0-postflight-v1。

Add tests:

1. success order is List、connect、preflight、open、probe、close、postflight、release、detach with ledger open1/probe1/close1/retry0/fallback0 and residual CLOSED。
2. preflight false/missing/wrong type performs open/probe/close0 and bounded detach only。
3. open throw/timeout pre-consumes open1、probe0、close method <=1。
4. probe throw/page failure pre-consumes probe1 and finally close1。
5. close throw/timeout performs no second close and residual UNKNOWN。
6. postflight open=true produces residual OPEN and failure。
7. detach throw/timeout is fixed DETACH/DEADLINE with raw cause absent。
8. no loop、retry、fallback、secondary target。
9. open fixed closure calls window.TradingView.bottomWidgetBar.activateScriptEditorTab() exactly once。Missing bar/method or throw maps OPEN。
10. close fixed closure calls window.TradingView.bottomWidgetBar.hideWidget('pine-editor') exactly once。Missing bar/method or throw maps CLOSE。
11. fake showWidget、generic DOM click、editor focus、Input dispatch counters remain zero in success/failure paths。
12. after open and close action, only the fixed read-only visibility closure may repeat up to 8 times at 100ms; the action closure count remains exactly1。

Expected RED: valid digest currently stops at Stage B MODULE or lacks the internal orchestrator; success sequence assertion fails specifically。

- [x] **D2 GREEN: implement internal adapter shell and orchestrator**

Keep executeMain/runCli/createLiveAdapter/internal orchestrator unexported。Use only module-local PROBE_TARGET constants; accept no targetId/tuple arguments。Effect counters update the same internal per-run progress record and increment before open/probe/close method calls。If open was attempted, call close method at most once in finally; close itself may refuse UI action after identity precheck。Every promise uses module-local fixed deadlines/global timers and an immediate late rejection sink。Never retain raw errors as cause。VM tests shorten time only by clamping the isolated context's global timers。

Open has exactly one mutation path: bottomWidgetBar.activateScriptEditorTab()。Do not implement showWidget、DOM click、focus、Input、or any fallback。Close has exactly one mutation path: bottomWidgetBar.hideWidget('pine-editor')。Do not implement an alternative。After each action, poll only the fixed visibility read closure document.querySelector('.monaco-editor.pine-editor-monaco') !== null, at most 8 reads separated by internal 100ms waits; never repeat the action。

At Stage D implement only the stable happy-path context needed by D tests。Do not preempt Stage E by adding fallback、numeric-context rebinding、or permissive URL behavior。

Run Stage A〜D tests. Expected: all existing tests PASS。

### Stage E — Exact target and unique-context ownership

- [x] **E1 RED: add target/context tests after D is green**

All tests still enter only by evaluating the artifact in CLI mode with the valid digest and awaiting the process-stub exitPromise; only the test-side dynamic-import hook supplies the fake CDP SyntheticModule。Internal live functions remain inaccessible from the module namespace。

Target tests:

1. CDP.List exactly once。
2. accept exactly one target whose id equals PROBE_TARGET.id、type is page、typeof url is string、new URL succeeds、protocol is https:、username/password are empty、url.port is empty after URL normalization (implicit or explicit default 443)、hostname equals tradingview.com or endsWith .tradingview.com、pathname equals /chart or startsWith /chart/。
3. prefix ID、duplicate exact ID、missing ID、wrong type、String object URL、invalid URL、HTTP、userinfo、nonstandard port、tradingview.com.evil.example、eviltradingview.com、/chart-evil、/not-chart all produce TARGET_REJECTED、connect0、fallback0。
4. accepted connect args are exactly host 127.0.0.1、port 9222、target PROBE_TARGET.id。

Unique-context tests:

1. initial identity is exactly {id,uniqueId,frameId,loaderId} from main-frame Page.getFrameTree and default Runtime.executionContextCreated。
2. every preflight/open/probe/close/postflight action performs Target.getTargetInfo、Page.getFrameTree、and current unique context verification immediately before and after callFunctionOn。
3. Runtime.callFunctionOn contains uniqueContextId equal captured uniqueId and omits executionContextId。
4. functionDeclaration is one fixed reviewed declaration、returnByValue true、awaitPromise false、fixed objectGroup。
5. Target.getTargetInfo ID/type/primitive URL/protocol/userinfo/port/hostname/path drift、frameId drift、loaderId drift、uniqueId drift all yield CONTEXT_CHANGED and no next action。
6. Runtime.executionContextDestroyed for captured id/uniqueId invalidates。
7. Runtime.executionContextsCleared invalidates。
8. Page.frameNavigated on main frame with new loaderId invalidates。
9. executionContextCreated with the same numeric id and a new uniqueId invalidates old ownership; it never rebinds。
10. releaseObjectGroup and client.close are finite/sanitized。
11. Runtime.evaluate、Page.reload、Input、fetch、HTTP client、external WebSocket calls are zero。

Expected RED: Stage D adapter uses insufficient target/context checks or numeric executionContextId; uniqueContextId and invalidation assertions fail specifically。

- [x] **E2 GREEN: harden internal adapter**

Capture and freeze:

~~~javascript
{
  id: context.id,
  uniqueId: context.uniqueId,
  frameId: mainFrame.id,
  loaderId: mainFrame.loaderId,
}
~~~

Reject missing/empty uniqueId or loaderId。Register destroy/clear/frame navigation/context-created listeners first, then call Page.enable and Runtime.enable through finite deadlines, and remove all listeners on detach。Never update the captured identity after invalidation。

Define one internal strictTargetPredicate and use it for both CDP.List selection and every Target.getTargetInfo pre/post result; do not duplicate a weaker predicate。For every fixed action call verifyIdentity before and after。verifyIdentity calls Target.getTargetInfo({targetId: PROBE_TARGET.id})、Page.getFrameTree()、and checks the tracked default context uniqueId。callFunctionOn uses:

~~~javascript
{
  functionDeclaration,
  uniqueContextId: identity.uniqueId,
  returnByValue: true,
  awaitPromise: false,
  objectGroup: 'tradingview-mcp-pine-discovery-v1',
}
~~~

Tuple values are compared inside fixed pre/post closures。Only boolean match/observability flags cross CDP; observed symbol/resolution/type/count/replay/panel values never return。

Run Stage A〜E tests. Expected: all existing tests PASS。

### Stage F — Raw leak containment and process hard deadline

- [x] **F1 RED: add child fixture and child-process tests after E is green**

Create tests/fixtures/pine_discovery_gate_a0_child.mjs。It does not import the artifact normally。It independently hashes the actual source bytes, sets the VM process argv to `[nodePath, actualArtifactPath, '--bundle-sha256=' + digest]`, and evaluates the SourceTextModule so the production auto-run guard enters internal runCli→executeMain。It never calls an exported helper or a namespace main/executeMain/runCli function and never imports/exports a high-level adapter。The test-side importModuleDynamically hook returns a low-level fake CDP SyntheticModule so the real internal selector/context/adapter/orchestrator executes。Its process-stub exit captures the artifact exit code, writes the already-captured single JSON line once to real stdout, then delegates to real process.exit。

Fault modes:

- protocol: Runtime.callFunctionOn rejects an object whose message、stack、cause、request.params contain runtime sentinel。
- page: callFunctionOn returns exceptionDetails text/description/value/stack with sentinel。
- late: callFunctionOn times out, then rejects with sentinel。
- list-hang: CDP.List never settles and captures sentinel。
- connect-hang: CDP connect never settles and captures sentinel。
- enable-hang: Runtime.enable never settles and captures sentinel。
- frame-tree-hang: Page.getFrameTree never settles and captures sentinel。
- context-wait-hang: Runtime.enable resolves but no default context event arrives; pending event-loop handle captures sentinel。
- loader-hang: importModuleDynamically for chrome-remote-interface never settles and captures sentinel。
- open-hang: the fixed open action invocation is recorded, its CDP response never settles, and the separately bounded cleanup close succeeds。
- probe-hang: the fixed probe invocation is recorded, its CDP response never settles, and cleanup close succeeds。
- close-hang: the fixed close invocation is recorded and its response never settles; cleanup must not invoke close a second time。
- work-abort: individually finite fake identity/visibility calls stay below the operation deadline but cumulatively reach the work deadline after open and before probe; cleanup close/release/detach finish within their separate reserve。
- hard-during-cleanup: individually finite work calls reach the work deadline after probe; cleanup records its one close attempt, then delayed release/detach leave cleanup active when the already-running total hard timer fires。
- matrix-invalid: open succeeds、probe records its invocation then fails、and cleanup identity precheck fails before close is attempted, producing provisional PROTOCOL with open1/probe1/close0 outside the SafeMain matrix。

The parent spec spawns every fixture mode as a plain child with `node --no-warnings --import ./tests/offline_network_guard.js --experimental-vm-modules tests/fixtures/pine_discovery_gate_a0_child.mjs <mode>` and a real interval handle。`--no-warnings` suppresses the VM ExperimentalWarning so stderr-empty is deterministic。Require exactly one parseable stdout JSON line、stderr empty、no sentinel/raw fields、one exit, and exit within the parent 2000ms safety timeout。

The VM timer map is exact: OPERATION_DEADLINE_MS 1000→5ms、WORK_DEADLINE_MS 20000→20ms、CLEANUP_RESERVE_MS 10000→10ms、TOTAL_HARD_DEADLINE_MS 30000→30ms、CLI_FLUSH_FALLBACK_MS 100→2ms。Production argv/env/API cannot override any of them。Assert these exact outcomes:

- protocol/page/late emit their fixed sanitized failure/exit1; late uses DEADLINE。All have retry0/fallback0 and no sentinel;
- list/connect/enable/frame-tree/context-wait before any UI action emit DEADLINE/exit1 with open0/probe0/close0;
- loader-hang emits HARD_DEADLINE/exit70 with the truthful current snapshot open0/probe0/close0, probe=null, residual UNKNOWN;
- open-hang emits DEADLINE/exit1 with open1/probe0/close1 and no second open/close;
- probe-hang emits DEADLINE/exit1 with open1/probe1/close1;
- close-hang emits DEADLINE/exit1 with open1/probe1/close1 and close action call count exactly1;
- work-abort emits DEADLINE/exit1 only after cleanup, with open1/probe0/close1 and residual CLOSED from the fixed post-close read;
- hard-during-cleanup emits HARD_DEADLINE/exit70 with the current nonzero snapshot open1/probe1/close1, probe=null, residual UNKNOWN。This is the behavioral RED proving the hard builder cannot substitute a zero ledger。
- matrix-invalid invokes the terminal serializer once and emits INTERNAL/exit1 with exact keys、open1/probe1/close0、retry0/fallback0、probe=null、residual UNKNOWN。It must not recurse、throw、emit twice、or leak the rejected provisional payload/raw failure。

Add an in-process CLI-mode evaluation table, not a runCli call。Use process-stub stdout variants whose callback fires and never fires; await exitPromise。Assert one write、one exit after callback or mapped 2ms fallback、no second emit after late internal settlement、and the same SafeMain matrix/counter ranges for every phase fake。

Expected RED: Stage E lacks the work-abort/cleanup-reserve/total-hard CLI owner and truthful shared progress snapshot; hard-during-cleanup or callback fallback fails specifically。

- [x] **F2 GREEN: implement leak boundary and CLI owner**

All raw CDP/module/page failures are consumed at the innermost boundary and replaced with fresh fixed errors with no cause。Attach a rejection sink before every Promise.race。Never stringify/inspect raw errors、request params、exceptionDetails、remote objects、pending promises。

Internal runCli accepts zero arguments and is called only by the auto-run guard。It creates one fresh mutable numeric progress record, starts the module-local TOTAL_HARD_DEADLINE_MS timer immediately, and calls module-local executeMain(process.argv.slice(2), progress)。executeMain accepts only argv and that internal progress record; neither function nor record is exported。Production accepts no target/digest/module/readFile/timer/deadline/observer override from argv、env、or API。All timers use globalThis.setTimeout/clearTimeout with only the frozen 1000/20000/10000/30000/100 values。

executeMain starts a WORK_DEADLINE_MS AbortController for normal flow。Every operation-level race still has OPERATION_DEADLINE_MS and a late rejection sink。When work aborts, stop starting normal actions and enter finally with a new cleanup controller/timer that has the independent CLEANUP_RESERVE_MS。Within that reserve attempt, in order and at most once, identity-guarded editor close when open was attempted and close was not already attempted、Runtime.releaseObjectGroup、listener removal、client detach/close。The work signal must not pre-cancel cleanup。Return a strictly validated SafeMain payload only after cleanup finishes or its reserve expires。

runCli owns emitted/exited guards and the already-running total hard timer is the final OS-kill backstop。If it fires first, build a fresh hard payload from `validateLedgerSnapshot(snapshotProgress(progress))`; set only error_code=HARD_DEADLINE、editor_residual_state=UNKNOWN、probe=null around that snapshot。The hard payload contains no literal replacement ledger and therefore preserves counters already incremented by open/probe/close。If the ledger validator itself detects corruption, route to the one-shot INTERNAL terminal serializer/exit1 instead of emitting a zero-ledger HARD_DEADLINE。The hard path may call process.exit(70) while executeMain is in finally; the approval envelope explicitly records PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN。

Normal provisional payloads and valid hard payloads pass once through internal validateSafeMainPayload。A validation failure transfers directly to the dedicated INTERNAL terminal serializer and never calls validateSafeMainPayload again。All paths share the same emitted/exited guards, write exactly one JSON line, and call process.exit after the stdout callback or after CLI_FLUSH_FALLBACK_MS。Late callbacks/resolutions observe guards and do nothing。stderr writes0。The normal success exit is0, sanitized/INTERNAL failure exit is1, and a valid hard exit is HARD_DEADLINE_EXIT_CODE=70。

Guard auto-run with fileURLToPath(import.meta.url) === resolve(process.argv[1]) and call zero-argument internal runCli()。Import-only VM mode does not satisfy the guard; CLI mode and the real exact command do。No live callable is exported。

Run Stage A〜F tests. Expected: all targeted tests and child modes PASS。

### Final offline gate

- [x] **Step 7: Run only the approved offline commands**

~~~bash
node --import ./tests/offline_network_guard.js --experimental-vm-modules --test --test-concurrency=1 --test-reporter=tap tests/pine_discovery_gate_a0.spec.mjs
node --check scripts/pine_discovery_gate_a1.mjs
node --check tests/pine_discovery_gate_a0.spec.mjs
node --check tests/fixtures/pine_discovery_gate_a0_child.mjs
~~~

Expected: targeted tests all PASS; syntax checks exit0。Do not run test_manifest、npm test、test:e2e、test:all、exact Gate A1 command、real CRI/CDP。

- [x] **Step 8: Run static boundary checks**

~~~bash
rg -n "^import .*chrome-remote-interface|node:(net|tls|http|https|child_process|process|timers)|src/connection|createConnectionManager|Runtime\\.evaluate|Page\\.reload|Input\\.|dispatchKeyEvent|setValue|showWidget|\\.click\\(|\\.focus\\(|fetch\\(|https?\\.request|WebSocket|console\\.|\\.cause|error\\.(message|stack)|throw error" scripts/pine_discovery_gate_a1.mjs
rg -n "export .*\\b(main|executeMain|runCli|createLiveAdapter|openEditor|connect|sendCommand)\\b|executionContextId" scripts/pine_discovery_gate_a1.mjs
rg -n "15000|5/30/10|public main|VM namespace (main|runCli)|main\\(\\[validDigestArg\\]\\)" scripts/pine_discovery_gate_a1.mjs tests/pine_discovery_gate_a0.spec.mjs tests/fixtures/pine_discovery_gate_a0_child.mjs
git diff --check
git status --short
~~~

Expected: no executable violation and the stale-pattern command returns no match。String literals used by deny tests are manually classified。No executionContextId call parameter。Status contains plan、single artifact、offline spec、fixture plus pre-existing audit work; package/test manifest/src have no A0 change。

### Independent review and digest freeze

- [x] **Step 9: Independent read-only review**

Reviewer prompt:

~~~text
Review Gate A0 only. Inspect the approved design sections 4.1-4.4, offline verification items 21-23, acceptance Probe safety, the Gate A0 plan, scripts/pine_discovery_gate_a1.mjs, tests/pine_discovery_gate_a0.spec.mjs, and tests/fixtures/pine_discovery_gate_a0_child.mjs. Do not edit and do not run the emitted exact Gate A1 command, real CRI/CDP, TradingView/UI, network, npm test, or live tests. You may run only Steps 7-8. Prioritize: final namespace exports only constants and the three pure helpers, with executeMain/runCli/live adapter export0 and production DI/test hooks0; all live tests use the two-mode VM loader and actual CLI auto-run guard; static builtin specifiers/named exports equal the exact five-module allowlist and all other node: builtins are rejected; exact command has no offline guard; per-index candidate value-type/availability matrix including TYPE_MISMATCH; open calls activateScriptEditorTab exactly once and close calls hideWidget('pine-editor') exactly once with showWidget/click/focus/Input0; digest precedes dynamic import; strict target predicate includes primitive URL, empty userinfo, normalized default port, exact host/path and is reused for every Target.getTargetInfo; uniqueContextId plus target/frame/loader verification and invalidation; SafeMain matrix and counter-before-call/finally; 1000ms operation, 20000ms work abort, separate 10000ms cleanup, 30000ms hard OS kill, truthful current hard ledger, single JSON/process exit; raw leak child coverage through valid-digest internal adapter; approval evidence says process exit can interrupt finally and leave residual UNKNOWN; page-network UNKNOWN. Return Approved or Rejected and Critical/Important/Minor findings with file/symbol evidence. Approval requires zero Critical and zero Important.
~~~

Rejectedならbehavior固有REDを先に追加し、failureを確認してからGREEN、Steps 7-9を再実行する。

- [x] **Step 10: Freeze reviewed digest and exact Gate A1 command**

After Approved and with no subsequent artifact edit, run only:

~~~bash
node scripts/pine_discovery_gate_a1.mjs --approval-envelope
~~~

Expected: one safe JSON line and exit0。exact_command starts exactly with node scripts/pine_discovery_gate_a1.mjs --bundle-sha256= and contains the literal reviewed digest。It contains no --import/tests/offline guard。Envelope target/tuple/budgets are exact; operation/work/cleanup/total values are 1000/20000/10000/30000; hard_exit_cleanup_limit is PROCESS_EXIT_CAN_INTERRUPT_FINALLY_AND_LEAVE_EDITOR_OR_SESSION_STATE_UNKNOWN; tradingview_page_initiated_network is UNKNOWN。

Record reviewer verdict、artifact SHA-256、exact command、target/tuple、open1/probe1/close1/retry0/fallback0、all four deadline values、hard-exit residual caveat、page-network UNKNOWN。Do not execute exact_command and do not commit。
