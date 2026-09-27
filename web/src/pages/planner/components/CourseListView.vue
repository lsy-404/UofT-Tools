<script setup>
import { courseUrl } from '../lib/campuses.js'
import { computed } from 'vue'
import { state, courseList, getStatus, setCourseStatus, isSatisfied } from '../store.js'
import { badgeClass, courseYear, prereqTokens } from '../lib/courses.js'

const ROW_CLS = ['', 's-planned', 's-progress', 's-done']
// Prereq quick-select cycles status: None → Plan → Taking → Done → None.
const cycleStatus = (code) => setCourseStatus(code, (getStatus(code) + 1) % 4)

const allSelectedCodes = computed(() => new Set(courseList.value.map(c => c.code)))

function prereqInfo(meta) {
  const prereqs = meta.prereqs || []
  if (!prereqs.length) return { none: true }
  const text = meta.prereqText || prereqs.join(', ')
  const hasOr = / or /i.test(text)
  const met = hasOr ? prereqs.some(isSatisfied) : prereqs.every(isSatisfied)
  return { none: false, met, tokens: prereqTokens(text, getStatus) }
}

const rows = computed(() => courseList.value.map(c => {
  const st = getStatus(c.code)
  const meta = state.courses ? state.courses[c.code] : null
  const exclConflicts = meta ? (meta.exclusions || []).filter(ex => allSelectedCodes.value.has(ex)) : []
  return {
    code: c.code,
    programs: c.programs,
    reqLabels: [...c.reqLabels],
    rowCls: ROW_CLS[st] || '',
    year: courseYear(c.code),
    meta,
    exclConflicts,
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

    <table class="course-table">
      <thead>
        <tr>
          <th class="c-status">Status</th>
          <th class="c-course">Course</th>
          <th class="c-flex">Required by</th>
          <th :class="{ 'c-flex': state.courses }">{{ state.courses ? 'Prereqs' : 'Year' }}</th>
          <th v-if="state.courses" class="c-year">Year</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.code" :class="row.rowCls">
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
              v-if="row.meta" class="course-name-preview"><span class="cn-name">{{ row.meta.name }}</span><span v-if="row.meta.description" class="cn-desc">{{ row.meta.description }}</span></span></span><span
              v-if="row.exclConflicts.length" class="excl-flag" tabindex="0" role="note"
              :aria-label="'Exclusion conflict — you can only count one of ' + row.code + ' and ' + row.exclConflicts.join(', ')"
            >⊘<span class="excl-tip">Exclusion: you may only count one of <b>{{ row.code }}</b> and {{ row.exclConflicts.join(', ') }} toward your programs.</span></span>
          </td>
          <td class="c-flex">
            <div class="programs-tags">
              <template v-if="row.reqLabels.length">
                <span v-for="l in row.reqLabels" :key="l" class="ptag" style="background:#f0f9ff;color:#007FA3">{{ l }}</span>
              </template>
              <template v-else>
                <span v-for="(p, i) in row.programs" :key="i" class="ptag" :class="badgeClass(p.type)">{{ p.name }}</span>
              </template>
            </div>
          </td>
          <td :class="{ 'c-flex': state.courses }">
            <template v-if="row.meta">
              <span v-if="row.prereq.none" class="prereq-none">—</span>
              <div v-else class="prereq-cell"><span v-if="row.prereq.met" class="prereq-met">✓</span><span v-else class="prereq-warn-icon">⚠</span>{{ ' ' }}<template v-for="(t, i) in row.prereq.tokens" :key="i"><span v-if="t.course" :class="t.cls" title="Click to cycle: None → Plan → Taking → Done" @click="cycleStatus(t.code)">{{ t.code }}</span><template v-else>{{ t.text }}</template></template></div>
            </template>
            <template v-else>
              <span v-if="row.year" style="color:var(--gray-600);font-size:12px">Y{{ row.year }}</span>
              <span v-else style="color:var(--gray-600)">—</span>
            </template>
          </td>
          <td v-if="state.courses" class="c-year" style="color:var(--gray-600);font-size:12px">{{ row.year ? 'Y' + row.year : '—' }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
