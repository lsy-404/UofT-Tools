"""Import explicitly supported Arts & Science / UTSC subject areas.

Requirements remain official prose, not an inferred logical degree audit.
Run from the repository root. Each campus is replaced only after validation.
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.http import PLANNER_UA, make_session
from common.io import write_json
from common.paths import PLANNER_DATA_DIR

CODE = re.compile(r'\b[A-Z]{3}(?:\d{3}|[A-D]\d{2})[HY][135]\b')
CATALOGS = {
    'stg': ('https://artsci.calendar.utoronto.ca', ['Computer-Science', 'Mathematics', 'Economics']),
    'utsc': ('https://utsc.calendar.utoronto.ca', ['Computer-Science', 'Mathematics', 'Economics-for-Management-Studies']),
}
SESSION = make_session(PLANNER_UA)


def page(url):
    r = SESSION.get(url, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, 'html.parser')


def field(root, name):
    return root.select_one(f'[class*="field--name-{name}"] .field__item, .views-field-{name} .field-content, .field--name-{name}.field__item')


def blocks(element):
    if not element:
        return []
    # Keep nested lists intact without repeating their children.
    elements = [e for e in element.find_all(['p', 'ul', 'ol']) if not e.find_parent(['p', 'ul', 'ol'])]
    if not elements:
        elements = [element]
    return [{'text': e.get_text(' ', strip=True), 'codes': sorted(set(CODE.findall(e.get_text(' ', strip=True)))),
             'manualReview': True} for e in elements if e.get_text(strip=True)]


def program(root, title, url, campus):
    code = re.search(r'\b(?:AS|SC)(?:SPE|MAJ|MIN)\w+', title)
    kind = re.search(r'\b(Specialist|Major|Minor)\b', title, re.I)
    if not code or not kind:
        return None
    groups = {k: {'blocks': blocks(field(root, f'field-{k}-requirements'))}
              for k in ['enrolment', 'completion']}
    if not groups['completion']['blocks']:
        raise ValueError(f'No completion requirements parsed: {title}')
    codes = sorted(set(c for g in groups.values() for b in g['blocks'] for c in b['codes']))
    return {'id': code[0].lower(), 'code': code[0], 'name': title, 'type': kind[0].title(),
            'campus': campus, 'source': url, 'courses': codes, 'requirementGroups': groups,
            'evaluation': 'manual', 'calendarYear': '2026-2027'}


def course(code, base, campus, retrieved):
    url = f'{base}/course/{code.lower()}'
    soup = page(url)
    root = soup.select_one('article') or soup.select_one('main')
    if not root:
        raise ValueError(f'Missing course content: {url}')
    title = soup.select_one('h1.page-title') or soup.find('title')
    def text(name):
        el = field(root, name)
        return el.get_text(' ', strip=True) if el else ''
    return {'code': code, 'name': title.get_text(' ', strip=True).split('|')[0].strip(),
            'description': text('body') or text('field-desc'),
            'prereqText': text('field-prerequisite'), 'prereqs': CODE.findall(text('field-prerequisite')),
            'exclusions': CODE.findall(text('field-exclusion')), 'exclusionText': text('field-exclusion'),
            'breadth': text('field-breadth-requirements') or text('field-breadth-requirement'),
            'campus': campus, 'source': url, 'calendarYear': '2026-2027', 'retrievedAt': retrieved}


def scrape(campus):
    base, subjects = CATALOGS[campus]
    retrieved = datetime.now(timezone.utc).isoformat()
    sections, seen = [], set()
    for subject in subjects:
        url = f'{base}/section/{subject}'
        soup = page(url)
        programs = []
        if campus == 'stg':
            paths = sorted({a['href'] for a in soup.select('a[href^="/program/"]')
                            if re.fullmatch(r'/program/AS(?:SPE|MAJ|MIN)\w+', a['href'], re.I)})
            for path in paths:
                doc = page(base + path)
                title = doc.find('title').get_text(' ', strip=True).split('|')[0].strip()
                p = program(doc, title, base + path, campus)
                if p and p['id'] not in seen:
                    programs.append(p)
                    seen.add(p['id'])
        else:
            for heading in soup.select('h3.js-views-accordion-group-header'):
                root = heading.find_next_sibling()
                p = program(root, heading.get_text(' ', strip=True), url, campus)
                if p and p['id'] not in seen:
                    programs.append(p)
                    seen.add(p['id'])
        if not programs:
            raise ValueError(f'No programs: {url}')
        sections.append({'slug': subject, 'name': subject.replace('-', ' '), 'programs': programs})
        print(campus, subject, len(programs), flush=True)
    suffix = '1' if campus == 'stg' else '3'
    codes = sorted({c for s in sections for p in s['programs'] for c in p['courses'] if c.endswith(suffix)})
    courses, unavailable = {}, []
    for code in codes:
        try:
            courses[code] = course(code, base, campus, retrieved)
        except Exception as exc:
            unavailable.append({'code': code, 'error': str(exc)})
        time.sleep(0.08)
    if len(courses) < len(codes) * 0.9:
        raise ValueError(f'Too many unavailable courses: {len(unavailable)}/{len(codes)}')
    metadata = {'campus': campus, 'calendarYear': '2026-2027', 'retrievedAt': retrieved,
                'source': base, 'supportedSubjects': subjects, 'unavailableCourses': unavailable,
                'coverage': 'Listed subject areas only; program requirements are reference prose requiring manual review.'}
    write_json(PLANNER_DATA_DIR / f'{campus}-programs.json', {**metadata, 'sections': sections})
    write_json(PLANNER_DATA_DIR / f'{campus}-courses.json', courses)
    print(campus, 'courses', len(courses), 'unavailable', len(unavailable), flush=True)


if __name__ == '__main__':
    for campus in CATALOGS:
        scrape(campus)
