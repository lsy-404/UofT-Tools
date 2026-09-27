# UofT-Tools – Utility Suite for University of Toronto Students

A collection of open-source tools designed to make student life at the University of Toronto easier.

> **NOT AN OFFICIAL UNIVERSITY PRODUCT.**
> This is an independent student project, not affiliated with or endorsed by the University of Toronto.
> Always verify important information at the official university websites.

---

## Website

Visit **[uoft.voidcarve.com](https://uoft.voidcarve.com)** to access all tools and features.

## Technical Overview

<details>
  <summary><strong>How to build & dev</strong></summary>

- **Frontend**: Vue 3 + Vite multi-page app, isolated under `web/` (page entries + `web/src/`), deployed to Cloudflare (Workers static assets)
- **Backend**: Python web scrapers (Playwright + BeautifulSoup), organised by module under `scripts/{calendar,planner,common}/`, run on a schedule via GitHub Actions
- **Data**: scraper-generated `*.ics` / planner JSON live in `data/` (separate from the web sources). `npm run build` runs `vite build` then `copy-data.mjs`, which copies `data/` into `dist/` so the deployed paths (`/calendar/*.ics`, `/planner/data/*.json`) are unchanged
- **Deployment**: `dist/` is the publish directory (`wrangler deploy`); `npm run deploy` builds + deploys
- **Updates**: Automatic calendar sync every 24 hours

### Layout

```
web/        Vue 3 + Vite app (index/faq/statement/calendar/planner entries + src/)
data/       scraper output — calendar/*.ics, planner/data/*.json (copied into dist/ at build)
scripts/    Python scrapers — calendar/ planner/ common/
dist/       build output (gitignored): vite build + copied data/
```

### Local development

```bash
npm install
npm run dev                       # Vite dev server (web/ app)
npm run build                     # vite build → dist/, then copy data/ → dist/
npm run preview                   # serve dist/ with data (full local test)
npm test                          # Vitest unit + component tests
```

> Note: `npm run dev` serves the app only; the scraper data in `data/` is copied
> in at build time, so use `npm run build && npm run preview` to test with live data.

</details>

## Disclaimer

This project is **not** affiliated with, sponsored by, or endorsed by the University of Toronto or any of its campuses, staff, or departments. All tools are provided as-is for student convenience. Always verify official information through the University of Toronto's official registrar and administrative websites.

## Three-campus planner

The planner supports UTM and selected UTSG Arts & Science / UTSC programs, with separate home-campus profiles and full ERIN/ARTSC/SCAR timetable snapshots. See [coverage, official sources and maintenance](docs/planner-coverage.md) for the exact supported scope and limitations. Degree progress is a partial check, not certification of graduation. Cross-campus course recognition requires manual verification.
