# Google Maps Scraper — Project Notes

Chrome MV3 extension. Extracts B2B local leads from Google Maps result pages.

## How extraction actually works

It does **not** scrape the DOM cards. It hijacks Google Maps' own data:

1. `contentScript2.js` (`document_start`) injects `injected.js` into the page's
   main world.
2. `injected.js` monkey-patches `XMLHttpRequest`. When Maps fires a `/search`
   XHR, it `postMessage`s the raw response to the content world.
3. `contentScript.js` (`document_end`) listens for those messages, parses the
   protobuf-ish nested arrays (`results[64]` → per-place fields at fixed
   indices like `e[11]`=name, `e[178][0][0]`=phone, `e[78]`=placeID), and
   appends leads. It also renders an in-page control panel (injected into
   `.w6VYqd`): Start/Stop Auto Extract, Export, Clear, an email-scrape toggle,
   and a scroll progress bar.
4. `js/mybg.js` (loaded by the `bg.js` service worker) handles messages:
   `openPage` (save leads → open dashboard), `access` (fetch a URL), `email`
   (deep email/social scrape of a lead website).
5. `dashboard.html` + `js/dashboard.js` render leads with Tabulator
   (dynamic columns, header filters, CSV/XLSX/JSON export).

`js/util.js` defines `newTabulator()` (a secured-fetch Tabulator wrapper) and
auth/fetch cookie helpers — it is NOT a dedup utility.

## Key state in contentScript.js

- `leads` — in-memory array of collected leads.
- `leads_lnglat` — `Set` of seen `placeID`s for dedup.
- `collect_email` — email-scrape toggle. **Default on**; the panel checkbox
  can disable it to keep the per-lead website fetch from blocking the pipeline.
- Leads are persisted to `chrome.storage.local.leads` on every batch and
  reloaded on startup (survives a Maps reload); `leads_lnglat` is re-seeded
  from stored placeIDs so dedup spans sessions/searches.

## Conventions

- Vanilla JS, no build step. The shipped JS is Google-Closure-minified; match
  the surrounding style and keep the fixed array-index parsing untouched.
- Keep diffs minimal; preserve the XHR-intercept architecture.
- IMPORTANT: this repo's working tree had no reachable `.git` during setup —
  do not rely on `git checkout` to undo edits here.
