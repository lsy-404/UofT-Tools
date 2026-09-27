// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { state, init, switchCampus, setCourseStatus, addExtraCourse, applyImported, courseList, courseOfferings, isSatisfied, refreshSchedule } from '../web/src/pages/planner/store.js'

const catalogs = Object.fromEntries(['utm', 'stg', 'utsc'].map(c => [c, { sections: [{ slug: 'cs', name: 'CS', programs: [{ id: c, name: c, courses: [], type: 'Major' }] }] }]))
const courses = { utm: 'CSC108H5', stg: 'CSC108H1', utsc: 'CSCA08H3' }
beforeEach(() => {
  localStorage.clear()
  Object.assign(state, { campus: 'utm', programs: null, courses: null, catalogs: {}, selectedPrograms: [], extraCourses: [], courseStatus: {}, timetables: {}, scheduled: {}, board: [], scopeId: '', loading: false })
  global.fetch = vi.fn(async url => {
    const campus = Object.keys(courses).find(c => url.includes(`/${c}-`))
    const body = url.includes('-programs') ? catalogs[campus] : url.includes('-courses') ? { [courses[campus]]: { name: campus } }
      : url.includes('-sessions') ? [{ value: '20269', label: 'Fall 2026' }, { value: '20271', label: 'Winter 2027' }, { value: '20269-20271', label: 'Fall-Winter 2026-2027' }]
        : { courses: [{ code: courses[campus], sections: [] }], courseCount: 1 }
    return { ok: true, json: async () => body }
  })
})
describe('campus profiles and safe requirement recognition', () => {
  it('retains legacy UTM records and round-trips separate campus plans', async () => {
    localStorage.setItem('utm_completed', JSON.stringify(['CSC108H5']))
    localStorage.setItem('utm_selected_programs', JSON.stringify([{ id: 'utm' }]))
    await init()
    expect(state.courseStatus.CSC108H5).toBe(3)
    expect(state.selectedPrograms[0].id).toBe('utm')
    await switchCampus('utsc')
    addExtraCourse('CSCA08H3'); setCourseStatus('CSCA08H3', 2)
    await switchCampus('utm')
    expect(state.courseStatus.CSC108H5).toBe(3)
    expect(state.courseStatus.CSCA08H3).toBeUndefined()
    await switchCampus('utsc')
    expect(state.courseStatus.CSCA08H3).toBe(2)
    expect(state.extraCourses).toContain('CSCA08H3')
  })
  it('keeps marked courses visible after program removal and never treats planned or cross-campus work as completed', async () => {
    await init()
    setCourseStatus('CSC108H5', 1)
    setCourseStatus('CSC108H1', 3)
    expect(isSatisfied('CSC108H5')).toBe(false)
    expect(isSatisfied('CSC108H1')).toBe(false)
    expect(courseList.value.map(c => c.code)).toContain('CSC108H1')
  })
  it('rejects wrong-campus and malformed imports without replacing the existing plan', async () => {
    await init(); setCourseStatus('CSC108H5', 3)
    expect(() => applyImported({ campus: 'utsc', courseStatus: { CSCA08H3: 3 } })).toThrow('Switch')
    expect(() => applyImported({ courseStatus: { CSC108H5: 99 } })).toThrow('Invalid')
    expect(() => applyImported({ courseStatus: {}, selectedPrograms: [null] })).toThrow('Invalid')
    expect(state.courseStatus.CSC108H5).toBe(3)
  })
  it('offers all three campuses directly without same-number aliases', async () => {
    await init()
    for (const code of Object.values(courses)) expect(courseOfferings.value[code][0].code).toBe(code)
    expect(courseOfferings.value.CSC108H5.every(p => p.code === 'CSC108H5')).toBe(true)
  })
  it('isolates schedule preferences and does not resurrect cleared legacy completion', async () => {
    localStorage.setItem('utm_completed', JSON.stringify(['CSC108H5']))
    localStorage.setItem('utm_course_status', '{}')
    await init()
    expect(state.courseStatus.CSC108H5).toBeUndefined()
    state.prefs.time = 'morning'
    await nextTick()
    await switchCampus('utsc')
    expect(state.prefs.time).toBe('any')
    await switchCampus('utm')
    expect(state.prefs.time).toBe('morning')
  })
  it('retains the active plan if a new catalog fails to load', async () => {
    await init(); setCourseStatus('CSC108H5', 3)
    global.fetch = vi.fn(async () => ({ ok: false }))
    await switchCampus('utsc')
    expect(state.campus).toBe('utm')
    expect(state.courseStatus.CSC108H5).toBe(3)
    expect(state.loadError).toContain('retained')
  })
  it('reports a selected course missing from a snapshot rather than silently dropping it', async () => {
    await init()
    state.scheduled = { CSC999H5: ['20269'] }
    await nextTick(); await refreshSchedule()
    expect(state.board[0].results[0].missing).toBe(true)
  })
})
