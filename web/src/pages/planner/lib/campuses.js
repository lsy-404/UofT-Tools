import { academicCredit } from './course-details.js'
// Verified against the linked 2026–2027 calendars on 2026-09-27.
// These are progress checks, never certification of graduation eligibility.
export const CAMPUSES = {
  utm: { name: 'UTM', suffix: '5', calendar: 'https://utm.calendar.utoronto.ca', faculty: 'University of Toronto Mississauga',
    degreeSource: 'https://utm.calendar.utoronto.ca/honours-bachelor-science-hbsc',
    categories: ['Science', 'Social Science', 'Humanities'], breadthMin: 1,
    checks: [['total', 'Total credits', 20], ['upper2', '200+ level', 13], ['upper', '300/400 level', 6], ['home', 'UTM credits (2026 entrants)', 10]] },
  stg: { name: 'UTSG', suffix: '1', calendar: 'https://artsci.calendar.utoronto.ca', faculty: 'Faculty of Arts & Science',
    degreeSource: 'https://artsci.calendar.utoronto.ca/hbahbsc-requirements',
    categories: ['Creative and Cultural Representations', 'Thought, Belief, and Behaviour', 'Society and Its Institutions', 'Living Things and Their Environment', 'The Physical and Mathematical Universes'], breadthMin: 1,
    checks: [['total', 'Total credits', 20], ['upper2', '200+ level', 13], ['upper', '300/400 level', 6], ['home', 'Arts & Science credits', 10]] },
  utsc: { name: 'UTSC', suffix: '3', calendar: 'https://utsc.calendar.utoronto.ca', faculty: 'University of Toronto Scarborough',
    degreeSource: 'https://utsc.calendar.utoronto.ca/honours-bachelor-science-hbsc',
    categories: ['Arts, Literature & Language', 'History, Philosophy & Cultural Studies', 'Social & Behavioural Sciences', 'Natural Sciences', 'Quantitative Reasoning'], breadthMin: 0.5,
    checks: [['total', 'Total credits', 20], ['upper', 'C/D level', 6], ['fourth', 'D level', 1], ['home', 'UTSC credits', 10]] },
}

export const OTHER_FACULTIES = [
  ['Applied Science & Engineering', 'https://engineering.calendar.utoronto.ca/'],
  ['Daniels Architecture, Landscape & Design', 'https://daniels.calendar.utoronto.ca/'],
  ['Kinesiology & Physical Education', 'https://kpe.calendar.utoronto.ca/'],
  ['Music', 'https://music.utoronto.ca/student-resources/undergraduate/courses-registration'],
  ['Other professional / second-entry faculties', 'https://calendar.utoronto.ca/'],
]
export function degreeConfiguration(campus, programs = []) {
  const base = { ...CAMPUSES[campus], degreeLabel: 'HBA / HBSc', extraNotes: [] }
  if (campus === 'stg' && programs.some(p => /\(BCom\)/i.test(p.name || ''))) {
    return { ...base, degreeLabel: 'BCom (Rotman Commerce)',
      degreeSource: 'https://artsci.calendar.utoronto.ca/bcom-requirements',
      checks: [...base.checks, ['fourth', '400-level', 1], ['commerce', 'RSM / MGT credits', 8], ['other', 'Other Arts & Science credits', 8]],
      extraNotes: ['Complete a Rotman Accounting, Finance & Economics, or Management Specialist. CGPA ≥ 1.85 and program-specific requirements need verification.'] }
  }
  if (campus === 'utsc' && programs.some(p => /BACHELOR OF BUSINESS ADMINISTRATION|\bBBA\b/i.test(p.name || ''))) {
    return { ...base, degreeLabel: 'BBA', degreeSource: 'https://utsc.calendar.utoronto.ca/bachelor-business-administration-bba',
      extraNotes: ['Complete an eligible Management or Economics for Management Studies Specialist. At least 0.5 credit in designated work-integrated-learning courses and CGPA ≥ 2.0 require verification; WIL is not inferred from Co-op registration.'] }
  }
  return base
}
export const VALID_COURSE = /^(?:[A-Z]{2,4}\d{3}|[A-Z]{3}[A-D]\d{2})[HY][0135]$/
export function courseCampus(code) { return code?.endsWith('0') ? 'stg' : Object.keys(CAMPUSES).find(k => code?.endsWith(CAMPUSES[k].suffix)) || null }
export function courseUrl(code) { return `${CAMPUSES[courseCampus(code) || 'utm'].calendar}/course/${code.toLowerCase()}` }
export function programUrl(p, campus) { return p.source || `${CAMPUSES[campus].calendar}/program/${p.id}` }
export function levelOf(code) {
  const letter = /^[A-Z]{3}([A-D])\d{2}[HY]3$/.exec(code)
  return letter ? 'ABCD'.indexOf(letter[1]) + 1 : Number(/\d{3}/.exec(code)?.[0]?.[0]) || 0
}

// Exclusion fields may also contain timing rules, exceptions, and permission to
// receive credit for both courses. Only plain code lists justify this automated
// review prompt; other clauses remain visible as original calendar prose.
function plainExclusionList(course) {
  const text = course?.exclusionText || ''
  if (!text) return false
  const residue = text
    .replace(/(?:[A-Z]{2,4}\d{3}|[A-Z]{3}[A-D]\d{2})[HY][0135]/g, '')
    .replace(/\bor\b/gi, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
  return residue.length === 0
}

export function reciprocalExclusions(statuses, courses, included) {
  const active = Object.keys(statuses).filter(code => included.includes(statuses[code]) && courses?.[code]).sort()
  const activeSet = new Set(active)
  const pairs = []
  for (const code of active) {
    for (const other of new Set(courses[code].exclusions || [])) {
      if (other > code && activeSet.has(other) &&
          plainExclusionList(courses[code]) && plainExclusionList(courses[other]) &&
          (courses[other].exclusions || []).includes(code)) {
        pairs.push([code, other])
      }
    }
  }
  return pairs
}

export function progress(campus, statuses, courses, included = [1, 2, 3]) {
  const config = CAMPUSES[campus]
  const result = { total: 0, upper2: 0, upper: 0, fourth: 0, home: 0, commerce: 0, other: 0,
    cats: Object.fromEntries(config.categories.map(c => [c, 0])), pending: [], pendingBreadth: [], satisfied: false,
    exclusionReview: reciprocalExclusions(statuses, courses, included) }
  const subjects = {}
  for (const [code, status] of Object.entries(statuses)) {
    if (!included.includes(status)) continue
    const meta = courses?.[code]
    if (!VALID_COURSE.test(code) || courseCampus(code) !== campus || !meta || meta.timetableOnly || meta.creditReview || meta.campusReview || meta.currentCatalog === false || /not in the current Calendar/i.test(meta.name || '')) {
      result.pending.push(code)
      continue
    }
    const rawCredit = academicCredit(code, meta), level = levelOf(code)
    if (rawCredit === 0) continue
    const subject = code.slice(0, 3)
    const used = subjects[subject] || 0
    // UTM and Arts & Science cap same-designator degree credits at 15.
    const credit = campus === 'utsc' ? rawCredit : Math.max(0, Math.min(rawCredit, 15 - used))
    subjects[subject] = used + rawCredit
    if (!credit) continue
    result.total += credit
    result.home += credit
    if (/^(RSM|MGT)/.test(code)) result.commerce += credit
    else result.other += credit
    if (level >= 2) result.upper2 += credit
    if (level >= 3) result.upper += credit
    if (level === 4) result.fourth += credit
    const category = campus === 'utm' ? meta.distribution : meta.breadth
    const normalize = s => (s || '').replaceAll('&', 'and').toLowerCase().replace(/[^a-z]/g, '')
    const matches = config.categories.filter((c, i) => normalize(c) === normalize(category) ||
      (campus === 'stg' && (category || '').includes(`(${i + 1})`)))
    if (matches.length === 1) result.cats[matches[0]] += credit
    else if (campus === 'stg' && credit === 1 && matches.length === 2) {
      for (const c of matches) result.cats[c] += 0.5
    } else result.pendingBreadth.push(code)
  }
  const values = Object.values(result.cats)
  result.satisfied = campus === 'stg'
    ? values.filter(v => v >= 1).length >= 4 || (values.filter(v => v >= 1).length >= 3 && values.every(v => v >= 0.5))
    : values.every(v => v >= config.breadthMin)
  return result
}

export function combination(active, campus) {
  if (!active.length) return { messages: [], success: '' }
  active = active.filter(p => ['specialist', 'major', 'minor'].includes(p.type?.toLowerCase()))
  const count = t => active.filter(p => p.type?.toLowerCase() === t).length
  const [s, m, n] = ['specialist', 'major', 'minor'].map(count)
  const messages = []
  if (!(s >= 1 || m >= 2 || (m >= 1 && n >= 2))) messages.push('Select 1 specialist, 2 majors, or 1 major + 2 minors.')
  if (active.length > 3) messages.push('At most 3 programs may count toward this degree.')
  if (campus === 'utsc' && s > 1) messages.push('UTSC allows at most one Specialist, except approved double-degree combinations.')
  if (campus !== 'utsc' && s + m > 2) messages.push('At most 2 specialist/major programs.')
  const areas = active.map(p => /\d{4}/.exec(p.code || p.id)?.[0]).filter(Boolean)
  if (new Set(areas).size !== areas.length) messages.push('Programs in the same area need combination review; different types may not be combined.')
  return { messages, success: messages.length ? '' : 'Program type pattern met; completion, distinct credits and restrictions require review.' }
}
