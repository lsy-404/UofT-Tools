<script setup>
import { state, legality, degreeProgress, degreeBreakdown, campusConfig, programCounts, toggleProgram, toggleIntention, applyImported } from '../store.js'
import { chipClass } from '../lib/courses.js'
import { programUrl } from '../lib/campuses.js'
import { exportPlanner, importPlanner } from '../lib/dataio.js'
import CoursePicker from './CoursePicker.vue'
const shortName = p => p.name.split(' - ')[0] || p.name
const chipTitle = p => p.intention ? 'Intention (planning)' : p.type + ' — ' + (p.code || '')
const fmt = n => (n || 0).toFixed(1)
function onExport() { exportPlanner(state.courseStatus, state.selectedPrograms, state.campus, state.extraCourses) }
function onImport() { importPlanner(applyImported) }
</script>

<template>
  <div class="prog-header">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2>Selected Programs</h2>
      <div class="data-btns" style="margin:0">
        <button class="data-btn" @click="onExport">Export</button>
        <button class="data-btn" @click="onImport">Import</button>
      </div>
    </div>

    <div class="prog-list">
      <span v-if="!state.selectedPrograms.length" style="font-size:12px;color:var(--gray-600)">No programs selected</span>
      <div
        v-for="p in state.selectedPrograms"
        :key="p.id"
        class="prog-chip"
        :class="[chipClass(p.type), { intention: p.intention }]"
        :title="chipTitle(p)"
      >
        <span title="Toggle intention" @click="toggleIntention(p.id)">{{ shortName(p) }}</span>
        <a
          class="code-link"
          style="font-size:10px;opacity:.7"
          :href="programUrl(p, state.campus)"
          target="_blank"
          title="Open program page"
          @click="$event.stopPropagation()"
        >{{ p.code || '' }}</a>
        <span class="chip-x" @click="toggleProgram(p.id)">×</span>
      </div>
    </div>

    <section aria-label="Degree progress">
      <h3>{{ campusConfig.name }} HBA / HBSc progress · 2026–2027 rules</h3>
      <p>Planning aid only. Earlier entry years, BCom, BBA, BCS, professional and double degrees require their own calendar review.</p>
      <p>Completed credits count toward the checks below. Taking and planned credits are projections, not earned credits.</p>
      <div class="summary">
        <div class="sum-block">
          <div class="sum-head">Program combination</div>
          <div>Specialist: {{ programCounts.specialist }} · Major: {{ programCounts.major }} · Minor: {{ programCounts.minor }}</div>
          <div v-for="message in legality.messages" :key="message" class="sum-warn">{{ message }}</div>
          <div>{{ legality.success }}</div>
        </div>
        <div class="sum-block" v-for="[key, label, required] in campusConfig.checks" :key="key">
          <div class="sum-head">{{ label }}</div>
          <div>Done: <b>{{ fmt(degreeBreakdown.done[key]) }} / {{ fmt(required) }}</b></div>
          <div>Taking: {{ fmt(degreeBreakdown.taking[key]) }} · Planned: {{ fmt(degreeBreakdown.planned[key]) }}</div>
          <div>Projected total: {{ fmt(degreeProgress[key]) }}</div>
        </div>
      </div>
      <details open>
        <summary>{{ state.campus === 'utm' ? 'Distribution' : 'Breadth' }} progress</summary>
        <p v-if="state.campus === 'stg'">1.0 credit in 4 categories, or 1.0 in 3 and 0.5 in both remaining categories.</p>
        <p v-else>At least {{ campusConfig.breadthMin.toFixed(1) }} credit in each category.</p>
        <div v-for="category in campusConfig.categories" :key="category">
          {{ category }} — Done: {{ fmt(degreeBreakdown.done.cats[category]) }} · Taking: {{ fmt(degreeBreakdown.taking.cats[category]) }} · Planned: {{ fmt(degreeBreakdown.planned.cats[category]) }}
        </div>
        <p>Completed breadth check: {{ degreeBreakdown.done.satisfied ? 'Recorded categories meet the threshold' : 'Not yet met' }}.</p>
      </details>
      <p v-if="degreeProgress.pending.length" role="status">Pending manual verification — excluded from automatic degree checks: {{ degreeProgress.pending.join(', ') }}. Cross-campus courses are not automatically equivalent, even when their numbers match.</p>
      <p v-if="degreeProgress.pendingBreadth.length">Distribution / breadth not automatically allocated: {{ degreeProgress.pendingBreadth.join(', ') }}. Check missing or multiple designations with your registrar.</p>
      <p>Graduation eligibility is not determined. Program completion, grades/CGPA, admission cohort, exclusions, transfer credits, CR/NCR restrictions, residency and distinct-credit requirements need official review.</p>
      <a :href="campusConfig.degreeSource" target="_blank" rel="noopener">Official degree requirements</a>
    </section>

    <CoursePicker />
  </div>
</template>
