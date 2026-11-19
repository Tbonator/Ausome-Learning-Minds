# Application security review

Reviewed: 19 November 2026 (Africa/Johannesburg).

Scope: this repository's Node application API, owner inbox, workshop editor,
browser rendering, private-data handling, production configuration, dependency
advisories, and deployment packaging. Checks used isolated test applications and
databases; they did not send application emails or scan the original live site.

## Results

- `npm audit --json`: **0 known advisories**, including production and development
  dependencies. This is a point-in-time registry check, not proof that every
  dependency is vulnerability-free.
- No GitHub token, Google API key, or private-key signatures were found in the
  source-pattern check. The real `.env` and local database/key directory are
  ignored by Git. Private credentials are not needed in frontend files.
- Automated checks cover validation, encrypted storage, authentication, expiry,
  CSRF and Origin enforcement, private PDF access, duplicate protection, SMTP
  failure recovery, safe DOM rendering, SQL parameterisation, and throttling.

## Fixed finding

### SEC-01: inherited object names selected the wrong application definition

Severity: Low. Status: Fixed.

`definitions[kind]` previously accepted inherited JavaScript object properties
such as `constructor` or `__proto__`. A crafted application type without a terms
version could follow an invalid definition and produce an internal server error.
No authentication bypass, disclosure or stored record was demonstrated.

`server/validation.mjs` now requires `Object.hasOwn(definitions, kind)`. Unknown
and inherited names return 404 without stack traces or database writes.
Regression tests cover these values.

## Additional hardening completed

- Owner pages and APIs use a separate Content Security Policy that permits only
  same-origin scripts. TikTok script permissions are limited to the homepage;
  application forms also permit same-origin scripts only. The policy normalises
  encoded page paths before choosing the
  protected policy. Owner/API responses use `Cache-Control: no-store` and a
  no-referrer policy. GitHub connectivity remains available to the workshop editor.
- Invalid `NODE_ENV` names now fail startup instead of accidentally selecting
  development behaviour. Invalid trusted-proxy hop values also fail startup;
  the real hop count still needs confirmation from the host.
- The Node server bounds request/header/keep-alive timeouts to reduce the cost of
  slow or incomplete requests. The hosting proxy must also enforce its limits.
- New tests verify that HTML-looking learner names render as text, SQL-looking
  names remain database values, forged forwarded-IP headers cannot bypass the
  login limiter when proxy trust is disabled, and production cookies are Secure.

## Existing protections verified

- Owner passwords are scrypt-hashed and compared with constant-time comparison.
- Session cookies use HttpOnly and SameSite=Strict, plus Secure in production.
  Sessions expire and are bound to the configured password version. Owner writes
  require both an authenticated session and CSRF token.
- Private applications and PDFs cannot be fetched without owner authentication.
- Applications are validated against server-owned field and terms definitions.
  Stale versions are rejected. Multipart limits bound input and prohibit files.
- Records are encrypted using AES-256-GCM; prepared SQL statements handle values.
  Private records and keys are kept outside the compiled static directory.
- Idempotency keys prevent repeated saves after a lost network response. SMTP
  failure preserves the stored application and queues a bounded retry.
- Frontend rendering uses DOM/text APIs rather than injecting submitted HTML.
  Public event links allow HTTP/HTTPS only; executable URL schemes are rejected.
- Deployment packaging uses an explicit runtime source list plus built public
  assets and excludes actual environment files, databases, and local keys.

## Before production deployment

These cannot be confirmed without the school's hosting access:

1. Enforce HTTPS and HTTP-to-HTTPS redirection at the actual hosting proxy. Verify
   Secure cookies, certificates, headers, and proxy trust on the deployed origin.
2. Confirm Node 24.13+, persistent local SQLite-compatible storage, and one app
   instance. A clustered deployment needs shared rate limits and a reviewed
   database/queue arrangement; the current login/submission limiter is in memory.
3. Keep the application root, database, `.env`, backups, and encryption key outside
   the public web root with restricted access. Test backup restoration separately.
4. Use school-approved mailboxes for real applications. Full PDF email attachments
   contain IDs and medical details; database encryption does not protect copies
   once delivered to an inbox. Configure the intended attachment option explicitly.
5. Agree on retention/deletion and staff-access procedures. The app does not infer
   a legal retention period, provide multi-user roles, or implement MFA itself.
6. Monitor spam, disk usage, failed email, and login attempts. Public forms have
   rate limits and a honeypot; these are not a guarantee against distributed spam.

The workshop editor's GitHub token remains browser-memory-only and needs a
repository-restricted token. Its GitHub Pages workflow does not automatically
deploy a separate Node-hosted copy. Static GitHub Pages cannot supply this Node
backend's authentication or security response headers.

This was a code review and automated local security check, not a full external
penetration test or a compliance certification.

## Reproduce

```text
npm audit --json
npm test
npm run package:hosting
```

Tests use fictional input and mocked SMTP. The package command rebuilds the site
and writes `output/deploy/ausome-node-deployment.zip` with a checksum manifest.
