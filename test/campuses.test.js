import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CAMPUSES, VALID_COURSE, levelOf, courseUrl, progress, combination } from '../web/src/pages/planner/lib/campuses.js'
import { courseYear, prereqTokens } from '../web/src/pages/planner/lib/courses.js'
import { rankedSchedules } from '../web/src/pages/planner/lib/scheduling.js'

const read = name => JSON.parse(readFileSync(new URL(`../data/planner/data/${name}.json`, import.meta.url), 'utf8'))
describe('campus-specific degree rules', () => {
  it('recognizes UTSC letter levels in input, display and requirements', () => {
    for (const [code, level] of [['CSCA08H3', 1], ['MATB41H3', 2], ['CSCC01H3', 3], ['CSCD01H3', 4], ['CSC148H1', 1], ['CSC343H5', 3]]) {
      expect(VALID_COURSE.test(code)).toBe(true)
      expect(levelOf(code)).toBe(level)
      expect(courseYear(code)).toBe(level)
      expect(prereqTokens(code, () => 0)[0].code).toBe(code)
    }
    expect(VALID_COURSE.test('CSCE01H3')).toBe(false)
    expect(courseUrl('CSCA08H3')).toContain('utsc.calendar')
  })
  it('does not turn a similar code into degree credit on another campus', () => {
    const result = progress('utm', { CSC108H1: 3, CSC108H5: 3, FAKE999H5: 3 }, { CSC108H1: {}, CSC108H5: { distribution: 'Science' } })
    expect(result.total).toBe(0.5)
    expect(result.pending).toEqual(['CSC108H1', 'FAKE999H5'])
    expect(result.cats.Science).toBe(0.5)
  })
  it('separates earned and projected credits and excludes timetable-only metadata', () => {
    const statuses = { CSCA08H3: 1, CSCB07H3: 2, CSCD01H3: 3, CSCC01H3: 3 }
    const courses = { CSCA08H3: {}, CSCB07H3: {}, CSCD01H3: {}, CSCC01H3: { timetableOnly: true } }
    expect(progress('utsc', statuses, courses, [3]).total).toBe(0.5)
    expect(progress('utsc', statuses, courses).total).toBe(1.5)
    expect(progress('utsc', statuses, courses).fourth).toBe(0.5)
  })
  it('requires all five UTSC categories at half a credit each', () => {
    const courses = {}, statuses = {}
    CAMPUSES.utsc.categories.forEach((breadth, i) => { const code = `TSTA0${i}H3`; courses[code] = { breadth }; statuses[code] = 3 })
    expect(progress('utsc', statuses, courses).satisfied).toBe(true)
    delete statuses.TSTA04H3
    expect(progress('utsc', statuses, courses).satisfied).toBe(false)
  })
  it('accepts both Arts & Science breadth patterns but not three full categories alone', () => {
    const courses = {}, statuses = {}
    for (let i = 0; i < 5; i++) {
      const code = `TST10${i}${i < 3 ? 'Y' : 'H'}1`
      courses[code] = { breadth: `${CAMPUSES.stg.categories[i]} (${i + 1})` }; statuses[code] = 3
    }
    expect(progress('stg', statuses, courses).satisfied).toBe(true)
    delete statuses.TST103H1; delete statuses.TST104H1
    expect(progress('stg', statuses, courses).satisfied).toBe(false)
    courses.TST104Y1 = { breadth: '(5)' }; statuses.TST104Y1 = 3
    expect(progress('stg', statuses, courses).satisfied).toBe(true)
  })
  it('splits a full-year Arts & Science breadth designation without double counting', () => {
    const p = progress('stg', { TST100Y1: 3 }, { TST100Y1: { breadth: '(1) (2)' } })
    expect(Object.values(p.cats).reduce((a, b) => a + b, 0)).toBe(1)
    expect(p.cats[CAMPUSES.stg.categories[0]]).toBe(0.5)
  })
  it('caps UTM and Arts & Science same-subject credits at 15', () => {
    const statuses = {}, courses = {}
    for (let i = 100; i < 132; i++) { statuses[`CSC${i}H5`] = 3; courses[`CSC${i}H5`] = {} }
    expect(progress('utm', statuses, courses).total).toBe(15)
  })
  it('flags reciprocal exclusions for credit review without mislabeling the CSCA08/CSCA48 sequence', () => {
    const stg = read('stg-courses')
    const excluded = progress('stg', { ACT230H1: 3, ACT240H1: 3 }, stg, [3])
    expect(excluded.exclusionReview).toEqual([['ACT230H1', 'ACT240H1']])
    const utsc = read('utsc-courses')
    const sequence = progress('utsc', { CSCA08H3: 3, CSCA48H3: 3 }, utsc, [3])
    expect(sequence.exclusionReview).toEqual([])
    const orderedCredit = progress('utsc', { MGEB12H3: 3, STAC67H3: 3 }, utsc, [3])
    expect(orderedCredit.exclusionReview).toEqual([])
    const stgTiming = progress('stg', { PHY100H1: 3, PHY202H1: 3 }, stg, [3])
    expect(stgTiming.exclusionReview).toEqual([])
  })
  it.each(Object.keys(CAMPUSES))('%s requires a recognized program pattern', campus => {
    expect(combination([{ type: 'Major', id: 'one' }], campus).messages.length).toBeGreaterThan(0)
    expect(combination([{ type: 'Major', id: 'one' }, { type: 'Minor', id: 'two' }, { type: 'Minor', id: 'three' }], campus).messages).toEqual([])
  })
})

describe('checked-in official campus snapshots', () => {
  it.each([
    ['utm', 'ermaj1688', 'CSC108H5'], ['stg', 'asmaj1689', 'CSC108H1'], ['utsc', 'scmaj1688', 'CSCA08H3'],
  ])('%s has a representative program, course and schedulable offering', (campus, id, code) => {
    const catalog = read(`${campus}-programs`)
    const program = catalog.sections.flatMap(s => s.programs).find(p => p.id === id)
    expect(program).toBeTruthy()
    expect(program.requirementGroups.completion.blocks.length).toBeGreaterThan(0)
    const courses = read(`${campus}-courses`)
    expect(courses[code].name).toBeTruthy()
    const timetable = read(`${campus}-timetable-20269`)
    expect(timetable.source).toBe('https://api.easi.utoronto.ca/ttb/getPageableCourses')
    expect(timetable.courseCount).toBe(timetable.courses.length)
    expect(timetable.courses.some(c => c.code === code)).toBe(true)
    const options = rankedSchedules(timetable, [code], { time: 'morning', freeDays: [], busyDays: [], density: 'any', commute: { enabled: true, hours: 1 } })
    expect(options[0].results[0].missing).toBeFalsy()
    expect(options[0].results[0].conflict).toBeFalsy()
    expect(options[0].results[0].sections.some(s => s.times.length)).toBe(true)
  })
  it('UTSG timetable includes courses beyond UTM lookalikes', () => {
    const stg = read('stg-timetable-20269'), utm = read('utm-timetable-20269')
    const bases = new Set(utm.courses.map(c => c.code.slice(0, -1)))
    expect(stg.courses.some(c => !bases.has(c.code.slice(0, -1)))).toBe(true)
  })
})
