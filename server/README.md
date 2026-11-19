# School-owned Node.js applications

This backend replaces Formspree for school and aftercare applications. It runs on
Node.js **24.13 or newer**, uses built-in SQLite, and serves the Vite-built website
and API from one origin. No hosted form or database subscription is required.
The independent Contact Us enquiry form still uses its existing Formspree endpoint.

## Run locally

1. `npm install`
2. `npm run admin:password` in your own terminal. Choose a private owner password
   of at least 12 characters. This writes an ignored `.env` containing a scrypt
   password hash and a data-encryption key; it never prints the password or key.
3. `npm run dev` starts Vite at `http://127.0.0.1:5173` and the API at port 3001.
4. Open `/applications-admin.html`; the default owner username is `owner`.

Local email delivery is disabled. Applications still save to `.local-data/` and
the owner can download their PDFs. Configure SMTP in `.env` to test actual email
delivery. Never use real children's details for local demonstrations.

### Gmail for local email tests

Enable Google 2-Step Verification, then generate an app password named
`Ausome Learning Minds` at https://myaccount.google.com/apppasswords.
Google requirements: https://support.google.com/accounts/answer/185833
App passwords may be restricted by organization policies or Advanced Protection.
This helper supports personal Gmail/Googlemail mailboxes.

Run `npm run smtp:setup`, choose `gmail`, enter the Gmail sending address, then
enter the separate receiving email (Yahoo is supported). Enter the generated
16-character app password at the masked prompt. The helper uses
`smtp.gmail.com` with TLS on port 465, verifies authentication without sending
email, and saves only after successful verification. It keeps the existing owner
password and encryption key. Restart the backend, then use `npm run smtp:test`
to send one test notification to the selected recipient.

### Yahoo for local email tests

Create a Yahoo **app password**, not your normal Yahoo account password:
https://help.yahoo.com/kb/mail/generate-app-specific-password-sln15241.html
Name it `Ausome Learning Minds`. Then run `npm run smtp:setup` in your own terminal
and choose `yahoo`.
Enter the full Yahoo email address and the app password when prompted. The password
is masked and never printed. The command verifies TLS authentication without
sending mail and writes the settings to the ignored `.env` only on success.
Owner credentials and the encryption key are preserved. Yahoo settings are
`smtp.mail.yahoo.com`, port 465 with TLS. You can choose the same mailbox or a
separate notification recipient. Optional full PDF attachments are an explicit setup choice.

Restart the backend after setup. Pending local applications will be processed.
Run `npm run smtp:test` to send one plain delivery-test email with no learner
details, then check Inbox and Spam. Yahoo may restrict app-password generation
for some accounts; if that option is unavailable, use an eligible mailbox rather
than your normal account password or disabling TLS.

If only the existing Vite server is already running, `npm run dev:server` starts
the API separately. `npm run dev:web` starts only Vite. To change the frontend
origin/port, update `PUBLIC_ORIGIN` and the Vite port together; the API enforces
an exact matching Origin for writes.

## Publish on the school's cPanel hosting

The host must provide Node 24.13+ with `node:sqlite` enabled, a persistent LOCAL
filesystem supporting SQLite locking, HTTPS, and outbound authenticated SMTP.
If the host offers only older Node versions or network-mounted storage, do not
launch this implementation as-is; select another supported Node host or adapt
the store to MariaDB. A PostgreSQL/MySQL service is not required for this version.

Run `npm run package:hosting` to build and create
`output/deploy/ausome-node-deployment.zip`. It includes only an explicit runtime
file list plus built public assets, with checksums. It excludes the real `.env`,
passwords, encryption keys, application records and local samples. Give this
archive to the owner/developer once they provide a staging Node application.
The developer will need to configure new production secrets privately.

1. Back up the existing WordPress website and database before replacing any
   public files. Do not change the current live website just to test this app.
2. Build locally: `npm ci`, then `npm run build`. The prebuild step regenerates
   `server/form-definitions.json` from the current forms, including server-side
   required fields, options, declarations and the 3% financial term.
3. In **Setup Node.js App**, create a production application with a private
   application root, for example `/home/ACCOUNT/ausome-node`, outside
   `public_html`. Use a staging subdomain first. The application URL must be at
   the subdomain/domain ROOT, not a subdirectory. Startup file: **app.cjs**.
4. Upload `app.cjs`, `package.json`, `package-lock.json`, `server/`,
   `src/js/application-pdf.js`, `src/fonts/`, and the prebuilt `dist/` directory
   into that private application root. Do not upload local data, samples,
   node_modules, Git metadata, or the local `.env` by accident.
5. Install production dependencies with `npm ci --omit=dev`, or use cPanel's
   Run NPM Install. Vite, jsdom, and the PDF preview tools are not needed at
   runtime. Do not run a production build after omitting dev dependencies;
   upload the already built `dist/` instead.
6. Set these variables privately in cPanel (or a mode-600 `.env` in the private
   application root):

   | Variable | Value |
   | --- | --- |
   | NODE_ENV | production |
   | PUBLIC_ORIGIN | Exact HTTPS staging or final origin, no trailing slash |
   | DATA_DIR | Absolute private persistent directory, e.g. `/home/ACCOUNT/ausome-data` |
   | DATA_ENCRYPTION_KEY | A separately generated 32-byte base64 key; keep a secure backup |
   | ADMIN_USERNAME | Owner's chosen username |
   | ADMIN_PASSWORD_HASH | The scrypt hash generated by the password setup command |
   | MAIL_MODE | smtp |
   | SMTP_HOST | School mailbox's authenticated SMTP server |
   | SMTP_PORT | 465 for implicit TLS, or 587 for required STARTTLS |
   | SMTP_USER / SMTP_PASS | SMTP mailbox credentials |
   | MAIL_FROM | One authorised sender email address |
   | APPLICATION_EMAIL | One school recipient address |
   | EMAIL_ATTACH_PDF | `true` to attach the full application PDF; `false` for a private workspace link |
   | TRUST_PROXY | Exact number of trusted reverse-proxy hops (confirm with host) |
   | HOST / PORT | Hosting-required listen address/port; honour cPanel's assigned PORT |

7. Start the app, confirm `/api/health`, then sign in at
   `/applications-admin.html`. Test both forms with clearly fictional details;
   confirm the record is stored, the PDF downloads, and the school receives the
   notification before enabling real applications.

GitHub Pages cannot execute this backend. Its existing deployment remains a
static presentation only; school and aftercare submission there will be
unavailable. Publishing this code to GitHub alone does not deploy Node or enable
SMTP. Use the Node-hosted staging URL for full demonstrations.

## Application flow and privacy

- The public form sends multipart fields to `/api/applications/school` or
  `/api/applications/aftercare`. Server validation does not trust browser checks.
- The server stores a validated application snapshot and the applicable terms,
  encrypted with AES-256-GCM, then returns a random reference. It does not expose
  an unauthenticated list or PDF download route.
- Idempotency keys prevent a network retry creating duplicate records. A retry
  with changed details is rejected. The browser retains the request key while
  the tab remains open; reloading after an unknown outcome requires checking
  the owner inbox before resubmitting.
- A form-version check rejects outdated application pages rather than recording
  their confirmations against a newer set of terms. Deploy the API and built
  website together after changing fields or declarations.
- The parent's download stays in the browser after acceptance. The owner PDF is
  generated from the saved, validated server record, with the same branding and
  reference. A stored record is preserved if email delivery fails.
- SMTP notifications contain only a reference and owner-workspace link by
  default. `EMAIL_ATTACH_PDF=true` attaches the complete PDF, including IDs and
  medical information: use only a school-authorised mailbox and handling policy.
- The queue checks every minute, retries failed notifications after five minutes,
  and stops after five attempts. The owner can retry manually. SMTP has no
  exactly-once guarantee; an interrupted send can result in a duplicate email,
  while the application record itself stays unique.
- Owner sessions use random, hashed tokens in the private database, HttpOnly /
  SameSite=Strict cookies (Secure in production), an eight-hour expiry, Origin
  enforcement and CSRF checks for owner changes. Login and submission routes
  have rate limits. Changing the owner password revokes stored sessions when
  using the setup script against this data directory.
- The app serves only `dist/`. Keep the entire application root and DATA_DIR
  outside the web document root. Vite development access also denies `.env`,
  backend sources, database files, and local keys. Do not use Vite as a public
  production server.
- The workshops editor at `/admin.html` remains its separate GitHub-based
  content editor. `/applications-admin.html` is the school-owned application
  inbox; no GitHub token is involved.
  Workshop edits committed through the older editor update the GitHub Pages
  presentation. To update a separately hosted Node copy, rebuild and redeploy
  that copy from the repository; no Node deployment automation is inferred.

## Operations

Use one Node application instance on one persistent local disk. SQLite transactions
and a leased outbox protect database writes and mail claims, but the built-in rate
limiter is process-local. A clustered deployment needs a shared rate-limit store
and a reviewed database/queue design.

Back up the SQLite database consistently with the server stopped (including WAL
files if present), or use SQLite's online backup API. Keep the encryption key
backed up separately. Losing it makes stored applications unreadable. Do not
replace it when changing an owner password or deploying new code. Test restoration.

Set a school-approved retention/deletion policy and remove expired records through
an authorised maintenance process. There is deliberately no automatic deletion
period inferred by this app. Review mailbox copies and backups in that policy.
Use supported dependency versions, TLS, restricted hosting access, and monitored
storage/SMTP quotas. No learner values are logged by the app.

Run `npm test` and `npm run build` before deployment. Tests use isolated in-memory
databases and mocked email; they do not submit real applications or send email.
