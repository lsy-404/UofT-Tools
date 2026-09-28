import { describe, it, expect } from 'vitest'
import { rankedSchedules } from '../web/src/pages/planner/lib/scheduling.js'
const H = 3600000
const sec = (name, start = 9, end = 10, extra = {}) => ({ name, type: name.slice(0, 3), sectionNumber: name.slice(3), times: [{ day: 1, startMs: start * H, endMs: end * H }], ...extra })
const course = (sections, code = 'AAA100H5') => ({ code, sections })
const run = (courses, constraints = {}, extra = {}, friends = []) => rankedSchedules({ courses }, courses.map(c => c.code), { freeDays: [], busyDays: [], density: 'any', time: 'any', constraints, ...extra }, friends, '20269')
const names = a => a.results.flatMap(r => r.sections.map(s => s.name))
describe('personal hard constraints', () => {
  it('locks all component types before deduplication and removes excluded equivalents', () => {
    const data = [course(['LEC', 'TUT', 'PRA'].flatMap((t, i) => [sec(t + '0101', 9 + i, 10 + i), sec(t + '0102', 9 + i, 10 + i)]))]
    const result = run(data, { sections: { '20269': { AAA100H5: { locked: { LEC: 'LEC0102', TUT: 'TUT0102', PRA: 'PRA0102' }, excluded: ['LEC0101'] } } } })
    expect(names(result[0])).toEqual(['LEC0102', 'TUT0102', 'PRA0102'])
    expect(result[0].results[0].sections.every(s => !s.equivalents?.length)).toBe(true)
  })
  it('does not relax contradictory or stale locks', () => {
    for (const rule of [{ locked: { LEC: 'LEC9999' } }, { locked: { LEC: 'LEC0101' }, excluded: ['LEC0101'] }, { locked: { PRA: 'PRA9999' } }]) {
      const result = run([course([sec('LEC0101')])], { sections: { '20269': { AAA100H5: rule } } })
      expect(result[0].results[0].missing).toBe(true)
      expect(names(result[0])).toEqual([])
    }
  })
  it('applies full-year locks to each column, ignores unrelated term locks', () => {
    const result = run([course([sec('LEC0101'), sec('LEC0102')])], { sections: { '20269-20271': { AAA100H5: { locked: { LEC: 'LEC0102' } } }, '20271': { AAA100H5: { excluded: ['LEC0102'] } } } })
    expect(names(result[0])).toEqual(['LEC0102'])
  })
  it('enforces bounds and unavailable blocks with exact boundary contact allowed', () => {
    const result = run([course([sec('LEC0101', 8, 9), sec('LEC0102', 9, 10), sec('LEC0103', 10, 11), sec('LEC0104', 11, 12)])], { earliest: '09:00', latest: '11:00', unavailable: [{ day: 1, start: '10:00', end: '11:00' }] }, { time: 'afternoon', freeDays: [1] })
    expect(names(result[0])).toEqual(['LEC0102'])
  })
  it('excludes any matching instructor using normalized full names before dedupe', () => {
    const result = run([course([sec('LEC0101', 9, 10, { instructors: [{ firstName: 'Ada', lastName: 'Lovelace' }] }), sec('LEC0102')])], { excludedInstructors: [' ADA  LOVELACE '] })
    expect(names(result[0])).toEqual(['LEC0102'])
  })
  it('handles online preference, asynchronous and hybrid prohibition as hard rules', () => {
    const data = [course([sec('LEC0101', 9, 10, { deliveryModes: ['INPER'] }), sec('LEC0102', 9, 10, { deliveryModes: ['HYBR'] }), sec('LEC0103', 9, 10, { deliveryModes: ['ASYNC'], times: [] })])]
    expect(names(run(data, { online: 'prefer' })[0])).toEqual(['LEC0103'])
    expect(names(run(data, { online: 'forbid' })[0])).toEqual(['LEC0101'])
    expect(names(run(data, { online: 'prefer', sections: { '20269': { AAA100H5: { excluded: ['LEC0103'] } } } })[0])).toContain('LEC0101')
  })
  it('checks lunch across courses and retains a continuous gap, not summed fragments', () => {
    const data = [course([sec('LEC0101', 11, 12)]), course([sec('LEC0201', 12.5, 13.5), sec('LEC0202', 13, 14)], 'BBB100H5')]
    const result = run(data, { lunch: { enabled: true, start: '11:00', end: '14:00', minutes: 60 } })
    expect(names(result[0])).toEqual(['LEC0101', 'LEC0202'])
    expect(result.every(a => names(a).includes('LEC0202'))).toBe(true)
  })
  it('reserves a lunch gap despite unreliable alternating-week phase labels', () => {
    const first = sec('LEC0101', 11, 12)
    first.times[0].repetition = 'BI_WEEKLY'
    first.times[0].repetitionTime = 'FIRST_AND_THIRD_WEEK'
    const second = sec('LEC0201', 12, 13)
    second.times[0].repetition = 'BI_WEEKLY'
    second.times[0].repetitionTime = 'SECOND_AND_FOURTH_WEEK'
    const lunch = { lunch: { enabled: true, start: '11:00', end: '13:00', minutes: 60 } }
    expect(run([course([first]), course([second], 'BBB100H5')], lunch)[0].constraintFailure).toBe(true)
    const weekly = sec('LEC0201', 12, 13)
    expect(run([course([first]), course([weekly], 'BBB100H5')], lunch)[0].constraintFailure).toBe(true)
  })
  it('never returns lunch violations through conflict fallback', () => {
    const result = run([course([sec('LEC0101', 11, 14)]), course([sec('LEC0201', 12, 13)], 'BBB100H5')], { lunch: { enabled: true, start: '11:00', end: '14:00', minutes: 60 } })
    expect(result[0].constraintFailure).toBe(true)
    expect(names(result[0])).toEqual([])
  })
  it('keeps a conflict fallback when it still satisfies lunch', () => {
    const result = run([course([sec('LEC0101', 11, 12)]), course([sec('LEC0201', 11, 12)], 'BBB100H5')], { lunch: { enabled: true, start: '11:00', end: '14:00', minutes: 60 } })
    expect(result[0].conflicts).toBe(2)
    expect(names(result[0])).toHaveLength(2)
  })
  it('searches past a greedy lunch violation for a hard-valid conflict fallback', () => {
    const result = run([course([sec('LEC0101', 11, 12)]), course([sec('LEC0201', 12, 13), sec('LEC0202', 11, 12)], 'BBB100H5')], { lunch: { enabled: true, start: '11:00', end: '13:00', minutes: 60 } })
    expect(names(result[0])).toEqual(['LEC0101', 'LEC0202'])
    expect(result[0].conflicts).toBe(2)
  })
  it('applies clock limits only to meetings in the current term', () => {
    const result = run([course([sec('LEC0101', 9, 10, { times: [{ day: 1, startMs: 8 * H, endMs: 9 * H, sessionCode: '20271' }, { day: 1, startMs: 10 * H, endMs: 11 * H, sessionCode: '20269' }] })])], { earliest: '10:00' })
    expect(names(result[0])).toEqual(['LEC0101'])
  })
  it('rejects malformed or impossible time ranges', () => {
    for (const constraints of [{ earliest: '25:00' }, { earliest: '17:00', latest: '09:00' }, { unavailable: [{ day: 1, start: '12:00', end: '11:00' }] }, { lunch: { enabled: true, start: '12:00', end: '13:00', minutes: 90 } }]) expect(run([course([sec('LEC0101')])], constraints)[0].constraintFailure).toBe(true)
  })
  it('does not apply personal restrictions to friends independent classes', () => {
    const data = { courses: [course([sec('LEC0101', 10, 11)]), course([sec('LEC0201', 8, 9)], 'BBB100H5')] }
    const result = rankedSchedules(data, ['AAA100H5'], { freeDays: [], busyDays: [], constraints: { earliest: '10:00' } }, [{ name: 'Friend', courses: ['AAA100H5', 'BBB100H5'] }], '20269')
    expect(result[0].infeasibleFriends).toEqual([])
  })
})
