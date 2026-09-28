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
- **Data**: scraper-generated `*.ics` / planner JSON live in `data/` (separate from the web sources). Vite serves this directory in development and copies it into `dist/` during the build, preserving paths such as `/calendar/*.ics` and `/planner/data/*.json`
- **Deployment**: `dist/` is the publish directory (`wrangler deploy`); `npm run deploy` builds + deploys
- **Updates**: Automatic calendar sync every 24 hours

### Layout

```
web/        Vue 3 + Vite app (index/faq/statement/calendar/planner entries + src/)
data/       scraper output — calendar/*.ics, planner/data/*.json (copied into dist/ at build)
scripts/    Python scrapers — calendar/ planner/ common/
dist/       build output (gitignored): app assets and copied data/
```

### Local development

```bash
npm install
npm run dev                       # Vite dev server (web/ app)
npm run build                     # vite build → dist/, including data/
npm run preview                   # serve dist/ with data (full local test)
npm test                          # Vitest unit + component tests
```

> Note: `npm run dev` serves the app only; the scraper data in `data/` is copied
> in at build time, so use `npm run build && npm run preview` to test with live data.

</details>

## Disclaimer

This project is **not** affiliated with, sponsored by, or endorsed by the University of Toronto or any of its campuses, staff, or departments. All tools are provided as-is for student convenience. Always verify official information through the University of Toronto's official registrar and administrative websites.

## Three-campus planner

The planner retains UTM and imports every entry in the UTSG Arts & Science (including Rotman) and UTSC official program-search catalogs, with separate home-campus profiles and full ERIN/ARTSC/SCAR timetable snapshots. Course roles distinguish required courses, alternatives, elective pools and optional recommendations; course levels are separate from recommended study years. See [coverage, official sources and maintenance](docs/planner-coverage.md) for scope, inventory reconciliation and limitations. Degree progress is a partial check, not certification of graduation. Cross-campus course recognition requires manual verification.
