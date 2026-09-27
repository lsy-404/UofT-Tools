"""Fetch complete TTB offerings for ERIN, ARTSC and SCAR.

Never infer equivalence from matching course numbers. Fetch all responses
before replacing published snapshots; reject incomplete pagination.
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Make the shared ``common`` package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.http import PLANNER_UA, make_session
from common.io import write_json
from common.paths import PLANNER_DATA_DIR as OUTPUT_DIR

REFERENCE   = "https://api.easi.utoronto.ca/ttb/reference-data"
COURSES_API = "https://api.easi.utoronto.ca/ttb/getPageableCourses"
CAMPUS_DIVISIONS = {"utm": ["ERIN"], "stg": ["ARTSC"], "utsc": ["SCAR"]}
PAGE_SIZE   = 100

SESSION = make_session(PLANNER_UA, {
    "Accept":  "application/json",
    "Referer": "https://ttb.utoronto.ca/",
})


def get_sessions() -> list[dict]:
    resp = SESSION.get(REFERENCE, timeout=15)
    resp.raise_for_status()
    reference = resp.json()["payload"]
    available = {d['value'] for d in reference['divisions']}
    if not all(d in available for ds in CAMPUS_DIVISIONS.values() for d in ds):
        raise ValueError('Official TTB division identifiers changed; review adapters')
    items = reference["currentSessions"]
    # Keep only non-header real sessions (have a 5-digit+ code)
    return [s for s in items if not s.get("header") and len(s["value"]) >= 5]


def fetch_all_courses(session_code: str, divisions: list[str]) -> list[dict]:
    courses: list[dict] = []
    page = 1
    while True:
        payload = {
            "courseCodeAndTitleProps": {
                "courseCode": "", "courseTitle": "", "courseSectionCode": ""
            },
            "departmentProps": [],
            "campuses": [],
            "sessions": [session_code],
            "requirementProps": [],
            "instructor": "",
            "courseLevels": [],
            "deliveryModes": [],
            "dayPreferences": [],
            "timePreferences": [],
            "divisions": divisions,
            "creditWeights": [],
            "availableSpace": False,
            "waitListable": False,
            "page": page,
            "pageSize": PAGE_SIZE,
            "direction": "asc",
        }
        resp = SESSION.post(COURSES_API, json=payload, timeout=20)
        if resp.status_code == 404:
            print(f"  404 — session not yet published, skipping")
            return []
        resp.raise_for_status()
        data   = resp.json()["payload"]["pageableCourse"]
        batch  = data.get("courses", [])
        total  = data.get("total", 0)
        courses.extend(batch)
        print(f"  page {page}: {len(batch)} courses (total so far: {len(courses)}/{total})")
        if not batch and len(courses) < total:
            raise ValueError('Incomplete TTB pagination; preserving previous snapshots')
        if len(courses) >= total:
            break
        page += 1
        time.sleep(0.3)
    return courses


def simplify_course(raw: dict) -> dict:
    sections = []
    for sec in raw.get("sections", []):
        times = []
        for mt in sec.get("meetingTimes", []):
            start = mt.get("start", {})
            end   = mt.get("end", {})
            bld   = mt.get("building", {})
            times.append({
                "day":       start.get("day"),
                "startMs":   start.get("millisofday"),
                "endMs":     end.get("millisofday"),
                "room":      (bld.get("buildingCode", "") + " " + bld.get("buildingRoomNumber", "")).strip(),
            })
        instructors_raw = sec.get("instructors", []) or []
        instructors = [
            {"firstName": i.get("firstName", ""), "lastName": i.get("lastName", "")}
            for i in instructors_raw
        ]
        sections.append({
            "name":          sec.get("name"),
            "type":          sec.get("teachMethod"),  # LEC, TUT, PRA
            "sectionNumber": sec.get("sectionNumber"),
            "times":         times,
            "instructors":   instructors,
        })
    return {
        "code":        raw["code"],
        "name":        raw["name"],
        "sectionCode": raw.get("sectionCode"),   # F / S / Y
        "sections":    sections,
    }


def write_timetable(prefix: str, code: str, label: str, courses: list[dict]) -> None:
    out = {
        "source": COURSES_API,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "divisions": CAMPUS_DIVISIONS[prefix],
        "coverage": "All courses returned by TTB for the listed divisions and session; not ACORN enrolment availability",
        "session":      code,
        "sessionLabel": label,
        "courseCount":  len(courses),
        "courses":      courses,
    }
    dest = OUTPUT_DIR / f"{prefix}-timetable-{code}.json"
    write_json(dest, out)
    print(f"  -> {dest} ({len(courses)} courses)")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching available sessions...")
    sessions = get_sessions()
    print(f"Found {len(sessions)} sessions: {[s['value'] for s in sessions]}")

    if not sessions:
        raise ValueError('Empty official session index; preserving previous snapshots')
    snapshots = []
    for s in sessions:
        code  = s["value"]
        label = s["label"]
        for campus, divisions in CAMPUS_DIVISIONS.items():
            print(f"Scraping {campus} {label} ({code})...")
            courses = [simplify_course(c) for c in fetch_all_courses(code, divisions)]
            snapshots.append((campus, code, label, courses))

    for snapshot in snapshots:
        write_timetable(*snapshot)

    # Write a session index so the frontend knows which files exist
    index = [{"value": s["value"], "label": s["label"]} for s in sessions]
    write_json(OUTPUT_DIR / "utm-sessions.json", index)
    print("\nDone. utm-sessions.json written.")


if __name__ == "__main__":
    main()
