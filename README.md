# Google Maps Scraper

Chrome extension that extracts business leads from Google Maps search results and exports them to CSV, XLSX, or JSON. Runs fully locally — no remote auth, no quota gate, no telemetry.

## Features

### Data extraction

Captures from each Google Maps listing:

- Business Name
- Phone Number
- Website URL
- Email Address (when publicly available on the business site)
- Social profiles: Facebook, Instagram, LinkedIn, Twitter/X, YouTube, Yelp
- Physical Address
- Google Place ID
- CID (Google internal listing ID)
- Star Rating and Review Count
- Business Hours per weekday
- Business Category
- Latitude / Longitude

### Auto-scroll pagination

Click **Start Auto Extract** on a Maps search results page. The extension scrolls the result feed automatically with randomized delays (1–3 s) and stops on:

- "You've reached the end" indicator
- Feed height unchanged for 20 consecutive iterations
- Manual **Stop**

### Deduplication

Listings deduped in-memory by Google Place ID across the current session.

### Email enrichment

For each lead with a website, the background service worker fetches the homepage plus common contact/about pages (`/contact`, `/about`, `/team`, etc.), extracts:

- Emails (with Cloudflare `data-cfemail` decoding)
- Social links

Concurrency capped at 5 simultaneous fetches with 250 ms inter-request delay. 10-second timeout per request. Emails matching the business domain are preferred over generic ones; blacklisted patterns (`noreply`, `wixpress.com`, image extensions, etc.) are dropped.

### Dashboard

Opens in a new tab on **Export Leads**. Features:

- Sortable, resizable, filterable columns (per-column header filter)
- Pagination (25 / 50 / 100 / 250 / 500 per page)
- Movable columns
- Persisted to `chrome.storage.local` — survives browser restarts
- Download as CSV, XLSX, or JSON
- Clear stored leads (with confirmation)

### Search shortcut

Popup includes a text input that opens `google.com/maps/search/<query>` in a new tab. Enter key submits.

### Resilience

- Fallback selectors for Maps DOM elements that Google rotates
- `MutationObserver` re-mounts the UI if Maps re-renders
- Defensive parsing wraps every brittle index lookup in `safeGet()` — feed payload shape changes degrade gracefully instead of throwing
- Cloudflare email decoder for sites that obfuscate addresses

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this repo directory
3. Pin the extension, open `https://www.google.com/maps`, search

## Usage

1. Search on Google Maps (e.g. "coffee shop near new york")
2. Wait for results to load
3. Click **Start Auto Extract** in the injected control panel
4. Wait for scroll to complete
5. Click **Export Leads** → dashboard opens
6. Filter / sort / download

## Permissions

- `storage` — persist leads across browser sessions
- `scripting` — inject the XHR hook into Maps pages
- `host_permissions: *://*/*` — fetch business websites for email/social enrichment

## Browser support

Chrome 88+ and any Chromium-based browser (Edge, Brave, Vivaldi, etc.).

## File map

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 extension manifest |
| `bg.js` | Service worker entry point |
| `js/mybg.js` | Message router + URL fetch + email/social extractor |
| `contentScript2.js` | Injects `injected.js` into Maps page context |
| `injected.js` | Hooks `XMLHttpRequest` to capture Maps `/search` responses |
| `contentScript.js` | UI overlay, auto-scroll loop, feed parser, lead dedup |
| `popup.html` / `js/popup.js` | Toolbar popup with search input |
| `dashboard.html` / `js/dashboard.js` | Lead table with filter / sort / export |
| `lib/` | jQuery, Tabulator (table), SheetJS (XLSX export) |

## License

Apache License 2.0 — see [LICENSE](LICENSE).
