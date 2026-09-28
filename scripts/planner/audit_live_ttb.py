"""Read-only comparison of local timetable snapshots with the live TTB API.

Run from the repository root. No timetable file is replaced by this audit.
"""

import argparse
import contextlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import scrape_ttb_courses as ttb


DATA = Path('data/planner/data')


def course_key(course):
    return course['code'], course.get('sectionCode')


def canonical(course):
    value = dict(course)
    sections = []
    for section in value['sections']:
        section = dict(section)
        section['times'] = sorted(section['times'], key=lambda item: json.dumps(item, sort_keys=True))
        section['instructors'] = sorted(section['instructors'], key=lambda item: json.dumps(item, sort_keys=True))
        section['linkedMeetingSections'] = sorted(section['linkedMeetingSections'] or [],
                                                  key=lambda item: json.dumps(item, sort_keys=True))
        section['deliveryModes'] = sorted(section['deliveryModes'], key=str)
        sections.append(section)
    value['sections'] = sorted(sections, key=lambda item: (item.get('type') or '', item.get('name') or ''))
    return value


def legacy_projection(course):
    """Strip only fields newly retained by the importer for a safe refresh check."""
    value = dict(course)
    value.pop('notes', None)
    value['sections'] = []
    for section in course['sections']:
        section = dict(section)
        section.pop('notes', None)
        new_times = section['times']
        section['times'] = []
        for meeting in new_times:
            old = dict(meeting)
            suffix = old.pop('roomSuffix', '')
            old.pop('buildingUrl', None)
            old.pop('repetition', None)
            old.pop('repetitionTime', None)
            if suffix and old['room'].endswith(suffix):
                old['room'] = old['room'][:-len(suffix)].strip()
            section['times'].append(old)
        value['sections'].append(section)
    return value


def compare(campus, session, refresh=False):
    path = DATA / f'{campus}-timetable-{session}.json'
    saved = json.loads(path.read_text(encoding='utf-8'))
    with contextlib.redirect_stdout(io.StringIO()):
        raw = ttb.fetch_all_courses(session, ttb.CAMPUS_DIVISIONS[campus])
    live = [ttb.simplify_course(course) for course in raw]
    old = {course_key(course): canonical(course) for course in saved['courses']}
    new = {course_key(course): canonical(legacy_projection(course) if refresh else course) for course in live}
    if len(old) != len(saved['courses']) or len(new) != len(live):
        raise ValueError(f'Duplicate course/section identity for {campus} {session}')
    added = sorted(new.keys() - old.keys())
    absent = sorted(old.keys() - new.keys())
    changed = sorted(key for key in new.keys() & old.keys() if new[key] != old[key])
    print(f'{campus} {session}: saved {len(old)}, live {len(new)}; '
          f'added {len(added)}, absent {len(absent)}, changed {len(changed)}', flush=True)
    for label, keys in [('added', added), ('absent', absent), ('changed', changed)]:
        if keys:
            print(f'  {label}: {keys[:20]}', flush=True)
    for key in changed[:8]:
        fields = [field for field in new[key] if new[key][field] != old[key][field]]
        print(f'  {key}: changed fields {fields}', flush=True)
    return len(added) + len(absent) + len(changed), (path, {**saved, 'courses': live,
        'courseCount': len(live), 'retrievedAt': datetime.now(timezone.utc).isoformat()})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-reviewed', action='store_true',
                        help='Replace snapshots only if all previously stored fields still match')
    args = parser.parse_args()
    current = [(session['value'], session['label']) for session in ttb.get_sessions()]
    saved_index = json.loads((DATA / 'utm-sessions.json').read_text(encoding='utf-8'))
    indexed = [(session['value'], session['label']) for session in saved_index]
    if current != indexed:
        raise ValueError(f'Session index differs: saved={indexed}, live={current}')
    checks = [compare(campus, session, args.refresh_reviewed) for session, _ in current
              for campus in ('stg', 'utsc', 'utm')]
    differences = sum(count for count, _ in checks)
    if args.refresh_reviewed and not differences:
        for _, (path, data) in checks:
            ttb.write_json(path, data)
        print('Refreshed all nine snapshots after verifying every previously stored field.')
    raise SystemExit(1 if differences else 0)
