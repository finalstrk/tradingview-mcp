export const executorId = 'tradingview-ready-state-legacy-session-v1';

const REQUIRED_METHODS = Object.freeze([
  'attach',
  'close',
  'connect',
  'detach',
  'enable',
  'evaluateReadyStateLength',
  'release',
  'verify',
]);

function requireCapability(capability) {
  if (!capability || typeof capability !== 'object'
    || REQUIRED_METHODS.some(method => typeof capability[method] !== 'function')) {
    throw new TypeError('BASELINE_EXECUTOR_CAPABILITY_INVALID');
  }
  return capability;
}

/**
 * Executes exactly one legacy benchmark sample. Every invocation owns a new
 * connection and target session; no lifecycle state is shared between samples.
 */
export async function execute(capability) {
  const fixed = requireCapability(capability);
  let connection;
  let session;
  let remoteObjectId;
  let primaryError;
  let value;

  try {
    connection = await fixed.connect();
    session = await fixed.attach(connection);
    await fixed.enable(session);
    await fixed.verify(session);
    const evaluated = await fixed.evaluateReadyStateLength(session);
    if (!evaluated || typeof evaluated !== 'object'
      || typeof evaluated.objectId !== 'string' || evaluated.objectId.length === 0
      || !Number.isSafeInteger(evaluated.value) || evaluated.value < 0) {
      throw new TypeError('BASELINE_EXECUTOR_RESULT_INVALID');
    }
    remoteObjectId = evaluated.objectId;
    value = evaluated.value;
    await fixed.release(session, remoteObjectId);
    remoteObjectId = undefined;
    await fixed.verify(session);
  } catch (error) {
    primaryError = error;
  } finally {
    if (remoteObjectId !== undefined && session !== undefined) {
      try { await fixed.release(session, remoteObjectId); } catch (error) { primaryError ||= error; }
    }
    if (session !== undefined) {
      try { await fixed.detach(connection, session); } catch (error) { primaryError ||= error; }
    }
    if (connection !== undefined) {
      try { await fixed.close(connection); } catch (error) { primaryError ||= error; }
    }
  }

  if (primaryError) throw primaryError;
  return value;
}
