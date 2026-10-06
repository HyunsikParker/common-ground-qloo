import { AppError } from './errors.js';
import { FixtureProvider } from './fixture-provider.js';
import { QlooProvider } from './qloo-provider.js';
import { HarnessTransport } from './qloo-transport.js';
import { loadAccess } from './qloo-access.js';

export function configuredProvider(environment = process.env) {
  const mode = environment.COMMON_GROUND_PROVIDER ?? 'fixture';
  if (mode === 'fixture') return new FixtureProvider();
  if (mode === 'qloo') {
    const accessFile = environment.COMMON_GROUND_ACCESS_FILE;
    // Requires explicit private event access and an existing operator allowance.
    // Ambient keys alone cannot enable requests or initialize a fresh budget.
    loadAccess(accessFile);
    const transport = new HarnessTransport({ accessFile });
    return new QlooProvider({ client: transport.client, executor: transport.executor,
      area: environment.COMMON_GROUND_DEFAULT_AREA ?? 'Manhattan, New York' });
  }
  throw new AppError('invalid_provider', 'Choose an explicitly supported data provider.', 503);
}
