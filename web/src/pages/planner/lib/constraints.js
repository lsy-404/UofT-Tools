// Hard constraints are evaluated before deduplication and preference ranking.
export function clockMs(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return NaN
  const [h, m] = value.split(':').map(Number)
  return h < 24 && m < 60 ? (h * 60 + m) * 60000 : NaN
}

export function constraintError(c = {}) {
  for (const key of ['earliest', 'latest']) if (c[key] && !Number.isFinite(clockMs(c[key]))) return 'Invalid daily time limit'
  if (c.earliest && c.latest && clockMs(c.earliest) >= clockMs(c.latest)) return 'Earliest start must precede latest end'
  for (const b of c.unavailable || []) {
    if (![1, 2, 3, 4, 5, 6, 7].includes(Number(b.day)) || !(clockMs(b.start) < clockMs(b.end))) return 'Invalid unavailable time range'
  }
  if (c.lunch?.enabled) {
    const l = c.lunch
    if (!(Number(l.minutes) > 0 && clockMs(l.end) - clockMs(l.start) >= Number(l.minutes) * 60000)) return 'Lunch duration must fit inside its time window'
  }
  return ''
}

export function instructorName(i) {
  return typeof i === 'string' ? i : [i.firstName, i.lastName].filter(Boolean).join(' ')
}
const normalize = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase()
const isOnline = s => s.deliveryModes?.length && s.deliveryModes.every(m => ['SYNC', 'ASYNC'].includes(m))

export function sectionRules(c, code, termCode) {
  // Full-session rules apply to both columns; exact term rules also apply.
  return Object.entries(c.sections || {}).filter(([term]) => !termCode || term === termCode || term.split('-').includes(termCode) || `${term}F` === termCode || `${term}S` === termCode)
    .map(([, courses]) => courses[code]).filter(Boolean)
}

export function allowedSections(pool, code, termCode, c = {}) {
  const rules = sectionRules(c, code, termCode)
  const excluded = new Set((c.excludedInstructors || []).map(normalize))
  const filtered = pool.filter(s => {
    if (rules.some(r => r.excluded?.includes(s.name) || (r.locked?.[s.type] && r.locked[s.type] !== s.name))) return false
    if ((s.instructors || []).some(i => excluded.has(normalize(instructorName(i))))) return false
    if (c.online === 'forbid' && (s.deliveryModes || []).some(m => ['SYNC', 'ASYNC', 'HYBR', 'HYBRID'].includes(m))) return false
    if (!lunchFits((s.times || []).filter(t => !termCode || !t.sessionCode || t.sessionCode === termCode), c)) return false
    return (s.times || []).every(t => {
      if (!t.day || (termCode && t.sessionCode && t.sessionCode !== termCode)) return true
      if (c.earliest && t.startMs < clockMs(c.earliest)) return false
      if (c.latest && t.endMs > clockMs(c.latest)) return false
      return !(c.unavailable || []).some(b => Number(b.day) === t.day && t.startMs < clockMs(b.end) && t.endMs > clockMs(b.start))
    })
  })
  return c.online === 'prefer' && filtered.some(isOnline) ? filtered.filter(isOnline) : filtered
}

export function lunchFits(times, c = {}) {
  if (!c.lunch?.enabled) return true
  const start = clockMs(c.lunch.start), end = clockMs(c.lunch.end), duration = Number(c.lunch.minutes) * 60000
  // TTB's biweekly phase labels do not reliably identify the starting week
  // (ANTA01H3 publishes different start dates under the same phase label).
  // Reserve the time in every week so a hard lunch limit cannot be waived.
  for (let day = 1; day <= 7; day++) {
    const occupied = [...times.filter(t => t.day === day), ...(c.unavailable || []).filter(b => Number(b.day) === day).map(b => ({ startMs: clockMs(b.start), endMs: clockMs(b.end) }))]
      .filter(t => t.startMs < end && t.endMs > start).sort((a, b) => a.startMs - b.startMs)
    let cursor = start, fits = false
    for (const t of occupied) {
      if (t.startMs - cursor >= duration) { fits = true; break }
      cursor = Math.max(cursor, t.endMs)
    }
    if (!fits && end - cursor < duration) return false
  }
  return true
}
