# JB PARFUMS ERP — JB Security Guard rate limiting

## Initial policy

- One authenticated-account counter: 600 calls to the ERP Worker per 60-second period.
- Both Development and Production configs start with JB_SECURITY_GUARD_MODE=monitor.
- Monitor mode records an exceeded event but does not return 429 or reject the employee's request.
- Enforcement is deliberately not activated by this change.

## Request path

The Worker verifies the Neon Auth JWT signature, issuer, audience, and subject first. It then applies JB Security Guard using the stable subject from that verified token, before making any Neon database query. The adapter hashes the identifier with Web Crypto before it reaches the Cloudflare binding. Normal ERP account provisioning, active-account validation, and permissions still run afterward. Logs contain only component, event, severity, scope, and mode — never the user ID or JWT.

## Boundaries

- This change adds no SQL, database tables, migrations, R2 writes, or new runtime dependencies.
- Requests without a valid signed JWT are rejected by the existing authentication checks and are not counted by this per-account limiter. This layer does not stop unauthenticated request floods or password attacks against the separate Neon Auth origin.
- Protecting unauthenticated traffic requires a separately reviewed edge control (for example, Cloudflare WAF rate-limiting rules) on the relevant public endpoints; we do not use a shared-IP employee counter in this change.
- Monitor events are emitted with console warnings only when the configured threshold is exceeded or the binding fails. Their visibility depends on Cloudflare Workers Logs being enabled; no new analytics or storage binding is introduced here.
- Existing authentication, active-account checks, permission checks, DGI authorization, and business operations remain in place.
- OPTIONS preflight, /api/config, and /api/health are not counted. Static assets are not served by this Worker.
- The Neon Auth sign-in endpoint is hosted on a separate origin and is not protected by this Worker-level counter. Protecting that origin requires a separate control.
- We intentionally do not key employee traffic by IP because offices, households, carrier networks, and mobile users can share addresses.
- Cloudflare's counters are approximate, eventually consistent, and local to each Cloudflare location. This is an abuse/automation brake, not a strict global quota.
- If the Cloudflare binding is unavailable, Security Guard fails open and emits a sanitized warning so a counter outage cannot lock out the ERP.

## Wrangler namespaces

Development uses namespace ID 202611111101; Production uses 202611111102. These are separate identifiers assigned for this integration. Confirm they are unused in the Cloudflare account before first deployment.

## Rollout

1. Merge and deploy to Development only after reviewing this PR and confirming the namespace IDs.
2. Observe rate-limit-exceeded events against representative employee traffic.
3. Tune the 600/minute threshold from measurements before any enforcement.
4. Change JB_SECURITY_GUARD_MODE to enforce only in a separately approved rollout.
5. Production deployment remains behind the existing explicit release gate; this PR does not deploy anything.

Cloudflare API reference: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.
