import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'planner'))
import scrape_campus_catalogs as catalog
import scrape_utm_courses as utm_courses
import scrape_utm_programs as utm_programs
import scrape_ttb_courses as timetable


class CalendarAdapterTests(unittest.TestCase):
    def test_explicit_non_credit_is_zero_but_cr_ncr_grading_still_has_weight(self):
        source = 'https://artsci.calendar.utoronto.ca/course/act390h1'
        self.assertEqual(catalog.credit_info('ACT390H1',
            'This course does not carry credit weight and is evaluated as Credit/No Credit.', '', source),
            {'academicCredit': 0, 'creditKind': 'No academic credit', 'creditSource': source})
        self.assertEqual(catalog.credit_info('ACT473H1',
            'This course is Pass/Fail. Not eligible for Credit/No Credit.', '', source),
            {'academicCredit': 0.5})
        self.assertEqual(catalog.credit_info('PSYB80H3',
            'This course uses a Credit/No Credit (CR/NCR) grading scheme.', '', source),
            {'academicCredit': 0.5})
        self.assertEqual(catalog.credit_info('UTM010H5',
            'No credit is awarded for this course.', '', source)['academicCredit'], 0)

    def test_calendar_metadata_is_preserved_without_inventing_delivery_for_stg(self):
        root = BeautifulSoup('''<div>
            <div class="views-field-field-hours"><div class="field-content">72L</div></div>
            <div class="views-field-field-previous-course-number"><div class="field-content">JWU100Y1, WDW102Y1</div></div>
            <div class="views-field-field-course-experience"><div class="field-content">University-Based Experience</div></div>
        </div>''', 'html.parser')
        result = catalog.course_from_root('ABP102Y1', 'ABP102Y1: Example', root,
                                          catalog.CATALOGS['stg'], 'stg', '2026-09-27')
        self.assertEqual(result['hours'], '72L')
        self.assertEqual(result['previousCourseNumber'], 'JWU100Y1, WDW102Y1')
        self.assertEqual(result['courseExperience'], 'University-Based Experience')
        self.assertNotIn('modeOfDelivery', result)

    def test_exclusion_prose_keeps_direction_without_self_exclusion_code(self):
        root = BeautifulSoup('''<div><div class="views-field-field-exclusion"><div class="field-content">
            CSCA20H3. CSCA08H3 may not be taken after or concurrently with CSCA48H3.
        </div></div></div>''', 'html.parser')
        course = catalog.course_from_root('CSCA08H3', 'CSCA08H3: Introduction', root,
                                          catalog.CATALOGS['utsc'], 'utsc', '2026-09-27')
        self.assertEqual(course['exclusions'], ['CSCA20H3', 'CSCA48H3'])
        self.assertIn('CSCA08H3 may not be taken after or concurrently with CSCA48H3', course['exclusionText'])
        utm = utm_courses.course_from_root('POL399H5', 'POL399H5: Example', BeautifulSoup(
            '<div class="views-field-field-exclusion"><div class="field-content">POL399H5 and POL399Y5 may not be taken concurrently.</div></div>',
            'html.parser'), '2026-09-27')
        self.assertEqual(utm['exclusions'], ['POL399Y5'])

    def test_prerequisite_prose_does_not_make_a_course_require_itself(self):
        root = BeautifulSoup('''<div><div class="views-field-field-prerequisite"><div class="field-content">
            FSL100H1 or placement in FSL102H1 based on the French Placement Test. FSL100H1 may also qualify.
        </div></div></div>''', 'html.parser')
        course = catalog.course_from_root('FSL102H1', 'FSL102H1: Elementary French II', root,
                                          catalog.CATALOGS['stg'], 'stg', '2026-09-27')
        self.assertEqual(course['prereqs'], ['FSL100H1'])
        self.assertIn('placement in FSL102H1', course['prereqText'])
        utm = utm_courses.course_from_root('FSC307H5', 'FSC307H5: Example', BeautifulSoup(
            '<div class="views-field-field-prerequisite"><div class="field-content">ANT202H5 or permission if FSC307H5 is used for the IDENT requirement.</div></div>',
            'html.parser'), '2026-09-27')
        self.assertEqual(utm['prereqs'], ['ANT202H5'])

    def test_utm_calendar_delivery_preserves_the_summer_qualification(self):
        root = BeautifulSoup('''<div>
            <div class="views-field-field-mode-of-delivery"><div class="field-content">In Class</div>
              <div class="field-content">Online (Summer only)</div></div>
            <div class="views-field-field-international-component"><div class="field-content">International - Optional</div></div>
        </div>''', 'html.parser')
        result = utm_courses.course_from_root('ANT102H5', 'ANT102H5 • Anthropology', root, '2026-09-27')
        self.assertEqual(result['modeOfDelivery'], 'In Class Online (Summer only)')
        self.assertEqual(result['internationalComponent'], 'International - Optional')

    def test_utsc_requirements_preserve_nested_alternatives_as_manual_prose(self):
        root = BeautifulSoup('''<div class="views-field-field-completion-requirements"><div class="field-content">
            <p>At least 1.0 credit, with permission:</p><ul><li>CSCA08H3 or CSCA48H3<ul><li>MATA31H3</li></ul></li></ul>
            </div></div>''', 'html.parser')
        p = catalog.program(root, 'MAJOR PROGRAM IN CS - SCMAJ1688', 'https://utsc.calendar.utoronto.ca/section/Computer-Science', 'utsc')
        blocks = p['requirementGroups']['completion']['blocks']
        self.assertEqual(len(blocks), 3)
        self.assertTrue(all(b['manualReview'] for b in blocks))
        self.assertIn('or', blocks[1]['text'])
        self.assertGreater(blocks[2]['depth'], blocks[1]['depth'])
        self.assertEqual(p['courses'], ['CSCA08H3', 'CSCA48H3', 'MATA31H3'])

    def test_empty_requirement_parser_fails_instead_of_publishing_success(self):
        with self.assertRaises(ValueError):
            catalog.program(BeautifulSoup('<div/>', 'html.parser'), 'CS Major ASMAJ1689', 'https://artsci.calendar.utoronto.ca', 'stg')

    def test_body_field_may_itself_be_the_item(self):
        root = BeautifulSoup('<div class="field--name-body field__item">Description</div>', 'html.parser')
        self.assertEqual(catalog.field(root, 'body').text, 'Description')

    def test_roles_and_credit_pools_survive_line_breaks(self):
        root = BeautifulSoup('''<div><p>1. Required courses:<br>CSCA08H3 Introduction<br>CSCA48H3 Programming</p>
        <p>2. Choose 0.5 credit from:<br>MATB24H3 Algebra<br>STAB52H3 Probability</p>
        <p>3. CSC electives (1.0 credit)<br>1.0 credits in any C- or D-level CSC courses.</p>
        <p>Writing Recommendation:<br>Students are urged to take ENGA10H3 or ANTA01H3.</p></div>''', 'html.parser')
        blocks = catalog.blocks(root)
        by_text = {b['text']: b for b in blocks}
        self.assertEqual(by_text['CSCA08H3 Introduction']['role'], 'required')
        self.assertEqual(by_text['MATB24H3 Algebra']['role'], 'elective')
        self.assertEqual(by_text['MATB24H3 Algebra']['groupId'], by_text['STAB52H3 Probability']['groupId'])
        self.assertEqual(by_text['1.0 credits in any C- or D-level CSC courses.']['role'], 'elective')
        self.assertEqual(blocks[-1]['role'], 'recommended')

    def test_adjacent_course_codes_in_calendar_prose_are_both_imported(self):
        root = BeautifulSoup('<p>EUR300H1, <a href="/course/EUR301H1">EUR301H1</a>EUR400H1, EUR401H1</p>', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual(parsed[0]['codes'], ['EUR300H1', 'EUR301H1', 'EUR400H1', 'EUR401H1'])
        self.assertIn('EUR301H1 EUR400H1', parsed[0]['text'])

    def test_utm_programs_keep_utsc_letter_level_course_references(self):
        codes = utm_programs._course_codes('Complete CSC207H5 / CSC207H1 / CSCB07H3; GLBC01H3 is at UTSC.')
        self.assertEqual(codes, ['CSC207H5', 'CSC207H1', 'CSCB07H3', 'GLBC01H3'])

    def test_explicit_must_complete_survives_explanatory_options_and_exemptions(self):
        root = BeautifulSoup('''<div>
            <p>This program follows prescribed academic study sequencing options.</p>
            <p>Students must complete MGEC08H3 (0.5 credit in Economics);</p>
            <p>Students are exempted from MGEB12H3 and MGAD70H3;</p>
            <p>Students must complete all of the following courses: MGAD20H3, MGAD40H3.</p>
        </div>''', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual([b['role'] for b in parsed], ['note', 'required', 'note', 'required'])
        self.assertEqual(parsed[-1]['codeRoles'], {'MGAD20H3': 'required', 'MGAD40H3': 'required'})

    def test_must_include_named_courses_not_misread_as_later_credit_pool(self):
        root = BeautifulSoup('''<p>Completion of the Art History Major Program must include:
            FAH101H5 and VCC101H5 and ISP100H5 plus 2.0 credits of FAH at the 200 level
            and 3.0 credits of FAH or VCC or VST at the 300/400 level.</p>''', 'html.parser')
        block = catalog.blocks(root)[0]
        self.assertEqual(block['role'], 'required')
        self.assertEqual(block['codeRoles'], {c: 'required' for c in ['FAH101H5', 'VCC101H5', 'ISP100H5']})
        self.assertNotIn('requiredCredits', block)

    def test_inline_pool_does_not_swallow_following_required_or_alternative_courses(self):
        root = BeautifulSoup('<div><p>1.0 credit from CSC209H5 or CSC258H5 or CSC263H5</p><p>MAT223H5 or MAT240H5</p><p>CSC207H5 and CSC236H5</p></div>', 'html.parser')
        self.assertEqual([b['role'] for b in catalog.blocks(root)], ['elective', 'alternative', 'required'])

    def test_credit_caps_and_program_totals_are_not_elective_minimums(self):
        root = BeautifulSoup('''<div>
            <p>0.5 credit from ACT455H1 or ACT466H1</p>
            <p>Up to 1.5 credits from ANT331H1 or ANT332H1</p>
            <p>To bring the program total to 14.0 credits, students may select from BIO220H1 or CHM217H1.</p>
            <p>This stream requires a total of 27 courses (13.5 credits). Ten other courses must be chosen.</p>
            <p>1.0 credit each (total 2.0 credits) from two of the following three fields:</p>
            <p>Additional 1.5 to 2.0 credits from CSC courses to a total of 4.0 credits.</p>
        </div>''', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual(parsed[0]['requiredCredits'], 0.5)
        self.assertTrue(all('requiredCredits' not in b for b in parsed[1:]))

    def test_credit_caps_and_program_totals_are_conditions_not_elective_pools(self):
        root = BeautifulSoup('''<div>
            <p>2.5 credits from the groups listed below.</p>
            <p>-Only 1.0 credit total from Computer Science may count toward this minor.</p>
            <p>no more than 0.5 credit from CSC311H1 or STA314H1</p>
            <p>This stream requires a total of 27 courses (13.5 credits). Ten other courses must be chosen.</p>
        </div>''', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual([b['role'] for b in parsed], ['elective', 'note', 'note', 'note'])
        self.assertEqual(parsed[0]['requiredCredits'], 2.5)

    def test_named_catalog_groups_are_choices_even_when_lines_list_only_codes(self):
        root = BeautifulSoup('''<div>
            <p>Core Courses</p><p>EAS103H1, EAS105H1, EAS209H1</p>
            <p>Society-Culture Courses</p><p>EAS193H1, EAS194H1, EAS195H1</p>
            <p>Group 2 - Related Courses</p><p>ANT331H1, ANT442H1, BIO120H1</p>
            <p>Cluster A - Biological Bases of Behaviour:</p><p>PSY346H5, PSY351H5, PSY352H5</p>
        </div>''', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual([b['role'] for b in parsed if b['codes']],
                         ['reference', 'elective', 'elective', 'elective'])
        self.assertTrue(all('codeRoles' not in b for b in parsed if b['role'] == 'elective'))

    def test_numbered_mandatory_codes_before_reference_catalog_survive_semicolon(self):
        root = BeautifulSoup('''<div>
            <p>1. EAS103H1 and EAS105H1;</p>
            <p>Core Courses</p><p>EAS103H1, EAS105H1, EAS209H1</p>
        </div>''', 'html.parser')
        parsed = catalog.blocks(root)
        self.assertEqual(parsed[0]['codeRoles'], {'EAS103H1': 'required', 'EAS105H1': 'required'})
        self.assertEqual(parsed[2]['role'], 'reference')

    def test_cop_preserves_text_restriction_timing_and_zero_credit(self):
        root = BeautifulSoup('''<div>
        <div class="field--name-field-prerequisite field__item">Restricted to students in Arts and Science Co-op.</div>
        <div class="field--name-field-note field__item">Students should complete this course in the first year of study.</div>
        </div>''', 'html.parser')
        c = catalog.course_from_root('COPB50H3', 'Co-op', root, catalog.CATALOGS['utsc'], 'utsc', '2026-09-27')
        self.assertEqual(c['academicCredit'], 0)
        self.assertIn('first year', c['recommendedTiming'])
        self.assertEqual(c['prereqs'], [])
        self.assertIn('Restricted', c['prereqText'])

    def test_mixed_rotman_requirement_keeps_mandatory_courses(self):
        root = BeautifulSoup('<p>1. (ECO101H1, ECO102H1), RSM100H1/\u200b MGT100H1</p>', 'html.parser')
        block = catalog.blocks(root)[0]
        self.assertEqual(block['codeRoles'], {'ECO101H1': 'required', 'ECO102H1': 'required', 'RSM100H1': 'alternative', 'MGT100H1': 'alternative'})
        self.assertEqual(block['role'], 'reference')

    def test_recommended_timing_does_not_make_a_required_course_optional(self):
        root = BeautifulSoup('<p>Students are strongly encouraged to take RSM219H1 in their first year of study.</p>', 'html.parser')
        self.assertEqual(catalog.blocks(root)[0]['role'], 'note')
        writing = BeautifulSoup('<div><p>Writing Recommendation:</p><p>Students are urged to take ANTA01H3 by their second year.</p></div>', 'html.parser')
        self.assertEqual(catalog.blocks(writing)[1]['role'], 'recommended')

    @patch.object(catalog, 'page')
    def test_search_traverses_last_page_and_rejects_repeated_page(self, page):
        def html(title, pager=''):
            return BeautifulSoup(f'<h3 class="js-views-accordion-group-header">{title}</h3><div>entry</div>{pager}', 'html.parser')
        first = html('First', '<nav class="pager"><a href="?page=1">Last</a></nav>')
        page.side_effect = [first, html('Second')]
        result = list(catalog.search_pages('https://example.test', '/search-programs'))
        self.assertEqual(len(result), 2)
        self.assertEqual(result[1][1][0][0], 'Second')
        page.side_effect = [first, first]
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            list(catalog.search_pages('https://example.test', '/search-programs'))

    def test_open_pool_expands_only_matching_subject_and_levels(self):
        p = {'courses': [], 'requirementGroups': {'completion': {'blocks': [{'text': '1.0 credits in any C- or D-level CSC courses.'}]}}}
        catalog.expand_open_pools([p], {c: {} for c in ['CSCC01H3', 'CSCD01H3', 'CSCA08H3', 'MATC01H3']})
        self.assertEqual(p['courses'], ['CSCC01H3', 'CSCD01H3'])
        self.assertEqual(p['requirementGroups']['completion']['blocks'][0]['requiredCredits'], 1)

    def test_stg_off_campus_reference_missing_from_course_catalog_is_recorded(self):
        programs = [{'courses': ['VIS100H1', 'VIS300H0', 'CSCA08H3']}]
        courses = {'VIS100H1': {}}
        self.assertEqual(
            catalog.referenced_courses_outside_catalog('stg', programs, courses),
            ['VIS300H0'],
        )

    @patch.object(timetable.SESSION, 'post')
    def test_incomplete_pagination_is_not_published(self, post):
        response = Mock(status_code=200)
        response.json.return_value = {'payload': {'pageableCourse': {'courses': [], 'total': 10}}}
        post.return_value = response
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            timetable.fetch_all_courses('20269', ['SCAR'])

    @patch.object(timetable.SESSION, 'post')
    def test_unpublished_session_fails_instead_of_becoming_an_empty_snapshot(self, post):
        post.return_value = Mock(status_code=404)
        with self.assertRaisesRegex(timetable.TimetableUnavailableError, 'not published'):
            timetable.fetch_all_courses('20269', ['SCAR'])

    @patch.object(timetable.SESSION, 'post')
    def test_empty_unfiltered_timetable_fails(self, post):
        response = Mock(status_code=200)
        response.json.return_value = {'payload': {'pageableCourse': {'courses': [], 'total': 0}}}
        post.return_value = response
        with self.assertRaisesRegex(timetable.TimetableUnavailableError, 'empty unfiltered'):
            timetable.fetch_all_courses('20269', ['SCAR'])

    def test_failed_refresh_keeps_existing_snapshot_and_session_index(self):
        raw_course = {'code': 'CSC100H5', 'name': 'Example', 'sections': []}
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            snapshot = output_dir / 'utm-timetable-20269.json'
            index = output_dir / 'utm-sessions.json'
            snapshot.write_text('{"existing": true}', encoding='utf-8')
            index.write_text('[{"value": "20269"}]', encoding='utf-8')
            with patch.object(timetable, 'OUTPUT_DIR', output_dir), \
                 patch.object(timetable, 'get_sessions', return_value=[{'value': '20269', 'label': 'Fall'}]), \
                 patch.object(timetable, 'fetch_all_courses', side_effect=[[raw_course], [raw_course],
                     timetable.TimetableUnavailableError('TTB has not published 20269 for SCAR')]):
                with self.assertRaises(timetable.TimetableUnavailableError):
                    timetable.main()
            self.assertEqual(snapshot.read_text(encoding='utf-8'), '{"existing": true}')
            self.assertEqual(index.read_text(encoding='utf-8'), '[{"value": "20269"}]')

    def test_timetable_preserves_utsc_identity_and_all_meeting_components(self):
        raw = {'code': 'CSCA08H3', 'name': 'CS', 'sectionCode': 'F', 'sections': [
            {'name': 'LEC01', 'teachMethod': 'LEC', 'meetingTimes': [{'start': {'day': 1, 'millisofday': 36000000}, 'end': {'millisofday': 39600000}, 'building': {}}]},
            {'name': 'TUT01', 'teachMethod': 'TUT', 'meetingTimes': []}]}
        result = timetable.simplify_course(raw)
        self.assertEqual(result['code'], 'CSCA08H3')
        self.assertEqual(len(result['sections']), 2)
        self.assertEqual(result['sections'][0]['times'][0]['day'], 1)

    def test_timetable_preserves_cancel_link_delivery_and_meeting_term(self):
        raw = {'code': 'MGTA38H3', 'name': 'Management', 'cancelInd': 'N', 'sections': [
            {'name': 'TUT0001', 'teachMethod': 'TUT', 'sectionNumber': '0001', 'cancelInd': 'Y',
             'linkedMeetingSections': [{'teachMethod': 'LEC', 'sectionNumber': '08'}],
             'deliveryModes': [{'mode': 'SYNC'}],
             'meetingTimes': [{'start': {'day': 6, 'millisofday': 36000000}, 'end': {'millisofday': 39600000}, 'building': {}, 'sessionCode': '20269'}]},
        ]}
        section = timetable.simplify_course(raw)['sections'][0]
        self.assertTrue(section['cancelled'])
        self.assertEqual(section['linkedMeetingSections'][0]['sectionNumber'], '08')
        self.assertEqual(section['deliveryModes'], ['SYNC'])
        self.assertEqual(section['times'][0]['sessionCode'], '20269')

    def test_timetable_preserves_alternating_weeks_room_suffix_and_notes(self):
        raw = {'code': 'ANTA01H3', 'name': 'Anthropology', 'sectionCode': 'F',
               'notes': [{'name': 'Course Note', 'content': '<p>Tutorials meet every other week.</p>'}],
               'sections': [{'name': 'TUT0010', 'teachMethod': 'TUT',
                             'meetingTimes': [{'start': {'day': 1, 'millisofday': 36000000},
                                               'end': {'millisofday': 39600000},
                                               'building': {'buildingCode': 'IA', 'buildingRoomNumber': '', 'buildingRoomSuffix': 'A'},
                                               'repetition': 'BI_WEEKLY', 'repetitionTime': 'FIRST_AND_THIRD_WEEK'}]}]}
        result = timetable.simplify_course(raw)
        meeting = result['sections'][0]['times'][0]
        self.assertEqual(meeting['repetition'], 'BI_WEEKLY')
        self.assertEqual(meeting['repetitionTime'], 'FIRST_AND_THIRD_WEEK')
        self.assertEqual(meeting['room'], 'IA A')
        self.assertEqual(result['notes'][0]['text'], 'Tutorials meet every other week.')


if __name__ == '__main__':
    unittest.main()
