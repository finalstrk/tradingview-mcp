export const CASE_OK = Object.freeze({ status: 'success', code: 'CASE_OK' });
export const CASE_FAILED = Object.freeze({ status: 'failure', code: 'CASE_FAILED' });
export const CASE_UNKNOWN = Object.freeze({ status: 'unknown', code: 'CASE_OUTCOME_UNKNOWN' });

export async function runFixedCase(operation) {
  try {
    await operation();
    return CASE_OK;
  } catch {
    return CASE_FAILED;
  }
}
