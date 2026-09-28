<script setup>
import { ref } from 'vue'
import {
  state, filteredSections, popupSection, selectSection, toggleProgram, closePopup,
} from '../store.js'
import { badgeClass } from '../lib/courses.js'
import SuggestionBar from './SuggestionBar.vue'

const sidebarEl = ref(null)

function onSelect(slug, event) {
  event.stopPropagation()
  const rect = event.currentTarget.getBoundingClientRect()
  const sbRect = sidebarEl.value?.getBoundingClientRect()
  const top = sbRect ? rect.top - sbRect.top : 0
  selectSection(slug, top)
}

const isSelected = (id) => state.selectedPrograms.some(p => p.id === id)
</script>

<template>
  <aside ref="sidebarEl" class="sidebar">
    <label class="program-search">Find a program
      <input v-model="state.sectionFilter" type="search" placeholder="Subject, program or code" aria-label="Find a program" @input="closePopup">
    </label>
    <div class="section-list">
      <button
        v-for="s in filteredSections"
        :key="s.slug"
        class="section-item"
        :class="{ active: s.slug === state.activeSectionSlug }"
        @click="onSelect(s.slug, $event)"
      >{{ s.name || s.slug.replace(/-/g, ' ') }}</button>
    </div>

    <SuggestionBar />

    <div class="sidebar-popup" :class="{ open: state.popupOpen }" :style="{ top: state.popupTop + 'px' }">
      <template v-if="!state.activeSectionSlug || !state.programs">
        <div class="prog-popup-empty">Select a subject first.</div>
      </template>
      <template v-else-if="!popupSection || !popupSection.programs.length">
        <div class="prog-popup-empty">No programs found.</div>
      </template>
      <template v-else>
        <div class="prog-popup-header">{{ popupSection.name }}</div>
        <div
          v-for="p in popupSection.programs"
          :key="p.id"
          class="prog-popup-item"
          :class="{ selected: isSelected(p.id) }"
          role="button"
          tabindex="0"
          @click="toggleProgram(p.id); closePopup()"
          @keydown.enter="toggleProgram(p.id); closePopup()"
        >
          <span>{{ p.name }} <span style="font-size:11px;color:var(--gray-600)">{{ p.code || '' }}</span></span>
          <span class="badge" :class="badgeClass(p.type)">{{ p.type }}</span>
        </div>
      </template>
    </div>
  </aside>
</template>
