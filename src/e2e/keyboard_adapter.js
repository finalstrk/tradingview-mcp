import { AdapterError, fail, normalizeOptions } from './safe_adapter.js';
import { createCdpMutationAdapter } from './cdp_mutation_adapter.js';

const KEY_PATTERN = /^[A-Za-z0-9]{1,24}$|^(?:Escape|Enter|Tab|Backspace|Delete|Arrow(?:Up|Down|Left|Right))$/;

export function createKeyboardAdapter(options) {
  const normalized = normalizeOptions(options);
  const mutation = createCdpMutationAdapter(normalized);
  return Object.freeze({
    async press(keySpec) {
      if (
        !keySpec
        || typeof keySpec !== 'object'
        || !KEY_PATTERN.test(keySpec.key)
        || !KEY_PATTERN.test(keySpec.code)
      ) {
        throw fail('E2E_ADAPTER_INVALID_KEY');
      }

      let downError = null;
      try {
        await mutation.mutate('Input.dispatchKeyEvent', { type: 'keyDown', key: keySpec.key, code: keySpec.code });
      } catch (error) {
        downError = error instanceof AdapterError ? error : fail('E2E_ADAPTER_TRANSPORT_FAILED');
      } finally {
        try {
          await mutation.mutate('Input.dispatchKeyEvent', { type: 'keyUp', key: keySpec.key, code: keySpec.code });
        } catch (error) {
          if (!downError) {
            throw error instanceof AdapterError ? error : fail('E2E_ADAPTER_TRANSPORT_FAILED');
          }
        }
      }
      if (downError) throw downError;
    },
  });
}
