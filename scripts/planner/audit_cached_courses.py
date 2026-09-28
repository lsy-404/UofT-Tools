"""Compare course snapshots with the cached official search pages.

Run after a catalog import to find field drift. By default this is read-only;
explicit repair flags update only the specified verified fields.
The cache is an audit of the saved retrieval, not a claim about later updates.
"""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

import scrape_campus_catalogs as catalogs
import scrape_utm_courses as utm


ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache' / 'planner-calendar'
DATA = ROOT / 'data' / 'planner' / 'data'
CREDIT_FIELDS = {'academicCredit', 'creditKind', 'creditSource', 'creditReview'}


def cached_page(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    return BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')


def course_pages(campus):
    if campus != 'utm':
        return json.loads((DATA / f'{campus}-programs.json').read_text(encoding='utf-8'))['inventory']['coursePages']
    first = utm.CALENDAR + '/course-search'
    last = max((int(parse_qs(urlparse(a['href']).query).get('page', ['0'])[0])
                for a in cached_page(first).select('.pager a[href]')), default=0)
    return [first + (f'?page={number}' if number else '') for number in range(last + 1)]


def check(campus, fill_missing=False, sync_credit=False):
    saved = json.loads((DATA / f'{campus}-courses.json').read_text(encoding='utf-8'))
    seen = set()
    missing_fields = Counter()
    mismatches = []
    updates = 0
    page_count = 0
    for url in course_pages(campus):
        page_count += 1
        soup = cached_page(url)
        for head in soup.select('h3.js-views-accordion-group-header'):
            title = head.get_text(' ', strip=True)
            root = head.find_next_sibling()
            if campus == 'utm':
                match = utm.COURSE_RE.match(title)
                code = utm._normalize(match[1]) if match else None
            else:
                match = catalogs.CODE.search(title)
                code = match[0] if match else None
            if not code or code not in saved or code in seen:
                raise ValueError(f'{campus}: unexpected or repeated {code} at {url}')
            seen.add(code)
            record = saved[code]
            if campus == 'utm':
                fresh = utm.course_from_root(code, title, root, record['retrievedAt'])
            else:
                fresh = catalogs.course_from_root(code, title, root, catalogs.CATALOGS[campus],
                                                  campus, record['retrievedAt'])
            if sync_credit:
                for key in CREDIT_FIELDS:
                    if (key in record) != (key in fresh) or (key in fresh and record.get(key) != fresh[key]):
                        updates += 1
                    record.pop(key, None)
                    if key in fresh:
                        record[key] = fresh[key]
            for key in record.keys() - fresh.keys():
                mismatches.append((code, key, record[key], '<absent>'))
            for key, value in fresh.items():
                if key not in record:
                    if value:
                        missing_fields[key] += 1
                        if fill_missing:
                            record[key] = value
                            updates += 1
                    continue
                if record[key] != value:
                    mismatches.append((code, key, record[key], value))
    if seen != saved.keys():
        raise ValueError(f'{campus}: {len(saved.keys() - seen)} saved courses absent from cached pages')
    print(f'{campus}: {page_count} pages, {len(seen)} courses; '
          f'missing fields {dict(missing_fields)}; mismatches {len(mismatches)}')
    for code, key, old, new in mismatches[:20]:
        print(f'  {code}.{key}: saved={str(old)[:110]!r} cache={str(new)[:110]!r}')
    return saved, len(mismatches), updates, sum(missing_fields.values())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fill-missing', action='store_true', help='Write only verified missing fields')
    parser.add_argument('--sync-credit', action='store_true', help='Reconcile only credit metadata from verified course text')
    args = parser.parse_args()
    campuses = ('stg', 'utsc', 'utm')
    results = {campus: check(campus, args.fill_missing, args.sync_credit) for campus in campuses}
    mismatches = sum(result[1] for result in results.values())
    missing = sum(result[3] for result in results.values())
    unresolved_missing = missing and not args.fill_missing
    if (args.fill_missing or args.sync_credit) and not mismatches and not unresolved_missing:
        for campus, (records, _, updates, _) in results.items():
            if updates:
                catalogs.write_json(DATA / f'{campus}-courses.json', records)
        print(f'Reconciled {sum(result[2] for result in results.values())} field values.')
    raise SystemExit(1 if mismatches or unresolved_missing else 0)
