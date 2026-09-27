<script setup>
import { ref, computed } from 'vue'
import { CAMPUSES, courseCampus } from '../lib/campuses.js'
import { state, addExtraCourse, removeExtraCourse, isValidCourseCode, getStatus, lockedExtraCourses } from '../store.js'

const props = defineProps({
  label: { type: String, default: 'Add a course' },
  placeholder: { type: String, default: 'type course here' },
  // Optional overrides; default to the planner's extraCourses list.
  items: { type: Array, default: null },
  add: { type: Function, default: null },
  remove: { type: Function, default: null },
})

const isDefault = computed(() => props.items == null)
const doAdd = (code) => (props.add ?? addExtraCourse)(code)
const doRemove = (code) => (props.remove ?? removeExtraCourse)(code)

// Locked = marked Plan/Taking/Done but outside any selected program (default mode only).
const lockedSet = computed(() => (isDefault.value ? new Set(lockedExtraCourses.value) : new Set()))
const lockedList = computed(() => (isDefault.value ? lockedExtraCourses.value : []))
const removableList = computed(() => (props.items ?? state.extraCourses).filter(c => !lockedSet.value.has(c)))

const query = ref('')
const browsing = ref(false)
const searchCampus = ref('all')

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!state.courses) return []
  const out = []
  for (const code in state.courses) {
    const c = state.courses[code]
    if (searchCampus.value !== 'all' && courseCampus(code) !== searchCampus.value) continue
    if (code.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)) {
      out.push({ code, name: c.name })
      if (out.length >= 8) break
    }
  }
  return out
})

// Allow adding a typed code even if it's not in the catalog metadata.
const manualCode = computed(() => {
  const c = query.value.trim().toUpperCase().replace(/\s+/g, '')
  return isValidCourseCode(c) && !results.value.some(r => r.code === c) ? c : null
})

function add(code) {
  if (doAdd(code)) { query.value = ''; browsing.value = false }
}
</script>

<template>
  <div class="course-picker">
    <label class="cp-label">{{ label }}</label>
    <label>Browse campus <select v-model="searchCampus" aria-label="Course campus" @change="browsing = true"><option value="all">All campuses</option><option v-for="(c, k) in CAMPUSES" :key="k" :value="k">{{ c.name }}</option></select></label>
    <div class="cp-row">
      <div class="cp-input-wrap">
        <input v-model="query" class="cp-input" type="text" :placeholder="placeholder" @focus="browsing = true" @keydown.esc="browsing = false">
        <div v-if="browsing && (results.length || manualCode)" class="cp-results">
          <button class="cp-item" @click="browsing = false">Close results</button>
          <button v-for="r in results" :key="r.code" class="cp-item" @click="add(r.code)">
            <span class="cp-code">{{ r.code }}</span>
            <span class="cp-name">{{ r.name }}</span>
          </button>
          <button v-if="manualCode" class="cp-item cp-manual" @click="add(manualCode)">
            + Add <span class="cp-code">{{ manualCode }}</span> <span class="cp-name">(not in catalog)</span>
          </button>
        </div>
      </div>

      <div v-if="removableList.length || lockedList.length" class="cp-chips">
        <span v-for="code in removableList" :key="'r' + code" class="cp-chip">
          {{ code }}<span class="cp-x" title="Remove" @click="doRemove(code)">×</span>
        </span>
        <span
          v-for="code in lockedList"
          :key="'l' + code"
          class="cp-chip locked"
          :class="'st-' + getStatus(code)"
          title="Marked outside your selected programs — kept here for reference"
        >{{ code }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-picker { margin-top: 10px; }
.cp-label {
  display: block; font-size: 11px; font-weight: 600; color: var(--gray-600);
  text-transform: uppercase; letter-spacing: .3px; margin-bottom: 4px;
}
.cp-row { display: flex; gap: 8px; align-items: flex-start; }
.cp-input-wrap { position: relative; flex: 0 0 auto; }
.cp-input {
  width: 16ch; padding: 6px 8px; border: 1px solid var(--gray-200);
  border-radius: var(--radius); font-size: 13px; outline: none;
}
.cp-input:focus { border-color: var(--teal); }
.cp-results {
  position: absolute; z-index: 50; left: 0; top: 100%; margin-top: 3px; min-width: 260px;
  background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, .12); max-height: 260px; overflow-y: auto;
}
.cp-item {
  display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left;
  padding: 7px 10px; border: none; background: none; cursor: pointer; font-size: 13px;
  border-bottom: 1px solid var(--gray-100);
}
.cp-item:last-child { border-bottom: none; }
.cp-item:hover { background: var(--gray-50); }
.cp-code { font-family: monospace; font-weight: 600; color: var(--blue); flex-shrink: 0; }
.cp-name { color: var(--gray-600); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-manual { color: var(--teal); font-weight: 500; }
.cp-chips { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
.cp-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
  border-radius: 20px; font-size: 12px; font-weight: 500; font-family: monospace;
  background: #e8f4f8; border: 1.5px solid #bae0ec; color: var(--blue);
}
.cp-x { cursor: pointer; font-size: 14px; line-height: 1; }
.cp-x:hover { opacity: .7; }
.cp-chip.locked { font-size: 11px; cursor: default; }
.cp-chip.locked.st-1 { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
.cp-chip.locked.st-2 { background: #fffbeb; border-color: #fde68a; color: #854d0e; }
.cp-chip.locked.st-3 { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
</style>
