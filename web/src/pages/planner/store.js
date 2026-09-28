import { CAMPUSES, VALID_COURSE, courseCampus, progress, combination, degreeConfiguration } from './lib/campuses.js'
import { reactive, computed, watch } from 'vue'
import { buildCourseList, computeSuggestions } from './lib/courses.js'
import {
  buildScopes, rankedSchedules,
  buildCourseAvailability, badgeTerms,
  campusOf,
} from './lib/scheduling.js'

const BASE = ''
const LS_STATUS = 'utm_course_status'
const LS_PROGRAMS = 'utm_selected_programs'
const LS_COMPLETED = 'utm_completed'
const LS_EXTRA = 'utm_extra_courses'
const LS_SCHEDULE = 'utm_schedule'
const profileKey = key => state.campus === 'utm' ? key : `${state.campus}_${key}`
const LS_TTB_WARNING = 'utm_ttb_warning_seen'
export const defaultConstraints = () => ({
  sections: {}, unavailable: [], earliest: '', latest: '', excludedInstructors: [],
  lunch: { enabled: false, start: '11:00', end: '14:00', minutes: 60 }, online: 'any',
})
const defaultPrefs = () => ({ density: 'any', time: 'any', freeDays: [], busyDays: [], zzOverlap: true, zzWithReg: false, commute: { enabled: true, hours: 1 }, constraints: defaultConstraints() })

function restoredPrefs(saved = {}) {
  const defaults = defaultPrefs()
  const old = saved && typeof saved === 'object' ? saved : {}
  const c = old.constraints && typeof old.constraints === 'object' ? old.constraints : {}
  return {
    ...defaults, ...old,
    commute: { ...defaults.commute, ...(old.commute || {}) },
    constraints: {
      ...defaults.constraints, ...c,
      sections: c.sections && typeof c.sections === 'object' && !Array.isArray(c.sections) ? c.sections : {},
      unavailable: Array.isArray(c.unavailable) ? c.unavailable : [],
      excludedInstructors: Array.isArray(c.excludedInstructors) ? c.excludedInstructors : [],
      lunch: { ...defaults.constraints.lunch, ...(c.lunch || {}) },
    },
  }
}

function saveSchedule() {
  try {
    localStorage.setItem(profileKey(LS_SCHEDULE), JSON.stringify({
      scopeId: state.scopeId, scheduled: state.scheduled, prefs: state.prefs,
    }))
  } catch { /* ignore quota errors */ }
}
function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(profileKey(LS_SCHEDULE)) || '{}') } catch { return {} }
}

function loadCourseStatus(campus = 'utm') {
  const obj = {}
  try {
    const raw = localStorage.getItem(campus === 'utm' ? LS_STATUS : `${campus}_${LS_STATUS}`)
    const m = JSON.parse(raw || '{}')
    for (const [k, v] of Object.entries(m)) if (VALID_COURSE.test(k) && [1, 2, 3].includes(+v)) obj[k] = +v
    for (const c of raw == null ? JSON.parse(localStorage.getItem(campus === 'utm' ? LS_COMPLETED : `${campus}_${LS_COMPLETED}`) || '[]') : []) {
      if (obj[c] === undefined) obj[c] = 3
    }
  } catch {
    /* ignore malformed storage */
  }
  return obj
}

export const state = reactive({
  campus: 'utm',
  loading: false,
  loadError: '',
  catalogs: {},
  programs: null,
  courses: null,
  sessions: [],
  timetable: null,
  timetableSession: null,

  activeTab: 'programs',         // 'programs' | 'courses' | 'schedule'
  viewMode: 'list',              // 'list' | 'requirements'

  sectionFilter: '',
  activeSectionSlug: null,
  popupOpen: false,
  popupTop: 0,

  selectedPrograms: [],          // [{id,name,type,courses,requirementGroups,intention}]
  extraCourses: [],              // course codes added outside any program (6.1)
  courseStatus: loadCourseStatus(),  // { code: 0|1|2|3 }

  // commute: cross-campus buffer between back-to-back classes on different
  // campuses (St. George/UTM/UTSC). enabled by default at 1 hour; hours ∈ {0,1,2}.
  prefs: defaultPrefs(),
  scopeId: '',                 // selected scheduling scope (see lib/scheduling buildScopes)
  timetables: {},              // sessionValue → timetable data (lazy cache)
  scheduled: {},               // code → [termValue,…] : which segment(s) to schedule per course
  board: [],                   // [{value,label,results,published}] — your schedule per term
  altIndex: {},                // termValue → which ranked alternative is shown
  // Group scheduling: each friend is just a list of courses; whichever ones you
  // also take become shared (same sections), the rest only constrain feasibility.
  friends: { enabled: false, list: [] },   // list: [{ id, name, courses: [] }]
  schedNotice: '',
  ttbWarningOpen: false,
})

// Schedule Builder's timetable data comes from ttb.utoronto.ca (the university's
// own public tool) rather than ACORN, for compliance reasons — but the two have
// been observed to disagree for reasons we haven't been able to pin down. Nag
// the user once, the first time they open the Schedule Builder tab.
export function maybeShowTtbWarning() {
  try {
    if (localStorage.getItem(LS_TTB_WARNING)) return
  } catch { /* ignore */ }
  state.ttbWarningOpen = true
}

export function dismissTtbWarning() {
  state.ttbWarningOpen = false
  try { localStorage.setItem(LS_TTB_WARNING, '1') } catch { /* ignore quota errors */ }
}

// ── Derived state (reactive) ──
export const courseList = computed(() => buildCourseList(state.selectedPrograms, [...new Set([...state.extraCourses, ...Object.keys(state.courseStatus).filter(c => state.courseStatus[c] >= 1)])]))
export const activePrograms = computed(() => state.selectedPrograms.filter(p => !p.intention))
export const legality = computed(() => combination(activePrograms.value, state.campus))

// Counts of active programs by type (Specialist / Major / Minor).
export const programCounts = computed(() => {
  const a = activePrograms.value
  const has = (p, t) => (p.type || '').toLowerCase().includes(t)
  return {
    specialist: a.filter(p => has(p, 'specialist')).length,
    major: a.filter(p => has(p, 'major')).length,
    minor: a.filter(p => has(p, 'minor')).length,
  }
})
export const suggestions = computed(() => computeSuggestions(state.selectedPrograms, state.programs))
export const filteredSections = computed(() => {
  if (!state.programs) return []
  const f = state.sectionFilter.toLowerCase()
  return state.programs.sections.filter(s =>
    !f || (s.name || '').toLowerCase().includes(f) || s.slug.toLowerCase().includes(f) || s.programs.some(p => `${p.name} ${p.code}`.toLowerCase().includes(f)),
  )
})
export const popupSection = computed(() =>
  state.programs?.sections.find(s => s.slug === state.activeSectionSlug) || null,
)
// Planned and currently taken courses can be scheduled.
export const pendingCourses = computed(() => courseList.value.filter(c => [1, 2].includes(getStatus(c.code))))

// Codes that belong to a selected program (used to tell apart "outside" courses).
export const programCourseCodes = computed(() => {
  const s = new Set()
  for (const p of state.selectedPrograms) for (const c of (p.courses || [])) s.add(c)
  return s
})

// Courses marked Plan/Taking/Done that aren't part of any selected program —
// always shown (locked) in the picker so the student doesn't lose track of them.
export const lockedExtraCourses = computed(() => {
  const inProg = programCourseCodes.value
  return Object.keys(state.courseStatus)
    .filter(c => state.courseStatus[c] >= 1 && !inProg.has(c))
    .sort()
})

export const campusConfig = computed(() => degreeConfiguration(state.campus, activePrograms.value))
export const degreeProgress = computed(() => progress(state.campus, state.courseStatus, state.courses))
export const degreeProgressActual = computed(() => progress(state.campus, state.courseStatus, state.courses, [2, 3]))
export const degreeBreakdown = computed(() => ({
  planned: progress(state.campus, state.courseStatus, state.courses, [1]),
  taking: progress(state.campus, state.courseStatus, state.courses, [2]),
  done: progress(state.campus, state.courseStatus, state.courses, [3]),
  all: degreeProgress.value,
}))

// ── Scheduling scopes / availability ──
export const scopes = computed(() => buildScopes(state.sessions))
export const currentScope = computed(() => scopes.value.find(s => s.id === state.scopeId) || null)
export const timetableSources = computed(() => {
  const scope = currentScope.value
  if (!scope) return []
  return [...scope.terms, ...(scope.full ? [scope.full] : [])].map(term => ({
    label: term.label,
    sources: state.timetables[term.value]?.sources || [],
    unavailable: state.timetables[term.value]?.unavailable || [],
  }))
})

// code → [term labels it is offered in] for the selected scope (after its
// timetables are loaded). Lets the picker show availability before scheduling.
export const availability = computed(() => {
  const scope = currentScope.value
  return scope ? buildCourseAvailability(badgeTerms(scope), state.timetables) : {}
})

// Per-course term offerings in the current scope → the pills shown in the picker.
//   { code: [{ value, label, tba }, …] }  tba = offered but no meeting times yet.
export const courseOfferings = computed(() => {
  const scope = currentScope.value
  if (!scope) return {}
  // 1) Every offered code → its own per-term availability.
  const raw = {}
  for (const term of badgeTerms(scope)) {
    const tt = state.timetables[term.value]
    if (!tt || !tt.courses) continue
    for (const c of tt.courses) {
      if (!raw[c.code]) raw[c.code] = []
      if (raw[c.code].some(t => t.value === term.value)) continue
      const timed = (c.sections || []).some(s => (s.times || []).some(t => t.day >= 1 && t.day <= 6 && t.endMs > t.startMs))
      raw[c.code].push({ value: term.value, label: term.label, tba: !timed })
    }
  }
  // Each course keeps its own identity. Similar course numbers are not equivalencies.
  const map = {}
  for (const [code, terms] of Object.entries(raw)) {
    map[code] = terms.map(p => ({ ...p, code, campus: campusOf(code) }))
  }
  return map
})

// Codes scheduled in at least one segment.
export const scheduledCodes = computed(() =>
  Object.keys(state.scheduled).filter(c => (state.scheduled[c] || []).length),
)

// Whether any timetable in the current scope is published yet — lets the picker
// distinguish "not offered in this range" from "timetable not published yet".
export const scopePublished = computed(() => {
  const scope = currentScope.value
  if (!scope) return false
  return badgeTerms(scope).some(t => (state.timetables[t.value]?.courseCount || 0) > 0)
})

export const scheduleSelection = computed(() => ({
  scheduled: JSON.parse(JSON.stringify(state.scheduled)),
  friendsEnabled: state.friends.enabled,
  friends: state.friends.list.map(f => ({ name: f.name, courses: [...f.courses] })),
  scopeId: state.scopeId,
  prefs: prefsObj(),
}))

// Warnings about the ACTUAL scheduled board only — never about courses you
// haven't scheduled. { type: 'conflict'|'missing'|'tba', code, term? }
export const scheduleWarnings = computed(() => {
  const out = []
  const seen = { conflict: new Set(), missing: new Set(), tba: new Set(), friend: new Set() }
  const add = (type, code, term, reason) => {
    if (seen[type].has(code)) return
    seen[type].add(code)
    out.push({ type, code, term, reason })
  }
  for (const term of state.board) {
    for (const r of term.results) {
      if (r.missing) add('missing', r.code, term.label, r.reason)
      else if (r.conflict) add('conflict', r.code)
    }
    for (const code of (term.tba || [])) add('tba', code, term.label)
    for (const name of (term.infeasibleFriends || [])) add('friend', name, term.label)
  }
  return out
})
export const courseAvailability = availability

// ── Status helpers ──
export function getStatus(code) { return state.courseStatus[code] || 0 }
export function isDone(code) { return getStatus(code) === 3 }
export function isSatisfied(code) { return getStatus(code) === 3 && courseCampus(code) === state.campus && !!state.courses?.[code] && !state.courses[code].timetableOnly }

export function setCourseStatus(code, status) {
  if (status === 0) delete state.courseStatus[code]
  else state.courseStatus[code] = status
  savePlannerState()
}

// ── Persistence ──
export function savePlannerState() {
  localStorage.setItem(profileKey(LS_STATUS), JSON.stringify({ ...state.courseStatus }))
  localStorage.setItem(profileKey(LS_PROGRAMS), JSON.stringify(
    state.selectedPrograms.map(p => ({ id: p.id, intention: !!p.intention })),
  ))
  localStorage.setItem(profileKey(LS_EXTRA), JSON.stringify(state.extraCourses))
}

export function loadSavedPlanner() {
  let saved = []
  try { saved = JSON.parse(localStorage.getItem(profileKey(LS_PROGRAMS)) || '[]') } catch { /* corrupted storage */ }
  if (!Array.isArray(saved)) saved = []
  state.selectedPrograms = []
  for (const s of saved) {
    const p = findProgramById(s.id)
    if (p) state.selectedPrograms.push({ ...p, intention: !!s.intention })
  }
  try {
    const extra = JSON.parse(localStorage.getItem(profileKey(LS_EXTRA)) || '[]')
    state.extraCourses = Array.isArray(extra) ? extra.filter(isValidCourseCode) : []
  } catch { state.extraCourses = [] }
}

const COURSE_CODE_RE = VALID_COURSE

export function isValidCourseCode(code) {
  return COURSE_CODE_RE.test((code || '').toUpperCase().replace(/\s+/g, ''))
}

export function addExtraCourse(code) {
  const c = (code || '').toUpperCase().replace(/\s+/g, '')
  if (!isValidCourseCode(c)) return false
  if (!state.extraCourses.includes(c)) { state.extraCourses.push(c); savePlannerState() }
  return true
}

export function removeExtraCourse(code) {
  state.extraCourses = state.extraCourses.filter(x => x !== code)
  savePlannerState()
}

// ── Program selection ──
export function findProgramById(id) {
  for (const sec of state.programs?.sections || []) {
    const p = sec.programs.find(p => p.id === id)
    if (p) return p
  }
  return null
}

export function toggleProgram(id) {
  const idx = state.selectedPrograms.findIndex(p => p.id === id)
  if (idx >= 0) {
    state.selectedPrograms.splice(idx, 1)
  } else {
    const prog = findProgramById(id)
    if (prog) state.selectedPrograms.push({ ...prog, intention: false })
  }
  savePlannerState()
}

export function toggleIntention(id) {
  const p = state.selectedPrograms.find(p => p.id === id)
  if (p) { p.intention = !p.intention; savePlannerState() }
}

export function addSuggested(id) {
  const prog = findProgramById(id)
  if (prog && !state.selectedPrograms.find(p => p.id === id)) {
    state.selectedPrograms.push({ ...prog, intention: false })
    savePlannerState()
  }
}

export function selectSection(slug, top) {
  state.activeSectionSlug = slug
  if (top != null) state.popupTop = top
  state.popupOpen = true
}

export function closePopup() { state.popupOpen = false }

// ── Import ──
export function applyImported(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid planner file')
  const campus = data.campus || 'utm'
  if (campus !== state.campus) throw new Error(`Switch to ${CAMPUSES[campus]?.name || campus} before importing this plan. Legacy files belong to UTM.`)
  if (data.selectedPrograms && (!Array.isArray(data.selectedPrograms) || !data.selectedPrograms.every(p => p && typeof p.id === 'string'))) throw new Error('Invalid programs')
  if (data.extraCourses && (!Array.isArray(data.extraCourses) || !data.extraCourses.every(isValidCourseCode))) throw new Error('Invalid extra courses')
  if (data.courseStatus) {
    const obj = {}
    for (const [k, v] of Object.entries(data.courseStatus)) {
      if (!isValidCourseCode(k) || ![0, 1, 2, 3].includes(v)) throw new Error('Invalid course status')
      obj[k] = v
    }
    state.courseStatus = obj
    localStorage.setItem(profileKey(LS_STATUS), JSON.stringify(data.courseStatus))
  }
  if (data.selectedPrograms && state.programs) {
    state.selectedPrograms = []
    for (const s of data.selectedPrograms) {
      const p = findProgramById(s.id)
      if (p) state.selectedPrograms.push({ ...p, intention: !!s.intention })
    }
  }
  if (data.extraCourses) state.extraCourses = [...data.extraCourses]
  savePlannerState()
}

// ── Schedule ──
export function isScheduledIn(code, termValue) {
  return (state.scheduled[code] || []).includes(termValue)
}

// Toggle scheduling a course in one term segment (a pill in the picker).
export function toggleScheduledTerm(code, termValue) {
  const cur = state.scheduled[code] || []
  if (cur.includes(termValue)) {
    const next = cur.filter(v => v !== termValue)
    if (next.length) state.scheduled[code] = next
    else delete state.scheduled[code]
  } else {
    state.scheduled[code] = [...cur, termValue]
  }
  queueScheduleRefresh()
}

// Prune deselected/completed courses; called when entering the schedule tab.
// Term-segment choices are kept (a course may be scheduled under another scope).
export function syncScheduledCourses() {
  const pending = new Set(pendingCourses.value.map(p => p.code))
  for (const code of Object.keys(state.scheduled)) {
    if (!pending.has(code)) delete state.scheduled[code]
  }
  queueScheduleRefresh()
}

async function ensureTimetable(value) {
  if (state.timetables[value]) return state.timetables[value]
  const fetchJson = (file) => fetch(BASE + `/planner/data/${file}`).then(r => r.ok ? r.json() : null).catch(() => null)
  const results = await Promise.all(['utm', 'stg', 'utsc'].map(c => fetchJson(`${c}-timetable-${value}.json`)))
  const courses = results.flatMap(d => d?.courses || [])
  const data = { courses, courseCount: courses.length, sources: results.filter(Boolean),
    unavailable: ['utm', 'stg', 'utsc'].filter((c, i) => !results[i]) }
  // Offer timetable titles in the picker without treating them as verified calendar metadata.
  for (const c of courses) {
    if (!state.courses?.[c.code]) (state.courses ||= {})[c.code] = { code: c.code, name: c.name, timetableOnly: true }
  }
  state.timetables[value] = data
  queueScheduleRefresh()
  return data
}

async function ensureScopeTimetables() {
  const scope = currentScope.value
  if (!scope) return
  const values = scope.terms.map(t => t.value)
  if (scope.full) values.push(scope.full.value)
  await Promise.all(values.map(ensureTimetable))
}

// A column's effective timetable = its own courses plus the full-session (Y)
// courses, which are shown in BOTH columns rather than a standalone table.
function mergedColumnTimetable(scope, term) {
  const tt = state.timetables[term.value] || { courses: [], courseCount: 0 }
  const fullTT = scope.full ? (state.timetables[scope.full.value] || { courses: [], courseCount: 0 }) : null
  if (!fullTT) return tt
  return {
    courses: [...(tt.courses || []), ...(fullTT.courses || [])],
    courseCount: (tt.courseCount || 0) + (fullTT.courseCount || 0),
  }
}

export async function onScopeChange() {
  state.scheduled = {}   // switching range clears all segment selections
  state.altIndex = {}
  state.board = []
  state.schedNotice = 'Loading timetable…'
  await ensureScopeTimetables()
  queueScheduleRefresh()
}

function prefsObj() {
  return {
    density: state.prefs.density,
    time: state.prefs.time,
    freeDays: state.prefs.freeDays.map(Number),
    busyDays: state.prefs.busyDays.map(Number),
    zzOverlap: state.prefs.zzOverlap,
    zzWithReg: state.prefs.zzWithReg,
    commute: { enabled: state.prefs.commute?.enabled !== false, hours: Number(state.prefs.commute?.hours) || 0 },
    constraints: JSON.parse(JSON.stringify(state.prefs.constraints || defaultConstraints())),
  }
}

// Day preference per weekday (Mon–Fri), cycling neutral → free → busy → neutral.
export function dayPref(d) {
  if (state.prefs.freeDays.includes(d)) return 'free'
  if (state.prefs.busyDays.includes(d)) return 'busy'
  return 'neutral'
}
export function cycleDayPref(d) {
  const cur = dayPref(d)
  state.prefs.freeDays = state.prefs.freeDays.filter(x => x !== d)
  state.prefs.busyDays = state.prefs.busyDays.filter(x => x !== d)
  if (cur === 'neutral') state.prefs.freeDays = [...state.prefs.freeDays, d]
  else if (cur === 'free') state.prefs.busyDays = [...state.prefs.busyDays, d]
  queueScheduleRefresh()
}

// Build the per-term schedule from the per-segment selection (state.scheduled).
// Cached ranked alternatives per column (recomputed only on selection/pref change).
let optionsCache = {}

function columnCodes(scope, term, fullCodes, fullVal) {
  return Object.keys(state.scheduled).filter(code => {
    const sel = state.scheduled[code] || []
    return sel.includes(term.value) || (fullVal && sel.includes(fullVal))
  })
}

// Enumerate + rank every column's possible schedules; reset which alternative is shown.
function computeOptions(scope) {
  const fullCodes = new Set((scope.full ? (state.timetables[scope.full.value]?.courses || []) : []).map(c => c.code))
  const fullVal = scope.full?.value
  const friends = state.friends.enabled
    ? state.friends.list.filter(f => f.courses.length).map(f => ({ name: f.name, courses: [...f.courses] }))
    : []
  optionsCache = {}
  state.altIndex = {}
  for (const term of scope.terms) {
    const tt = mergedColumnTimetable(scope, term)
    const inTerm = columnCodes(scope, term, fullCodes, fullVal)
    optionsCache[term.value] = inTerm.length
      ? rankedSchedules(tt, inTerm, prefsObj(), friends, term.value)
      : [{ results: [], conflicts: 0, score: 0, infeasibleFriends: [] }]
  }
}

// Render the board from the cached options at the currently-selected alternative.
function renderSoloBoard(scope) {
  const fullCodes = new Set((scope.full ? (state.timetables[scope.full.value]?.courses || []) : []).map(c => c.code))
  state.board = scope.terms.map(term => {
    const tt = mergedColumnTimetable(scope, term)
    const options = optionsCache[term.value] || [{ results: [], conflicts: 0 }]
    const i = Math.min(Math.max(state.altIndex[term.value] || 0, 0), options.length - 1)
    const chosen = options[i] || options[0] || { results: [], conflicts: 0 }
    chosen.results.forEach(r => { if (fullCodes.has(r.code)) r.full = true })
    const tba = chosen.results.filter(r => !r.missing && !hasRenderableTimes(r)).map(r => r.code)
    return {
      value: term.value, label: term.label, results: chosen.results,
      published: (tt.courseCount || 0) > 0, tba,
      optionIndex: i, optionCount: options.length, conflicts: chosen.conflicts || 0,
      infeasibleFriends: chosen.infeasibleFriends || [],
      constraintFailure: !!chosen.constraintFailure, constraintReason: chosen.reason || '',
    }
  })
}

// Step through the ranked alternatives for one column (no recompute).
export function setAlt(termValue, i) {
  const opts = optionsCache[termValue]
  if (!opts) return
  state.altIndex[termValue] = Math.min(Math.max(i, 0), opts.length - 1)
  const scope = currentScope.value
  if (scope) renderSoloBoard(scope)
}

// A scheduled result is renderable only if some section has a weekday meeting time.
function hasRenderableTimes(r) {
  return (r.sections || []).some(s => (s.times || []).some(t => t.day >= 1 && t.day <= 6 && t.endMs > t.startMs))
}

let refreshTimer = null
let refreshRun = 0

export function queueScheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { refreshSchedule() }, 100)
}

export async function refreshSchedule() {
  const run = ++refreshRun
  const scope = currentScope.value
  if (!scope) { state.schedNotice = 'Please select a scheduling range.'; return }
  if (!scheduledCodes.value.length) {
    state.board = []
    state.schedNotice = 'Pick a term segment for a course to preview a schedule.'
    return
  }

  state.schedNotice = 'Loading timetable…'
  await ensureScopeTimetables()
  if (run !== refreshRun) return

  computeOptions(scope)
  renderSoloBoard(scope)

  const unpublished = state.board.some(t => !t.published)
  const infeasible = state.board.find(t => t.constraintFailure)
  state.schedNotice = infeasible
    ? `${infeasible.label}: ${infeasible.constraintReason || 'No schedule satisfies hard constraints'}. Adjust the hard constraints to see options.`
    : unpublished ? 'One or more terms have no published timetable yet.' : ''
}

export const generateSchedule = refreshSchedule

// ── Friend group scheduling ──
let friendSeq = 0

export function toggleFriends(on) {
  state.friends.enabled = on
  if (on && !state.friends.list.length) addFriend()
  queueScheduleRefresh()
}

export function addFriend() {
  const id = ++friendSeq
  state.friends.list.push({ id, name: `Friend ${state.friends.list.length + 1}`, courses: [] })
  return id
}

export function removeFriend(id) {
  state.friends.list = state.friends.list.filter(f => f.id !== id)
  queueScheduleRefresh()
}

export function renameFriend(id, name) {
  const f = state.friends.list.find(f => f.id === id)
  if (f && (name || '').trim()) f.name = name.trim()
}

export function addFriendCourse(id, code) {
  const f = state.friends.list.find(f => f.id === id)
  if (!f) return false
  const c = (code || '').toUpperCase().replace(/\s+/g, '')
  if (!isValidCourseCode(c)) return false
  if (!f.courses.includes(c)) f.courses.push(c)
  queueScheduleRefresh()
  return true
}

export function removeFriendCourse(id, code) {
  const f = state.friends.list.find(f => f.id === id)
  if (!f) return
  f.courses = f.courses.filter(x => x !== code)
  queueScheduleRefresh()
}

watch(scheduleSelection, () => {
  if (state.loading) return
  saveSchedule()
  queueScheduleRefresh()
}, { deep: true })

// ── Init ──
let campusLoadRun = 0
export async function switchCampus(campus) {
  if (!CAMPUSES[campus]) throw new Error('Unsupported campus')
  const run = ++campusLoadRun
  savePlannerState()
  saveSchedule()
  state.loading = true
  state.loadError = ''
  try {
    const programs = state.catalogs[campus] || await fetch(BASE + `/planner/data/${campus}-programs.json`).then(r => {
      if (!r.ok) throw new Error('Catalog unavailable')
      return r.json()
    })
    if (!Array.isArray(programs.sections)) throw new Error('Invalid catalog')
    if (run !== campusLoadRun) return
    state.catalogs[campus] = programs
    state.campus = campus
    localStorage.setItem('uoft_home_campus', campus)
    state.programs = programs
    state.courseStatus = loadCourseStatus(campus)
    state.sectionFilter = ''
    state.activeSectionSlug = null
    state.popupOpen = false
    loadSavedPlanner()
    const saved = loadSchedule()
    const sc = buildScopes(state.sessions)
    state.scopeId = sc.some(s => s.id === saved.scopeId) ? saved.scopeId : sc[0]?.id || ''
    state.scheduled = saved.scheduled || {}
    state.prefs = restoredPrefs(saved.prefs)
    state.board = []
    await ensureScopeTimetables()
    queueScheduleRefresh()
  } catch (error) {
    if (run === campusLoadRun) state.loadError = `Could not load ${CAMPUSES[campus].name}: ${error.message}. Your current plan is retained.`
  } finally {
    if (run === campusLoadRun) state.loading = false
  }
}

export async function init() {
  state.loading = true
  try {
    const response = await fetch(BASE + '/planner/data/utm-sessions.json')
    if (!response.ok) throw new Error('Session index unavailable')
    state.sessions = await response.json()
    const catalogs = await Promise.all(['utm', 'stg', 'utsc'].map(async campus => {
      const r = await fetch(BASE + `/planner/data/${campus}-courses.json`)
      return r.ok ? r.json() : {}
    }))
    state.courses = Object.assign({}, ...catalogs)
    const campus = localStorage.getItem('uoft_home_campus') || 'utm'
    // Do not overwrite saved UTM state during initial loading.
    state.campus = CAMPUSES[campus] ? campus : 'utm'
    state.courseStatus = loadCourseStatus(state.campus)
    const r = await fetch(BASE + `/planner/data/${state.campus}-programs.json`)
    if (!r.ok) throw new Error('Program catalog unavailable')
    state.programs = await r.json()
    state.catalogs[state.campus] = state.programs
    loadSavedPlanner()
    const saved = loadSchedule()
    const sc = buildScopes(state.sessions)
    state.scopeId = sc.some(s => s.id === saved.scopeId) ? saved.scopeId : sc[0]?.id || ''
    state.scheduled = saved.scheduled || {}
    state.prefs = restoredPrefs(saved.prefs)
    await ensureScopeTimetables()
    queueScheduleRefresh()
  } catch (error) { state.loadError = `Planner data could not be loaded: ${error.message}` }
  finally { state.loading = false }
}
