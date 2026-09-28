<script setup>
import { computed } from 'vue'
import { state, setAlt } from '../store.js'
import ScheduleGrid from './ScheduleGrid.vue'

const showSharedHint = computed(() =>
  state.friends.enabled && state.board.some(t => t.results.some(r => r.shared)))
</script>

<template>
  <div class="board">
    <div v-if="showSharedHint" class="board-views">
      <span class="bv-hint">★ = shared course (same lecture &amp; lab as your friend)</span>
    </div>

    <div v-if="!state.board.length" class="no-data">
      Select courses to preview a schedule.
    </div>

    <div v-else class="term-cols">
      <div v-for="term in state.board" :key="term.value" class="term-col">
        <div class="term-head">
          {{ term.label }}
          <span v-if="!term.published" class="term-unpub">timetable not published yet</span>
          <span v-if="term.conflicts" class="term-confl">{{ term.conflicts }} conflict(s)</span>
          <span v-if="term.infeasibleFriends?.length" class="term-confl">{{ term.infeasibleFriends.join(', ') }} can't fit</span>
          <div v-if="term.optionCount > 1" class="alt-nav">
            <button class="alt-btn" :disabled="term.optionIndex === 0" @click="setAlt(term.value, term.optionIndex - 1)">‹</button>
            <span class="alt-label">option {{ term.optionIndex + 1 }} / {{ term.optionCount }}</span>
            <button class="alt-btn" :disabled="term.optionIndex >= term.optionCount - 1" @click="setAlt(term.value, term.optionIndex + 1)">›</button>
          </div>
        </div>
        <ScheduleGrid :results="term.results" :home-campus="state.campus" />
        <template v-for="result in term.results" :key="result.code">
          <details v-if="!result.missing && (result.notes?.length || result.sections?.some(section => section.notes?.length))" class="timetable-notes">
            <summary>{{ result.code }} · official timetable notes</summary>
            <p v-for="(note, i) in result.notes || []" :key="'course-' + i">{{ note.text }}</p>
            <template v-for="section in result.sections || []" :key="section.name">
              <p v-for="(note, i) in section.notes || []" :key="i"><b>{{ section.name }}:</b> {{ note.text }}</p>
            </template>
          </details>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board { display: flex; flex-direction: column; min-height: 0; }
.board-views { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.bv-hint { font-size: 11px; color: var(--gray-500); margin-left: auto; }
.term-cols { display: flex; gap: 14px; align-items: flex-start; }
.term-col { flex: 1 1 0; min-width: 0; }
.timetable-notes { margin-top: 8px; font-size: 11px; color: var(--gray-700); }
.timetable-notes p { margin: 6px 0; line-height: 1.45; }
.term-head {
  display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700;
  color: var(--blue); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid var(--gray-200);
}
.term-unpub { font-size: 11px; font-weight: 500; font-style: italic; color: #856404; }
.term-confl { font-size: 11px; font-weight: 600; color: var(--red); }
.alt-nav { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.alt-label { font-size: 11px; font-weight: 500; color: var(--gray-600); }
.alt-btn {
  width: 22px; height: 22px; line-height: 1; border: 1px solid var(--gray-300); border-radius: 5px;
  background: #fff; cursor: pointer; color: var(--gray-700); font-size: 14px;
}
.alt-btn:hover:not(:disabled) { border-color: var(--teal); color: var(--teal); }
.alt-btn:disabled { opacity: .4; cursor: default; }
@media (max-width: 640px) {
  .term-cols { flex-direction: column; align-items: stretch; }
  .term-col { width: 100%; }
}
</style>
