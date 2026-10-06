import { createAppServer } from './http.js';
import { publicError } from './errors.js';
import { configuredProvider } from './provider.js';
try {
  const port = Number(process.env.PORT ?? 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  const provider = configuredProvider();
  const server = createAppServer({ provider });
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Common Ground: http://${process.env.HOST ?? '127.0.0.1'}:${port} (${provider.mode} mode)`));
  server.on('error', () => { console.error('The server could not start. Check whether the port is already in use.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
} catch (error) { console.error(publicError(error).error.message); process.exitCode = 1; }
