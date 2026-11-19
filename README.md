# Ausome Learning Minds

Minimal starter built with plain HTML, CSS and vanilla JavaScript. [Vite](https://vitejs.dev) is used only as the dev server and build tool.

## Getting started

```bash
npm install
npm run dev      # start local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Structure

```
index.html        Home page
about.html        About page
programs.html     Programs page
workshop-events.html  Workshops and events photo gallery
admin.html        Owner editor for workshop content, photographs and events
admission.html    Admission & fees, with links to the online forms
apply.html        Online application form
aftercare.html    Online aftercare form
find-us.html      Find us page (set the address in its data-address attribute)
vite.config.js    Lists the pages included in the build
src/css/main.css  Global styles
src/js/main.js    JavaScript entry point
src/images/       Images and icons
```

Workshop page content and its eight photographs were imported from
https://ausomelearningminds.co.za/workshop-events/. Photographs are stored locally
in `src/images/workshops/`; the source page does not list dated upcoming events.
Selecting a gallery photo opens an on-page modal viewer with next/previous
controls, captions, thumbnails, keyboard navigation, and touch swipe. Escape or
Close dismisses the viewer and returns focus to the original photo. The admin
preview uses the same viewer.

## Owner admin

Open `admin.html` to edit the workshop page text, choose a featured photo, upload
JPEG/PNG/WebP photos, edit captions and image descriptions, reorder or remove
gallery entries, and add/edit/remove events. Events have a date, optional start
time (SAST), venue, description, optional booking URL, and draft/published status.
Only published events dated today or later appear in Upcoming events. Draft means
hidden from the page, not private: content is stored in the public repository.

The public page reads `src/content/workshops.json`. Vite bundles referenced images
from `src/images/workshops/`. Uploads and page data are committed together to
`Tbonator/Ausome-Learning-Minds` on `main`, triggering the existing Pages workflow.
There is no additional hosted database or server. Removing a photo removes its
gallery entry; existing image files remain in the repository and its history.

Deploy this feature to `main` before connecting the editor. The owner must create
a fine-grained GitHub personal access token scoped only to this repository, with
Contents read/write permission and an expiry date. No workflow/admin permission
is needed. Repository rules may still require a pull request; this editor needs
permission to update `main` directly and never bypasses rules or force-pushes.
See [GitHub token setup](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

The token is held only in JavaScript memory and sent only to GitHub's API. It is
never written to storage, URLs, source files, or commits. Reloading/disconnecting
clears the editor's token. Unsaved text and uploads remain only in the current
tab; keep it open until publishing succeeds. Do not paste tokens into chat.
Connecting loads the latest committed content; conflicting page edits block
publishing. A successful save means a Git commit exists, not that deployment has
finished. Check the repository's Actions tab for deployment failures or progress.

Local preview: `npm run dev`, then open `/admin.html`. Try the editor without a
token; publishing stays disabled until connected. Connected publishing always
writes to the actual GitHub repository, including from localhost. GitHub changes
do not automatically update this local checkout; pull them before later coding.

Checks: `node --test tests/workshops.test.mjs` and `npm run build`. GitHub API tests
use mocked responses and never publish changes to the live repository.
