<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import './planner.css'
import { state, courseList, switchCampus, campusConfig, init, syncScheduledCourses, closePopup, maybeShowTtbWarning } from './store.js'
import ProgramSidebar from './components/ProgramSidebar.vue'
import ProgramSelector from './components/ProgramSelector.vue'
import CourseListView from './components/CourseListView.vue'
import RequirementsView from './components/RequirementsView.vue'
import ScheduleBuilder from './components/ScheduleBuilder.vue'
import ScheduleBoard from './components/ScheduleBoard.vue'
import TtbWarningModal from './components/TtbWarningModal.vue'

import { CAMPUSES, OTHER_FACULTIES } from './lib/campuses.js'

const sidebarOpen = ref(false)

function switchTab(tab) {
  state.activeTab = tab
  if (tab === 'schedule') {
    syncScheduledCourses()
    maybeShowTtbWarning()
  }
  sidebarOpen.value = false
}

// Close the program popup when clicking outside the sidebar.
function onDocClick(e) {
  if (!e.target.closest('.sidebar')) closePopup()
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (!state.programs) init()
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="planner-scope">
    <section class="campus-banner" aria-label="Campus and data coverage">
      <label for="home-campus">Home campus / faculty</label>
      <select id="home-campus" :value="state.campus" :disabled="state.loading" @change="switchCampus($event.target.value)">
        <option v-for="(config, key) in CAMPUSES" :key="key" :value="key">{{ config.name }} — {{ config.faculty }}</option>
      </select>
      <span v-if="state.loading" role="status">Loading…</span>
      <p v-if="state.loadError" role="alert">{{ state.loadError }} <button @click="init">Retry</button></p>
      <details>
        <summary>Supported scope, data year and official sources</summary>
        <p>{{ campusConfig.faculty }}. {{ state.programs?.coverage || 'Existing UTM program catalog retained.' }}</p>
        <p v-if="state.programs?.inventory">{{ state.programs.inventory.programCount }} program / certificate entries across {{ state.programs.inventory.programPages.length }} official search pages; {{ state.programs.inventory.courseCount }} calendar courses. <a :href="state.programs.source" target="_blank" rel="noopener">Verify the official directory</a></p>
        <p>Catalog year: {{ state.programs?.calendarYear || 'legacy UTM snapshot; year not recorded by original importer' }}. Retrieved: {{ state.programs?.retrievedAt || 'not recorded' }}. Rules checked 2026-09-27 against 2026–2027 calendars. Use the calendar for your admission and program-entry year.</p>
        <a :href="campusConfig.calendar" target="_blank" rel="noopener">Official academic calendar</a>
        <p>Schedules use public Timetable Builder snapshots for UTM (ERIN), UTSC (SCAR) and UTSG Arts & Science (ARTSC). Course availability, enrolment eligibility and room changes must be confirmed in ACORN. Other faculties are not covered by the schedule snapshots or degree checks.</p>
        <p>UTSG faculties with separate rules, currently unsupported:</p>
        <ul><li v-for="[name, url] in OTHER_FACULTIES" :key="url"><a :href="url" target="_blank" rel="noopener">{{ name }}</a></li></ul>
        <p>Cross-campus courses may be planned and scheduled; requirement recognition remains pending manual verification unless explicitly verified. Each home campus has its own saved plan.</p>
      </details>
    </section>
    <div class="tabs">
      <button class="tab-btn" :class="{ active: state.activeTab === 'planner' }" @click="switchTab('planner')">Program Planner</button>
      <button class="tab-btn" :class="{ active: state.activeTab === 'schedule' }" @click="switchTab('schedule')">Schedule Builder</button>
    </div>

    <!-- Program Planner -->
    <div class="tab-panel" :class="{ active: state.activeTab === 'planner' }">
      <div class="mob-bar">
        <button class="mob-sidebar-btn" @click="sidebarOpen = !sidebarOpen">☰ Programs</button>
      </div>
      <div v-if="sidebarOpen" class="mob-backdrop" @click="sidebarOpen = false" />
      <ProgramSidebar :class="{ 'mob-open': sidebarOpen }" />

      <div class="main">
        <ProgramSelector />

        <div v-if="state.selectedPrograms.length || courseList.length" class="view-toggle">
          <button class="view-btn" :class="{ active: state.viewMode === 'list' }" @click="state.viewMode = 'list'">Course List</button>
          <button class="view-btn" :class="{ active: state.viewMode === 'requirements' }" @click="state.viewMode = 'requirements'">Program Requirements</button>
        </div>

        <div class="course-area">
          <div v-if="!state.selectedPrograms.length && !courseList.length" class="empty-state">
            <div style="font-size:36px">📚</div>
            <p>Select a subject from the left, then add a program — or add individual courses below.</p>
          </div>
          <template v-else>
            <CourseListView v-if="state.viewMode === 'list'" />
            <RequirementsView v-else />
          </template>
        </div>
      </div>
    </div>

    <!-- Schedule Builder -->
    <div id="schedule-panel" class="tab-panel" :class="{ active: state.activeTab === 'schedule' }">
      <ScheduleBuilder />
      <div class="grid-area">
        <ScheduleBoard />
      </div>
    </div>

    <TtbWarningModal v-if="state.ttbWarningOpen" />
  </div>
</template>

<style scoped>
.campus-banner { padding: 16px; background: var(--gray-50, #f5f7fa); border-bottom: 1px solid #ddd; }
.campus-banner select { margin: 0 12px; max-width: 100%; padding: 6px; }
.campus-banner details { margin-top: 10px; font-size: 13px; }
</style>
