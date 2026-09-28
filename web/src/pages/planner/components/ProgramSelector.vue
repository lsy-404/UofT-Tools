<script setup>
import { state, legality, degreeProgress, degreeBreakdown, campusConfig, programCounts, toggleProgram, toggleIntention, applyImported } from '../store.js'
import { chipClass } from '../lib/courses.js'
import { programUrl } from '../lib/campuses.js'
import { exportPlanner, importPlanner } from '../lib/dataio.js'
import CoursePicker from './CoursePicker.vue'
defineProps({
  mode: { type: String, default: 'all' },
})
const shortName = p => p.name.split(' - ')[0] || p.name
const chipTitle = p => p.intention ? 'Intention (planning)' : p.type + ' — ' + (p.code || '')
const fmt = n => (n || 0).toFixed(1)
function onExport() { exportPlanner(state.courseStatus, state.selectedPrograms, state.campus, state.extraCourses) }
function onImport() { importPlanner(applyImported) }
</script>

<template>
  <div class="prog-header">
    <div v-if="mode === 'all' || mode === 'programs'" style="display:flex;align-items:center;justify-content:space-between">
      <h2>Selected Programs</h2>
    </div>

    <div v-if="mode === 'all' || mode === 'programs'" class="prog-list">
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

    <section v-if="mode === 'all' || mode === 'programs'" aria-label="Program combination">
      <h3>Program combination</h3>
      <div class="summary">
        <div class="sum-block">
          <div>Specialist: {{ programCounts.specialist }} · Major: {{ programCounts.major }} · Minor: {{ programCounts.minor }}</div>
          <div v-for="message in legality.messages" :key="message" class="sum-warn">{{ message }}</div>
          <div>{{ legality.success }}</div>
        </div>
      </div>
    </section>

    <section v-if="mode === 'all' || mode === 'courses'" aria-label="Degree progress">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h2>Course Plan</h2>
        <div class="data-btns" style="margin:0">
          <button class="data-btn" @click="onExport">Export</button>
          <button class="data-btn" @click="onImport">Import</button>
        </div>
      </div>
      <h3>{{ campusConfig.name }} {{ campusConfig.degreeLabel }} progress · 2026–2027 rules</h3>
      <p>Planning aid only. The degree profile follows your active programs. Earlier entry years, double degrees and individual exceptions require their own calendar review. BCS requirements start with the 2027–2028 calendar and are not evaluated here.</p>
      <p v-for="note in campusConfig.extraNotes" :key="note">{{ note }}</p>
      <p>Completed-course totals are provisional until exclusions and transcript Extra (EXT) status are checked. Taking and planned credits are projections, not earned credits.</p>
      <div class="summary">
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
      <p v-if="degreeBreakdown.done.exclusionReview.length" role="status">Completed-course exclusions need review: {{ degreeBreakdown.done.exclusionReview.map(pair => pair.join(' / ')).join('; ') }}. These courses list each other in their exclusion fields; the displayed credit totals may overcount until transcript Extra (EXT) status and enrolment order are checked.</p>
      <p v-else-if="degreeProgress.exclusionReview.length" role="status">Planned or in-progress courses list each other in their exclusion fields: {{ degreeProgress.exclusionReview.map(pair => pair.join(' / ')).join('; ') }}. Check the original wording before treating both as degree credit.</p>
      <p v-if="degreeProgress.pendingBreadth.length">Distribution / breadth not automatically allocated: {{ degreeProgress.pendingBreadth.join(', ') }}. Check missing or multiple designations with your registrar.</p>
      <p>Graduation eligibility is not determined. Program completion, grades/CGPA, admission cohort, exclusions, transfer credits, CR/NCR restrictions, residency and distinct-credit requirements need official review.</p>
      <a :href="campusConfig.degreeSource" target="_blank" rel="noopener">Official degree requirements</a>
    </section>

    <CoursePicker v-if="mode === 'all' || mode === 'courses'" />
  </div>
</template>
