<script setup>
import { computed, ref } from 'vue'
import { state, currentScope, defaultConstraints } from '../store.js'
import { msToLabel } from '../lib/scheduling.js'
import { constraintError, clockMs } from '../lib/constraints.js'

const DAYS = [{ value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }]
const DAY_NAMES = Object.fromEntries(DAYS.map(d => [d.value, d.label]))
const TYPES = ['LEC', 'TUT', 'PRA']
const constraints = computed(() => state.prefs.constraints || (state.prefs.constraints = defaultConstraints()))
const sectionChoices = computed(() => {
  const scope = currentScope.value
  if (!scope) return []
  return [...scope.terms, ...(scope.full ? [scope.full] : [])].flatMap(term => {
    const tt = state.timetables[term.value]
    return (tt?.courses || []).filter(c => (state.scheduled[c.code] || []).includes(term.value))
      .map(c => ({ ...c, term, groups: TYPES.map(type => ({
        type, sections: (c.sections || []).filter(s => s.type === type && !s.cancelled)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter(g => g.sections.length) }))
  })
})
const sectionRules = (term, code) => constraints.value.sections?.[term]?.[code] || {}
const sectionState = (term, code, sec) => {
  const rules = sectionRules(term, code)
  return rules.locked?.[sec.type] === sec.name ? 'locked'
    : (rules.excluded || []).includes(sec.name) ? 'excluded' : 'allowed'
}
function updateSection(term, code, sec, action) {
  const byTerm = constraints.value.sections
  const byCourse = byTerm[term] ||= {}
  const rule = byCourse[code] ||= { locked: {}, excluded: [] }
  rule.locked ||= {}
  rule.excluded ||= []
  if (action === 'lock') {
    if (rule.locked[sec.type] === sec.name) delete rule.locked[sec.type]
    else {
      rule.locked[sec.type] = sec.name
      rule.excluded = rule.excluded.filter(name => name !== sec.name)
    }
  } else {
    if (rule.excluded.includes(sec.name)) rule.excluded = rule.excluded.filter(name => name !== sec.name)
    else {
      rule.excluded.push(sec.name)
      if (rule.locked[sec.type] === sec.name) delete rule.locked[sec.type]
    }
  }
  if (!Object.keys(rule.locked).length && !rule.excluded.length) delete byCourse[code]
  if (!Object.keys(byCourse).length) delete byTerm[term]
}
const sectionInfo = sec => [
  (sec.times || []).filter(t => t.day >= 1 && t.day <= 6)
    .map(t => `${DAY_NAMES[t.day]} ${msToLabel(t.startMs)}–${msToLabel(t.endMs)}`).join(', ') || 'Time TBA',
  (sec.instructors || []).map(i => `${i.firstName || ''} ${i.lastName || ''}`.trim()).filter(Boolean).join(', '),
  (sec.deliveryModes || []).join('/'),
].filter(Boolean).join(' · ')

const blockedDay = ref(1)
const blockedStart = ref('09:00')
const blockedEnd = ref('10:00')
const blockedError = ref('')
const clockError = computed(() => constraintError(constraints.value))
function addBlocked() {
  if (!(clockMs(blockedStart.value) < clockMs(blockedEnd.value))) {
    blockedError.value = 'End must be after start.'
    return
  }
  blockedError.value = ''
  constraints.value.unavailable.push({ day: Number(blockedDay.value), start: blockedStart.value, end: blockedEnd.value })
}
const instructorText = ref('')
function addInstructor() {
  const name = instructorText.value.trim().replace(/\s+/g, ' ')
  if (!name || constraints.value.excludedInstructors.some(n => n.toLocaleLowerCase() === name.toLocaleLowerCase())) return
  constraints.value.excludedInstructors.push(name)
  instructorText.value = ''
}
</script>

<template>
  <section class="hard-constraints">
    <h3>Hard constraints</h3>
    <p class="help">Schedules must meet every rule below. Density, time of day and day preferences still rank the schedules that remain.</p>

    <label class="field-title">Unavailable times</label>
    <div class="entry-row">
      <select v-model.number="blockedDay" aria-label="Unavailable day"><option v-for="d in DAYS" :key="d.value" :value="d.value">{{ d.label }}</option></select>
      <input v-model="blockedStart" type="time" aria-label="Unavailable from">
      <span>to</span><input v-model="blockedEnd" type="time" aria-label="Unavailable until">
      <button type="button" @click="addBlocked">Add</button>
    </div>
    <p v-if="blockedError" class="validation" role="alert">{{ blockedError }}</p>
    <div v-for="(slot, i) in constraints.unavailable" :key="i" class="saved-row">
      <span>{{ DAY_NAMES[slot.day] }} {{ slot.start }}–{{ slot.end }}</span>
      <button type="button" :aria-label="`Remove ${DAY_NAMES[slot.day]} ${slot.start}–${slot.end}`" @click="constraints.unavailable.splice(i, 1)">×</button>
    </div>

    <label class="field-title">Class hours</label>
    <div class="entry-row"><label>Earliest start <input v-model="constraints.earliest" type="time"></label><label>Latest end <input v-model="constraints.latest" type="time"></label></div>
    <p class="help">Leave either time blank for no limit.</p>

    <label class="zz-check lunch-toggle"><input v-model="constraints.lunch.enabled" type="checkbox"> Keep a lunch break each day</label>
    <div v-if="constraints.lunch.enabled" class="entry-row lunch-row">
      <label>Window from <input v-model="constraints.lunch.start" type="time"></label>
      <label>to <input v-model="constraints.lunch.end" type="time"></label>
      <label>Break <select v-model.number="constraints.lunch.minutes"><option :value="30">30 min</option><option :value="45">45 min</option><option :value="60">60 min</option><option :value="90">90 min</option></select></label>
    </div>
    <p v-if="constraints.lunch.enabled" class="help">Every day needs this much continuous free time inside the window. Unavailable times also occupy the window.</p>
    <p v-if="clockError" class="validation" role="alert">{{ clockError }}</p>

    <label class="field-title">Exclude instructors</label>
    <div class="entry-row"><input v-model="instructorText" type="text" placeholder="Full name" aria-label="Instructor name" @keydown.enter.prevent="addInstructor"><button type="button" @click="addInstructor">Add</button></div>
    <div v-for="(name, i) in constraints.excludedInstructors" :key="name" class="saved-row"><span>{{ name }}</span><button type="button" :aria-label="`Remove ${name}`" @click="constraints.excludedInstructors.splice(i, 1)">×</button></div>

    <label class="field-title" for="online-rule">Online sections</label>
    <select id="online-rule" v-model="constraints.online" class="online-rule">
      <option value="any">Allow either</option><option value="prefer">Require online when available</option><option value="forbid">No online or mixed sections</option>
    </select>
    <p class="help">Online means SYNC or ASYNC. “Require online” applies to each LEC, TUT and PRA component after the other section rules; when a fully online choice exists, it must be chosen.</p>

    <label class="field-title">Specific sections</label>
    <p class="help">Select courses above to set their sections. A full-year course has one set of rules, applied in both terms.</p>
    <button v-if="Object.keys(constraints.sections).length" type="button" class="clear-sections" @click="constraints.sections = {}">Clear all section locks and exclusions</button>
    <p v-if="!sectionChoices.length" class="help">No selected courses with published sections in this range.</p>
    <details v-for="course in sectionChoices" :key="`${course.term.value}:${course.code}`" class="course-rules">
      <summary>{{ course.code }} · {{ course.term.label }}</summary>
      <div v-for="group in course.groups" :key="group.type" class="section-group">
        <strong>{{ group.type }}</strong>
        <div v-for="sec in group.sections" :key="sec.name" class="section-row" :class="sectionState(course.term.value, course.code, sec)">
          <div class="section-detail"><b>{{ sec.name }}</b><small>{{ sectionInfo(sec) }}</small></div>
          <button type="button" :aria-pressed="sectionState(course.term.value, course.code, sec) === 'locked'" @click="updateSection(course.term.value, course.code, sec, 'lock')">Lock</button>
          <button type="button" :aria-pressed="sectionState(course.term.value, course.code, sec) === 'excluded'" @click="updateSection(course.term.value, course.code, sec, 'exclude')">Exclude</button>
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.hard-constraints { border-top: 1px solid var(--gray-200); margin-top: 14px; padding-top: 12px; }
h3 { font-size: 14px; margin: 0 0 5px; }
.help { font-size: 11px; color: var(--gray-600); line-height: 1.4; margin: 3px 0 9px; }
.field-title { display: block; margin: 13px 0 5px; font-size: 12px; font-weight: 700; color: var(--gray-700); }
.entry-row { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; font-size: 11px; }
.entry-row label { display: flex; align-items: center; gap: 3px; font-size: 11px; }
.entry-row input[type=time] { width: 82px; }
.entry-row input[type=text] { flex: 1; min-width: 100px; }
input, select, button { border: 1px solid var(--gray-300); border-radius: 5px; background: #fff; padding: 4px; font-size: 11px; color: var(--gray-700); }
button { cursor: pointer; }
.saved-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 5px; font-size: 11px; border-bottom: 1px solid var(--gray-200); }
.saved-row button { border: 0; font-size: 15px; padding: 0 4px; }
.validation { color: #b91c1c; font-size: 11px; margin: 4px 0; }
.lunch-toggle { display: flex; align-items: center; gap: 5px; margin-top: 12px; font-size: 12px; }
.online-rule { width: 100%; }
.course-rules { border: 1px solid var(--gray-200); border-radius: 6px; padding: 5px 7px; margin: 5px 0; }
.clear-sections { margin-bottom: 5px; }
.course-rules summary { cursor: pointer; font-size: 12px; font-weight: 600; }
.section-group { margin: 8px 0; }
.section-group strong { font-size: 11px; }
.section-row { display: flex; gap: 4px; align-items: center; border-top: 1px solid var(--gray-200); padding: 4px 0; }
.section-detail { flex: 1; min-width: 0; font-size: 11px; }
.section-detail small { display: block; color: var(--gray-600); overflow-wrap: anywhere; }
.section-row.locked button:first-of-type { color: #fff; background: var(--teal); border-color: var(--teal); }
.section-row.excluded button:last-of-type { color: #fff; background: #b91c1c; border-color: #b91c1c; }
</style>
