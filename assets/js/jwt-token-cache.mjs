function decodeExpiry(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    const expiry = Number(payload?.exp);
    return Number.isFinite(expiry) && expiry > 0 ? expiry * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Short-lived, in-memory JWT reuse for browser API calls.
 * The token is never persisted; the Worker validates every authenticated request.
 */
export function createJwtTokenCache({
  now = () => Date.now(),
  maxAgeMs = 60_000,
  safetyWindowMs = 30_000
} = {}) {
  let cachedToken = null;
  let cachedUntil = 0;
  let pendingRequest = null;
  let generation = 0;

  function read() {
    if (!cachedToken) return null;
    if (now() < cachedUntil) return cachedToken;
    cachedToken = null;
    cachedUntil = 0;
    return null;
  }

  function remember(token) {
    const expiry = decodeExpiry(token);
    const currentTime = now();
    if (!expiry || expiry <= currentTime + safetyWindowMs) {
      cachedToken = null;
      cachedUntil = 0;
      return token;
    }
    const reusableUntil = Math.min(expiry - safetyWindowMs, currentTime + maxAgeMs);
    if (reusableUntil > currentTime) {
      cachedToken = token;
      cachedUntil = reusableUntil;
    }
    return token;
  }

  function clear() {
    generation += 1;
    cachedToken = null;
    cachedUntil = 0;
    pendingRequest = null;
  }

  function request(loader) {
    const token = read();
    if (token) return Promise.resolve({ token, error: "" });
    if (pendingRequest) return pendingRequest;
    if (typeof loader !== "function") {
      return Promise.resolve({ token: null, error: "Token loader is unavailable." });
    }

    const requestGeneration = generation;
    const currentRequest = Promise.resolve()
      .then(loader)
      .then(result => {
        if (requestGeneration === generation && result?.token) remember(result.token);
        return result;
      })
      .finally(() => {
        if (pendingRequest === currentRequest) pendingRequest = null;
      });
    pendingRequest = currentRequest;
    return currentRequest;
  }

  return { read, remember, clear, request };
}
