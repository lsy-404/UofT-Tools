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

The Planner has three sections: choose a home campus and programs, build a course plan, then select timetable sections and preview schedules.

## License

Copyright (c) 2026 contributors to UofT-Tools.

The project's original source code, including the code used to build and run the tools, is licensed under the [MIT License](LICENSE) (`MIT`). See [`LICENSE`](LICENSE) for the complete terms.

University of Toronto academic information and other source material are not covered by this license. In particular, the calendar feeds and the course, program, and timetable data in `data/` are derived from University of Toronto websites. This project does not claim ownership of those materials or grant rights to them. Academic information and planning suggestions are intended for personal reference, not as official university advice or services. These source materials are separate from the project's original source code license; this intended-use statement applies to those materials and suggestions only. Dependencies remain subject to their own licenses.
