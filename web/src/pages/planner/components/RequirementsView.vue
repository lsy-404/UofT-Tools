<script setup>
import { courseUrl } from '../lib/campuses.js'
import { computed } from 'vue'
import { activePrograms, getStatus, setCourseStatus, isSatisfied, degreeProgress } from '../store.js'
import { badgeClass, prereqTokens, reqLineMet, courseCredit } from '../lib/courses.js'

const KINDS = [
  ['enrolment', 'Enrolment Requirements'],
  ['completion', 'Completion Requirements'],
]

// Render a block's prose into clickable course tokens, with any leading
// emphasized label (e.g. "First Year:") stripped so it can be shown bold.
function tokenizeBlock(b) {
  let text = b.text || ''
  if (b.lead && text.startsWith(b.lead)) text = text.slice(b.lead.length).trimStart()
  return prereqTokens(text, getStatus)
}

// Click a course code to cycle status: none → plan → taking → done → none.
function reqToggle(code) {
  setCourseStatus(code, (getStatus(code) + 1) % 4)
}

const programsModel = computed(() => activePrograms.value.map(prog => {
  const rg = prog.requirementGroups || {}
  // Credit context for thresholds that reference a wider pool than the listed
  // courses: credits satisfied within this program, and overall.
  const poolCredits = (prog.courses || []).filter(isSatisfied).reduce((n, c) => n + courseCredit(c), 0)
  const ctx = { poolCredits, totalCredits: degreeProgress.value.total }
  const kinds = []
  for (const [key, label] of KINDS) {
    const blocks = rg[key]?.blocks || []
    if (!blocks.length) continue
    kinds.push({
      label,
      blocks: blocks.map(b => ({ ...b, met: !b.manualReview && reqLineMet(b, isSatisfied, ctx), tokens: tokenizeBlock(b) })),
    })
  }
  return { prog, hasReqs: kinds.length > 0, kinds }
}))
</script>

<template>
  <div>
    <div v-if="!activePrograms.length" class="empty-state">
      <p>All programs are in intention mode.</p>
    </div>

    <template v-else>
      <div v-for="entry in programsModel" :key="entry.prog.id" class="req-prog-block">
        <p>Official requirement reference. Marks show recorded completed home-campus courses only; grades, alternatives, credit pools and permissions require manual verification.</p>
        <div class="req-prog-header">
          {{ entry.prog.name }} <span class="badge" :class="badgeClass(entry.prog.type)">{{ entry.prog.type }}</span>
        </div>

        <div v-if="!entry.hasReqs" class="req-none">No structured requirements available.</div>

        <template v-else>
          <template v-for="kind in entry.kinds" :key="kind.label">
            <div class="req-kind-label">{{ kind.label }}</div>

            <template v-for="(b, bi) in kind.blocks" :key="bi">
              <!-- Standalone heading (e.g. "Higher Years:") -->
              <div v-if="b.heading" class="req-heading">{{ b.lead || b.text }}</div>

              <!-- Credit-only note line (no course codes) -->
              <div v-else-if="b.note" class="req-note" :class="{ indent: b.indent }">{{ b.text }}</div>

              <!-- Requirement line with course codes -->
              <div v-else class="req-block" :class="{ indent: b.indent, met: b.met }">
                <span class="req-status">{{ b.manualReview ? '?' : b.met ? '✓' : '○' }}</span>
                <span class="req-text"><span v-if="b.lead" class="req-lead">{{ b.lead }} </span><template v-for="(t, ti) in b.tokens" :key="ti"><span v-if="t.course" class="prc-wrap"><span class="rc" :class="t.cls" title="Click to cycle: none → plan → taking → done" @click="reqToggle(t.code)">{{ t.code }}</span><a class="code-link" style="font-size:9px" :href="courseUrl(t.code)" target="_blank" title="Open course page" @click="$event.stopPropagation()">↗</a></span><template v-else>{{ t.text }}</template></template></span>
              </div>
            </template>
          </template>
        </template>
      </div>
    </template>
  </div>
</template>
