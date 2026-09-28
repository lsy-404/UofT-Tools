"""Import all pages of the Arts & Science and UTSC official search catalogs.

--resume reuses raw pages for a local review; scheduled runs fetch fresh pages.
Other UTSG faculties require their own adapters, not an Arts & Science alias.
"""
import argparse
import hashlib
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.http import PLANNER_UA, make_session
from common.io import write_json
from common.paths import PLANNER_DATA_DIR
from requirements import CODE, blocks

CATALOGS = {'stg': 'https://artsci.calendar.utoronto.ca', 'utsc': 'https://utsc.calendar.utoronto.ca'}
SESSION = make_session(PLANNER_UA)
CACHE = Path('.cache/planner-calendar')
RESUME = False
FETCHED_AT = {}
COOP_SOURCE = 'https://utsc.calendar.utoronto.ca/co-operative-programs'
NO_CREDIT = re.compile(
    r'\bnon[- ]credit\b|\bno (?:academic |degree )?credit is awarded\b|'
    r'\bdoes not carry (?:academic |degree )?credit(?: weight)?\b|'
    r'\bcarries no (?:academic |degree )?credit\b', re.I)


def credit_info(code, description, note, source):
    """Distinguish explicit zero credit from a Credit/No Credit grading scheme."""
    if NO_CREDIT.search(description + ' ' + note):
        return {'academicCredit': 0, 'creditKind': 'No academic credit', 'creditSource': source}
    return {'academicCredit': 1 if re.search(r'Y[0135]$', code) else 0.5}


def page(url):
    target = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    if RESUME and target.exists():
        FETCHED_AT[url] = datetime.fromtimestamp(target.stat().st_mtime, timezone.utc).isoformat()
        return BeautifulSoup(target.read_text(encoding='utf-8'), 'html.parser')
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=30)
            r.raise_for_status()
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)
    CACHE.mkdir(parents=True, exist_ok=True)
    target.write_text(r.text, encoding='utf-8')
    FETCHED_AT[url] = datetime.now(timezone.utc).isoformat()
    time.sleep(0.1)
    return BeautifulSoup(r.text, 'html.parser')


def field(root, name):
    return root.select_one(f'.field--name-{name} .field__item, .views-field-{name} .field-content, .field--name-{name}.field__item')


def search_pages(base, path):
    """Follow the final page and reject empty pages and duplicated entries."""
    first = page(base + path)
    numbers = [int(parse_qs(urlparse(a['href']).query).get('page', ['0'])[0]) for a in first.select('.pager a[href]')]
    last = max(numbers, default=0)
    seen = set()
    for number in range(last + 1):
        url = base + path + (f'?page={number}' if number else '')
        soup = first if number == 0 else page(url)
        heads = soup.select('h3.js-views-accordion-group-header')
        if not heads:
            raise ValueError(f'Empty catalog page: {url}')
        titles = [h.get_text(' ', strip=True) for h in heads]
        if seen.intersection(titles):
            raise ValueError(f'Duplicate catalog entries/pagination loop: {url}')
        seen.update(titles)
        print(path, number + 1, '/', last + 1, len(heads), flush=True)
        yield url, [(h.get_text(' ', strip=True), h.find_next_sibling()) for h in heads]


def program(root, title, url, campus):
    code = re.search(r'\b(?:AS|SC)(?:SPE|MAJ|MIN|CER|FOC)\w+', title, re.I)
    kind = re.search(r'\b(Specialist|Major|Minor|Certificate)\b', title, re.I)
    identifier = code[0].lower() if code else campus + '-' + re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    groups = {}
    fields = {'enrolment': ['field-enrolment-requirements', 'field-admission-requirements'],
              'completion': ['field-completion-requirements', 'field-program-requirements', 'field-certificate-requirements']}
    for key, names in fields.items():
        elements = [field(root, name) for name in names]
        groups[key] = {'blocks': [b for el in elements if el for b in blocks(el, key)]}
    body = field(root, 'body')
    if not any(g['blocks'] for g in groups.values()):
        if not body:
            raise ValueError(f'No requirements or reference content: {title}')
        groups['completion'] = {'blocks': [{**b, 'role': 'reference'} for b in blocks(body)]}
    codes = sorted(set(c for g in groups.values() for b in g['blocks'] for c in b['codes']))
    return {'id': identifier, 'code': code[0].upper() if code else identifier,
            'name': title, 'type': 'Focus' if re.match(r'^Focus\b', title, re.I) else kind[0].title() if kind else 'Program', 'campus': campus,
            'source': url, 'courses': codes, 'requirementGroups': groups,
            'description': body.get_text(' ', strip=True) if body else '',
            'evaluation': 'manual', 'calendarYear': '2026-2027', 'requirementSchema': 2}


def course_from_root(code, title, root, base, campus, retrieved):
    def text(name):
        el = field(root, name)
        return el.get_text(' ', strip=True) if el else ''
    desc = text('body') or text('field-desc')
    note = text('field-note') or text('field-notes')
    result = {'code': code, 'name': re.sub(r'^' + re.escape(code) + r'\s*[-:]\s*', '', title), 'description': desc, 'notes': note,
              'prereqText': text('field-prerequisite'),
              'prereqs': list(dict.fromkeys(c for c in CODE.findall(text('field-prerequisite')) if c != code)),
              'coreqText': text('field-corequisite'), 'recommendedPreparation': text('field-recommended-preparation') or text('field-recommended'),
              # The field can also contain directional enrolment prose. Codes
              # are references, not a claim that degree credit is mutually barred.
              'exclusions': list(dict.fromkeys(c for c in CODE.findall(text('field-exclusion')) if c != code)),
              'exclusionText': text('field-exclusion'),
              'breadth': text('field-breadth-requirements') or text('field-breadth-requirement'),
              'campus': campus, 'source': f'{base}/course/{code.lower()}',
              'calendarYear': '2026-2027', 'retrievedAt': retrieved}
    for output, source in (('hours', 'field-hours'),
                           ('previousCourseNumber', 'field-previous-course-number'),
                           ('courseExperience', 'field-course-experience')):
        value = text(source)
        if value:
            result[output] = value
    if campus == 'utsc' and code.startswith('COP'):
        result.update(academicCredit=0, creditSource=COOP_SOURCE, creditKind='Co-op requirement (no academic credit)')
    else:
        result.update(credit_info(code, desc, note, result['source']))
    timing = re.search(r'[^.]*\b(?:should|must|recommended|expected)\b[^.]*\b(?:first|second|third|fourth)[ -]year\b[^.]*\.', note, re.I)
    if timing:
        result['recommendedTiming'] = timing[0].strip()
    return result


def course(code, base, campus, retrieved):
    soup = page(f'{base}/course/{code.lower()}')
    root = soup.select_one('article') or soup.select_one('main')
    title = soup.select_one('h1.page-title') or soup.find('title')
    if not root or not title:
        raise ValueError(f'Missing course: {code}')
    return course_from_root(code, title.get_text(' ', strip=True).split('|')[0].strip(), root, base, campus, retrieved)


def expand_open_pools(programs, courses):
    """Resolve explicit subject/level pools against the complete course catalog.

    Keep clauses with additional constraints as source prose for manual review.
    This supplies choices; it does not certify that chosen credits satisfy them.
    """
    for p in programs:
        for b in p['requirementGroups']['completion']['blocks']:
            # Source: UTSC History Minor SCMIN0652, current official calendar.
            if b['text'] == 'Students must complete 4.0 credits in History, of which at least 1.0 credit must be at the C- and/or D-level.':
                b.update(role='elective', requiredCredits=4.0, pool={'subject': 'HIS', 'upperCredits': 1.0},
                         eligibleCourses=sorted(c for c in courses if re.fullmatch(r'HIS[A-D]\d{2}[HY]3', c)))
                p['courses'] = sorted(set(p['courses'] + b['eligibleCourses']))
                continue
            match = re.fullmatch(r'(\d+(?:\.\d+)?) credits? in any ([A-D])- or ([A-D])-level ([A-Z]{3}) courses\.', b['text'])
            if not match:
                continue
            amount, low, high, subject = match.groups()
            b.update(role='elective', requiredCredits=float(amount), pool={'subject': subject, 'levels': [low, high]},
                     eligibleCourses=sorted(c for c in courses if re.fullmatch(subject + '[' + low + high + r']\d{2}[HY]3', c)))
            p['courses'] = sorted(set(p['courses'] + b['eligibleCourses']))


def scrape(campus):
    base = CATALOGS[campus]
    retrieved = datetime.now(timezone.utc).isoformat()
    sections, discovered, program_pages = {}, [], []
    for url, entries in search_pages(base, '/search-programs'):
        program_pages.append(url)
        for title, root in entries:
            p = program(root, title, url, campus)
            discovered.append(p['id'])
            section = root.select_one('.views-field-field-section-link a[href^="/section/"], .views-field-field-calendar-section-link a[href^="/section/"]')
            slug = section['href'].split('/section/')[1] if section else 'Other-programs'
            name = section.get_text(' ', strip=True) if section else 'Other programs'
            sections.setdefault(slug, {'slug': slug, 'name': name, 'programs': []})['programs'].append(p)
    if len(set(discovered)) != len(discovered):
        raise ValueError('Duplicate program identifiers; reconcile before publishing')
    courses, course_pages = {}, []
    for url, entries in search_pages(base, '/search-courses'):
        course_pages.append(url)
        for title, root in entries:
            code = CODE.search(title)
            if not code:
                raise ValueError(f'Unrecognized course title: {title}')
            if code[0] in courses:
                raise ValueError(f'Duplicate course: {code[0]}')
            courses[code[0]] = course_from_root(code[0], title, root, base, campus, FETCHED_AT[url])
    expand_open_pools([p for s in sections.values() for p in s['programs']], courses)
    imported = sorted(p['id'] for s in sections.values() for p in s['programs'])
    if imported != sorted(discovered):
        raise ValueError('Program inventory does not reconcile')
    suffix = '1' if campus == 'stg' else '3'
    referenced = {c for s in sections.values() for p in s['programs'] for c in p['courses'] if c.endswith(suffix)}
    unavailable = sorted(referenced - courses.keys())
    inventory = {'programPages': program_pages, 'coursePages': course_pages, 'discoveredProgramIds': sorted(discovered),
                 'importedProgramIds': imported, 'missingProgramIds': [], 'programCount': len(imported),
                 'courseCount': len(courses), 'referencedCoursesOutsideCurrentCatalog': unavailable}
    snapshot_dates = {url: FETCHED_AT[url] for url in program_pages + course_pages}
    metadata = {'campus': campus, 'calendarYear': '2026-2027', 'retrievedAt': min(snapshot_dates.values()),
                'lastRetrievedAt': max(snapshot_dates.values()), 'pageSnapshots': snapshot_dates,
                'source': base + '/search-programs', 'inventory': inventory,
                'coverage': 'Every entry in this faculty/campus official program search; all pages reconciled. Complex requirements need review.'}
    write_json(PLANNER_DATA_DIR / f'{campus}-courses.json', courses)
    write_json(PLANNER_DATA_DIR / f'{campus}-programs.json', {**metadata, 'sections': sorted(sections.values(), key=lambda s: s['name'])})
    print(campus, 'programs', len(imported), 'courses', len(courses), 'historical/unlisted references', len(unavailable), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--resume', action='store_true', help='Reuse cached pages from the current local review')
    parser.add_argument('--campus', choices=list(CATALOGS))
    args = parser.parse_args()
    RESUME = args.resume
    for campus in [args.campus] if args.campus else CATALOGS:
        scrape(campus)
