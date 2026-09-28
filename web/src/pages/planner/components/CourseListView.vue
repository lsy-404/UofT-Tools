<script setup>
import { courseUrl } from '../lib/campuses.js'
import { computed, ref } from 'vue'
import { state, courseList, getStatus, setCourseStatus } from '../store.js'
import { prereqTokens } from '../lib/courses.js'
import { courseLevelLabel, academicCredit, prerequisiteText, ROLE_LABELS } from '../lib/course-details.js'

const ROW_CLS = ['', 's-planned', 's-progress', 's-done']
const roleFilter = ref('all')
// Prereq quick-select cycles status: None → Plan → Taking → Done → None.
const cycleStatus = (code) => setCourseStatus(code, (getStatus(code) + 1) % 4)

function prereqInfo(meta) {
  const text = prerequisiteText(meta)
  if (!text) return { none: true }
  // Recorded course completion is not evidence of grades, permissions,
  // admission category or text-only eligibility restrictions.
  return { none: false, tokens: prereqTokens(text, getStatus) }
}

const rows = computed(() => courseList.value.map(c => {
  const st = getStatus(c.code)
  const meta = state.courses ? state.courses[c.code] : null
  return {
    code: c.code,
    programs: c.programs,
    roles: [...new Map((c.requirements || []).map(r => [r.program + r.role, r])).values()],
    rowCls: ROW_CLS[st] || '',
    level: courseLevelLabel(c.code),
    credit: academicCredit(c.code, meta),
    meta,
    added: !!c.added,
    prereq: meta ? prereqInfo(meta) : null,
  }
}))

const stats = computed(() => {
  const list = courseList.value
  return {
    total: list.length,
    planned: list.filter(c => getStatus(c.code) === 1).length,
    taking: list.filter(c => getStatus(c.code) === 2).length,
    done: list.filter(c => getStatus(c.code) === 3).length,
  }
})
const visibleRows = computed(() => rows.value.filter(row => roleFilter.value === 'all' || (roleFilter.value === 'added' ? row.added : row.roles.some(r => r.role === roleFilter.value))))

function onPreviewEnter(e) {
  const wrap = e.currentTarget
  const rect = wrap.getBoundingClientRect()
  const preview = wrap.querySelector('.course-name-preview')
  if (!preview) return
  const estHeight = preview.scrollHeight || 200
  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceAbove < estHeight && spaceBelow > spaceAbove) {
    wrap.classList.add('preview-below')
  } else {
    wrap.classList.remove('preview-below')
  }
}
</script>

<template>
  <div v-if="!courseList.length" class="empty-state">
    <p>No course data found for selected programs.</p>
  </div>

  <template v-else>
    <div class="course-stats">
      <span class="stat stat-total">{{ stats.total }} total</span>
      <span class="stat stat-planned">{{ stats.planned }} planned</span>
      <span class="stat stat-taking">{{ stats.taking }} taking</span>
      <span class="stat stat-done">{{ stats.done }} done</span>
    </div>
    <label class="role-filter">Show course role
      <select v-model="roleFilter" aria-label="Filter courses by requirement role">
        <option value="all">All roles</option>
        <option v-for="(label, role) in ROLE_LABELS" :key="role" :value="role">{{ label }}</option>
      </select>
    </label>
    <p>Level describes the course code, not the year you may enrol. Check prerequisites and the official timing notes.</p>

    <table class="course-table">
      <thead>
        <tr>
          <th class="c-status">Status</th>
          <th class="c-course">Course</th>
          <th class="c-flex">Role in selected programs</th>
          <th class="c-flex">Prerequisites / restrictions</th>
          <th class="c-year">Level / credit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in visibleRows" :key="row.code" :class="row.rowCls">
          <td class="c-status">
            <div class="sp">
              <button class="sp-b" :class="{ 's-none': getStatus(row.code) === 0 }" @click="setCourseStatus(row.code, 0)">None</button>
              <button class="sp-b" :class="{ 's-planned': getStatus(row.code) === 1 }" @click="setCourseStatus(row.code, 1)">Plan</button>
              <button class="sp-b" :class="{ 's-progress': getStatus(row.code) === 2 }" @click="setCourseStatus(row.code, 2)">Taking</button>
              <button class="sp-b" :class="{ 's-done': getStatus(row.code) === 3 }" @click="setCourseStatus(row.code, 3)">Done</button>
            </div>
          </td>
          <td class="c-course">
            <span class="c-name-wrap" @mouseenter="onPreviewEnter"><a class="code-link" :href="courseUrl(row.code)" target="_blank">{{ row.code }}</a><span
              v-if="row.meta" class="course-name-preview"><span class="cn-name">{{ row.meta.name }}</span><span v-if="row.meta.description" class="cn-desc">{{ row.meta.description }}</span></span></span>
          </td>
          <td class="c-flex">
            <div class="programs-tags">
              <template v-if="row.roles.length">
                <span v-for="r in row.roles" :key="r.program + r.role" class="ptag" :class="'role-' + r.role" :title="r.text">{{ r.program }} · {{ ROLE_LABELS[r.role] }}</span>
              </template>
              <template v-else>
                <span v-for="(p, i) in row.programs" :key="i" class="ptag">{{ p.name }} · {{ row.added ? 'Added independently' : 'Reference — check requirement' }}</span>
              </template>
            </div>
          </td>
          <td :class="{ 'c-flex': state.courses }">
            <template v-if="row.meta">
              <span v-if="row.prereq.none" class="prereq-none">—</span>
              <div v-else class="prereq-cell"><template v-for="(t, i) in row.prereq.tokens" :key="i"><span v-if="t.course" :class="t.cls" title="Click to cycle: None → Plan → Taking → Done" @click="cycleStatus(t.code)">{{ t.code }}</span><template v-else>{{ t.text }}</template></template></div>
              <p v-if="row.meta.coreqText">Corequisite: {{ row.meta.coreqText }}</p>
              <!-- Referenced codes alone cannot distinguish credit exclusions from
                   directional, concurrent or conditional enrolment restrictions. -->
              <p v-if="row.meta.exclusionText" class="exclusion-details">Exclusions / enrolment restrictions: {{ row.meta.exclusionText }}</p>
              <p v-if="row.meta.recommendedPreparation">Recommended preparation: {{ row.meta.recommendedPreparation }}</p>
              <p v-if="row.meta.enrolmentLimits">Enrolment limits: {{ row.meta.enrolmentLimits }}</p>
              <p v-if="row.meta.notes">{{ row.meta.notes }}</p>
              <details v-if="row.meta.breadth || row.meta.distribution || row.meta.hours || row.meta.modeOfDelivery || row.meta.previousCourseNumber || row.meta.courseExperience || row.meta.internationalComponent || row.meta.campusReview || row.code.endsWith('0')">
                <summary>Other calendar details</summary>
                <p v-if="row.meta.breadth">Breadth designation: {{ row.meta.breadth }}</p>
                <p v-if="row.meta.distribution">Distribution requirement: {{ row.meta.distribution }}</p>
                <p v-if="row.meta.hours">Instructional hours: {{ row.meta.hours }}</p>
                <p v-if="row.meta.modeOfDelivery">Calendar delivery options: {{ row.meta.modeOfDelivery }}</p>
                <p v-if="row.meta.previousCourseNumber">Previous course number: {{ row.meta.previousCourseNumber }}</p>
                <p v-if="row.meta.courseExperience">Course experience: {{ row.meta.courseExperience }}</p>
                <p v-if="row.meta.internationalComponent">International component: {{ row.meta.internationalComponent }}</p>
                <p v-if="row.meta.campusReview">Calendar location note: {{ row.meta.campusReview }}</p>
                <p v-if="row.code.endsWith('0')">Course code indicates off-campus instruction; check the actual location.</p>
              </details>
            </template>
            <template v-else>
              <span>Calendar details unavailable</span>
            </template>
          </td>
          <td class="c-year" style="color:var(--gray-600);font-size:12px">{{ row.level }}<br><template v-if="row.meta && !row.meta.timetableOnly">{{ row.credit }} academic credit<span v-if="row.meta.creditReview"><br>Credit conditions need review</span><span v-if="row.credit === 0"><br>Tracked separately from degree credits</span></template><template v-else>Credit unverified</template></td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
