import { describe, it, expect } from 'vitest'
import {
  campusOf, campusName, commuteBufferMs, markConflicts, rankedSchedules,
} from '../web/src/pages/planner/lib/scheduling.js'

// One single-meeting course result on a given campus (encoded in the code).
const res = (code, day, sHr, eHr) => ({
  code,
  sections: [{ name: 'LEC0101', type: 'LEC', times: [{ day, startMs: sHr * 3600000, endMs: eHr * 3600000, room: 'X 100' }] }],
})
const COMMUTE = (hours, enabled = true) => ({ commute: { enabled, hours } })

describe('campus helpers', () => {
  it('reads the campus digit from a course code', () => {
    expect(campusOf('CSC108H5')).toBe('5')
    expect(campusOf('MAT135H1')).toBe('1')
    expect(campusOf('BIO399Y3')).toBe('3')
    expect(campusOf('ANT311Y0')).toBe('0')
    expect(campusOf('')).toBe('')
  })
  it('maps the digit to a campus name', () => {
    expect(campusName('CSC108H5')).toBe('UTM')
    expect(campusName('MAT135H1')).toBe('St. George')
    expect(campusName('ANT311Y0')).toBe('Off campus')
  })
  it('derives the buffer in ms, honouring enabled/hours', () => {
    expect(commuteBufferMs({ commute: { enabled: true, hours: 1 } })).toBe(3600000)
    expect(commuteBufferMs({ commute: { enabled: true, hours: 2 } })).toBe(7200000)
    expect(commuteBufferMs({ commute: { enabled: false, hours: 2 } })).toBe(0)
    expect(commuteBufferMs({ commute: { enabled: true, hours: 0 } })).toBe(0)
    expect(commuteBufferMs({})).toBe(0)
  })
})

describe('cross-campus commute buffer', () => {
  it('does not treat off-campus instruction as St. George for travel checks', () => {
    const results = [res('ANT311Y0', 1, 9, 10), res('MAT135H1', 1, 10, 11)]
    markConflicts(results, COMMUTE(1))
    expect(results[0].conflict).toBe(true)
    expect(results[1].conflict).toBe(true)
  })
  it('flags back-to-back classes on different campuses within the buffer', () => {
    const results = [res('CSC108H5', 1, 9, 10), res('MAT135H1', 1, 10, 11)]
    markConflicts(results, COMMUTE(1))
    expect(results[0].conflict).toBe(true)
    expect(results[1].conflict).toBe(true)
  })
  it('does NOT flag back-to-back classes on the SAME campus', () => {
    const results = [res('CSC108H5', 1, 9, 10), res('MAT135H5', 1, 10, 11)]
    markConflicts(results, COMMUTE(1))
    expect(results[0].conflict).toBeUndefined()
    expect(results[1].conflict).toBeUndefined()
  })
  it('does NOT flag cross-campus classes when commute is disabled', () => {
    const results = [res('CSC108H5', 1, 9, 10), res('MAT135H1', 1, 10, 11)]
    markConflicts(results, COMMUTE(1, false))
    expect(results[0].conflict).toBeUndefined()
  })
  it('respects the buffer size: a 1.5h gap clears 1h but not 2h', () => {
    const a = () => [res('CSC108H5', 2, 9, 10), res('MAT135H1', 2, 11.5, 12.5)]
    const oneH = a(); markConflicts(oneH, COMMUTE(1))
    expect(oneH[0].conflict).toBeUndefined()
    const twoH = a(); markConflicts(twoH, COMMUTE(2))
    expect(twoH[0].conflict).toBe(true)
  })
  it('a true time overlap is still a conflict even same-campus', () => {
    const results = [res('CSC108H5', 3, 10, 11), res('MAT135H5', 3, 10, 12)]
    markConflicts(results, COMMUTE(1))
    expect(results[0].conflict).toBe(true)
  })
})

describe('rankedSchedules with commute buffer', () => {
  const tt = {
    courses: [
      { code: 'CSC108H5', name: 'UTM CS', sections: [{ name: 'LEC0101', type: 'LEC', times: [{ day: 1, startMs: 9 * 3600000, endMs: 10 * 3600000, room: 'DH' }] }] },
      { code: 'MAT135H1', name: 'STG Calc', sections: [{ name: 'LEC0101', type: 'LEC', times: [{ day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: 'BA' }] }] },
    ],
  }
  const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }
  it('treats an unavoidable cross-campus adjacency as a conflict under a 1h buffer', () => {
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT135H1'], { ...prefs, ...COMMUTE(1) })
    expect(ranked[0].conflicts).toBe(2)
  })
  it('finds it conflict-free with no commute buffer', () => {
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT135H1'], { ...prefs, ...COMMUTE(0) })
    expect(ranked[0].conflicts).toBe(0)
  })
})
