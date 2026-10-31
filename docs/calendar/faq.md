# ❓ Frequently Asked Questions

## General Questions

### What are these calendar feeds?
These are automatically-updated iCalendar (ICS) feeds for all three University of Toronto campuses. They include important academic dates like:
- Course enrollment deadlines
- Midterm break dates
- Exam periods
- Convocation dates
- Holiday closures

The feeds are scraped daily from the official registrar pages and updated automatically.

### Is this an official University of Toronto tool?
**No.** This is an unofficial, student-built tool. It is **not** affiliated with, endorsed by, or supported by the University of Toronto.

Always verify important dates on the official registrar websites for your campus.

### How often are the feeds updated?
Feeds update **once every 24 hours** via automated GitHub Actions. Most calendar apps pull updates automatically; some may require a manual refresh.

### Which calendar apps are supported?
Any calendar application that supports the webcal protocol or can import ICS files:
- ✅ Google Calendar
- ✅ Apple Calendar / iCloud
- ✅ Microsoft Outlook
- ✅ Mozilla Thunderbird
- ✅ Samsung Calendar
- ✅ Nextcloud Calendar
- ✅ Any CalDAV-compatible app

---

## Technical Questions

### How does the web scraper work?
The scraper uses:
- **Python** for the scripting language
- **Playwright** for headless browser automation (especially for JavaScript-heavy pages)
- **BeautifulSoup** for HTML parsing
- **iCalendar** library for generating valid ICS files

This approach allows us to capture dates from dynamic content (widgets, accordions, etc.) on registrar pages.

### Why webcal instead of HTTPS?
**Webcal** is the standard protocol for calendar feeds and enables automatic updates. However, if your device doesn't support webcal, you can use the HTTPS URL instead:
- Webcal: `webcal://uoft.leisiyu.dev/calendar/artsci.ics`
- HTTPS: `https://uoft.leisiyu.dev/calendar/artsci.ics`

### What if a date is wrong?
The dates come directly from the official registrar pages. If a date appears incorrect:
1. **Check the official registrar page** to verify
2. If there's a discrepancy, the official page is authoritative
3. Report the issue on [GitHub](https://github.com/lsy-404/UofT-Tools/issues)

### Can I see the source code?
Yes! The entire project is open source on GitHub: [lsy-404/UofT-Tools](https://github.com/lsy-404/UofT-Tools)

---

## Subscription & Syncing

### How do I subscribe?
See the [Getting Started](getting-started.md) guide or [Campus Subscriptions](subscriptions.md) page for step-by-step instructions.

### Why isn't my calendar updating?
Check these troubleshooting steps:

1. **Verify the subscription URL is correct**
   - Copy the URL again from [subscriptions.md](subscriptions.md)
   
2. **Check your calendar app's sync settings**
   - Some apps require manual refresh or have sync disabled
   - Google Calendar: Settings → Calendars → Auto-sync should be on
   - Apple: Settings → Calendars → Sync should be enabled

3. **Unsubscribe and re-subscribe**
   - Remove the calendar and add it again
   - Some apps cache stale data

4. **Try the HTTPS URL instead**
   - If webcal:// doesn't work, try the HTTPS version

### Can I edit the events in my calendar?
You can add notes or change reminders, but:
- Any changes you make are **local to your calendar only**
- When the feed updates, modified events revert to the original data
- Treat these as read-only calendars; create separate events for personal notes

### Can I share the calendar with others?
Yes! Share the **webcal URL**, not your personal calendar:
- Share: `webcal://uoft.leisiyu.dev/calendar/artsci.ics`
- They can add it to their own calendar app

---

## Privacy & Data

### What data does the tool collect?
**None.** The tool:
- Does **not** track users
- Does **not** store personal information
- Does **not** use cookies
- Simply scrapes public registrar pages and generates calendar files

### Is my data safe?
Yes. The tool:
- Only reads data from public university websites
- Generates static ICS files
- Doesn't store any user data
- Is fully open source (code is auditable)

### Can I see the logs?
All scraping logs are public in the GitHub repository's [Actions](https://github.com/lsy-404/UofT-Tools/actions) page.

---

## Multiple Campuses

### I'm a double-degree student. Can I subscribe to multiple calendars?
Yes! You can add multiple campus calendars:
1. Subscribe to the first campus (e.g., UTSG)
2. Add the second campus calendar separately (e.g., UTM)
3. Both calendars will appear in your calendar app

Each update independently, so you'll see all important dates across campuses.

### Which calendar should I use if I'm not sure?
- **St. George (UTSG)**: Main downtown campus, most programs
- **Mississauga (UTM)**: Offers select undergraduate and graduate programs
- **Scarborough (UTSC)**: Offers select programs, including some unique offerings

Check your acceptance/enrollment letter to confirm your campus.

---

## Still Have Questions?

- **Report a bug**: [GitHub Issues](https://github.com/lsy-404/UofT-Tools/issues)
- **Request a feature**: [GitHub Discussions](https://github.com/lsy-404/UofT-Tools/discussions)
- **View source code**: [GitHub Repository](https://github.com/lsy-404/UofT-Tools)

---

## See Also

- [Getting Started](getting-started.md)
- [Campus Subscriptions](subscriptions.md)
- [Main Tool Overview](README.md)
