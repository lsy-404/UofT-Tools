import { describe, it, expect } from 'vitest'
import {
  scoreSec, markConflicts, buildSchedule, buildGrid, msToLabel, GRID_START, timeKey, rankedSchedules,
  buildScopes, shortTerm, analyzeCourseConflicts, layoutDayColumns, dedupeSections,
} from '../web/src/pages/planner/lib/scheduling.js'

const lec = (day, startHr, endHr, name = 'LEC0101') => ({
  name, type: 'LEC',
  times: [{ day, startMs: startHr * 3600000, endMs: endHr * 3600000, room: 'DH 2020' }],
})

describe('scoreSec', () => {
  it('penalises meetings on a free day', () => {
    const sec = lec(1, 10, 11)
    expect(scoreSec(sec, [1], [], 'spread', 'any', [])).toBeLessThan(scoreSec(sec, [], [], 'spread', 'any', []))
  })
  it('rewards busy days and penalises a wrong time-of-day preference', () => {
    const morning = lec(2, 9, 10)
    expect(scoreSec(morning, [], [2], 'spread', 'any', [])).toBe(70) // 50 + 20 busy
    expect(scoreSec(morning, [], [], 'spread', 'afternoon', [])).toBe(35) // 50 - 15
  })
})

describe('official section restrictions', () => {
  const prefs = { freeDays: [], busyDays: [], density: 'compact', time: 'any', commute: { enabled: true, hours: 1 } }
  it('selects active and linked lecture, tutorial and practical sections together', () => {
    const course = { code: 'TST100H5', name: 'Example', sections: [
      { ...lec(1, 9, 10, 'LEC0101'), sectionNumber: '0101' },
      { ...lec(1, 11, 12, 'LEC0102'), sectionNumber: '0102', cancelled: true },
      { name: 'TUT0101', type: 'TUT', sectionNumber: '0101', linkedMeetingSections: [{ teachMethod: 'LEC', sectionNumber: '0102' }], times: [] },
      { name: 'TUT0102', type: 'TUT', sectionNumber: '0102', linkedMeetingSections: [{ teachMethod: 'LEC', sectionNumber: '0101' }], times: [] },
      { name: 'PRA0101', type: 'PRA', sectionNumber: '0101', times: [] },
    ] }
    const alternatives = rankedSchedules({ courses: [course] }, ['TST100H5'], prefs)
    expect(alternatives[0].results[0].sections.map(s => s.name)).toEqual(['LEC0101', 'TUT0102', 'PRA0101'])
    expect(alternatives.every(a => a.results[0].sections.every(s => !s.cancelled))).toBe(true)
  })
  it('reports no valid option when an entire required component is cancelled', () => {
    const course = { code: 'TST100H5', name: 'Example', sections: [
      lec(1, 9, 10), { ...lec(1, 11, 12, 'PRA0101'), type: 'PRA', cancelled: true },
    ] }
    const result = rankedSchedules({ courses: [course] }, ['TST100H5'], prefs)[0].results[0]
    expect(result.missing).toBe(true)
    expect(result.reason).toContain('No valid active')
  })
  it('keeps a linked section number even when another section has the same time', () => {
    const course = { code: 'TST100H5', name: 'Example', sections: [
      { ...lec(1, 9, 10, 'LEC0101'), sectionNumber: '0101' },
      { ...lec(1, 9, 10, 'LEC0102'), sectionNumber: '0102' },
      { name: 'TUT0101', type: 'TUT', sectionNumber: '0101', linkedMeetingSections: [{ teachMethod: 'LEC', sectionNumber: '0102' }], times: [] },
    ] }
    const result = rankedSchedules({ courses: [course] }, ['TST100H5'], prefs)[0].results[0]
    expect(result.sections.map(s => s.name)).toEqual(['LEC0102', 'TUT0101'])
  })
  it('shows the correct term of a full-year course and Saturday meetings', () => {
    const course = { code: 'TST100Y5', name: 'Year course', sections: [{ name: 'LEC0101', type: 'LEC', times: [
      { day: 1, startMs: 9 * 3600000, endMs: 10 * 3600000, sessionCode: '20269' },
      { day: 6, startMs: 11 * 3600000, endMs: 12 * 3600000, sessionCode: '20271' },
    ] }] }
    const timetable = { courses: [course] }
    const fall = rankedSchedules(timetable, ['TST100Y5'], prefs, [], '20269')[0].results[0]
    const winter = rankedSchedules(timetable, ['TST100Y5'], prefs, [], '20271')[0].results[0]
    expect(fall.sections[0].times).toHaveLength(1)
    expect(winter.sections[0].times).toHaveLength(1)
    expect(buildGrid([winter]).dayBlocks[6]).toHaveLength(1)
  })
})

describe('markConflicts', () => {
  it('flags overlapping biweekly meetings even when the API phase labels differ', () => {
    const alternating = phase => ({ sections: [{ ...lec(1, 10, 11), times: [{ ...lec(1, 10, 11).times[0], repetition: 'BI_WEEKLY', repetitionTime: phase }] }] })
    const first = alternating('FIRST_AND_THIRD_WEEK')
    const second = alternating('SECOND_AND_FOURTH_WEEK')
    markConflicts([first, second])
    expect(first.conflict).toBe(true)
    expect(second.conflict).toBe(true)
    const weekly = { sections: [lec(1, 10, 11)] }
    markConflicts([first, weekly])
    expect(first.conflict).toBe(true)
    expect(weekly.conflict).toBe(true)
  })
  it('flags two results that overlap in time', () => {
    const results = [
      { sections: [lec(1, 10, 11)] },
      { sections: [lec(1, 10, 12)] },
    ]
    markConflicts(results)
    expect(results[0].conflict).toBe(true)
    expect(results[1].conflict).toBe(true)
  })
  it('does not flag non-overlapping results', () => {
    const results = [
      { sections: [lec(1, 9, 10)] },
      { sections: [lec(1, 10, 11)] },
    ]
    markConflicts(results)
    expect(results[0].conflict).toBeUndefined()
  })

  const zz = (day, sh, eh) => ({ sections: [{ name: 'LEC0101', type: 'LEC', times: [{ day, startMs: sh * 3600000, endMs: eh * 3600000, room: 'ZZ' }] }] })
  it('allows two overlapping ZZ blocks by default', () => {
    const results = [zz(6, 9, 12), zz(6, 9, 12)]
    markConflicts(results)
    expect(results[0].conflict).toBeUndefined()
  })
  it('flags two overlapping ZZ blocks when zzOverlap is disabled', () => {
    const results = [zz(6, 9, 12), zz(6, 9, 12)]
    markConflicts(results, { zzOverlap: false })
    expect(results[0].conflict).toBe(true)
  })
  it('flags a ZZ block overlapping a regular class by default', () => {
    const results = [zz(1, 10, 12), { sections: [lec(1, 10, 11)] }]
    markConflicts(results)
    expect(results[0].conflict).toBe(true)
    expect(results[1].conflict).toBe(true)
  })
  it('allows ZZ over a regular class when zzWithReg is enabled', () => {
    const results = [zz(1, 10, 12), { sections: [lec(1, 10, 11)] }]
    markConflicts(results, { zzWithReg: true })
    expect(results[0].conflict).toBeUndefined()
  })
  it('records only the overlapping block (conflictTimes), not the course\'s other meetings', () => {
    const a = { code: 'AAA100H5', sections: [{ name: 'LEC', times: [
      { day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: '' },
      { day: 3, startMs: 14 * 3600000, endMs: 15 * 3600000, room: '' },
    ] }] }
    const b = { code: 'BBB100H5', sections: [{ name: 'LEC', times: [{ day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: '' }] }] }
    markConflicts([a, b])
    expect(a.conflict).toBe(true)
    expect(a.conflictTimes.has(timeKey('AAA100H5', { day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000 }))).toBe(true)
    expect(a.conflictTimes.has(timeKey('AAA100H5', { day: 3, startMs: 14 * 3600000, endMs: 15 * 3600000 }))).toBe(false)
  })
})

describe('rankedSchedules', () => {
  it('does not claim a conflict-free schedule from opposite API phase labels alone', () => {
    const alternate = (code, phase) => ({ code, name: code, sections: [{
      ...lec(1, 10, 11), times: [{ ...lec(1, 10, 11).times[0], repetition: 'BI_WEEKLY', repetitionTime: phase }],
    }] })
    const tt = { courses: [alternate('AAA100H5', 'FIRST_AND_THIRD_WEEK'), alternate('BBB100H5', 'SECOND_AND_FOURTH_WEEK')] }
    const result = rankedSchedules(tt, ['AAA100H5', 'BBB100H5'], { density: 'any', time: 'any', freeDays: [], busyDays: [] })[0]
    expect(result.conflicts).toBeGreaterThan(0)
    expect(result.results.every(r => r.conflict)).toBe(true)
  })
  it('ranks a conflict-free arrangement first, even when preferences differ', () => {
    const tt = { courses: [
      { code: 'CSC108H5', name: 'CS', sections: [lec(1, 9, 10, 'LEC0101'), lec(1, 10, 11, 'LEC0102')] },
      { code: 'MAT102H5', name: 'MAT', sections: [lec(1, 9, 10, 'LEC0101')] },
    ] }
    const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs)
    expect(ranked[0].conflicts).toBe(0)
    // CSC must take the 10-11 lecture to avoid MAT's 9-10 lecture
    expect(ranked[0].results.find(r => r.code === 'CSC108H5').sections[0].name).toBe('LEC0102')
    // every returned arrangement is conflict-free (feasibility ignores preferences)
    expect(ranked.every(r => r.conflicts === 0)).toBe(true)
  })
  it('keeps a conflict-free option even when a preference would prefer the clashing section', () => {
    // CSC's busy-day-preferred lecture (Mon) clashes with MAT; the other (Tue) does not.
    const tt = { courses: [
      { code: 'CSC108H5', name: 'CS', sections: [lec(1, 9, 10, 'LEC0101'), lec(2, 9, 10, 'LEC0102')] },
      { code: 'MAT102H5', name: 'MAT', sections: [lec(1, 9, 10, 'LEC0101')] },
    ] }
    const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [1] } // prefer Monday
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs)
    expect(ranked[0].conflicts).toBe(0)
    expect(ranked[0].results.find(r => r.code === 'CSC108H5').sections[0].name).toBe('LEC0102')
  })
  it('prefers a real timed section over a no-time placeholder section', () => {
    const tt = { courses: [{ code: 'ISP100H5', name: 'ISP', sections: [
      { name: 'LEC0112', type: 'LEC', times: [] },   // placeholder, no meeting time
      lec(2, 9, 11, 'LEC0101'),                       // real meeting time
    ] }] }
    const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }
    const ranked = rankedSchedules(tt, ['ISP100H5'], prefs)
    expect(ranked[0].results[0].sections[0].name).toBe('LEC0101')
  })
  it('falls back to a single best-effort option when no conflict-free arrangement exists', () => {
    const tt = { courses: [
      { code: 'CSC108H5', name: 'CS', sections: [lec(1, 9, 10)] },
      { code: 'MAT102H5', name: 'MAT', sections: [lec(1, 9, 10)] },
    ] }
    const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].conflicts).toBeGreaterThan(0)
  })
  it('never places a course whose own LEC and TUT overlap when a clean combo exists', () => {
    const tt = { courses: [{ code: 'MAT232H5', name: 'Calc', sections: [
      lec(1, 9, 11, 'LEC0101'),
      { name: 'TUT0101', type: 'TUT', times: [{ day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: 'IB' }] }, // overlaps own LEC
      { name: 'TUT0201', type: 'TUT', times: [{ day: 2, startMs: 9 * 3600000, endMs: 10 * 3600000, room: 'IB' }] },
    ] }] }
    const prefs = { density: 'compact', time: 'any', freeDays: [], busyDays: [] }
    const ranked = rankedSchedules(tt, ['MAT232H5'], prefs)
    for (const opt of ranked) {
      const tut = opt.results[0].sections.find(s => s.type === 'TUT')
      expect(tut.name).toBe('TUT0201')
      expect(opt.conflicts).toBe(0)
    }
  })
  it('keeps and red-flags a course when every LEC×TUT combo self-overlaps', () => {
    const tt = { courses: [{ code: 'XYZ100H5', name: 'X', sections: [
      lec(1, 9, 11, 'LEC0101'),
      { name: 'TUT0101', type: 'TUT', times: [{ day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: 'IB' }] },
    ] }] }
    const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }
    const ranked = rankedSchedules(tt, ['XYZ100H5'], prefs)
    expect(ranked[0].results[0].conflict).toBe(true)
    expect(ranked[0].conflicts).toBeGreaterThan(0)
  })
})

describe('dedupeSections', () => {
  it('keeps opposite alternating-week sections distinct at the same hour', () => {
    const first = { ...lec(1, 9, 10, 'TUT0001'), times: [{ ...lec(1, 9, 10).times[0], repetition: 'BI_WEEKLY', repetitionTime: 'FIRST_AND_THIRD_WEEK' }] }
    const second = { ...lec(1, 9, 10, 'TUT0002'), times: [{ ...lec(1, 9, 10).times[0], repetition: 'BI_WEEKLY', repetitionTime: 'SECOND_AND_FOURTH_WEEK' }] }
    expect(dedupeSections([first, second])).toHaveLength(2)
  })
  it('collapses sections with identical meeting times into one representative', () => {
    const pool = [
      lec(1, 9, 10, 'TUT0101'), lec(1, 9, 10, 'TUT0102'), lec(1, 9, 10, 'TUT0103'),
      lec(2, 9, 10, 'TUT0201'),
    ]
    const out = dedupeSections(pool)
    expect(out).toHaveLength(2)
    const rep = out.find(s => s.name === 'TUT0101')
    expect(rep.equivalents).toEqual(['TUT0102', 'TUT0103'])
    expect(out.find(s => s.name === 'TUT0201').equivalents).toBeUndefined()
  })
  it('does not merge a ZZ block with a regular room at the same time', () => {
    const pool = [
      { name: 'TUT0101', type: 'TUT', times: [{ day: 1, startMs: 9 * 3600000, endMs: 10 * 3600000, room: 'IB' }] },
      { name: 'TUT0102', type: 'TUT', times: [{ day: 1, startMs: 9 * 3600000, endMs: 10 * 3600000, room: 'ZZ' }] },
    ]
    expect(dedupeSections(pool)).toHaveLength(2)
  })
})

describe('markConflicts same-course sections', () => {
  it('flags a course whose own LEC and TUT overlap', () => {
    const results = [{ code: 'A', sections: [
      lec(1, 9, 11, 'LEC0101'),
      { name: 'TUT0101', type: 'TUT', times: [{ day: 1, startMs: 10 * 3600000, endMs: 11 * 3600000, room: 'IB' }] },
    ] }]
    markConflicts(results)
    expect(results[0].conflict).toBe(true)
  })
  it('does not flag a single section against itself', () => {
    const results = [{ code: 'A', sections: [lec(1, 9, 11, 'LEC0101')] }]
    markConflicts(results)
    expect(results[0].conflict).toBeUndefined()
  })
})

describe('buildSchedule', () => {
  const timetable = {
    courses: [{
      code: 'CSC108H5', name: 'Intro to CS',
      sections: [lec(1, 9, 11), { name: 'TUT0101', type: 'TUT', times: [{ day: 3, startMs: 13 * 3600000, endMs: 14 * 3600000, room: 'IB 110' }] }],
    }],
  }
  it('picks a lecture and a tutorial per course', () => {
    const results = buildSchedule(timetable, ['CSC108H5'], { density: 'compact', time: 'any', freeDays: [], busyDays: [] })
    expect(results).toHaveLength(1)
    expect(results[0].sections.map(s => s.type)).toEqual(['LEC', 'TUT'])
    expect(results[0].color).toBeTruthy()
  })
  it('marks courses absent from the timetable as missing', () => {
    const results = buildSchedule(timetable, ['XYZ999H5'], { density: 'compact', time: 'any', freeDays: [], busyDays: [] })
    expect(results[0].missing).toBe(true)
  })
})

describe('buildGrid / msToLabel', () => {
  it('formats millis-of-day as a 12-hour label', () => {
    expect(msToLabel(GRID_START)).toBe('8:00 AM')
    expect(msToLabel(13 * 3600000)).toBe('1:00 PM')
  })
  it('positions a block within the correct day column', () => {
    const results = [{ code: 'CSC108H5', name: 'Intro', color: '#000', sections: [lec(2, 9, 10)] }]
    const grid = buildGrid(results)
    expect(grid.dayBlocks[2]).toHaveLength(1)
    expect(grid.dayBlocks[1]).toHaveLength(0)
    expect(grid.dayBlocks[2][0].height).toBe(60) // 1 hour * HOUR_PX
  })
})

describe('layoutDayColumns', () => {
  it('keeps a non-overlapping block full width', () => {
    const [a] = layoutDayColumns([{ top: 0, height: 60 }])
    expect(a.left).toBe(0)
    expect(a.widthPct).toBe(100)
  })
  it('splits two overlapping blocks side-by-side (left/right halves)', () => {
    const blocks = layoutDayColumns([{ top: 0, height: 60 }, { top: 30, height: 60 }])
    expect(blocks.map(b => b.widthPct)).toEqual([50, 50])
    expect(blocks.map(b => b.left).sort((x, y) => x - y)).toEqual([0, 50])
  })
  it('separate clusters each reset to full width', () => {
    const blocks = layoutDayColumns([{ top: 0, height: 30 }, { top: 120, height: 30 }])
    expect(blocks.every(b => b.widthPct === 100 && b.left === 0)).toBe(true)
  })
})

describe('buildScopes / shortTerm', () => {
  const sessions = [
    { value: '20265F', label: 'Summer First Sub-Session 2026 (F)' },
    { value: '20265S', label: 'Summer Second Sub-Session 2026 (S)' },
    { value: '20265', label: 'Summer Full Session 2026 (Y)' },
    { value: '20269', label: 'Fall 2026 (F)' },
    { value: '20271', label: 'Winter 2027 (S)' },
    { value: '20269-20271', label: 'Fall-Winter 2026-2027 (Y)' },
  ]
  it('shortTerm derives compact labels', () => {
    expect(shortTerm('Fall 2026 (F)')).toBe('Fall')
    expect(shortTerm('Winter 2027 (S)')).toBe('Winter')
    expect(shortTerm('Summer First Sub-Session 2026 (F)')).toBe('Summer F')
    expect(shortTerm('Summer Second Sub-Session 2026 (S)')).toBe('Summer S')
    expect(shortTerm('Summer Full Session 2026 (Y)')).toBe('Summer Full')
    expect(shortTerm('Fall-Winter 2026-2027 (Y)')).toBe('Full Year')
  })
  it('builds Summer and Fall-Winter as two-column scopes with a full-session term', () => {
    const sc = buildScopes(sessions)
    const fw = sc.find(s => s.id === '20269-20271')
    expect(fw.terms.map(t => t.value)).toEqual(['20269', '20271'])
    expect(fw.terms.map(t => t.label)).toEqual(['Fall', 'Winter'])
    expect(fw.full).toEqual({ value: '20269-20271', label: 'Full Year' })
    const summer = sc.find(s => s.id === '20265')
    expect(summer.terms.map(t => t.value)).toEqual(['20265F', '20265S'])
    expect(summer.terms.map(t => t.label)).toEqual(['Summer F', 'Summer S'])
    expect(summer.full).toEqual({ value: '20265', label: 'Summer Full' })
  })
  it('exposes only the two combined ranges (no duplicate single-session scopes)', () => {
    const sc = buildScopes(sessions)
    expect(sc.map(s => s.id)).toEqual(['20265', '20269-20271'])
    expect(sc.some(s => s.single)).toBe(false)
  })
})

describe('analyzeCourseConflicts', () => {
  const prefs = { density: 'compact', time: 'any', freeDays: [], busyDays: [] }
  it('flags a candidate when no non-conflicting section can be found', () => {
    const terms = [{ value: '20265F', label: 'Summer F' }]
    const timetables = {
      '20265F': {
        courseCount: 2,
        courses: [
          { code: 'CSC108H5', name: 'Intro', sections: [lec(1, 10, 11)] },
          { code: 'MAT102H5', name: 'Proofs', sections: [lec(1, 10, 11)] },
        ],
      },
    }
    const hints = analyzeCourseConflicts(terms, timetables, ['CSC108H5'], prefs, ['MAT102H5'])
    expect(hints.MAT102H5).toEqual({ conflict: true, reason: 'Conflict Found' })
  })
})

describe('rankedSchedules with friends', () => {
  const tt = {
    courses: [
      {
        code: 'CSC108H5', name: 'Intro',
        sections: [
          lec(1, 9, 11, 'LEC0101'), lec(2, 14, 16, 'LEC0201'),
          { name: 'PRA0101', type: 'PRA', times: [{ day: 3, startMs: 13 * 3600000, endMs: 14 * 3600000, room: '' }] },
        ],
      },
      { code: 'MAT102H5', name: 'Calc', sections: [lec(4, 9, 11)] },
      { code: 'BIO153H5', name: 'Bio', sections: [lec(1, 9, 11)] }, // clashes with CSC LEC0101 only
    ],
  }
  const prefs = { density: 'any', time: 'any', freeDays: [], busyDays: [] }

  it('marks shared courses with the friend names; friend-only courses stay off the board', () => {
    const friends = [{ name: 'Alex', courses: ['CSC108H5', 'BIO153H5'] }]
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs, friends)
    const top = ranked[0]
    const csc = top.results.find(r => r.code === 'CSC108H5')
    expect(csc.shared).toBe(true)
    expect(csc.sharedWith).toEqual(['Alex'])
    expect(top.results.find(r => r.code === 'MAT102H5').shared).toBeUndefined()
    expect(top.results.some(r => r.code === 'BIO153H5')).toBe(false)
  })
  it("prefers arrangements where every friend can fit their own courses", () => {
    // Alex also takes BIO153H5 (Mon 9-11): your CSC must take LEC0201 (Tue) so
    // Alex's BIO still fits — LEC0101 (Mon 9-11) would clash with it for Alex.
    const friends = [{ name: 'Alex', courses: ['CSC108H5', 'BIO153H5'] }]
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs, friends)
    expect(ranked[0].infeasibleFriends).toEqual([])
    const lecName = ranked[0].results.find(r => r.code === 'CSC108H5').sections.find(s => s.type === 'LEC').name
    expect(lecName).toBe('LEC0201')
  })
  it('reports a friend who can never fit instead of dropping the arrangement', () => {
    // Bob's own course collides with the only MAT lecture, which Bob shares.
    const tt2 = { courses: [
      { code: 'MAT102H5', name: 'Calc', sections: [lec(4, 9, 11, 'LEC0101')] },
      { code: 'PHY136H5', name: 'Phys', sections: [lec(4, 9, 11, 'LEC0101')] },
    ] }
    const friends = [{ name: 'Bob', courses: ['MAT102H5', 'PHY136H5'] }]
    const ranked = rankedSchedules(tt2, ['MAT102H5'], prefs, friends)
    expect(ranked[0].infeasibleFriends).toEqual(['Bob'])
  })
  it('supports multiple friends sharing the same course', () => {
    const friends = [
      { name: 'Alex', courses: ['CSC108H5'] },
      { name: 'Sam', courses: ['CSC108H5', 'MAT102H5'] },
    ]
    const ranked = rankedSchedules(tt, ['CSC108H5', 'MAT102H5'], prefs, friends)
    const csc = ranked[0].results.find(r => r.code === 'CSC108H5')
    expect(csc.sharedWith).toEqual(['Alex', 'Sam'])
    expect(ranked[0].results.find(r => r.code === 'MAT102H5').sharedWith).toEqual(['Sam'])
  })
})
