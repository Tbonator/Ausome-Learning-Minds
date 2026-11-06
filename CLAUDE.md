# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marketing website for Ausome Learning Minds, a home-based schooling and tutoring centre for children with diverse learning needs, located in Alberton, South Africa. Plain HTML, CSS and vanilla JavaScript. No framework. Vite is the only dependency, used as the dev server and bundler.

The owner asked to keep the site minimal for now. Do not add authentication, databases, payments, admin features or e-commerce unless explicitly asked.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the dist/ build
```

There are no tests and no linter.

## Architecture

- **Multi-page, no templating.** Each page is a standalone HTML file in the project root (`index.html`, `about.html`, `find-us.html`). The nav, Google Fonts links and footer are duplicated in every page. When you change one of them, change it on every page.
- **Register new pages** in the `build.rollupOptions.input` list in `vite.config.js`. Otherwise `npm run build` leaves them out.
- **Keep paths relative.** Use `src/css/main.css`, `src/images/...` and `about.html`, never `/...`. The owner opens pages directly or with Live Server as well as through Vite. Root-relative paths, and Vite's `public/` folder, broke images in those cases. Keep assets in `src/images/` so Vite fingerprints or inlines them at build time.
- **Styling.** All styles live in `src/css/main.css`. Design tokens (colours, fonts, radii) are CSS custom properties on `:root`. Reuse the existing building blocks instead of adding new ones:
  - `.hero`, plus `.hero--page` for inner pages
  - `.tile--*` cards with a solid offset `box-shadow` driven by a `--shadow` variable
  - `.split`, `.mission`, `.cta`, `.video-card`, `.photo`, `.map-card`, and `.btn--*` / `.pill`
- **Decorative 3D shapes.** These are absolutely positioned `.shape` elements. Each one is placed with inline CSS variables: `--x`, `--y`, `--s` (size), `--r` (cube rotation) and `--d` (animation delay).
  - Cubes are SVG images (`src/images/cube-*.svg`).
  - Spheres and rings are pure CSS (`.sphere--yellow|red|white`, `.ring`, `.ring--dark`).
  - The parent element must be `position: relative`.
- **JavaScript.** `src/js/main.js` is the single entry, loaded as `type="module"` by every page. It does five things:
  - footer year (`[data-year]`)
  - mobile nav toggle
  - placeholder video play buttons
  - the Find us map
  - scroll-reveal
- **Scroll-reveal.** Scroll-reveal hides `.reveal` elements only under `html.js`. `main.js` sets that class itself, so the content stays visible if the module fails to load (for example under `file://`). Don't move the class back into an inline `<head>` script.
- **Find us map.** `find-us.html` holds the address in `data-address` on the `[data-location]` section. `main.js` builds the Google Maps embed (`https://www.google.com/maps?q=...&output=embed`, no API key) and the directions link from it. The visible address text is also hard-coded in the HTML.
- **Online forms.** `apply.html` and `aftercare.html` are online versions of the paper PDFs (`Ausome-Learning-Application-Form-2026.pdf`, `Aftercare-Agreement-2026-.pdf`) and match their fields. The PDFs are kept locally for reference only and are git-ignored.
  - Any `form[data-online-form]` is handled by `main.js`: it validates with native constraint validation (`novalidate`, plus a `.was-validated` class for red highlights), then POSTs `FormData` to the form's `data-endpoint`, then shows the `.form-success` block that follows the form.
  - While `data-endpoint` is empty, submissions are blocked and the parent is told to phone instead.
  - Field `name`s are human-readable (e.g. "Learner - Surname") because they become the labels in the emailed submission.
  - `_subject` and `_gotcha` (spam honeypot) follow the Formspree conventions.
  - Ticking a checkbox replaces initialling each section of the paper form, and a typed name with a consent checkbox replaces the signature.
- **Responsive breakpoints.** 860px stacks the grids, 760px switches to the hamburger nav, and 560px uses single-column tiles. Motion is disabled under `prefers-reduced-motion`.

## Content

- Phone numbers: 064 909 7710 / 064 510 9728, linked as `tel:+27...`.
- Address: 17 Toinette St, Ext 2, Brackenhurst, Alberton, 1448.
- Text in `[square brackets]` is a placeholder still waiting for real content, for example video descriptions and opening hours. Photos supplied by the owner live in `src/images/`; the `.hero-photo` class frames a photo in a hero.
- `programs.html` uses the six programs from the live site. `admission.html` shows the fees and links to the online forms.
- The live site at https://ausomelearningminds.co.za/ sits behind bot verification and can't be fetched automatically. Ask the user for content from it.
- Fee content shown on `admission.html`. These are the 2027 intake fees; the live site also says "Registration Now open for 2026".
  - Registration: R 1000.00 once-off. It is non-refundable, includes two assessments, and does not guarantee placement.
  - Centre fees: R 5000.00 per month.
  - Aftercare: R 1200.00 per month.
- Where sources conflict, the live site wins (owner decision): aftercare is R1 200/month (not the PDF's R800), and the second phone number is 064 510 9728.
- The two PDFs give different FNB branch codes (253305 and 250655). Banking details are deliberately not on the website.
