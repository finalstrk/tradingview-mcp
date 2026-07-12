import { register } from '../router.js';
import * as core from '../../core/health.js';

register('status', {
  description: 'Check CDP connection to TradingView',
  handler: () => core.healthCheck(),
});

register('launch', {
  description: 'Launch TradingView with CDP enabled',
  options: {
    port: { type: 'string', short: 'p', description: 'CDP port (default 9222)' },
    'no-kill': { type: 'boolean', description: 'Skip killing existing instances during the new-launch preflight; healthy CDP endpoints are always reused.' },
  },
  handler: async (opts) => {
    const result = await core.launch({
      port: opts.port ? Number(opts.port) : undefined,
      kill_existing: !opts['no-kill'],
    });

    if (result?.success === false) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    return result;
  },
});
