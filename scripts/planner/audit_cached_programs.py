"""Read-only parity check for all saved program entries and cached calendars.

This verifies extraction against the pages used to build the snapshot. It does
not decide whether a complex requirement has been interpreted correctly.
"""
import hashlib
import json
from pathlib import Path

from bs4 import BeautifulSoup

import scrape_campus_catalogs as catalog
import scrape_utm_programs as utm


ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache' / 'planner-calendar'
DATA = ROOT / 'data' / 'planner' / 'data'
FIELDS = ('code', 'name', 'type', 'source', 'courses', 'requirementGroups', 'description')


def cached_page(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    return BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')


def parsed_programs(campus, saved):
    found = {}
    if campus == 'utm':
        # parse_program normally uses the shared fetcher. Bind it to the cache
        # so this audit cannot silently fetch a newer page or write anything.
        utm.fetch_html = cached_page
        for ident, program in saved.items():
            found[ident] = utm.parse_program(program['path'])
        return found

    data = json.loads((DATA / f'{campus}-programs.json').read_text(encoding='utf-8'))
    for url in data['inventory']['programPages']:
        for heading in cached_page(url).select('h3.js-views-accordion-group-header'):
            program = catalog.program(heading.find_next_sibling(), heading.get_text(' ', strip=True), url, campus)
            if program['id'] in found:
                raise ValueError(f'{campus}: duplicate parsed program {program["id"]}')
            found[program['id']] = program
    if campus == 'utsc':
        courses = json.loads((DATA / 'utsc-courses.json').read_text(encoding='utf-8'))
        catalog.expand_open_pools(list(found.values()), courses)
    return found


def main():
    failed = False
    for campus in ('stg', 'utsc', 'utm'):
        data = json.loads((DATA / f'{campus}-programs.json').read_text(encoding='utf-8'))
        saved = {p['id']: p for s in data['sections'] for p in s['programs']}
        parsed = parsed_programs(campus, saved)
        mismatches = []
        for ident in sorted(saved.keys() | parsed.keys()):
            if ident not in saved or ident not in parsed:
                mismatches.append((ident, 'inventory'))
                continue
            for field in FIELDS:
                if saved[ident].get(field) != parsed[ident].get(field):
                    mismatches.append((ident, field))
        print(f'{campus}: {len(saved)} saved, {len(parsed)} parsed, {len(mismatches)} mismatches')
        for ident, field in mismatches[:20]:
            print(f'  {ident}: {field}')
        failed |= bool(mismatches)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
