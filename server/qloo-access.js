import { constants, openSync, closeSync, fstatSync, readFileSync, realpathSync, statSync, mkdirSync, rmdirSync, writeFileSync, renameSync, unlinkSync, fsyncSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from './errors.js';

const project = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const unavailable = () => new AppError('access_pending', 'Verified private Qloo access configuration is required.', 503);

function privatePath(path, directory = false) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw unavailable();
  const actual = realpathSync(path);
  if (actual === project || actual.startsWith(project + sep)) throw unavailable();
  const info = statSync(actual);
  if ((info.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && info.uid !== process.getuid())) throw unavailable();
  if (directory && !info.isDirectory()) throw unavailable();
  return actual;
}

function readPrivate(path, maxBytes) {
  privatePath(dirname(path), true); const actual = privatePath(path);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > maxBytes || (info.mode & 0o077) !== 0 || actual !== resolve(path)) throw unavailable();
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}

// Version 1 binds published free-use limits. Version 2 binds an issued event
// key and explicitly operator-chosen limits when the guide does not publish
// numeric quotas. Neither version creates or resets its own usage budget.
export function loadAccess(path, now = Date.now()) {
  try {
    const config = JSON.parse(readPrivate(path, 8192));
    const expires = Date.parse(config.expiresAt), verified = Date.parse(config.verifiedAt);
    const permitted = (config.version === 1 && config.freeUseVerified === true) ||
      (config.version === 2 && config.eventAccessVerified === true && config.feeNoticeReceived === false && config.limitBasis === 'operator');
    if (!permitted || config.suspended === true || !/^https:\/\//.test(config.evidenceUrl ?? '') || !/^[a-zA-Z0-9_-]{1,80}$/.test(config.accessId ?? '') || !Number.isFinite(verified) || verified > now || !Number.isFinite(expires)) throw unavailable();
    if (expires <= now) throw new AppError('access_expired', 'The verified Qloo access window has ended.', 503);
    if (!Number.isSafeInteger(config.maxRequests) || config.maxRequests < 1 || !Number.isSafeInteger(config.minIntervalMs) || config.minIntervalMs < 0) throw unavailable();
    const key = readPrivate(config.credentialFile, 2048).trim();
    if (!/^[\x21-\x7e]{8,512}$/.test(key)) throw unavailable();
    privatePath(dirname(config.budgetFile), true); privatePath(config.budgetFile);
    const policyHash = hash(JSON.stringify({ version: config.version, accessId: config.accessId, keyHash: hash(key), expiresAt: config.expiresAt, maxRequests: config.maxRequests, minIntervalMs: config.minIntervalMs }));
    return { config, key, policyHash, expires };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable();
  }
}

export function initialBudget(access) {
  return { version: 1, policyHash: access.policyHash, used: 0, lastAttemptAt: 0 };
}

export async function reserveRequest(access, { now = Date.now, wait = delay, maxWaitMs = 2000 } = {}) {
  const { config, policyHash, expires } = access; const started = now();
  const lock = config.budgetFile + '.lock';
  for (;;) {
    if (now() >= expires) throw new AppError('access_expired', 'The verified Qloo access window has ended.', 503);
    try { mkdirSync(lock, { mode: 0o700 }); }
    catch { throw new AppError('budget_busy', 'Another Qloo request is updating the shared allowance. Try again shortly.', 503); }
    let waitMs = 0;
    try {
      const state = JSON.parse(readPrivate(config.budgetFile, 8192));
      if (state.version !== 1 || state.policyHash !== policyHash || !Number.isSafeInteger(state.used) || state.used < 0 || !Number.isSafeInteger(state.lastAttemptAt) || state.lastAttemptAt < 0 || state.lastAttemptAt > now()) throw unavailable();
      if (state.used >= config.maxRequests) throw new AppError('quota_exhausted', 'The verified free Qloo allowance is exhausted. No further request was sent.', 503);
      waitMs = Math.max(0, state.lastAttemptAt + config.minIntervalMs - now());
      if (!waitMs) {
        const next = { ...state, used: state.used + 1, lastAttemptAt: now() };
        const temporary = join(dirname(config.budgetFile), `.budget-${randomUUID()}.tmp`);
        try {
          const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
          try { writeFileSync(fd, JSON.stringify(next) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
          renameSync(temporary, config.budgetFile);
        } finally { try { unlinkSync(temporary); } catch {} }
        return next;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    } finally { rmdirSync(lock); }
    if (now() - started + waitMs > maxWaitMs) throw new AppError('local_rate_limited', 'Pause before the next Qloo request. No request was sent during this wait.', 429);
    await wait(waitMs);
  }
}
