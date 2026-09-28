"""Read-only comparison of saved courses against the live official search pages.

Run from the repository root. This does not replace the source cache or course
snapshots. Network/parse failures fail the audit instead of implying a match.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup

import scrape_campus_catalogs as stg_utsc
import scrape_utm_courses as utm


DATA = Path('data/planner/data')
TIMEOUT = 30


def fetch(url):
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=TIMEOUT,
                                    headers={'User-Agent': 'UofTtool course catalog accuracy audit'})
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def pages(campus):
    base = utm.CALENDAR if campus == 'utm' else stg_utsc.CATALOGS[campus]
    path = '/course-search' if campus == 'utm' else '/search-courses'
    first_url = base + path
    first = fetch(first_url)
    last = max((int(parse_qs(urlparse(link['href']).query).get('page', ['0'])[0])
                for link in first.select('.pager a[href]')), default=0)
    return {first_url + (f'?page={index}' if index else ''): (first if index == 0 else None)
            for index in range(last + 1)}


def compare(campus):
    saved = json.loads((DATA / f'{campus}-courses.json').read_text(encoding='utf-8'))
    queue = pages(campus)
    seen = set()
    differences = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch, url): url for url, soup in queue.items() if soup is None}
        for url, soup in queue.items():
            if soup is not None:
                consume(campus, url, soup, saved, seen, differences)
        for future in as_completed(futures):
            url = futures[future]
            consume(campus, url, future.result(), saved, seen, differences)
    missing = sorted(saved.keys() - seen)
    added = sorted(seen - saved.keys())
    print(f'{campus}: {len(queue)} live pages, {len(seen)} courses; '
          f'{len(added)} added, {len(missing)} absent, {len(differences)} field differences', flush=True)
    for code, field, old, live in sorted(differences)[:30]:
        print(f'  {code}.{field}: saved={ascii(str(old)[:110])} live={ascii(str(live)[:110])}')
    if added:
        print('  Added:', ', '.join(added[:30]))
    if missing:
        print('  Absent:', ', '.join(missing[:30]))
    return len(added) + len(missing) + len(differences)


def consume(campus, url, soup, saved, seen, differences):
    entries = soup.select('h3.js-views-accordion-group-header')
    if not entries:
        raise ValueError(f'Empty or unrecognized live course page: {url}')
    for head in entries:
        title = head.get_text(' ', strip=True)
        root = head.find_next_sibling()
        if campus == 'utm':
            match = utm.COURSE_RE.match(title)
            code = utm._normalize(match[1]) if match else None
        else:
            match = stg_utsc.CODE.search(title)
            code = match[0] if match else None
        if not code or code in seen:
            raise ValueError(f'Invalid or duplicated course {code} on {url}')
        seen.add(code)
        if code not in saved:
            continue
        record = saved[code]
        fresh = (utm.course_from_root(code, title, root, record['retrievedAt']) if campus == 'utm'
                 else stg_utsc.course_from_root(code, title, root, stg_utsc.CATALOGS[campus],
                                                campus, record['retrievedAt']))
        for field in (fresh.keys() | record.keys()) - {'retrievedAt'}:
            if fresh.get(field) != record.get(field):
                differences.append((code, field, record.get(field, '<absent>'), fresh.get(field, '<absent>')))


if __name__ == '__main__':
    changed = sum(compare(campus) for campus in ('stg', 'utsc', 'utm'))
    raise SystemExit(1 if changed else 0)
