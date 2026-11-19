# Ausome Learning Minds

School website built with HTML, CSS and vanilla JavaScript, with a Node.js backend
for school and aftercare applications. Vite builds the public website.

## Getting started

```bash
npm install
npm run admin:password  # choose the owner's private application-inbox password
npm run dev      # start the website and Node application backend
npm run build    # production build to dist/
npm run preview  # preview the production build
```

Requires Node 24.13+. See [Node backend setup and deployment](server/README.md)
for encrypted storage, SMTP, owner login, and cPanel instructions. GitHub Pages
remains a static presentation; it cannot run the application backend. Local email
is disabled until SMTP is configured. `npm run preview` previews only static files;
use `npm start` after building for the complete app at port 3001, with
`PUBLIC_ORIGIN=http://127.0.0.1:3001` when testing that server locally.

## Structure

```
index.html        Home page
about.html        About page
programs.html     Programs page
workshop-events.html  Workshops and events photo gallery
admin.html        Owner editor for workshop content, photographs and events
applications-admin.html  Password-protected application inbox (requires Node API)
server/           Application API, encrypted SQLite store, validation and mail queue
admission.html    Admission & fees, with links to the online forms
apply.html        Online application form
aftercare.html    Online aftercare form
find-us.html      Find us page (set the address in its data-address attribute)
contact.html      Contact details, enquiry form, work hours and map
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
The workshop editor does not use the application database. Removing a photo removes its
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

## Application PDF copies

After the Node backend saves an application or aftercare submission, the success panel
offers a branded PDF download. It includes every form section, the answers,
checkbox confirmations, declarations/terms, contact details and page numbers.
Lato fonts are bundled with their open font licence for accented names. jsPDF
loads on submission; fonts load only when downloading. A PDF error never prevents
the application being sent. The completed copy stays only in this tab's memory
and is cleared when the page closes or reloads. Downloaded files contain personal
information and should be kept private.

The Node backend also generates the PDF from the saved application for owner
downloads. SMTP can optionally attach it to the school's notification email;
otherwise the email includes a reference and a link to the private owner inbox.
School and aftercare applications no longer use Formspree.

Run `node --test tests/*.test.mjs` for checks. To generate fictional samples and
render every page for inspection, run `node scripts/preview-application-pdfs.mjs`.
The resulting `output/pdf/` and `tmp/pdfs/` folders are ignored by Git.

## Contact page

`contact.html` follows the original Contact page's phone numbers, address and
public school email. Owner-updated hours are Monday-Thursday 06:45-13:30,
Friday 06:45-13:00, aftercare 06:45-18:00, weekends closed. The public email is
`info@ausomelearningminds.co.za`. Enquiries post to the owner's separate Formspree
endpoint `https://formspree.io/f/xyewpbnl`. The target notification email is managed
in Formspree; the public school email is not replaced with the temporary test inbox.
The form preserves a message on failure and confirms only after an accepted
response. Its email-app fallback can be used if the endpoint is removed.
Public navigation points to Contact us; the existing Find us page remains available.
