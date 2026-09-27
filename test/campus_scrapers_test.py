import sys
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'planner'))
import scrape_campus_catalogs as catalog
import scrape_ttb_courses as timetable


class CalendarAdapterTests(unittest.TestCase):
    def test_utsc_requirements_preserve_nested_alternatives_as_manual_prose(self):
        root = BeautifulSoup('''<div class="views-field-field-completion-requirements"><div class="field-content">
            <p>At least 1.0 credit, with permission:</p><ul><li>CSCA08H3 or CSCA48H3<ul><li>MATA31H3</li></ul></li></ul>
            </div></div>''', 'html.parser')
        p = catalog.program(root, 'MAJOR PROGRAM IN CS - SCMAJ1688', 'https://utsc.calendar.utoronto.ca/section/Computer-Science', 'utsc')
        blocks = p['requirementGroups']['completion']['blocks']
        self.assertEqual(len(blocks), 2)
        self.assertTrue(all(b['manualReview'] for b in blocks))
        self.assertIn('or', blocks[1]['text'])
        self.assertEqual(p['courses'], ['CSCA08H3', 'CSCA48H3', 'MATA31H3'])

    def test_empty_requirement_parser_fails_instead_of_publishing_success(self):
        with self.assertRaises(ValueError):
            catalog.program(BeautifulSoup('<div/>', 'html.parser'), 'CS Major ASMAJ1689', 'https://artsci.calendar.utoronto.ca', 'stg')

    def test_body_field_may_itself_be_the_item(self):
        root = BeautifulSoup('<div class="field--name-body field__item">Description</div>', 'html.parser')
        self.assertEqual(catalog.field(root, 'body').text, 'Description')

    @patch.object(timetable.SESSION, 'post')
    def test_incomplete_pagination_is_not_published(self, post):
        response = Mock(status_code=200)
        response.json.return_value = {'payload': {'pageableCourse': {'courses': [], 'total': 10}}}
        post.return_value = response
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            timetable.fetch_all_courses('20269', ['SCAR'])

    def test_timetable_preserves_utsc_identity_and_all_meeting_components(self):
        raw = {'code': 'CSCA08H3', 'name': 'CS', 'sectionCode': 'F', 'sections': [
            {'name': 'LEC01', 'teachMethod': 'LEC', 'meetingTimes': [{'start': {'day': 1, 'millisofday': 36000000}, 'end': {'millisofday': 39600000}, 'building': {}}]},
            {'name': 'TUT01', 'teachMethod': 'TUT', 'meetingTimes': []}]}
        result = timetable.simplify_course(raw)
        self.assertEqual(result['code'], 'CSCA08H3')
        self.assertEqual(len(result['sections']), 2)
        self.assertEqual(result['sections'][0]['times'][0]['day'], 1)


if __name__ == '__main__':
    unittest.main()
