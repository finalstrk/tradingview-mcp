import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { types as utilTypes } from 'node:util';

const ALLOWED_SURFACES = new Set(['chart', 'study', 'drawing', 'replay', 'panel', 'pine']);
const ALLOWED_CASE_STATUSES = new Set(['success', 'failure', 'unknown']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FIXED_CASE_CODES = new Set(['CASE_OK', 'CASE_FAILED', 'CASE_OUTCOME_UNKNOWN']);
const REQUIRED_OPERATIONS = Object.freeze([
  'captureInventory',
  'inspectReplay',
  'inspectPineSignals',
  'runOwnedCase',
  'cleanupCreated',
  'restoreInventory',
  'countCreated',
  'countOwnerlessMutations',
  'inventoriesEqual',
]);

export const LIVE_SUITE_MIGRATION_REGISTRY = Object.freeze([
  Object.freeze({ file: 'tests/e2e.test.js', state: 'ready' }),
  Object.freeze({ file: 'tests/batch_e2e.test.js', state: 'ready' }),
  Object.freeze({ file: 'tests/graphics_e2e.test.js', state: 'ready' }),
  Object.freeze({ file: 'tests/launch_e2e.test.js', state: 'ready' }),
  Object.freeze({ file: 'tests/pine_facade_e2e.test.js', state: 'ready' }),
  Object.freeze({ file: 'tests/quote_e2e.test.js', state: 'ready' }),
]);

const BYPASS_PATTERNS = Object.freeze([
  Object.freeze({ kind: 'direct-cdp', pattern: /(?:from\s+['"]chrome-remote-interface['"]|\bCRI\s*\()/ }),
  Object.freeze({ kind: 'direct-fetch', pattern: /\bfetch\s*\(/ }),
  Object.freeze({ kind: 'direct-input', pattern: /\bInput\.dispatch(?:Key|Mouse)Event\s*\(/ }),
  Object.freeze({ kind: 'child-process', pattern: /(?:from\s+['"]node:child_process['"]|\b(?:execFile|spawn)(?:Sync)?\s*\()/ }),
]);

export class GuardedE2EError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GuardedE2EError';
    this.code = code;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}

function fail(code = 'E2E_HARNESS_INVALID_CONFIGURATION') {
  return new GuardedE2EError(code);
}

function plainData(value) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(value).every(key => (
      typeof key === 'string'
      && descriptors[key]?.enumerable === true
      && Object.hasOwn(descriptors[key], 'value')
    ));
  } catch {
    return false;
  }
}

function exactKeys(value, keys) {
  if (!plainData(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizeTarget(value) {
  if (!exactKeys(value, ['executionContextId', 'sessionId', 'targetId'])) throw fail();
  const { targetId, sessionId, executionContextId } = value;
  if (
    !IDENTIFIER.test(targetId)
    || !IDENTIFIER.test(sessionId)
    || !Number.isSafeInteger(executionContextId)
    || executionContextId < 0
  ) throw fail();
  return Object.freeze({ targetId, sessionId, executionContextId });
}

function normalizeCases(cases) {
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 64) throw fail();
  const seen = new Set();
  return Object.freeze(cases.map(value => {
    if (!exactKeys(value, ['id', 'mutation', 'requiresPineSignal', 'surface'])) throw fail();
    const { id, surface, mutation, requiresPineSignal } = value;
    if (
      !IDENTIFIER.test(id)
      || seen.has(id)
      || !ALLOWED_SURFACES.has(surface)
      || typeof mutation !== 'boolean'
      || typeof requiresPineSignal !== 'boolean'
      || (requiresPineSignal && (surface !== 'pine' || !mutation))
    ) throw fail();
    seen.add(id);
    return Object.freeze({ id, surface, mutation, requiresPineSignal });
  }));
}

function normalizeOperations(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) throw fail();
  for (const method of REQUIRED_OPERATIONS) {
    if (typeof value[method] !== 'function') throw fail();
  }
  return value;
}

const DEADLINE = Symbol('deadline');

async function bounded(operation, deadlineMs) {
  let timer;
  const pending = Promise.resolve().then(operation);
  pending.catch(() => {});
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(DEADLINE), deadlineMs);
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function safeCreatedIds(value) {
  if (!Array.isArray(value) || value.length > 128) return null;
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    if (!IDENTIFIER.test(id) || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeCaseOutcome(value) {
  if (!exactKeys(value, ['code', 'createdIds', 'status'])) return null;
  const createdIds = safeCreatedIds(value.createdIds);
  if (
    !ALLOWED_CASE_STATUSES.has(value.status)
    || !FIXED_CASE_CODES.has(value.code)
    || createdIds === null
  ) return null;
  return { status: value.status, code: value.code, createdIds };
}

function publicCase(caseDefinition, status, code) {
  return Object.freeze({ id: caseDefinition.id, surface: caseDefinition.surface, status, code });
}

function overallStatus(cases) {
  if (cases.some(value => value.status === 'failure')) return 'failure';
  if (cases.some(value => value.status === 'unknown')) return 'unknown';
  return 'success';
}

function finalCode(status) {
  if (status === 'success') return 'E2E_GUARD_OK';
  if (status === 'failure') return 'E2E_CASE_FAILURE';
  return 'E2E_CASE_OUTCOME_UNKNOWN';
}

/**
 * Build a one-shot, coordinator-owned full-E2E runner. All case mutation is
 * serialized through runOwnedCase; capture, cleanup and restore remain outer
 * guard responsibilities and always use the same frozen target identity.
 */
export function createGuardedE2EHarness(configuration) {
  if (!exactKeys(configuration, ['cases', 'deadlineMs', 'operations', 'target'])) throw fail();
  const target = normalizeTarget(configuration.target);
  const cases = normalizeCases(configuration.cases);
  const operations = normalizeOperations(configuration.operations);
  const { deadlineMs } = configuration;
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000) throw fail();

  let used = false;
  const outerOwner = Object.freeze({ kind: 'guarded-e2e-owner' });

  return Object.freeze({
    target,
    async run() {
      if (used) throw fail('E2E_HARNESS_ALREADY_USED');
      used = true;
      let initial;
      try {
        initial = await bounded(() => operations.captureInventory(target), deadlineMs);
        if (initial === DEADLINE) throw fail('OUTER_CAPTURE_DEADLINE_EXCEEDED');
      } catch {
        return Object.freeze({
          status: 'unknown', code: 'OUTER_CAPTURE_FAILED', cases: Object.freeze([]), pine_mode: 'unknown',
          initial_final_invariant: false, created_remaining_count: 0, ownerless_mutation_count: 0,
        });
      }

      const auditMutationFreeExit = async (status, code) => {
        let invariant = false;
        let ownerless = 1;
        try {
          const final = await bounded(() => operations.captureInventory(target), deadlineMs);
          const compared = final === DEADLINE
            ? false
            : await bounded(() => operations.inventoriesEqual(initial, final), deadlineMs);
          invariant = compared === true;
        } catch {
          invariant = false;
        }
        try {
          const counted = await bounded(() => operations.countOwnerlessMutations(target), deadlineMs);
          ownerless = counted === DEADLINE || !Number.isSafeInteger(counted) || counted < 0 ? 1 : counted;
        } catch {
          ownerless = 1;
        }
        const clean = invariant && ownerless === 0;
        return Object.freeze({
          status: clean ? status : 'unknown',
          code: clean ? code : 'INITIAL_GUARD_AUDIT_FAILED',
          cases: Object.freeze([]), pine_mode: 'unknown',
          initial_final_invariant: invariant,
          created_remaining_count: 0,
          ownerless_mutation_count: ownerless,
        });
      };

      let replay;
      try {
        replay = await bounded(() => operations.inspectReplay(target), deadlineMs);
      } catch {
        replay = null;
      }
      if (
        replay === DEADLINE
        || !exactKeys(replay, ['active'])
        || typeof replay.active !== 'boolean'
      ) {
        return auditMutationFreeExit('unknown', 'INITIAL_REPLAY_UNKNOWN');
      }
      if (replay.active) {
        return auditMutationFreeExit('failure', 'INITIAL_REPLAY_ACTIVE');
      }

      let pine;
      try {
        pine = await bounded(() => operations.inspectPineSignals(target), deadlineMs);
      } catch {
        pine = null;
      }
      const pineProven = pine !== DEADLINE && exactKeys(pine, ['proven']) && pine.proven === true;
      const pineMode = pineProven ? 'atomic' : 'read-only';
      const outcomes = [];
      const created = new Set();
      let restoreCode = null;
      let invariant = false;
      let remaining = 0;
      let ownerlessMutations = 0;

      try {
        for (const caseDefinition of cases) {
          if (caseDefinition.requiresPineSignal && !pineProven) {
            outcomes.push(publicCase(caseDefinition, 'skipped', 'PINE_SIGNAL_UNPROVEN'));
            continue;
          }
          let raw;
          const controller = new AbortController();
          const caseOwner = Object.freeze({
            kind: 'guarded-e2e-owner',
            signal: controller.signal,
          });
          try {
            raw = await bounded(
              () => operations.runOwnedCase(caseDefinition, target, caseOwner),
              deadlineMs,
            );
          } catch {
            outcomes.push(publicCase(caseDefinition, 'failure', 'CASE_EXECUTION_FAILED'));
            continue;
          }
          if (raw === DEADLINE) {
            controller.abort(fail('CASE_DEADLINE_EXCEEDED'));
            outcomes.push(publicCase(caseDefinition, 'unknown', 'CASE_DEADLINE_EXCEEDED'));
            continue;
          }
          const normalized = normalizeCaseOutcome(raw);
          if (!normalized) {
            outcomes.push(publicCase(caseDefinition, 'unknown', 'CASE_OUTCOME_INVALID'));
            continue;
          }
          for (const id of normalized.createdIds) created.add(id);
          outcomes.push(publicCase(caseDefinition, normalized.status, normalized.code));
        }
      } finally {
        try {
          const cleanup = await bounded(() => operations.cleanupCreated([...created], target, outerOwner), deadlineMs);
          if (cleanup === DEADLINE) restoreCode = 'CREATED_CLEANUP_FAILED';
        } catch {
          restoreCode = 'CREATED_CLEANUP_FAILED';
        }
        try {
          const restore = await bounded(() => operations.restoreInventory(initial, target, outerOwner), deadlineMs);
          if (restore === DEADLINE) restoreCode = 'OUTER_RESTORE_FAILED';
        } catch {
          restoreCode = 'OUTER_RESTORE_FAILED';
        }
        try {
          const counted = await bounded(() => operations.countCreated([...created], target), deadlineMs);
          remaining = counted === DEADLINE || !Number.isSafeInteger(counted) || counted < 0
            ? created.size
            : counted;
        } catch {
          remaining = created.size;
        }
        try {
          const final = await bounded(() => operations.captureInventory(target), deadlineMs);
          const compared = final === DEADLINE
            ? false
            : await bounded(() => operations.inventoriesEqual(initial, final), deadlineMs);
          invariant = compared === true;
        } catch {
          invariant = false;
        }
        try {
          const counted = await bounded(() => operations.countOwnerlessMutations(target), deadlineMs);
          ownerlessMutations = counted === DEADLINE || !Number.isSafeInteger(counted) || counted < 0
            ? 1
            : counted;
        } catch {
          ownerlessMutations = 1;
        }
      }

      if (remaining > 0 && !restoreCode) restoreCode = 'CREATED_RESIDUAL_DETECTED';
      if (!invariant && !restoreCode) restoreCode = 'OUTER_INVARIANT_MISMATCH';
      if (ownerlessMutations > 0 && !restoreCode) restoreCode = 'OWNERLESS_MUTATION_DETECTED';
      if (restoreCode) {
        return Object.freeze({
          status: 'unknown', code: restoreCode, cases: Object.freeze(outcomes), pine_mode: pineMode,
          initial_final_invariant: invariant, created_remaining_count: remaining,
          ownerless_mutation_count: ownerlessMutations,
        });
      }
      const status = overallStatus(outcomes);
      return Object.freeze({
        status, code: finalCode(status), cases: Object.freeze(outcomes), pine_mode: pineMode,
        initial_final_invariant: true, created_remaining_count: 0,
        ownerless_mutation_count: ownerlessMutations,
      });
    },
  });
}

function isLiveTest(name) {
  return name === 'e2e.test.js' || name.endsWith('_e2e.test.js');
}

/** Read-only static gate. Unknown files, pending migrations, or bypasses fail. */
export async function scanLiveSuiteBoundary(rootDirectory) {
  const names = (await readdir(join(rootDirectory, 'tests'))).filter(isLiveTest).sort();
  const known = new Set(LIVE_SUITE_MIGRATION_REGISTRY.map(entry => entry.file));
  const actual = names.map(name => `tests/${name}`);
  const unknownFiles = actual.filter(file => !known.has(file));
  const missingFiles = [...known].filter(file => !actual.includes(file));
  const bypasses = [];
  const pending = LIVE_SUITE_MIGRATION_REGISTRY
    .filter(entry => entry.state !== 'ready')
    .map(entry => entry.file);

  for (const file of actual.filter(value => known.has(value))) {
    const source = await readFile(join(rootDirectory, file), 'utf8');
    for (const { kind, pattern } of BYPASS_PATTERNS) {
      if (pattern.test(source)) bypasses.push(Object.freeze({ file, kind }));
    }
  }

  if (unknownFiles.length > 0 || missingFiles.length > 0) {
    return Object.freeze({
      status: 'failure', code: 'LIVE_SUITE_BOUNDARY_DRIFT',
      pending: Object.freeze(pending),
      bypasses: Object.freeze(bypasses),
      unknown_files: Object.freeze(unknownFiles), missing_files: Object.freeze(missingFiles),
    });
  }
  if (pending.length > 0) {
    return Object.freeze({
      status: 'failure', code: 'LIVE_SUITE_MIGRATION_REQUIRED',
      pending: Object.freeze(pending), bypasses: Object.freeze(bypasses),
      unknown_files: Object.freeze([]), missing_files: Object.freeze([]),
    });
  }
  if (bypasses.length > 0) {
    return Object.freeze({
      status: 'failure', code: 'LIVE_SUITE_BYPASS_DETECTED',
      pending: Object.freeze([]), bypasses: Object.freeze(bypasses),
      unknown_files: Object.freeze([]), missing_files: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: 'success', code: 'LIVE_SUITE_MIGRATION_READY',
    pending: Object.freeze([]), bypasses: Object.freeze([]),
    unknown_files: Object.freeze([]), missing_files: Object.freeze([]),
  });
}
