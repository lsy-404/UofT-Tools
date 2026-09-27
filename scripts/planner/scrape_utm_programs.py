"""
Scrape UTM Academic Calendar program requirements.
Outputs: public/planner/data/programs.json
"""

import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

# Make the shared ``common`` package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.http import PLANNER_UA, make_session
from common.io import write_json
from common.paths import PLANNER_DATA_DIR as OUTPUT_DIR

CALENDAR_URL = "https://utm.calendar.utoronto.ca"
SECTION_URL  = f"{CALENDAR_URL}/section/"

COURSE_RE    = re.compile(r"\b([A-Z]{2,4}\s*\d{3}\s*[YH]\s*[0-9])\b", re.IGNORECASE)
PROGRAM_TYPE_RE = re.compile(r"\b(Specialist|Major|Minor|Certificate)\b", re.IGNORECASE)

SESSION = make_session(PLANNER_UA, {"Accept": "text/html,application/xhtml+xml"})


def fetch_html(url: str) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def get_sections() -> list[dict]:
    """Return list of {slug, name} for all 60 sections."""
    # The section listing page renders links server-side in the menu
    # but the main content list needs JS. Use the known URL pattern directly
    # by fetching the main page and finding /section/ links in the HTML.
    soup = fetch_html(SECTION_URL)
    seen = set()
    sections = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/section/") and href != "/section/":
            slug = href[len("/section/"):]
            if slug and slug not in seen:
                seen.add(slug)
                sections.append({"slug": slug, "name": a.get_text(strip=True)})
    return sections


def get_program_links(section_slug: str) -> list[str]:
    """Return list of /program/{id} paths for a section."""
    soup = fetch_html(f"{CALENDAR_URL}/section/{section_slug}")
    hrefs = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/program/"):
            hrefs.append(href)
    return list(dict.fromkeys(hrefs))  # deduplicate, preserve order


def parse_program(path: str) -> dict | None:
    """Fetch a program page and extract structured data."""
    url  = CALENDAR_URL + path
    soup = fetch_html(url)

    # The first <h1> is the global site "Academic Calendar" header.
    # The <title> tag has the real name: "Anthropology - Major (Science) - ERMAJ0105 | Academic Calendar"
    title_el = soup.find("title")
    if not title_el:
        return None
    title = title_el.get_text(strip=True).removesuffix(" | Academic Calendar")

    # Parse: "Anthropology - Major (Science) - ERMAJ0105"
    # or "Biology for Health Sciences - Major (Science) - ERMAJ0123"
    parts = [p.strip() for p in title.rsplit(" - ", 2)]
    if len(parts) == 3:
        name, type_part, code = parts
        m = PROGRAM_TYPE_RE.search(type_part)
        prog_type = m.group(1).capitalize() if m else "Program"
    else:
        name = title
        prog_type = "Program"
        code = path.lstrip("/program/")

    # Main content text
    main = soup.find(id="main-content") or soup.find("main") or soup.find("body")
    text = main.get_text(separator="\n") if main else ""

    # Extract all course codes mentioned anywhere in the page (flat list for Jaccard)
    course_codes = sorted(set(_course_codes(text)))

    # Extract structured requirement groups
    requirementGroups = _parse_requirement_groups(soup)

    # Extract the program ID from path (/program/ermaj1688 → ermaj1688)
    prog_id = path.lstrip("/program/")

    return {
        "id":       prog_id,
        "path":     path,
        "name":     name,
        "type":     prog_type,
        "code":     code,
        "courses":  course_codes,
        "requirementGroups": requirementGroups,
    }


def _normalize_course_code(code: str) -> str:
    return re.sub(r"\s+", "", code).upper()


def _course_codes(text: str) -> list[str]:
    return [_normalize_course_code(c) for c in COURSE_RE.findall(text or "")]


def _parse_paragraph_for_codes(el) -> list[list[str]]:
    """Walk a <p> or similar block element and extract course codes with OR/AND grouping.

    Uses the same _walk_children logic as _parse_list_item but operates on
    any block-level element (p, div, etc.) instead of just <li>.
    """
    def _walk_children(el):
        items = []  # list of ("code", joiner_text_before)
        prev_text = ""
        for child in el.children:
            if hasattr(child, 'name') and child.name == 'a':
                codes = _course_codes(child.get_text(" ") + " " + child.get('href', ''))
                if codes:
                    items.append((codes[0], prev_text))
                    prev_text = ""
            elif isinstance(child, NavigableString):
                prev_text += str(child)
            elif hasattr(child, 'name'):
                sub = _walk_children(child)
                if sub:
                    for code, joiner in sub:
                        items.append((code, prev_text + joiner if prev_text else joiner))
                        prev_text = ""
        return items

    items = _walk_children(el)
    if not items:
        codes = _course_codes(el.get_text(" "))
        if not codes:
            return []
        return [codes]

    # Build groups based on "or" separators in joiner text
    groups = []
    current_group = []
    for code, joiner in items:
        joiner_lower = joiner.lower()
        if 'or' in joiner_lower and current_group:
            groups.append(current_group)
            current_group = [code]
        else:
            current_group.append(code)
    if current_group:
        groups.append(current_group)
    return groups


def _parse_requirement_groups(soup) -> dict:
    """Parse enrolment/completion requirements into faithful ordered blocks.

    Returns: { "enrolment": {"blocks": [...]}, "completion": {"blocks": [...]} }
    Each block mirrors one <p>/<li> line from the calendar:
      { "text": prose, "codes": [normalized course codes, in order],
        "heading": bool, "indent": bool (came from <li>),
        "lead": emphasized lead label or None, "note": bool }
    This preserves credit amounts, <em>/<strong> year headings, and
    constraint lines that reference courses without links
    (e.g. "1.0 additional credit from the courses listed above").
    """
    result = {"enrolment": {"blocks": []}, "completion": {"blocks": []}}

    for field_class, key in [
        ("field-enrolment-requirements", "enrolment"),
        ("field-completion-req", "completion"),
    ]:
        field = soup.find(class_=re.compile(field_class))
        if not field:
            continue
        content_div = field.find(class_="field__item") or field

        blocks = []
        for el in content_div.find_all(["p", "li"], recursive=True):
            block = _requirement_block(el)
            if block:
                blocks.append(block)
        result[key]["blocks"] = blocks

    return result


def _norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def _ordered_codes(el) -> list[str]:
    seen: list[str] = []
    for raw in COURSE_RE.findall(el.get_text(" ")):
        code = _normalize_course_code(raw)
        if code not in seen:
            seen.append(code)
    return seen


def _lead_label(el):
    """Text of a leading <em>/<strong> label, if the line starts with one."""
    for child in el.children:
        if isinstance(child, NavigableString):
            if child.strip() == "":
                continue
            return None
        if hasattr(child, "name") and child.name:
            if child.name in ("em", "strong", "b", "i"):
                return _norm_ws(child.get_text(" ")) or None
            return None
    return None


def _requirement_block(el):
    """Turn a <p>/<li> into a faithful requirement block, or None to skip."""
    # Skip container elements that wrap nested lines (avoid double counting).
    if el.find(["p", "li"]):
        return None
    text = _norm_ws(el.get_text(" "))
    if not text:
        return None
    if re.match(r"^(NOTES?)\b", text, re.IGNORECASE):
        return None
    # Canonicalize inline course-code spacing ("ENG 110 H 5" -> "ENG110H5").
    text = COURSE_RE.sub(lambda m: _normalize_course_code(m.group(0)), text)
    text = re.sub(r"\s+([.,;])", r"\1", text)  # tidy stray space before punctuation
    codes = _ordered_codes(el)
    lead = _lead_label(el)
    indent = (el.name == "li")
    is_heading = (
        not codes
        and len(text) <= 60
        and bool(
            lead
            or text.endswith(":")
            or re.search(r"\b(higher\s+years?|year)\b", text, re.IGNORECASE)
        )
    )
    return {
        "text": text,
        "codes": codes,
        "heading": is_heading,
        "indent": indent,
        "lead": lead,
        "note": (not codes) and not is_heading,
    }


def _parse_list_item(li) -> list[list[str]]:
    """Parse a single <li> into requirement groups.

    Walks the children of <li> in order, tracking <a> codes and the text
    between them to determine AND vs OR relationships.

    Returns a list of groups, where each group is a list of course codes.
    Outer list = OR (pick one group); inner list = AND (must take all).

    Example: "(CSC108H5 and MAT102H5) or CSC110Y5"
      → [["CSC108H5", "MAT102H5"], ["CSC110Y5"]]
    Example: "CSC207H5 and CSC236H5"
      → [["CSC207H5", "CSC236H5"]]
    """

    def _walk_children(el):
        """Walk direct children of el, collecting codes and their joiners."""
        items = []  # list of ("code", joiner_text_before)
        prev_text = ""
        for child in el.children:
            if hasattr(child, 'name') and child.name == 'a':
                codes = _course_codes(child.get_text(" ") + " " + child.get('href', ''))
                if codes:
                    items.append((codes[0], prev_text))
                    prev_text = ""
            elif isinstance(child, NavigableString):
                prev_text += str(child)
            elif hasattr(child, 'name'):
                # Recurse into nested elements (strong, em, sub, sup, etc.)
                sub = _walk_children(child)
                if sub:
                    # Merge sub-items: join last item's text with this joiner
                    for code, joiner in sub:
                        items.append((code, prev_text + joiner if prev_text else joiner))
                        prev_text = ""
        return items

    items = _walk_children(li)
    if not items:
        codes = _course_codes(li.get_text(" "))
        if not codes:
            return []
        return [codes]

    # Build groups based on "or" separators
    groups = []
    current_group = []
    for code, joiner in items:
        joiner_lower = joiner.lower()
        if 'or' in joiner_lower and current_group:
            groups.append(current_group)
            current_group = [code]
        else:
            current_group.append(code)
    if current_group:
        groups.append(current_group)

    return groups


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching section list...")
    sections = get_sections()
    print(f"Found {len(sections)} sections")

    # If calendar page didn't yield links (JS-only rendering), fall back to known list
    if len(sections) < 10:
        print("Warning: few sections found via static HTML, using known slug list")
        slugs = [
            "Anthropology","Arabic","Art","Astronomy","Bioinformatics","Biology",
            "Biomedical-Communications","Business,-Science-and-Entrepreneurship",
            "Canadian-Studies","Chemistry","Chinese","Cinema-Studies",
            "Classical-Civilization","Combined-Degree-Programs","Commerce",
            "Communication,-Culture,-Information-and-Technology","Computer-Science",
            "Co~op-Internship-Program","Criminology,-Law-and-Society",
            "Diaspora-and-Transnational-Studies","Earth-Science","Economics",
            "Education-Studies","English","Environmental-Management",
            "Environmental-Science","Exceptionality-in-Human-Learning",
            "Forensic-Sciences","French","GeoSpatial-Data-Science","Geography",
            "German","Greek","Hindi","History","History-of-Religions",
            "International-Affairs","Italian","Language-Studies",
            "Language-Teaching-and-Learning","Latin",
            "Latin-American-and-Caribbean-Studies","Linguistics","Management",
            "Management-and-Innovation","Mathematical-Sciences","Neuroscience",
            "Persian","Philosophy","Physics","Political-Science","Psychology",
            "Sociology","South-Asian-Humanities","Spanish","Statistics,-Applied",
            "Study-of-University-Pedagogy",
            "Theatre,-Drama-and-Performance-Studies",
            "Visual-Culture-and-Communication",
            "Women,-Gender-and-Sexuality-Studies",
        ]
        sections = [{"slug": s, "name": s.replace("-", " ").replace(",", "")} for s in slugs]

    result_sections = []
    for sec in sections:
        slug = sec["slug"]
        print(f"  {slug} ...", end=" ", flush=True)
        try:
            prog_paths = get_program_links(slug)
            print(f"{len(prog_paths)} programs")
        except Exception as e:
            print(f"ERROR: {e}")
            result_sections.append({"slug": slug, "name": sec["name"], "programs": []})
            continue

        programs = []
        for path in prog_paths:
            try:
                prog = parse_program(path)
                if prog:
                    programs.append(prog)
                time.sleep(0.15)
            except Exception as e:
                print(f"    {path} ERROR: {e}")

        result_sections.append({
            "slug":     slug,
            "name":     sec["name"] or slug.replace("-", " "),
            "programs": programs,
        })
        time.sleep(0.2)

    output = {
        "campus": "utm",
        "calendarYear": "2026-2027",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "source": CALENDAR_URL,
        "sections": result_sections,
        "totalPrograms": sum(len(s["programs"]) for s in result_sections),
    }
    dest = OUTPUT_DIR / "utm-programs.json"
    if output['totalPrograms'] < 180:
        raise ValueError('Unexpected catalog shrinkage; preserving previous UTM snapshot')
    write_json(dest, output)
    print(f"\nDone → {dest} ({output['totalPrograms']} programs)")


if __name__ == "__main__":
    main()
