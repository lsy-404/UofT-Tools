// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { academicCredit, courseLevelLabel } from '../web/src/pages/planner/lib/course-details.js'
import { progress, degreeConfiguration, combination } from '../web/src/pages/planner/lib/campuses.js'
import { buildCourseList } from '../web/src/pages/planner/lib/courses.js'
import { rankedSchedules } from '../web/src/pages/planner/lib/scheduling.js'
import CourseListView from '../web/src/pages/planner/components/CourseListView.vue'
import CoursePlanHeader from '../web/src/pages/planner/components/CoursePlanHeader.vue'
import { state } from '../web/src/pages/planner/store.js'

const read = name => JSON.parse(readFileSync(resolve(`data/planner/data/${name}.json`), 'utf8'))
const courses = read('utsc-courses')
const catalog = read('utsc-programs')
const cs = catalog.sections.flatMap(s => s.programs).find(p => p.id === 'scmaj1688')

beforeEach(() => {
  state.loading = true
  state.campus = 'utsc'
  state.courses = courses
  state.courseStatus = {}
  state.selectedPrograms = []
  state.extraCourses = []
})

describe('official review regression cases', () => {
  it('shows calendar hours and former course numbers from St. George', () => {
    state.campus = 'stg'
    state.courses = read('stg-courses')
    state.extraCourses = ['ABP102Y1']
    const wrapper = mount(CourseListView)
    const details = wrapper.find('tbody details')
    expect(details.exists()).toBe(true)
    expect(details.text()).toContain('Instructional hours: 72L')
    expect(details.text()).toContain('Previous course number: JWU100Y1, WDW102Y1')
    wrapper.unmount()
  })
  it('shows official breadth and distribution categories alongside the course', () => {
    state.campus = 'stg'
    state.courses = read('stg-courses')
    state.extraCourses = ['ANT100Y1', 'ANT311Y0']
    const stg = mount(CourseListView)
    expect(stg.text()).toContain('Breadth designation:')
    expect(stg.text()).toContain('off-campus instruction')
    stg.unmount()
    state.campus = 'utm'
    state.courses = read('utm-courses')
    state.extraCourses = ['DTS201H5']
    const utm = mount(CourseListView)
    expect(utm.text()).toContain('Distribution requirement: Humanities, Social Science')
    utm.unmount()
  })
  it('keeps explicit zero-credit courses out of degree totals without confusing CR/NCR grading', () => {
    const stgCourses = read('stg-courses')
    const utmCourses = read('utm-courses')
    expect(stgCourses.ACT390H1.academicCredit).toBe(0)
    expect(stgCourses.INT200H1.academicCredit).toBe(0)
    expect(stgCourses.ACT473H1.academicCredit).toBe(0.5)
    expect(stgCourses.ACT473H1.creditReview).toBeUndefined()
    expect(courses.PSYB80H3.creditReview).toBeUndefined()
    expect(utmCourses.ISP010H5.academicCredit).toBe(0)
    expect(progress('stg', { ACT390H1: 3, ACT473H1: 3 }, stgCourses, [3]).total).toBe(0.5)
    expect(progress('utm', { ISP010H5: 3 }, utmCourses, [3]).total).toBe(0)
    state.campus = 'stg'
    state.courses = stgCourses
    state.extraCourses = ['ACT390H1']
    const wrapper = mount(CourseListView)
    expect(wrapper.text()).toContain('0 academic credit')
    wrapper.unmount()
  })
  it('shows reciprocal exclusion review beside provisional degree totals', () => {
    state.campus = 'stg'
    state.courses = read('stg-courses')
    state.courseStatus = { ACT230H1: 3, ACT240H1: 3 }
    const wrapper = mount(CoursePlanHeader)
    expect(wrapper.text()).toContain('ACT230H1 / ACT240H1')
    expect(wrapper.text()).toContain('may overcount')
    wrapper.unmount()
  })
  it('includes both courses joined without whitespace in the official European Affairs list', () => {
    const programs = read('stg-programs').sections.flatMap(section => section.programs)
    const major = programs.find(program => program.id === 'asmaj1626')
    expect(major.courses).toEqual(expect.arrayContaining(['EUR301H1', 'EUR400H1']))
    const block = major.requirementGroups.completion.blocks.find(item => item.text.includes('EUR301H1'))
    expect(block.codes).toEqual(expect.arrayContaining(['EUR301H1', 'EUR400H1']))
    expect(block.text).toContain('EUR301H1 EUR400H1')
  })
  it('keeps large Psychology and East Asian Studies catalogs out of mandatory courses', () => {
    const stg = read('stg-programs').sections.flatMap(section => section.programs)
    const psychology = stg.find(program => program.id === 'asmaj1160')
    const psychologyList = buildCourseList([psychology])
    expect(psychologyList.find(row => row.code === 'PSY311H1').requirements.some(r => r.role === 'required')).toBe(false)
    expect(psychologyList.find(row => row.code === 'PSY311H1').requirements.some(r => r.role === 'elective')).toBe(true)
    const eastMinor = stg.find(program => program.id === 'asmin1058')
    const eastList = buildCourseList([eastMinor])
    expect(eastList.find(row => row.code === 'EAS103H1').requirements.some(r => r.role === 'required')).toBe(true)
    expect(eastList.find(row => row.code === 'EAS209H1').requirements.some(r => r.role === 'required')).toBe(false)
    const utm = read('utm-programs').sections.flatMap(section => section.programs)
    const utmPsychology = utm.find(program => program.id === 'erspe1160')
    const utmList = buildCourseList([utmPsychology])
    expect(utmList.find(row => row.code === 'PSY346H5').requirements.some(r => r.role === 'required')).toBe(false)
  })
  it('keeps UTSC course alternatives named by UTM programs pending manual credit review', () => {
    const programs = read('utm-programs').sections.flatMap(section => section.programs)
    const computerScience = programs.find(program => program.id === 'ermaj1688')
    const commerce = programs.find(program => program.id === 'erspe2273')
    expect(computerScience.courses).toContain('CSCB07H3')
    expect(commerce.courses).toEqual(expect.arrayContaining(['MGAB01H3', 'MGAB02H3', 'MATA30H3', 'MATA36H3']))
    expect(buildCourseList([commerce]).some(course => course.code === 'MGAB01H3')).toBe(true)
    expect(progress('utm', { MGAB01H3: 3 }, read('utm-courses'), [3]).pending).toContain('MGAB01H3')
  })
  it('labels explicit MAccFin completion courses as required and exemptions as notes', () => {
    const programs = read('utsc-programs').sections.flatMap(section => section.programs)
    const combined = programs.find(program => program.id === 'utsc-combined-degree-programs-bachelor-of-business-administration-master-of-accounting-and-finance')
    const blocks = combined.requirementGroups.completion.blocks
    expect(blocks.find(block => block.codes.includes('MGEC08H3')).role).toBe('required')
    expect(blocks.find(block => block.codes.includes('MGFC35H3')).role).toBe('required')
    expect(blocks.find(block => block.text.startsWith('Students are exempted from')).role).toBe('note')
    const accounting = blocks.find(block => block.text.startsWith('Students must complete all of the following advanced accounting'))
    expect(accounting.role).toBe('required')
    expect(Object.values(accounting.codeRoles)).toEqual(Array(5).fill('required'))
  })
  it('does not label mandatory Art History courses as an elective credit pool', () => {
    const programs = read('utm-programs').sections.flatMap(section => section.programs)
    for (const id of ['erspe0714', 'erspe0615', 'ermaj0714', 'ermaj0615']) {
      const program = programs.find(item => item.id === id)
      const block = program.requirementGroups.completion.blocks.find(item => item.text.includes('must include:'))
      expect(block.role).toBe('required')
      expect(block.codeRoles).toMatchObject({ FAH101H5: 'required', ISP100H5: 'required' })
      expect(block.requiredCredits).toBeUndefined()
    }
  })
  it('qualifies UTM online delivery as a calendar option limited to summer', () => {
    state.campus = 'utm'
    state.courses = read('utm-courses')
    state.extraCourses = ['ANT102H5']
    const wrapper = mount(CourseListView)
    const details = wrapper.find('tbody details')
    expect(details.text()).toContain('Calendar delivery options: In Class, Online (Summer only)')
    expect(details.text()).toContain('International component: International - Optional')
    wrapper.unmount()
  })
  it.each([[1, 1], [3, 2], [3, 3]])('preserves CSCA08/CSCA48 ordering restrictions without inventing a credit conflict (%s, %s)', (a08Status, a48Status) => {
    state.extraCourses = ['CSCA08H3', 'CSCA48H3']
    state.courseStatus = { CSCA08H3: a08Status, CSCA48H3: a48Status }
    const wrapper = mount(CourseListView)
    const a08 = wrapper.findAll('tbody tr').find(row => row.find('.code-link').text() === 'CSCA08H3')
    const a48 = wrapper.findAll('tbody tr').find(row => row.find('.code-link').text() === 'CSCA48H3')
    expect(a08.find('.exclusion-details').text()).toBe('Exclusions / enrolment restrictions: ' + courses.CSCA08H3.exclusionText)
    expect(a08.text()).toContain('CSCA08H3 may not be taken after or concurrently with CSCA48H3')
    expect(a48.find('.prereq-cell').text()).toContain('CSCA08H3')
    expect(wrapper.text()).not.toMatch(/only count one|toward your programs/)
    expect(wrapper.find('[aria-label^="Exclusion conflict"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows actual exclusion text even before courses are marked, without dropping abbreviated codes', () => {
    state.extraCourses = ['CSCA08H3', 'CSCA20H3', 'CSCA48H3']
    const wrapper = mount(CourseListView)
    expect(wrapper.findAll('.exclusion-details')).toHaveLength(3)
    const text = wrapper.find('.exclusion-details').text()
    expect(text).toContain('CSCA20H3')
    expect(text).toContain('CSC108H')
    expect(text).toContain('CSC110H cannot be taken after or concurrently with CSC111H')
    wrapper.unmount()
  })
  it('uses the Rotman BCom degree profile for an actual commerce specialist', () => {
    const stg = read('stg-programs').sections.flatMap(s => s.programs)
    const accounting = stg.find(p => p.id === 'asspe2676')
    expect(accounting).toBeTruthy()
    const config = degreeConfiguration('stg', [accounting])
    expect(config.degreeLabel).toContain('BCom')
    expect(config.checks).toContainEqual(['fourth', '400-level', 1])
    const sample = progress('stg', { RSM422H1: 3, ECO101H1: 3, COPB50H3: 3 }, read('stg-courses'), [3])
    expect(sample.commerce).toBe(0.5)
    expect(sample.other).toBe(0.5)
    expect(sample.fourth).toBe(0.5)
    const list = buildCourseList([accounting])
    const roles = code => list.find(c => c.code === code).requirements.map(r => r.role)
    expect(roles('ECO101H1')).toContain('required')
    expect(roles('ECO101H1')).not.toContain('alternative')
    expect(roles('RSM100H1')).toContain('alternative')
    expect(roles('RSM219H1')).toContain('required')
    expect(roles('RSM219H1')).not.toContain('recommended')
  })
  it('keeps focus programs separate from majors and excluded courses outside elective choices', () => {
    const stg = read('stg-programs').sections.flatMap(s => s.programs)
    const focus = stg.find(p => p.code === 'ASFOC0652B')
    expect(focus.type).toBe('Focus')
    const psychology = stg.find(p => p.id === 'asmaj1160')
    const hmb = buildCourseList([psychology]).find(c => c.code === 'HMB200H1')
    expect(hmb.requirements.some(r => r.role === 'excluded')).toBe(true)
  })
  it('keeps source requirements for humanities, sciences and commerce', () => {
    for (const [campus, ids] of [['stg', ['asmaj1775', 'asmaj0652', 'asmaj1160', 'asspe2676']], ['utsc', ['scmin0652', 'scmaj1030m', 'scmaj1160', 'scspe24313']]]) {
      const programs = read(`${campus}-programs`).sections.flatMap(s => s.programs)
      for (const id of ids) {
        const p = programs.find(p => p.id === id)
        expect(p, id).toBeTruthy()
        expect(p.requirementGroups.completion.blocks.some(b => b.text.length > 20)).toBe(true)
        expect(p.source).toContain('calendar.utoronto.ca')
      }
    }
    const history = catalog.sections.flatMap(s => s.programs).find(p => p.id === 'scmin0652')
    expect(history.courses.length).toBeGreaterThan(30)
    expect(history.requirementGroups.completion.blocks.some(b => b.pool?.upperCredits === 1)).toBe(true)
  })
  it('does not turn exclusions, elective choices or a standalone OR into mandatory courses', () => {
    const stg = read('stg-programs').sections.flatMap(s => s.programs)
    const english = buildCourseList([stg.find(p => p.id === 'asmin1645')])
    expect(english.find(c => c.code === 'ENG386H1').requirements[0].role).toBe('excluded')
    const utsc = catalog.sections.flatMap(s => s.programs)
    const african = buildCourseList([utsc.find(p => p.id === 'scminafs')])
    expect(african.find(c => c.code === 'ENGB22H3').requirements[0].role).toBe('elective')
    const management = buildCourseList([utsc.find(p => p.id === 'scspe24313')])
    expect(management.find(c => c.code === 'MATA34H3').requirements.some(r => r.role === 'alternative')).toBe(true)
    expect(management.find(c => c.code === 'MATA34H3').requirements.some(r => r.role === 'required')).toBe(false)
    const immunology = buildCourseList([stg.find(p => p.id === 'asspe1002')])
    expect(immunology.find(c => c.code === 'IMM450Y1').requirements.some(r => r.role === 'required')).toBe(false)
    const statistics = buildCourseList([utsc.find(p => p.id === 'scmin1078')])
    expect(statistics.find(c => c.code === 'STAB22H3').requirements.some(r => r.role === 'required')).toBe(false)
    const africanMajor = buildCourseList([stg.find(p => p.id === 'asmaj1707')])
    expect(africanMajor.find(c => c.code === 'AFR290H1').requirements.some(r => r.role === 'elective')).toBe(true)
    expect(africanMajor.find(c => c.code === 'AFR290H1').requirements.some(r => r.role === 'required')).toBe(false)
    const statisticsMinor = buildCourseList([utsc.find(p => p.id === 'scmin2289')])
    expect(statisticsMinor.find(c => c.code === 'MATA31H3').requirements.some(r => r.role === 'note')).toBe(true)
  })
  it('uses current UTM search, keeps enrolment information and flags ambiguous distribution', () => {
    const programs = read('utm-programs').sections.flatMap(s => s.programs)
    const utmCourses = read('utm-courses')
    expect(programs).toHaveLength(168)
    expect(new Set(programs.map(p => p.id)).size).toBe(168)
    expect(programs.find(p => p.id === 'erspe2226').description).toContain('cannot be combined')
    expect(Object.keys(utmCourses)).toHaveLength(2491)
    expect(utmCourses.ANT434H5.coreqText).toContain('ANT340H5')
    expect(utmCourses.ANT204H5.notes).toContain('ANT207H1')
    expect(utmCourses.ECO100Y5).toBeUndefined()
    expect(progress('utm', { ECO100Y5: 3 }, utmCourses, [3]).pending).toContain('ECO100Y5')
    const distributed = progress('utm', { DTS201H5: 3 }, utmCourses, [3])
    expect(distributed.pendingBreadth).toContain('DTS201H5')
  })
  it('keeps a live UTM lab and its overlapping linked tutorial together', () => {
    const timetable = read('utm-timetable-20269')
    const prefs = { freeDays: [], busyDays: [], density: 'compact', time: 'any' }
    const result = rankedSchedules(timetable, ['BIO203H5'], prefs, [], '20269')[0].results[0]
    expect(result.missing).not.toBe(true)
    expect(result.sections.map(s => s.type)).toEqual(['LEC', 'TUT', 'PRA'])
    expect(result.sections.some(s => s.cancelled)).toBe(false)
    expect(result.conflict).toBe(false)
  })
  it('rejects two UTSC specialists as an ordinary program combination', () => {
    const utsc = catalog.sections.flatMap(s => s.programs)
    const a = utsc.find(p => p.id === 'scspe1160')
    const b = utsc.find(p => p.id === 'scspe24313')
    expect(a && b).toBeTruthy()
    expect(combination([a, b], 'utsc').messages.join(' ')).toContain('one Specialist')
  })
  it('keeps COPB50 level separate from recommended first year and degree credit', () => {
    expect(courseLevelLabel('COPB50H3')).toBe('B-level')
    expect(courses.COPB50H3.recommendedTiming).toContain('first year')
    expect(academicCredit('COPB50H3', courses.COPB50H3)).toBe(0)
    expect(progress('utsc', { COPB50H3: 3 }, courses, [3]).total).toBe(0)
    expect(progress('utsc', { COPB50H3: 3, CSCA08H3: 3 }, courses, [3]).total).toBe(0.5)
  })
  it('renders text-only restrictions and first-year guidance, without a misleading Y2 badge', () => {
    state.extraCourses = ['COPB50H3']
    const w = mount(CourseListView)
    expect(w.text()).toContain('Restricted to students in the Arts and Science Co-op programs')
    expect(w.text()).toContain('first year')
    expect(w.text()).toContain('0 academic credit')
    expect(w.text()).toContain('B-level')
    expect(w.text()).not.toContain('Y2')
    w.unmount()
  })
  it('distinguishes CS major core courses, choices, writing recommendations and open electives', () => {
    const list = buildCourseList([cs])
    const roles = code => list.find(c => c.code === code).requirements.map(r => r.role)
    expect(roles('CSCA08H3')).toContain('required')
    expect(roles('MATB24H3')).toContain('elective')
    expect(roles('STAB52H3')).not.toContain('required')
    expect(roles('ANTA01H3')).toEqual(['recommended'])
    expect(roles('CSCD01H3')).toContain('elective')
  })
  it('filters recommendations separately from mandatory courses', async () => {
    state.selectedPrograms = [cs]
    const w = mount(CourseListView)
    await w.get('select').setValue('required')
    expect(w.text()).toContain('CSCA08H3')
    expect(w.text()).not.toContain('ANTA01H3')
    await w.get('select').setValue('recommended')
    expect(w.text()).toContain('ANTA01H3')
    w.unmount()
  })
  it.each([['utsc', 9, 240, 2100], ['stg', 14, 400, 5300]])('reconciles the full %s search directory', (campus, pages, programs, count) => {
    const data = read(`${campus}-programs`)
    const all = data.sections.flatMap(s => s.programs)
    expect(data.inventory.programPages).toHaveLength(pages)
    expect(all.length).toBeGreaterThanOrEqual(programs)
    expect(all.map(p => p.id).sort()).toEqual(data.inventory.discoveredProgramIds)
    expect(new Set(all.map(p => p.id)).size).toBe(all.length)
    expect(data.inventory.missingProgramIds).toEqual([])
    expect(Object.keys(read(`${campus}-courses`)).length).toBeGreaterThanOrEqual(count)
  })
})
