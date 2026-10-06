import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { qlooCommand } from './qloo-command.js';

const childFile = fileURLToPath(new URL('./qloo-child.js', import.meta.url));

export class HarnessTransport {
  constructor({ accessFile, spawnChild = spawn }) {
    this.accessFile = accessFile; this.spawnChild = spawnChild; this.tail = Promise.resolve(); this.pending = 0;
    this.client = { searchEntities: async input => ({ results: await this.invoke('search', input) }) };
    this.executor = { execute: async (operation, input) => {
      const rows = await this.invoke(operation, input);
      // An app-owned compatibility envelope over the supported `qloo api` surface.
      return { result: { schema_version: '1.0-preview.1', operation, status: rows.length ? 'ok' : 'empty', results: rows, result_count: rows.length } };
    } };
  }
  invoke(operation, input) {
    qlooCommand(operation, input);
    if (this.pending >= 12) return Promise.reject(new AppError('provider_busy', 'The shared Qloo request queue is full. Try again shortly.', 503));
    this.pending++;
    const task = this.tail.then(() => this.run(operation, input));
    this.tail = task.catch(() => {});
    return task.finally(() => { this.pending--; });
  }
  run(operation, input) {
    return new Promise((resolve, reject) => {
      // Do not inherit NODE_OPTIONS, model credentials, proxies or Qloo settings.
      const env = { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8', NO_COLOR: '1' };
      const child = this.spawnChild(process.execPath, [childFile], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', complete = false;
      const done = (error, value) => {
        if (complete) return; complete = true; clearTimeout(timer);
        if (error) { child.kill('SIGKILL'); reject(error); } else resolve(value);
      };
      const timer = setTimeout(() => done(new AppError('provider_timeout', 'The Qloo tool exceeded its execution deadline.', 504)), 12000);
      child.stdout.on('data', bytes => {
        output += bytes.toString();
        if (Buffer.byteLength(output) > 1_100_000) done(new AppError('provider_response_too_large', 'The Qloo tool output exceeded this app’s size limit.', 502));
      });
      child.stderr.resume();
      child.on('error', () => done(new AppError('provider_unavailable', 'The Qloo tool could not be started.', 502)));
      child.stdin.on('error', () => done(new AppError('provider_unavailable', 'The Qloo tool input could not be delivered.', 502)));
      child.on('close', code => {
        if (complete) return;
        if (code !== 0) { done(new AppError('provider_unavailable', 'The Qloo tool stopped before completing the request.', 502)); return; }
        try {
          const result = JSON.parse(output);
          if (result.ok === true && Array.isArray(result.rows)) done(null, result.rows);
          else if (result.ok === false && typeof result.error?.code === 'string' && typeof result.error?.message === 'string') done(new AppError(result.error.code, result.error.message, result.status));
          else done(new AppError('invalid_provider_result', 'The Qloo tool returned an invalid response.', 502));
        } catch { done(new AppError('invalid_provider_result', 'The Qloo tool returned invalid JSON.', 502)); }
      });
      child.stdin.end(JSON.stringify({ operation, input, accessFile: this.accessFile }));
    });
  }
}
