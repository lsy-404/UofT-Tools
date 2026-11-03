# 📅 Academic Calendar Feeds

## Overview

The Academic Calendar Feeds tool provides automatically updated calendar subscriptions for all three University of Toronto campuses:
- **St. George (ArtsCI)** — UTSG
- **Mississauga** — UTM  
- **Scarborough** — UTSC

Subscribe to webcal feeds and get important academic dates directly in your calendar app, with automatic updates.

## Features

✅ **Auto-Updates** — Calendar data is refreshed weekly<br>
✅ **Multi-Campus** — Support for all three UofT campuses  
✅ **Easy Integration** — Works with Google Calendar, Apple Calendar, Outlook, and more  
✅ **No Manual Tracking** — Forget about checking the registrar page  
✅ **Open Source** — Built with transparent, publicly auditable web scraping  

## Quick Links

- [Get Started](getting-started.md) — How to subscribe to calendar feeds
- [Campus Subscriptions](subscriptions.md) — Subscription links for each campus
- [FAQ](faq.md) — Frequently asked questions
- [How It Works](#how-it-works) — Technical details

## How It Works

Each week, a GitHub Actions job:

1. **Scrapes Official Registrar Pages** — Fetches academic dates from each campus registrar
2. **Extracts Event Data** — Parses HTML/widgets to extract important dates
3. **Converts to iCalendar Format** — Generates valid ICS (iCalendar) files
4. **Updates Data** — Commits the feeds to this repository for publication through Tiny Projects

Calendar applications that support CalDAV/webcal automatically pull updates from the published URLs.

### Technical Stack

| Component | Technology |
|-----------|-----------|
| **Web Scraper** | Python + Playwright + BeautifulSoup |
| **Scheduling** | GitHub Actions (weekly) |
| **Hosting** | Tiny Projects |
| **Format** | iCalendar (ICS) |

## Supported Calendar Apps

- ✅ Google Calendar
- ✅ Apple Calendar / iCloud
- ✅ Microsoft Outlook
- ✅ Mozilla Thunderbird
- ✅ Any app supporting webcal/CalDAV protocol

## Updates & Changelog

Calendar data is refreshed weekly. Check the [GitHub repository](https://github.com/lsy-404/UofT-Tools) for release notes and updates.

## Disclaimer

⚠️ This tool is **not** affiliated with the University of Toronto. Always verify important dates on the official registrar websites for your campus.

**Data Sources:**
- [ArtsCI Dates & Deadlines](https://www.artsci.utoronto.ca/current/dates-deadlines/academic-dates)
- [UTM Registrar Dates](https://www.utm.utoronto.ca/registrar/dates)
- [UTSC Registrar Dates](https://www.utsc.utoronto.ca/registrar/academic-dates)
