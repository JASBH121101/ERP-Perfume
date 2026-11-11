import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCloudflareWorkerRateLimit } from "../worker/src/security-guard-rate-limit.js";

function createBinding(answers = [{ success: true }]) {
  const keys = [];
  let index = 0;
  return {
    keys,
    async limit(input) {
      keys.push(input.key);
      const answer = answers[Math.min(index, answers.length - 1)];
      index += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    }
  };
}

test("ERP uses monitor mode by default and does not block an exceeded account", async () => {
  const events = [];
  const limiter = createCloudflareWorkerRateLimit({
    binding: createBinding([{ success: false }]),
    onEvent(event) { events.push(event); }
  });
  const result = await limiter.check({ identity: "erp-user-123", scope: "account" });
  assert.equal(result.allowed, true);
  assert.equal(result.exceeded, true);
  assert.equal(result.response, null);
  assert.equal(events[0].action, "cloudflare-rate-limit-exceeded");
  assert.equal(JSON.stringify(events).includes("erp-user-123"), false);
});

test("enforcement returns a generic 429 without leaking account identifiers", async () => {
  const limiter = createCloudflareWorkerRateLimit({
    binding: createBinding([{ success: false }]),
    mode: "enforce",
    periodSeconds: 60
  });
  const result = await limiter.check({ identity: "erp-user-secret", scope: "account" });
  assert.equal(result.response.status, 429);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  assert.equal(result.response.headers.get("retry-after"), "60");
  assert.equal((await result.response.text()).includes("erp-user-secret"), false);
});

test("each account identity is converted to an opaque Cloudflare key", async () => {
  const binding = createBinding([{ success: true }, { success: true }]);
  const limiter = createCloudflareWorkerRateLimit({ binding });
  await limiter.check({ identity: "user-a", scope: "account" });
  await limiter.check({ identity: "user-b", scope: "account" });
  assert.notEqual(binding.keys[0], binding.keys[1]);
  assert.equal(binding.keys.every((key) => !key.includes("user-")), true);
});

test("Cloudflare binding failures fail open rather than denying ERP access", async () => {
  const events = [];
  const limiter = createCloudflareWorkerRateLimit({
    binding: createBinding([new Error("private Cloudflare detail")]),
    mode: "enforce",
    onEvent(event) { events.push(event); }
  });
  const result = await limiter.check({ identity: "user-c", scope: "account" });
  assert.equal(result.allowed, true);
  assert.equal(result.unavailable, true);
  assert.equal(result.response, null);
  assert.equal(JSON.stringify(events).includes("private Cloudflare detail"), false);
});

test("ERP places account throttling only after active account verification", async () => {
  const source = await readFile(new URL("../worker/src/index.js", import.meta.url), "utf8");
  const activeCheck = source.indexOf('if (user.active !== true || user.account_status !== "active")');
  const rateCheck = source.indexOf("const rateLimitResponse = await checkAccountRateLimit(env, user);");
  const successReturn = source.indexOf("return { user, sql };", rateCheck);
  assert.ok(activeCheck >= 0);
  assert.ok(rateCheck > activeCheck);
  assert.ok(successReturn > rateCheck);
});

test("both Wrangler environments begin in non-blocking monitor mode", async () => {
  const { readFile } = await import("node:fs/promises");
  const dev = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const prod = await readFile(new URL("../wrangler.production.toml", import.meta.url), "utf8");
  for (const config of [dev, prod]) {
    assert.match(config, /JB_SECURITY_GUARD_MODE = "monitor"/);
    assert.match(config, /name = "JB_GUARD_ACCOUNT_LIMITER"/);
    assert.match(config, /limit = 600/);
    assert.match(config, /period = 60/);
  }
  assert.notEqual(
    dev.match(/namespace_id = "(\d+)"/)?.[1],
    prod.match(/namespace_id = "(\d+)"/)?.[1]
  );
});
