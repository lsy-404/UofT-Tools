# Planner coverage and maintenance

This is a course planner and a set of **partial credit checks**, not a graduation audit or an enrolment system. No combination of green checks certifies graduation. All rules in the new progress panel are pinned to the **2026–2027 calendar**, reviewed on 2026-09-27. Earlier admission/program-entry cohorts require their own calendar review.

## Supported scope

| Home campus | Program references | Degree checks | Timetable division |
| --- | --- | --- | --- |
| UTM | Existing 212-program catalog retained; current official requirements refreshed | HBA/HBSc credit total, 200+ and 300/400 levels, distribution, home-campus credits for September 2026 entrants | ERIN |
| UTSG | 11 selected Arts & Science programs in Computer Science, Mathematics and Economics | Arts & Science HBA/HBSc total, levels, home-faculty credits and five-category breadth | ARTSC |
| UTSC | 23 selected programs in Computer Science, Mathematics and Economics for Management Studies | HBA/HBSc total, C/D level, D level, home-campus credits and five-category breadth | SCAR |

The new subject-area catalogs are **not exhaustive**. The exact supported programs are the `code` entries in each campus's `*-programs.json`, displayed in the sidebar. Course calendar metadata covers courses mentioned in those programs; timetable-only courses can also be searched, planned and scheduled but require manual verification for credit checks. New-campus requirement blocks preserve official prose and clickable course codes; they do not infer satisfaction of admissions grades, options, co-op work terms or complex credit pools.

UTSG is not a single faculty. Engineering, Daniels, Music, Kinesiology & Physical Education, Information, and other professional or second-entry faculties are not supported by these degree checks or timetable snapshots. BCom, BBA, BCS, double degrees and certificates may appear as UTM reference programs but are not evaluated as HBA/HBSc degrees. Co-op program references do not certify co-op completion.

## Official rule and faculty sources

- [UTM HBSc](https://utm.calendar.utoronto.ca/honours-bachelor-science-hbsc): 20 credits, 13 at 200+, 6 at 300/400, 1 in each distribution; 10 UTM credits for September 2026 entrants; 15-credit same-designator limit.
- [UTM HBA](https://utm.calendar.utoronto.ca/honours-bachelor-arts-hba): corresponding Arts degree rules; program discipline determines degree designation, which this tool does not certify.
- [Arts & Science HBA/HBSc](https://artsci.calendar.utoronto.ca/hbahbsc-requirements): 20 total, 13 at 200+, 6 at 300/400, 10 from Arts & Science, same-designator limit and the two allowed breadth patterns.
- [UTSC HBSc](https://utsc.calendar.utoronto.ca/honours-bachelor-science-hbsc) and [HBA](https://utsc.calendar.utoronto.ca/honours-bachelor-arts-hba): 20 total, 10 at UTSC, 6 C/D including 1 D, 0.5 in each breadth category.
- [UTSC course regulations](https://utsc.calendar.utoronto.ca/course-regulations) and [registrar cross-campus guidance](https://www.utsc.utoronto.ca/registrar/courses-other-campuses): program credit requires academic-unit approval; enrolment and exclusion restrictions also apply.
- [Arts & Science course enrolment](https://artsci.calendar.utoronto.ca/course-enrolment): division-specific course access and degree-credit restrictions.
- [UTM cross-campus program approval example](https://www.utm.utoronto.ca/language-studies/student-resources/frequently-asked-questions-faqs): departmental permission is required, not an automatic equivalence based on the code.
- Separate UTSG sources reviewed: [Engineering calendar](https://engineering.calendar.utoronto.ca/), [Engineering timetables](https://undergrad.engineering.utoronto.ca/academics-registration/course-timetables/), [Daniels calendar](https://daniels.calendar.utoronto.ca/), [Daniels timetable guidance](https://www.daniels.utoronto.ca/students/current-students/undergraduate/course-descriptions-timetables), [KPE calendar](https://kpe.calendar.utoronto.ca/), [Music registration and timetable](https://music.utoronto.ca/student-resources/undergraduate/courses-registration), [university calendar directory](https://calendar.utoronto.ca/). Their existence does not imply implementation coverage.

## Cross-campus and progress semantics

Course identities remain complete codes (`CSC108H1`, `CSC108H5`, `CSCA08H3`). Similar names, numbers, exclusions and prerequisite alternatives are not program equivalence evidence. There is currently **no automatic cross-campus equivalence table**. All cross-campus courses are shown as pending manual verification and excluded from automatic degree/breadth checks; this intentionally undercounts credits that a registrar may ultimately approve. No enrolment right is implied by scheduling a course.

Plan, Taking and Done are distinct. Only Done contributes to completed checks; Taking and Plan are shown separately as projections. Same-campus credits without calendar metadata are also pending. Multi-designation UTM distribution courses need manual allocation. Arts & Science full-credit courses with two breadth categories contribute 0.5 to each, not 1.0 to both. Grades, CR/NCR, repeated/excluded courses, program completion, distinct credits, transfers, individual permissions and admission-year exceptions remain outside a complete audit. Use ACORN/official Degree Explorer and an advisor.

The previous 15-credit “Ordinary” projection and “Projected Outcome” graduation label were removed because the current calendars describe non-Honours graduation through GPA conditions on the four-year requirements, not a blanket 15-credit route. Program selection, statuses, prerequisites/exclusions, requirement references, suggestions, friend schedules, preferences and commute buffers remain available for UTM.

## Timetable provenance

The public [Timetable Builder](https://ttb.utoronto.ca/) uses:

- `https://api.easi.utoronto.ca/ttb/reference-data` with `Accept: application/json` for active sessions and division identifiers;
- `https://api.easi.utoronto.ca/ttb/getPageableCourses` for paginated offerings.

The reference data was checked directly: ERIN = UTM, SCAR = UTSC, ARTSC = Arts & Science. Other advertised divisions (APSC, ARCLA, FPEH, MUSIC, FIS) are intentionally not fetched. The API currently returns 20 records per page even when a larger page size is requested; pagination follows returned totals. UTSG is no longer filtered to UTM-like numbers.

Current refreshed sessions are Fall 2026, Winter 2027 and full-year 2026–2027. Each file records source, division, session, course count and retrieval timestamp. Older summer files are retained for history but not advertised in the current session index. The app exposes snapshot dates and missing campus files. TTB may disagree with ACORN; it does not confirm seats, eligibility, cancellations after retrieval or enrolment. Conflict detection, time/day/density preferences, full-year courses and configurable cross-campus travel buffers remain active. Travel buffers are user preferences, not guaranteed travel times.

## Refresh and extension

```sh
pip install -r scripts/requirements.txt
python scripts/planner/scrape_utm_programs.py
python scripts/planner/scrape_utm_courses.py
python scripts/planner/scrape_campus_catalogs.py
python scripts/planner/scrape_ttb_courses.py
npm ci
npm test
python -m unittest discover -s test -p '*_test.py'
npm run build
```

`update-planner.yml` performs the same refresh and validates tests/build before committing data. Calendar importers reject missing completion fields, unexpectedly empty catalogs and excessive missing course pages. New-campus missing course details are recorded in `unavailableCourses`; never fabricate metadata. TTB validates official division identifiers and incomplete pagination, fetching all snapshots before publication. A failing run must be reviewed, not converted into empty “no courses” data.

Before changing the academic year, manually review the official calendars, update the pinned year/rule definitions and coverage statements, then refresh the data. The annual rule review is not automated. Add subject areas in `CATALOGS`, inspect the exact extracted program list and prose, verify representative course breadth and requirements, and extend fixtures before claiming support. Faculty support requires its own verified rules and catalog adapter; adding a TTB division alone is insufficient.

## Persistence and review checklist

Existing `utm_*` local-storage keys and version-2 UTM exports are retained. UTSG and UTSC have separate profile keys. Version-3 exports include campus and extra courses; importing into the wrong home campus is rejected with a switch instruction. Marked courses remain visible after their program is removed.

For review, check the limited new-campus program list, conservative cross-campus treatment, 2026-only rule scope, co-op/manual requirements, UTM saved-state migration and representative course schedules. No deployment or merge is part of this change.
