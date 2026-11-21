# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Website for Ausome Learning Minds, a home-based schooling and tutoring centre for children with diverse learning needs, located in Alberton, South Africa.

- **Frontend:** plain HTML, CSS and vanilla JavaScript, no framework. Vite is the dev server and bundler.
- **Backend:** a Node.js (24.13+) Express app in `server/` that receives the school and aftercare applications, stores them encrypted in built-in SQLite (`node:sqlite`), emails the school, and serves a password-protected owner inbox.

The owner wants the site kept minimal. The application backend and owner login exist because they were asked for. Do not add payments, e-commerce, more databases or new admin features unless explicitly asked.

`README.md` covers features in detail. `server/README.md` covers backend setup, SMTP, privacy and cPanel deployment. `SECURITY_REVIEW.md` records the security review.

## Commands

```bash
npm install
npm run admin:password  # one-off: writes .env with the owner password hash and data-encryption key
npm run dev             # Vite at http://127.0.0.1:5173 + API at 127.0.0.1:3001 (scripts/dev.mjs)
npm run dev:web         # Vite only
npm run dev:server      # API only, with node --watch
npm test                # node --test tests/*.test.mjs
node --test tests/workshops.test.mjs   # a single test file
npm run build           # prebuild regenerates server/form-definitions.json, then vite build to dist/
npm run preview         # static preview of dist/ only (no API)
npm start               # full app from dist/ on port 3001 (set PUBLIC_ORIGIN=http://127.0.0.1:3001 locally)
npm run smtp:setup      # interactive Gmail/Yahoo SMTP setup into .env; smtp:test sends one test email
npm run package:hosting # build + zip to output/deploy/ for cPanel hosting
```

- Tests use in-memory databases and mocked email. They never send mail or publish to GitHub.
- There is no linter.
- Interactive scripts (`admin:password`, `smtp:setup`) prompt for secrets. The user must run them in their own terminal. Never ask for passwords or tokens in chat.

## Deployment

- **GitHub Pages.** Every push to `main` runs `npm test` and `npm run build`, then deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`) at https://tbonator.github.io/Ausome-Learning-Minds/. Pages is a static presentation only: the API doesn't run there, so application submissions are unavailable on it. `base: './'` in `vite.config.js` keeps asset URLs relative so the sub-path works.
- **Full Node app.** This is intended for the school's cPanel Node hosting. The startup file is `app.cjs`, which imports `server/index.mjs`. In production, Express serves `dist/` and `/api` from one origin. Configuration comes from environment variables or `.env` (see `.env.example`). `.env` and `.local-data/` are git-ignored and must never be committed.

## Architecture

### Frontend

- **Multi-page, no templating.** Each page is a standalone HTML file in the project root:
  - public pages: `index`, `about`, `programs`, `workshop-events`, `admission`, `apply`, `aftercare`, `find-us`, `contact`
  - owner pages: `admin`, `applications-admin`

  The nav, Google Fonts links, favicon links and footer are duplicated in every public page. When you change one of them, change it on every page.
- **Register new pages** in the `build.rollupOptions.input` list in `vite.config.js`. Otherwise `npm run build` leaves them out.
- **Keep paths relative.** Use `src/css/main.css`, `src/images/...`, `about.html` and `api/...`, never `/...`. The owner opens pages directly or with Live Server as well as through Vite. Root-relative paths, and Vite's `public/` folder, broke images in those cases. Keep assets in `src/images/` so Vite fingerprints or inlines them at build time.
- **Styling.** Public styles live in `src/css/main.css` and owner-page styles in `src/css/admin.css`. Design tokens (colours, fonts, radii) are CSS custom properties on `:root`. Reuse the existing building blocks instead of adding new ones:
  - `.hero`, plus `.hero--page` for inner pages
  - `.tile--*` cards with a solid offset `box-shadow` driven by a `--shadow` variable
  - `.split`, `.mission`, `.cta`, `.video-card`, `.photo`, `.map-card`, and `.btn--*` / `.pill`
- **Decorative 3D shapes.** These are absolutely positioned `.shape` elements. Each one is placed with inline CSS variables: `--x`, `--y`, `--s` (size), `--r` (cube rotation) and `--d` (animation delay).
  - Cubes are SVG images (`src/images/cube-*.svg`).
  - Spheres and rings are pure CSS (`.sphere--yellow|red|white`, `.ring`, `.ring--dark`).
  - The parent element must be `position: relative`.
- **JavaScript.** Every public page loads `src/js/main.js` as `type="module"`. It handles:
  - the dismissible payment notice (`[data-payment-notice]`, deliberately not remembered)
  - footer year (`[data-year]`)
  - mobile nav toggle
  - placeholder video play buttons
  - the Find us map
  - online application forms
  - scroll-reveal

  Page-specific modules:
  - `contact.js`: Contact enquiry form
  - `workshops.js`, `workshop-content.js`, `photo-gallery.js`: workshop page and modal photo viewer
  - `admin.js`, `workshop-github.js`: workshop editor
  - `applications-admin.js`: owner inbox
  - `application-pdf.js`: PDF builder, shared by the browser and the server
- **Scroll-reveal.** Scroll-reveal hides `.reveal` elements only under `html.js`. `main.js` sets that class itself, so the content stays visible if the module fails to load (for example under `file://`). Don't move the class back into an inline `<head>` script.
- **Find us map.** `find-us.html` holds the address in `data-address` on the `[data-location]` section. `main.js` builds the Google Maps embed (`https://www.google.com/maps?q=...&output=embed`, no API key) and the directions link from it. The visible address text is also hard-coded in the HTML. `contact.html` also shows the map.
- **Content Security Policy.** The server sets a CSP with Helmet in `server/app.mjs`. Owner pages and `/api` get a stricter policy than public pages, and TikTok scripts are allowed only on the homepage. Any new external script, frame, image or fetch origin must be added there, or it will be blocked in production. `tests/security-config.test.mjs` covers this.

### Online application forms (school + aftercare)

`apply.html` and `aftercare.html` are online versions of the paper PDFs (`Ausome-Learning-Application-Form-2026.pdf`, `Aftercare-Agreement-2026-.pdf`) and match their fields. The PDFs are kept locally for reference only and are git-ignored.

- **Browser side.** `main.js` handles any `form[data-online-form]`:
  - validates with native constraint validation (`novalidate`, plus a `.was-validated` class for red highlights)
  - POSTs multipart `FormData` to the form's relative `data-endpoint` (`api/applications/school` or `api/applications/aftercare`) with an idempotency key
  - shows the `.form-success` block with the returned reference and a "download PDF" button. The PDF is built in the browser by `application-pdf.js` with jsPDF and the bundled Lato fonts in `src/fonts/`.
- **Form fields.** Field `name`s are human-readable (e.g. "Learner - Surname") because they become labels in the stored record and the PDF. `_`-prefixed fields such as `_gotcha` (spam honeypot) are ignored.
- **Paper-form equivalents.** Ticking a checkbox replaces initialling each section of the paper form, and a typed name with a consent checkbox replaces the signature.
- **Server-side definitions.** `server/form-definitions.json` is **generated** from the HTML forms by `scripts/generate-form-definitions.mjs` (runs as `prebuild`). It holds required fields, options, declarations and a version hash. After changing any field or declaration in `apply.html` or `aftercare.html`, run `npm run build` (or the script directly) and commit the regenerated JSON. The server rejects submissions whose form version doesn't match, so the API and the built site must be deployed together.

### Backend (`server/`)

- `index.mjs` starts the server and `app.mjs` defines the Express app and routes:
  - `GET /api/health`
  - `POST /api/applications/:kind`
  - `/api/staff/*`: login, session, logout, list, PDF, mark reviewed, retry email
- `config.mjs` reads environment variables.
- `validation.mjs` validates submissions against the form definitions and never trusts browser checks.
- `store.mjs` holds the SQLite store. Records are AES-256-GCM encrypted with `DATA_ENCRYPTION_KEY`, and local data goes to `.local-data/`.
- `auth.mjs` handles scrypt password hashing and session tokens.
- `pdf.mjs` builds the owner PDF from the saved record.
- `mailer.mjs` is a mail outbox queue. It retries failed sends and leaves the stored record in place if email fails.
- Security model:
  - writes require an exact `Origin` match with `PUBLIC_ORIGIN`
  - owner sessions use HttpOnly, SameSite=Strict cookies plus CSRF tokens
  - login and submission routes are rate limited
  - nothing logs learner data. Keep it that way.
- In dev, Vite proxies `/api` to port 3001. `server.fs.deny` in `vite.config.js` blocks `.env`, `server/`, `.local-data/` and database files from being served. If you change the Vite port, change `PUBLIC_ORIGIN` to match.
- `MAIL_MODE=disabled` (the local default) still saves applications but sends no email.

### Owner pages

- **`applications-admin.html`** is the application inbox. It needs the Node API, and the owner signs in with the username from `ADMIN_USERNAME` (default `owner`).
- **`admin.html`** is a separate, purely client-side workshop editor. It edits `src/content/workshops.json` and uploads photos to `src/images/workshops/`.
  - It commits directly to `main` of `Tbonator/Ausome-Learning-Minds` through the GitHub API, using a fine-grained token the owner pastes in. The token is held in memory only.
  - Publishing from localhost still writes to the real repository. Pull afterwards before coding.

### Contact form

`contact.html` posts to Formspree (`https://formspree.io/f/xyewpbnl`) via `contact.js`, independently of the Node backend.

### Responsive breakpoints

860px stacks the grids, 760px switches to the hamburger nav, and 560px uses single-column tiles. Motion is disabled under `prefers-reduced-motion`.

## Content

- Phone numbers: 064 909 7710 / 064 510 9728, linked as `tel:+27...`.
- Address: 17 Toinette St, Ext 2, Brackenhurst, Alberton, 1448.
- Public email: info@ausomelearningminds.co.za.
- Hours: Monday-Thursday 06:45-13:30, Friday 06:45-13:00, aftercare 06:45-18:00, weekends closed.
- Text in `[square brackets]` is a placeholder still waiting for real content, for example video descriptions. Photos supplied by the owner live in `src/images/`; the `.hero-photo` class frames a photo in a hero.
- `programs.html` uses the six programs from the live site. `admission.html` shows the fees and links to the online forms. `workshop-events.html` content and photos were imported from the live site's workshop page.
- The live site at https://ausomelearningminds.co.za/ sits behind bot verification and can't be fetched automatically. Ask the user for content from it.
- Fee content shown on `admission.html`. These are the 2027 intake fees; the live site also says "Registration Now open for 2026".
  - Registration: R 1000.00 once-off. It is non-refundable, includes two assessments, and does not guarantee placement.
  - Centre fees: R 5000.00 per month.
  - Aftercare: R 1200.00 per month.
- Where sources conflict, the live site wins (owner decision): aftercare is R1 200/month (not the PDF's R800), and the second phone number is 064 510 9728.
- The two PDFs give different FNB branch codes (253305 and 250655). Banking details are deliberately not on the website.
- Never use real children's details in local testing or demos; use clearly fictional data.
