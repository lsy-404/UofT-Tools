"""
Scrape UTM course prerequisites and exclusions.
Source: utm.calendar.utoronto.ca/course/{code}
Output: public/planner/data/courses.json

Collects all unique course codes from programs.json, then fetches each
course page to extract prerequisites, exclusions, and description.
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

# Make the shared ``common`` package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.http import PLANNER_UA, make_session
from common.io import write_json
from common.paths import PLANNER_DATA_DIR as DATA_DIR

CALENDAR     = "https://utm.calendar.utoronto.ca"
COURSE_RE    = re.compile(r"\b([A-Z]{2,4}\s*\d{3}\s*[YH]\s*[0-9])\b", re.IGNORECASE)

SESSION = make_session(PLANNER_UA, {"Accept": "text/html"})


def collect_codes_from_programs() -> set[str]:
    """Return all unique course codes mentioned in utm-programs.json."""
    prog_file = DATA_DIR / "utm-programs.json"
    if not prog_file.exists():
        raise FileNotFoundError("programs.json not found — run scrape_utm_programs.py first")
    data = json.loads(prog_file.read_text(encoding='utf-8'))
    codes: set[str] = set()
    for sec in data["sections"]:
        for prog in sec["programs"]:
            codes.update(prog.get("courses", []))
    return codes


def field_text(article: BeautifulSoup, field_name: str) -> str:
    """Extract text content of a Drupal field by CSS class suffix."""
    el = article.select_one(f"[class*='field--name-{field_name}'] .field__item")
    return el.get_text(separator=" ", strip=True) if el else ""


def field_codes(article: BeautifulSoup, field_name: str) -> list[str]:
    """Extract course codes from links inside a Drupal field."""
    el = article.select_one(f"[class*='field--name-{field_name}'] .field__item")
    if not el:
        return []
    codes = []
    for a in el.find_all("a"):
        text = a.get_text(strip=True)
        if COURSE_RE.match(text):
            codes.append(re.sub(r"\s+", "", text).upper())
    # Also extract any inline codes not wrapped in links
    inline = [re.sub(r"\s+", "", c).upper() for c in COURSE_RE.findall(el.get_text())]
    return list(dict.fromkeys(codes + [c for c in inline if c not in codes]))


def fetch_course(code: str) -> dict | None:
    url = f"{CALENDAR}/course/{code.lower()}"
    try:
        resp = SESSION.get(url, timeout=12)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"    ERROR fetching {code}: {e}")
        return None

    soup    = BeautifulSoup(resp.text, "html.parser")
    article = soup.select_one("article")
    if not article:
        return None

    # The page has two <h1> tags — site-header "Academic Calendar" comes first.
    # The actual course title is "CODE • Name" inside h1.page-title.
    title_el = soup.select_one("h1.page-title") or soup.find("h1") or soup.find("title")
    raw_name = title_el.get_text(strip=True).split("|")[0].strip() if title_el else code
    # Strip the leading "CODE • " prefix so we keep just the course name.
    name = raw_name.split("•", 1)[1].strip() if "•" in raw_name else raw_name

    desc   = field_text(article, "field-desc")
    prereq_codes = field_codes(article, "field-prerequisite")
    prereq_text  = field_text(article, "field-prerequisite")
    excl_codes   = field_codes(article, "field-exclusion")
    excl_text    = field_text(article, "field-exclusion")
    hours        = field_text(article, "field-hours")
    distrib      = field_text(article, "field-distribution-requirements")

    return {
        "campus": "utm",
        "source": url,
        "calendarYear": "2026-2027",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "code":          code,
        "name":          name,
        "description":   desc,
        "prereqs":       prereq_codes,
        "prereqText":    prereq_text,
        "exclusions":    excl_codes,
        "exclusionText": excl_text,
        "hours":         hours,
        "distribution":  distrib,
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Collecting course codes from programs.json...")
    codes = sorted(collect_codes_from_programs())
    print(f"Found {len(codes)} unique course codes")

    results: dict[str, dict] = {}
    for i, code in enumerate(codes, 1):
        print(f"  [{i:3d}/{len(codes)}] {code}", end=" ", flush=True)
        course = fetch_course(code)
        if course:
            results[code] = course
            print(f"prereqs={course['prereqs']} excl={len(course['exclusions'])}")
        else:
            print("not found")
        time.sleep(0.15)

    dest = DATA_DIR / "utm-courses.json"
    if len(results) < len(codes) * 0.9:
        raise ValueError('Too many unavailable courses; preserving previous UTM snapshot')
    write_json(dest, results)
    print(f"\nDone → {dest} ({len(results)} courses)")


if __name__ == "__main__":
    main()
