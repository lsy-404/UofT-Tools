// Pure schedule-generation + grid-layout logic — no DOM, no Vue. Unit-testable.
import { allowedSections, constraintError, lunchFits, sectionRules } from './constraints.js'

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#b45309', '#be123c', '#0369a1']

// Campus is encoded in the last digit of a course code (CSC108H[5]):
// 1 = St. George (downtown), 3 = UTSC (Scarborough), 5 = UTM (Mississauga).
// Two classes on DIFFERENT campuses need commute time between them; same-campus
// classes do not. Returns '' when the code has no recognizable campus digit.
const CAMPUS_NAMES = { 0: 'Off campus', 1: 'St. George', 3: 'UTSC', 5: 'UTM' }
export function campusOf(code) {
  const m = /[HY](\d)$/.exec(code || '')
  return m && CAMPUS_NAMES[m[1]] ? m[1] : ''
}
export function campusName(code) { return CAMPUS_NAMES[campusOf(code)] || '' }
export function sectionCampus(code, sec) {
  const modes = sec.deliveryModes || []
  return modes.length && modes.every(mode => mode === 'SYNC' || mode === 'ASYNC') ? '' : campusOf(code)
}

export function sectionsCompatible(sections, activeSections = sections) {
  return sections.every(sec => {
    const groups = new Map()
    for (const ref of sec.linkedMeetingSections || []) {
      if (!groups.has(ref.teachMethod)) groups.set(ref.teachMethod, [])
      groups.get(ref.teachMethod).push(ref.sectionNumber)
    }
    return [...groups].every(([type, allowed]) => {
      if (sections.some(other => other.type === type && allowed.includes(other.sectionNumber))) return true
      // The Timetable Builder can retain links to sections that are now
      // cancelled. Accept a remaining reciprocal link only when every listed
      // target of this type is inactive (BIO203H5 is a live example).
      const hasActiveTarget = activeSections.some(other => other.type === type && allowed.includes(other.sectionNumber))
      return !hasActiveTarget && sections.some(other => other.type === type &&
        (other.linkedMeetingSections || []).some(ref => ref.teachMethod === sec.type && ref.sectionNumber === sec.sectionNumber))
    })
  })
}

function sectionsLinked(a, b) {
  const linksTo = (from, to) => (from.linkedMeetingSections || []).some(ref =>
    ref.teachMethod === to.type && ref.sectionNumber === to.sectionNumber)
  return linksTo(a, b) || linksTo(b, a)
}

// The commute buffer (ms) from a prefs.commute = { enabled, hours } setting.
// Disabled or 0h → no buffer. Default is 1h enabled (set in the store).
export function commuteBufferMs(prefs = {}) {
  const c = prefs.commute
  if (!c || c.enabled === false) return 0
  return Math.max(0, Number(c.hours) || 0) * 3600000
}

// Do two meeting blocks clash? Same campus → a plain time overlap. Different
// campus → also clash when the gap between them is below the commute buffer
// (the student can't physically travel between campuses in time).
function blocksClash(a, b, buffer) {
  const cross = buffer > 0 && a.campus && b.campus && a.campus !== b.campus
  const pad = cross ? buffer : 0
  return a.startMs < b.endMs + pad && b.startMs < a.endMs + pad
}

// Short, grid-friendly term label from a full session label.
export function shortTerm(label = '') {
  if (/summer/i.test(label) && /full/i.test(label)) return 'Summer Full'
  if (/fall-winter|full year/i.test(label)) return 'Full Year'
  if (/fall/i.test(label)) return 'Fall'
  if (/winter/i.test(label)) return 'Winter'
  if (/summer/i.test(label) && /first/i.test(label)) return 'Summer F'
  if (/summer/i.test(label) && /second/i.test(label)) return 'Summer S'
  if (/summer/i.test(label)) return 'Summer'
  return label
}

function scopeLabel(session) {
  if (/summer/i.test(session.label || '') && /full/i.test(session.label || '')) {
    return (session.label || '').replace(/\s*Full Session\s*/i, ' ').replace(/\s*\(Y\)\s*$/, '').trim()
  }
  return session.label
}

// Group the flat session list into scheduling "scopes". Only the two combined
// ranges are exposed (Summer, Fall-Winter) — no duplicate single-session entries.
// Each scope shows TWO term columns; the full-session (Y) timetable is merged
// into both columns rather than rendered as a standalone third table.
//   [{ id, label, terms: [{value,label}, {value,label}], full: {value,label}|null }]
export function buildScopes(sessions) {
  const byValue = Object.fromEntries(sessions.map(s => [s.value, s]))
  const term = (v) => ({ value: v, label: shortTerm(byValue[v]?.label || v) })
  const scopes = []
  for (const s of sessions) {
    const v = s.value
    if (v.includes('-')) {
      const [a, b] = v.split('-')
      if (byValue[a] && byValue[b]) scopes.push({ id: v, label: s.label, terms: [term(a), term(b)], full: term(v) })
    } else if (!/[FS]$/.test(v) && byValue[v + 'F'] && byValue[v + 'S']) {
      scopes.push({ id: v, label: scopeLabel(s), terms: [term(v + 'F'), term(v + 'S')], full: term(v) })
    }
  }
  return scopes
}

// The badge-term list for availability: the two columns plus the full-session
// term (kept as its own "Summer Full"/"Full Year" label so the Y semantics show).
export function badgeTerms(scope) {
  if (!scope) return []
  return scope.full ? [...scope.terms, scope.full] : [...scope.terms]
}

// Sections whose meeting times are identical are interchangeable for
// scheduling: collapse each time-signature group to one representative carrying
// the other section names in `equivalents`. ZZ (exam-block) rooms change
// conflict semantics, so they are part of the signature.
export function dedupeSections(pool, preserveNumbers = false) {
  const groups = new Map()
  for (const sec of pool) {
    const sig = (sec.times || [])
      .filter(t => t.day)
      .map(t => `${t.day}|${t.startMs}|${t.endMs}|${t.sessionCode || ''}|${t.repetition || ''}|${t.repetitionTime || ''}|${t.room || ''}`)
      .sort()
      .join(',') + '|' + JSON.stringify(sec.linkedMeetingSections || []) + '|' + JSON.stringify(sec.deliveryModes || []) +
      '|' + JSON.stringify(sec.instructors || []) + '|' + JSON.stringify(sec.notes || []) +
      (preserveNumbers ? `|${sec.sectionNumber || sec.name}` : '')
    if (!groups.has(sig)) groups.set(sig, [])
    groups.get(sig).push(sec)
  }
  const out = []
  for (const group of groups.values()) {
    const [rep, ...rest] = group
    out.push(rest.length ? { ...rep, equivalents: rest.map(s => s.name) } : rep)
  }
  return out
}

// Day/time/density are soft preferences, but avoiding a time conflict is ALWAYS
// the first priority: a conflicting section gets a dominating penalty that no
// combination of preferences can overcome, so the scheduler only ever places a
// course on a conflicting slot when every one of its sections conflicts.
export const CONFLICT_PENALTY = 10000

export function scoreSec(sec, freeDays, busyDays, density, timePref, placed, buffer = 0, campus = '') {
  let score = 50
  for (const t0 of sec.times) {
    if (!t0.day) continue
    const t = { ...t0, campus }
    if (freeDays.includes(t.day)) score -= 25   // prefer to keep this day free
    if (busyDays.includes(t.day)) score += 20   // prefer classes on this day
    const hr = t.startMs / 3600000
    if (timePref === 'morning' && hr >= 12) score -= 15
    if (timePref === 'afternoon' && hr < 12) score -= 15
    const sameDayPlaced = placed.filter(p => p.day === t.day).length
    if (density === 'compact') score += sameDayPlaced * 5      // cluster onto fewer days
    else if (density === 'spread') score -= sameDayPlaced * 5  // spread across more days
    for (const p of placed) {
      if (p.day === t.day && blocksClash(t, p, buffer)) score -= CONFLICT_PENALTY
    }
  }
  return score
}

// "ZZ" is the room code for exam/test-reserved blocks. These may be allowed to
// overlap: opts.zzOverlap (ZZ↔ZZ, default allowed) and opts.zzWithReg
// (ZZ↔regular class, default NOT allowed → still a conflict).
// Key identifying one meeting block of a course (for per-block conflict marking).
export function timeKey(code, t) { return `${code}|${t.day}|${t.startMs}|${t.endMs}|${t.repetitionTime || ''}` }

export function markConflicts(results, opts = {}) {
  const zzOverlap = opts.zzOverlap !== false
  const zzWithReg = opts.zzWithReg === true
  const buffer = commuteBufferMs(opts)
  const conflictTimes = new Set()
  const allTimes = []
  for (const r of results) {
    for (const sec of (r.sections || [])) {
      const campus = sectionCampus(r.code, sec)
      for (const t of sec.times) {
        if (!t.day) continue
        allTimes.push({ result: r, sec, day: t.day, startMs: t.startMs, endMs: t.endMs, repetition: t.repetition, repetitionTime: t.repetitionTime, zz: t.room === 'ZZ', campus, key: timeKey(r.code, t) })
      }
    }
  }
  for (let i = 0; i < allTimes.length; i++) {
    for (let j = i + 1; j < allTimes.length; j++) {
      const a = allTimes[i], b = allTimes[j]
      // Same course: only an overlap between two DIFFERENT sections (e.g. its
      // own LEC vs TUT) is a conflict; a section never conflicts with itself.
      if (a.result === b.result && a.sec === b.sec) continue
      if (a.result === b.result && sectionsLinked(a.sec, b.sec)) continue
      if (a.day !== b.day) continue
      const cross = buffer > 0 && a.campus && b.campus && a.campus !== b.campus
      const overlap = a.startMs < b.endMs && a.endMs > b.startMs
      // Cross-campus pairs clash when their gap is below the commute buffer,
      // even without a true overlap; same-campus pairs need an actual overlap.
      if (!(cross ? blocksClash(a, b, buffer) : overlap)) continue
      // ZZ (exam-block) overlap allowances only apply to genuine overlaps on the
      // same campus — a cross-campus commute clash is always a real conflict.
      if (!cross) {
        if (a.zz && b.zz) { if (zzOverlap) continue }
        else if (a.zz || b.zz) { if (zzWithReg) continue }
      }
      a.result.conflict = true
      b.result.conflict = true
      conflictTimes.add(a.key)   // only the overlapping blocks turn red, not the
      conflictTimes.add(b.key)   // course's other meetings
    }
  }
  for (const r of results) r.conflictTimes = conflictTimes
}

// Greedily pick best LEC + TUT/PRA per course given preferences.
// prefs: { density, time, freeDays:number[], busyDays:number[] }
export function buildSchedule(timetable, scheduledCourses, prefs) {
  return rankedSchedules(timetable, scheduledCourses, prefs)[0]?.results || []
}

// Preference-only score for a whole arrangement (conflicts are ranked separately).
function scheduleScore(results, { freeDays, busyDays, time, density }) {
  let score = 0
  const days = new Set()
  for (const r of results) {
    let hasTime = false
    for (const sec of (r.sections || [])) {
      for (const t of sec.times) {
        if (!t.day) continue
        hasTime = true
        days.add(t.day)
        if (freeDays.includes(t.day)) score -= 25
        if (busyDays.includes(t.day)) score += 20
        const hr = t.startMs / 3600000
        if (time === 'morning' && hr >= 12) score -= 15
        if (time === 'afternoon' && hr < 12) score -= 15
      }
    }
    // Strongly prefer a section with actual meeting times over a no-time
    // placeholder (which would otherwise be picked just for avoiding conflicts).
    if ((r.sections || []).length && !hasTime) score -= 1000
  }
  if (density === 'compact') score += (5 - days.size) * 10   // fewer distinct days
  else if (density === 'spread') score += days.size * 10      // more distinct days
  return score
}

// Find conflict-free schedules by backtracking, then rank them by preference.
// Crucially, feasibility (avoiding conflicts) is decided WITHOUT regard to
// preferences — preferences only order/rank the conflict-free results — so no
// preference can ever cause a conflict. Only when NO conflict-free arrangement
// exists do we fall back to a single best-effort (minimum-conflict) option.
// The search is branch-and-bound over the deduped option space, keeping the
// TOP_K best arrangements by preference score. A branch is pruned only when
// its score UPPER BOUND cannot beat the current K-th best — so the returned
// set is guaranteed to be the global top K; nothing better is ever missed,
// while memory stays bounded (a naive exhaustive collect OOMs on first-year
// course combinations with millions of conflict-free arrangements).
//
// `friends` ([{name, courses}]) adds group constraints: a friend's course that
// you also take is SHARED (same sections as you, marked sharedWith); a friend's
// other courses never appear on your board but must remain placeable around the
// shared sections — arrangements where some friend can't fit are ranked last
// and carry their names in `infeasibleFriends`.
export function rankedSchedules(timetable, codes, prefs, friends = [], termCode = '') {
  const constraints = prefs.constraints || {}
  const failure = (reason = 'No schedule satisfies hard constraints', truncated = false) => [{
    results: codes.map(code => ({ code, sections: [], missing: true, reason })),
    conflicts: 0, score: 0, infeasibleFriends: [], constraintFailure: true, reason, truncated,
  }]
  const invalid = constraintError(constraints)
  if (invalid) return failure(invalid)
  const zzOverlap = prefs.zzOverlap !== false
  const zzWithReg = prefs.zzWithReg === true
  const buffer = commuteBufferMs(prefs)
  const lookup = new Map()
  for (const c of timetable.courses) if (!lookup.has(c.code)) lookup.set(c.code, c)
  const colorMap = {}
  let ci = 0
  for (const code of codes) if (!colorMap[code]) colorMap[code] = COLORS[ci++ % COLORS.length]

  const overlaps = (a, b) => a.day === b.day && a.startMs < b.endMs && a.endMs > b.startMs
  const pairConflict = (a, b) => {
    if (a.code && a.code === b.code && a.sec && b.sec && a.sec !== b.sec && sectionsLinked(a.sec, b.sec)) return false
    if (a.day !== b.day) return false
    // Cross-campus pairs clash within the commute buffer (overlap included) and
    // are never exempted by ZZ overlap allowances — you still have to travel.
    if (buffer > 0 && a.campus && b.campus && a.campus !== b.campus) return blocksClash(a, b, buffer)
    if (!overlaps(a, b)) return false
    if (a.zz && b.zz) return !zzOverlap
    if (a.zz || b.zz) return !zzWithReg
    return true
  }
  const hits = (times, placed) => {
    for (const t of times) for (const p of placed) if (pairConflict(t, p)) return true
    return false
  }
  // A course's own LEC and TUT must not overlap each other either.
  const selfConflict = (times) => {
    for (let i = 0; i < times.length; i++)
      for (let j = i + 1; j < times.length; j++)
        if (pairConflict(times[i], times[j])) return true
    return false
  }

  const optionTimes = (sections, code) => {
    const out = []
    for (const sec of sections) for (const t of sec.times) if (t.day && (!termCode || !t.sessionCode || t.sessionCode === termCode))
      out.push({ day: t.day, startMs: t.startMs, endMs: t.endMs, repetition: t.repetition, repetitionTime: t.repetitionTime, zz: t.room === 'ZZ', campus: sectionCampus(code, sec), code, sec })
    return out
  }
  // LEC × TUT options for one course. Self-conflicting combos are dropped —
  // unless ALL combos self-conflict, in which case they are kept so the course
  // still shows (marked red).
  const buildOpts = (entry, personal = true) => {
    if (entry.cancelled) return []
    const activeSections = entry.sections.filter(s => !s.cancelled)
    const preserveNumbers = entry.sections.some(s => s.linkedMeetingSections?.length)
    const types = ['LEC', 'TUT', 'PRA']
    if (personal && sectionRules(constraints, entry.code, termCode).some(r =>
      Object.entries(r.locked || {}).some(([type, name]) => name && !activeSections.some(s => s.type === type && s.name === name)))) return []
    const pools = types.map(type => {
      const offered = entry.sections.filter(s => s.type === type)
      const active = activeSections.filter(s => s.type === type)
      return offered.length ? dedupeSections(personal ? allowedSections(active, entry.code, termCode, constraints) : active, preserveNumbers) : null
    }).filter(Boolean)
    if (pools.some(pool => !pool.length)) return []
    const opts = []
    const combinations = pools.reduce((groups, pool) => groups.flatMap(group => pool.map(sec => [...group, sec])), [[]])
    for (const sections of combinations) {
      if (!sectionsCompatible(sections, activeSections)) continue
      if (personal && !lunchFits(optionTimes(sections, entry.code), constraints)) continue
      // sScore mirrors scheduleScore's per-section terms exactly, so that
      // partial sums + the density term reproduce the final ranking score.
      let s = 0
      let hasTime = false
      for (const sec of sections) for (const tm of sec.times) {
        if (termCode && tm.sessionCode && tm.sessionCode !== termCode) continue
        if (!tm.day) continue
        hasTime = true
        if (prefs.freeDays.includes(tm.day)) s -= 25
        if (prefs.busyDays.includes(tm.day)) s += 20
        const hr = tm.startMs / 3600000
        if (prefs.time === 'morning' && hr >= 12) s -= 15
        if (prefs.time === 'afternoon' && hr < 12) s -= 15
      }
      if (sections.length && !hasTime) s -= 1000
      opts.push({ sections: sections.map(sec => ({ ...sec, times: sec.times.filter(tm => !termCode || !tm.sessionCode || tm.sessionCode === termCode) })),
        times: optionTimes(sections, entry.code), sScore: s,
        score: sections.reduce((acc, sec) => acc + scoreSec({ ...sec, times: sec.times.filter(tm => !termCode || !tm.sessionCode || tm.sessionCode === termCode) }, prefs.freeDays, prefs.busyDays, prefs.density, prefs.time, [], buffer, sectionCampus(entry.code, sec)), 0) })
    }
    const clean = opts.filter(o => !selfConflict(o.times))
    return clean.length ? clean : opts
  }

  // Per-course options, pre-scored and sorted best-preference first.
  const per = codes.map(code => {
    const entry = lookup.get(code)
    if (!entry) return { code, missing: true, opts: [{ sections: [], times: [], sScore: 0, score: 0 }] }
    const opts = buildOpts(entry)
    if (!opts.length) return { code, missing: true, blocked: buildOpts(entry, false).length > 0, name: entry.name, reason: 'No valid active section combination satisfying hard constraints', opts: [{ sections: [], times: [], sScore: 0, score: 0 }] }
    opts.sort((a, b) => b.score - a.score)
    return { code, name: entry.name, notes: entry.notes || [], opts }
  })
  const blocked = per.filter(p => p.blocked)
  if (blocked.length) return failure(`No schedule satisfies hard constraints: no allowed section combination for ${blocked.map(p => p.code).join(', ')}`)

  // Friend contexts: which of YOUR courses each friend shares, plus the option
  // pools of their independent courses (offered ones only).
  const codeSet = new Set(codes)
  const friendCtx = (friends || []).map(f => {
    const fCodes = [...new Set(f.courses || [])]
    const sharedSet = new Set(fCodes.filter(c => codeSet.has(c)))
    const indepOpts = fCodes
      .filter(c => !codeSet.has(c) && lookup.has(c))
      .map(c => buildOpts(lookup.get(c), false))
    return { name: f.name, sharedSet, indepOpts }
  })

  // Can this friend place all their independent courses around the shared
  // sections of a given arrangement? Boolean backtracking with early exit.
  const friendFeasible = (ctx, pick) => {
    const placed = []
    for (let i = 0; i < per.length; i++) {
      if (ctx.sharedSet.has(per[i].code) && pick[i]) for (const t of pick[i].times) placed.push(t)
    }
    const pools = [...ctx.indepOpts].sort((a, b) => a.length - b.length)
    const rec = (k) => {
      if (k === pools.length) return true
      for (const opt of pools[k]) {
        if (hits(opt.times, placed)) continue
        for (const t of opt.times) placed.push(t)
        if (rec(k + 1)) return true
        for (let n = 0; n < opt.times.length; n++) placed.pop()
      }
      return false
    }
    return rec(0)
  }
  const sharedWithFor = (code) => friendCtx.filter(c => c.sharedSet.has(code)).map(c => c.name)
  const tagShared = (results) => {
    for (const r of results) {
      const names = sharedWithFor(r.code)
      if (names.length) { r.shared = true; r.sharedWith = names }
    }
  }
  const buildResults = (pick) => per.map((p, i) => p.missing
    ? { code: p.code, name: p.name || 'Not in timetable', sections: [], color: colorMap[p.code], missing: true, reason: p.reason }
    : { code: p.code, name: p.name, notes: p.notes, sections: [...pick[i].sections], color: colorMap[p.code], conflict: false })

  // Most-constrained course first → prune earlier.
  const order = per.map((_, i) => i).sort((a, b) => per[a].opts.length - per[b].opts.length)

  // Fixed-capacity min-heap holding the TOP_K best (score, pick) leaves.
  const TOP_K = 200
  const heap = []
  const heapSiftUp = () => {
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p].score <= heap[i].score) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const heapSiftDown = () => {
    let i = 0
    for (;;) {
      const l = 2 * i + 1, r = l + 1
      let m = i
      if (l < heap.length && heap[l].score < heap[m].score) m = l
      if (r < heap.length && heap[r].score < heap[m].score) m = r
      if (m === i) break
      ;[heap[m], heap[i]] = [heap[i], heap[m]]
      i = m
    }
  }
  const offer = (score, pick) => {
    if (heap.length < TOP_K) { heap.push({ score, pick }); heapSiftUp() }
    else if (score > heap[0].score) { heap[0] = { score, pick }; heapSiftDown() }
  }

  // Optimistic suffix bounds: best possible sScore from course k onward, and
  // the most NEW distinct days the remaining courses could possibly add.
  // Day counts are capped at the days that actually OCCUR in the data (usually
  // Mon–Fri = 5, not 7) — a loose cap would keep the bound permanently above
  // every reachable score and disable pruning entirely.
  const allDays = new Set()
  for (const p of per) for (const o of p.opts) for (const t of o.times) allDays.add(t.day)
  const maxPossibleDays = allDays.size
  const maxSTail = new Array(order.length + 1)
  const maxDaysTail = new Array(order.length + 1)
  maxSTail[order.length] = 0
  maxDaysTail[order.length] = 0
  for (let k = order.length - 1; k >= 0; k--) {
    let m = -Infinity
    let d = 0
    for (const o of per[order[k]].opts) {
      if (o.sScore > m) m = o.sScore
      const days = new Set(o.times.map(t => t.day)).size
      if (days > d) d = days
    }
    maxSTail[k] = maxSTail[k + 1] + m
    maxDaysTail[k] = Math.min(maxPossibleDays, maxDaysTail[k + 1] + d)
  }

  const placed = []
  const chosen = new Array(per.length)
  const dayCount = new Array(8).fill(0)
  let distinctDays = 0
  const densityTerm = () => prefs.density === 'compact' ? (5 - distinctDays) * 10
    : prefs.density === 'spread' ? distinctDays * 10 : 0
  // Exact density upper bound: compact only worsens as days grow; spread can
  // gain at most the remaining courses' new days. Tight bounds matter — they
  // let equal-score plateaus prune as soon as the heap is full.
  const densityBound = (k) => prefs.density === 'compact' ? (5 - distinctDays) * 10
    : prefs.density === 'spread' ? Math.min(maxPossibleDays, distinctDays + maxDaysTail[k]) * 10 : 0

  // Defensive backstop only: with the bound pruning above, normal searches
  // finish almost immediately once the heap fills. The budget only bites when
  // conflict-free arrangements are rarer than TOP_K inside an astronomically
  // large option space — there the search would otherwise run unbounded just
  // to prove near-infeasibility.
  const NODE_BUDGET = 2000000
  let nodes = 0
  let truncated = false
  const backtrack = (k, partial) => {
    if (heap.length === TOP_K && partial + maxSTail[k] + densityBound(k) <= heap[0].score) return
    if (k === order.length) { offer(partial + densityTerm(), chosen.slice()); return }
    for (const opt of per[order[k]].opts) {
      if (nodes++ > NODE_BUDGET) { truncated = true; return }
      if (hits(opt.times, placed)) continue
      if (!lunchFits([...placed, ...opt.times], constraints)) continue
      for (const t of opt.times) {
        placed.push(t)
        if (++dayCount[t.day] === 1) distinctDays++
      }
      chosen[order[k]] = opt
      backtrack(k + 1, partial + opt.sScore)
      for (let n = opt.times.length - 1; n >= 0; n--) {
        placed.pop()
        if (--dayCount[opt.times[n].day] === 0) distinctDays--
      }
      if (truncated) return
    }
  }
  backtrack(0, 0)

  if (heap.length) {
    const ranked = heap.map(({ score, pick }) => {
      const results = buildResults(pick)
      tagShared(results)
      markConflicts(results, prefs)
      const infeasibleFriends = friendCtx.filter(c => !friendFeasible(c, pick)).map(c => c.name)
      return { results, conflicts: results.filter(r => r.conflict).length, score, infeasibleFriends, truncated }
    })
    ranked.sort((a, b) => a.conflicts - b.conflicts
      || a.infeasibleFriends.length - b.infeasibleFriends.length
      || b.score - a.score)
    return ranked
  }

  // No conflict-free arrangement exists: greedy minimum-conflict, best preference as tiebreak.
  const pick = new Array(per.length)
  const placedG = []
  for (const k of order) {
    const p = per[k]
    let best = p.opts[0], bestConf = Infinity, bestScore = -Infinity
    for (const opt of p.opts) {
      const conf = opt.times.reduce((n, t) => n + placedG.filter(pt => pairConflict(t, pt)).length, 0)
      if (conf < bestConf || (conf === bestConf && opt.score > bestScore)) { best = opt; bestConf = conf; bestScore = opt.score }
    }
    pick[k] = best
    for (const t of best.times) placedG.push(t)
  }
  // A conflict fallback may relax class overlaps, never a personal hard limit.
  // If greedy choices consume lunch, search other combinations with overlaps allowed.
  if (!lunchFits(placedG, constraints)) {
    const occupied = []
    let fallbackNodes = 0
    const find = k => {
      if (!lunchFits(occupied, constraints)) return false
      if (k === order.length) return true
      for (const opt of per[order[k]].opts) {
        if (++fallbackNodes > NODE_BUDGET) { truncated = true; return false }
        pick[order[k]] = opt
        occupied.push(...opt.times)
        if (find(k + 1)) return true
        occupied.length -= opt.times.length
        if (truncated) return false
      }
      return false
    }
    if (!find(0)) return failure(truncated ? 'Search limit reached; no schedule satisfying hard constraints found' : undefined, truncated)
  }
  const results = buildResults(pick)
  tagShared(results)
  markConflicts(results, prefs)
  const infeasibleFriends = friendCtx.filter(c => !friendFeasible(c, pick)).map(c => c.name)
  return [{ results, conflicts: results.filter(r => r.conflict).length, score: scheduleScore(results, prefs), infeasibleFriends }]
}

export function buildCourseAvailability(scopeTerms, timetables) {
  const map = {}
  for (const term of scopeTerms || []) {
    const tt = timetables[term.value]
    if (!tt || !tt.courses) continue
    for (const c of tt.courses) {
      if (!map[c.code]) map[c.code] = []
      if (!map[c.code].includes(term.label)) map[c.code].push(term.label)
    }
  }
  return map
}

// Merge a column timetable with the full-session (Y) timetable so a candidate is
// judged against everything that will actually appear in that column's grid.
function mergedColumn(term, timetables, fullTT) {
  const tt = timetables[term.value] || { courses: [], courseCount: 0 }
  if (!fullTT) return tt
  return {
    courses: [...(tt.courses || []), ...(fullTT.courses || [])],
    courseCount: (tt.courseCount || 0) + (fullTT.courseCount || 0),
  }
}

export function analyzeCourseConflicts(scopeTerms, timetables, selectedCodes, prefs, candidateCodes = [], full = null) {
  const columns = scopeTerms || []
  const fullTT = full ? timetables[full.value] : null
  const badge = full ? [...columns, full] : columns
  const selected = [...new Set(selectedCodes || [])]
  const candidates = [...new Set(candidateCodes.length ? candidateCodes : selected)]
  const availability = buildCourseAvailability(badge, timetables)
  const anyPublished = badge.some(term => (timetables[term.value]?.courseCount || 0) > 0)
  const hints = {}

  for (const code of candidates) {
    if (selected.includes(code)) continue
    if (!availability[code]?.length) {
      hints[code] = { conflict: true, reason: anyPublished ? 'Not offered here' : 'Timetable TBA' }
      continue
    }

    const fits = columns.some(term => {
      const tt = mergedColumn(term, timetables, fullTT)
      if (!(tt.courseCount || 0)) return false
      const offered = new Set((tt.courses || []).map(c => c.code))
      if (!offered.has(code)) return false
      const termCourses = [...selected, code].filter(c => offered.has(c))
      const results = buildSchedule(tt, termCourses, prefs)
      const candidate = results.find(r => r.code === code)
      return candidate && !candidate.missing && !results.some(r => r.conflict)
    })

    if (!fits) hints[code] = { conflict: true, reason: 'Conflict Found' }
  }

  return hints
}

// ── Grid layout ──
export const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const GRID_START = 8 * 3600000   // 8:00 AM
export const GRID_END = 21 * 3600000    // 9:00 PM
export const HOUR_PX = 60

export function msToTop(ms) { return (ms - GRID_START) / 3600000 * HOUR_PX }
export function msToPx(ms) { return ms / 3600000 * HOUR_PX }
export function msToLabel(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Lay overlapping blocks within one day side-by-side: each cluster of mutually
// overlapping blocks is split into equal-width columns so conflicting courses
// show L/R instead of hiding each other. Sets `left` (%) and `widthPct` (%).
export function layoutDayColumns(blocks) {
  const sorted = blocks.sort((a, b) => a.top - b.top || (a.top + a.height) - (b.top + b.height))
  let cluster = []
  let clusterEnd = -Infinity
  const flush = () => {
    const colEnds = []
    for (const blk of cluster) {
      let col = colEnds.findIndex(end => blk.top >= end - 0.01)
      if (col === -1) { col = colEnds.length; colEnds.push(0) }
      colEnds[col] = blk.top + blk.height
      blk._col = col
    }
    const ncols = colEnds.length || 1
    for (const blk of cluster) { blk.left = (blk._col / ncols) * 100; blk.widthPct = 100 / ncols }
    cluster = []
    clusterEnd = -Infinity
  }
  for (const blk of sorted) {
    if (cluster.length && blk.top >= clusterEnd - 0.01) flush()
    cluster.push(blk)
    clusterEnd = Math.max(clusterEnd, blk.top + blk.height)
  }
  flush()
  return blocks
}

// Produce a renderable grid model: hour labels + per-day positioned blocks.
export function buildGrid(results) {
  const totalH = (GRID_END - GRID_START) / 3600000
  const hours = Array.from({ length: totalH }, (_, i) => GRID_START + i * 3600000)
  const colHeight = totalH * HOUR_PX

  const dayBlocks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const r of results) {
    for (const sec of (r.sections || [])) {
      for (const t of sec.times) {
        if (!t.day || t.day < 1 || t.day > 6) continue
        const top = msToTop(Math.max(t.startMs, GRID_START))
        const height = msToPx(Math.min(t.endMs, GRID_END) - Math.max(t.startMs, GRID_START))
        if (height <= 0) continue
        dayBlocks[t.day].push({
          code: r.code, name: r.name, sec: sec.name, room: t.room,
          equivalents: sec.equivalents || [],
          instructors: sec.instructors || [],
          campus: sectionCampus(r.code, sec), campusName: sectionCampus(r.code, sec) ? campusName(r.code) : 'Online',
          top, height, color: r.color,
          conflict: !!(r.conflictTimes && r.conflictTimes.has(timeKey(r.code, t))),
          repetition: t.repetition, repetitionTime: t.repetitionTime,
          shared: !!r.shared, sharedWith: r.sharedWith || [], full: !!r.full,
          startLabel: msToLabel(t.startMs), endLabel: msToLabel(t.endMs),
        })
      }
    }
  }
  for (const d of [1, 2, 3, 4, 5, 6]) layoutDayColumns(dayBlocks[d])
  return { hours, dayBlocks, colHeight }
}
