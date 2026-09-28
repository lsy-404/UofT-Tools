<script setup>
import { state, legality, programCounts, toggleProgram, toggleIntention } from '../store.js'
import { chipClass } from '../lib/courses.js'
import { programUrl } from '../lib/campuses.js'
const shortName = p => p.name.split(' - ')[0] || p.name
const chipTitle = p => p.intention ? 'Intention (planning)' : p.type + ' — ' + (p.code || '')
</script>

<template>
  <div class="prog-header">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2>Selected Programs</h2>
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

    <section aria-label="Program combination">
      <h3>Program combination</h3>
      <div class="summary">
        <div class="sum-block">
          <div>Specialist: {{ programCounts.specialist }} · Major: {{ programCounts.major }} · Minor: {{ programCounts.minor }}</div>
          <div v-for="message in legality.messages" :key="message" class="sum-warn">{{ message }}</div>
          <div>{{ legality.success }}</div>
        </div>
      </div>
    </section>

  </div>
</template>
