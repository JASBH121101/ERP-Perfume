import test from 'node:test';
import assert from 'node:assert/strict';
import { createJwtTokenCache } from '../assets/js/jwt-token-cache.mjs';

function makeJwt(expiryMs) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiryMs / 1000) })).toString('base64url');
  return 'header.' + payload + '.signature';
}

test('reuses a valid JWT in memory until the conservative expiry boundary', async () => {
  let currentTime = 1_800_000_000_000;
  const cache = createJwtTokenCache({ now: () => currentTime, maxAgeMs: 60_000, safetyWindowMs: 30_000 });
  const token = makeJwt(currentTime + 10 * 60_000);
  let calls = 0;

  const first = await cache.request(async () => {
    calls += 1;
    return { token, error: '' };
  });
  const second = await cache.request(async () => {
    calls += 1;
    return { token: 'unexpected', error: '' };
  });

  assert.equal(first.token, token);
  assert.equal(second.token, token);
  assert.equal(calls, 1);
  currentTime += 60_001;
  assert.equal(cache.read(), null);
});

test('coalesces simultaneous JWT requests into one network operation', async () => {
  let currentTime = 1_800_000_000_000;
  const cache = createJwtTokenCache({ now: () => currentTime });
  const token = makeJwt(currentTime + 5 * 60_000);
  let calls = 0;
  let release;
  const loader = () => {
    calls += 1;
    return new Promise(resolve => { release = () => resolve({ token, error: '' }); });
  };

  const first = cache.request(loader);
  const second = cache.request(loader);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.equal((await first).token, token);
  assert.equal((await second).token, token);
  assert.equal(calls, 1);
});

test('does not cache tokens that are expired or too close to expiry', () => {
  let currentTime = 1_800_000_000_000;
  const cache = createJwtTokenCache({ now: () => currentTime, safetyWindowMs: 30_000 });
  cache.remember(makeJwt(currentTime + 20_000));
  assert.equal(cache.read(), null);
  cache.remember('not-a-jwt');
  assert.equal(cache.read(), null);
});

test('clearing the cache invalidates both cached and in-flight tokens', async () => {
  let currentTime = 1_800_000_000_000;
  const cache = createJwtTokenCache({ now: () => currentTime });
  const token = makeJwt(currentTime + 5 * 60_000);
  let release;
  const pending = cache.request(() => new Promise(resolve => {
    release = () => resolve({ token, error: '' });
  }));
  await Promise.resolve();
  cache.clear();
  release();
  await pending;
  assert.equal(cache.read(), null);
});
