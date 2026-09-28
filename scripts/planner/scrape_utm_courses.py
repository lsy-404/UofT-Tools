"""Import every page of the official UTM current course-search inventory.

Keep the source text and restrictions alongside the normalized course codes;
program references alone are not a complete course inventory.
"""

import re
import sys
from pathlib import Path

# Make the shared ``common`` package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.io import write_json
from common.paths import PLANNER_DATA_DIR as DATA_DIR
import scrape_campus_catalogs as calendar_pages

def _normalize(code):
    return re.sub(r'\s+', '', code).upper()

CALENDAR     = "https://utm.calendar.utoronto.ca"
COURSE_RE    = re.compile(r"\b([A-Z]{2,4}\s*\d{3}\s*[YH]\s*[0-9])\b", re.IGNORECASE)

def course_from_root(code, title, root, retrieved):
    def value(name):
        return ' '.join(dict.fromkeys(el.get_text(' ', strip=True) for el in root.select(f'.views-field-{name} .field-content') if el.get_text(' ', strip=True)))
    desc = value('field-desc')
    note = value('field-note')
    prereq = value('field-prerequisite')
    exclusion = value('field-exclusion')
    campus_note = value('field-campus')
    result = {
        'campus': 'utm', 'source': f'{CALENDAR}/course/{code.lower()}',
        'calendarYear': '2026-2027', 'retrievedAt': retrieved,
        'currentCatalog': True, 'code': code,
        'name': re.sub(r'^' + re.escape(code) + r'\s*[•:\-]\s*', '', title),
        'description': desc, 'prereqText': prereq,
        'prereqs': list(dict.fromkeys(_normalize(c) for c in COURSE_RE.findall(prereq) if _normalize(c) != code)),
        'coreqText': value('field-corequisite'),
        'exclusionText': exclusion,
        # Keep the exact restriction above; extracted codes alone do not say
        # whether this is a credit exclusion, timing rule, or other condition.
        'exclusions': list(dict.fromkeys(_normalize(c) for c in COURSE_RE.findall(exclusion) if _normalize(c) != code)),
        'recommendedPreparation': value('field-recommended-preparation'),
        'notes': note, 'enrolmentLimits': value('field-enrolment-limits'),
        'hours': value('field-hours'), 'distribution': value('field-distribution-requirements'),
    }
    for output, source in (('modeOfDelivery', 'field-mode-of-delivery'),
                           ('courseExperience', 'field-course-experience'),
                           ('internationalComponent', 'field-international-component')):
        extra = value(source)
        if extra:
            result[output] = extra
    result.update(calendar_pages.credit_info(code, desc, note, result['source']))
    if campus_note and campus_note.lower() not in ('university of toronto mississauga', 'utm'):
        result['campusReview'] = campus_note
    return result

def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    calendar_pages.RESUME = '--resume' in sys.argv
    results: dict[str, dict] = {}
    for url, entries in calendar_pages.search_pages(CALENDAR, '/course-search'):
        for title, root in entries:
            match = COURSE_RE.match(title)
            if not match:
                raise ValueError(f'Unrecognized UTM course title: {title}')
            code = _normalize(match[1])
            if code in results:
                raise ValueError(f'Duplicate UTM course {code} on {url}')
            results[code] = course_from_root(code, title, root, calendar_pages.FETCHED_AT[url])

    dest = DATA_DIR / "utm-courses.json"
    if len(results) < 2300:
        raise ValueError('UTM current course directory unexpectedly small; preserving previous snapshot')
    write_json(dest, results)
    print(f"\nDone → {dest} ({len(results)} courses)")


if __name__ == "__main__":
    main()
