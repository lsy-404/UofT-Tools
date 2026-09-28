<script setup>
import {
  state, pendingCourses, scopes, courseOfferings, scheduledCodes, scheduleWarnings, scopePublished, timetableSources,
  onScopeChange, isScheduledIn, toggleScheduledTerm, dayPref, cycleDayPref,
  toggleFriends, addFriend, removeFriend, renameFriend, addFriendCourse, removeFriendCourse,
} from '../store.js'
import CoursePicker from './CoursePicker.vue'
import HardConstraints from './HardConstraints.vue'
import { CAMPUSES } from '../lib/campuses.js'
import { campusName } from '../lib/scheduling.js'

const DAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' },
]
const WARN_TEXT = {
  conflict: (w) => `${w.code}: time conflict`,
  missing: (w) => `${w.code}: ${w.reason || `not offered in ${w.term}`}`,
  tba: (w) => `${w.code}: no meeting times posted yet (${w.term}, TBA)`,
  friend: (w) => `${w.code}: can't fit their own courses around the shared ones (${w.term})`,
}
const isAwayFromHome = offering => offering.campus && offering.campus !== CAMPUSES[state.campus].suffix
const offeringTitle = offering => {
  if (offering.tba) return 'Offered, but no meeting times posted yet (TBA)'
  if (offering.campus === '0') return 'Off-campus instruction; check the actual location and travel time'
  if (isAwayFromHome(offering)) return `${campusName(offering.code)} campus — commute buffer applies`
  return ''
}
</script>

<template>
  <aside class="sched-controls">
    <section class="sched-settings">
      <h3>Settings</h3>
      <label>Scheduling Range</label>
      <select v-model="state.scopeId" class="session-select" @change="onScopeChange">
        <option v-if="!scopes.length" value="">No sessions available</option>
        <option v-for="s in scopes" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <details>
        <summary>Timetable sources and snapshot dates</summary>
        <p>UTSG: Arts & Science only. Timetable Builder is not live ACORN registration. Verify enrolment restrictions and changes before enrolling.</p>
        <div v-for="term in timetableSources" :key="term.label">
          <b>{{ term.label }}</b>
          <div v-for="source in term.sources" :key="source.divisions?.join(',')">
            {{ source.divisions?.join(', ') || 'Legacy snapshot' }}: {{ source.courseCount }} offerings · {{ source.retrievedAt || 'date unrecorded' }}
          </div>
          <p v-if="term.unavailable.length">Data unavailable for {{ term.unavailable.join(', ') }}. Missing data does not mean no courses are offered.</p>
        </div>
        <a href="https://ttb.utoronto.ca/" target="_blank" rel="noopener">Official Timetable Builder</a>
      </details>

      <div class="pref-head">Preferences</div>

      <label>Schedule Density</label>
      <div class="pref-group">
        <button class="pref-btn" :class="{ active: state.prefs.density === 'any' }" @click="state.prefs.density = 'any'">Any</button>
        <button class="pref-btn" :class="{ active: state.prefs.density === 'compact' }" @click="state.prefs.density = 'compact'">Compact</button>
        <button class="pref-btn" :class="{ active: state.prefs.density === 'spread' }" @click="state.prefs.density = 'spread'">Spread out</button>
      </div>

      <label>Time of Day</label>
      <div class="pref-group">
        <button class="pref-btn" :class="{ active: state.prefs.time === 'any' }" @click="state.prefs.time = 'any'">Any</button>
        <button class="pref-btn" :class="{ active: state.prefs.time === 'morning' }" @click="state.prefs.time = 'morning'">Morning</button>
        <button class="pref-btn" :class="{ active: state.prefs.time === 'afternoon' }" @click="state.prefs.time = 'afternoon'">Afternoon</button>
      </div>

      <label>Days</label>
      <div class="day-row">
        <button
          v-for="day in DAYS"
          :key="day.d"
          type="button"
          class="day-btn"
          :class="dayPref(day.d)"
          :title="'Click to cycle: Any → prefer free → prefer classes'"
          @click="cycleDayPref(day.d)"
        >{{ day.label }}<span class="day-state">{{ dayPref(day.d) === 'free' ? 'free' : dayPref(day.d) === 'busy' ? 'class' : 'Any' }}</span></button>
      </div>

      <label>Cross-campus Commute</label>
      <label class="zz-check">
        <input type="checkbox" v-model="state.prefs.commute.enabled"> Keep a buffer between classes on different campuses
      </label>
      <div class="pref-group" v-if="state.prefs.commute.enabled">
        <button
          v-for="h in [0, 1, 2]"
          :key="h"
          type="button"
          class="pref-btn"
          :class="{ active: state.prefs.commute.hours === h }"
          @click="state.prefs.commute.hours = h"
        >{{ h }} h</button>
      </div>

      <label>Exam-reserved (ZZ) Blocks</label>
      <div class="zz-opts">
        <label class="zz-check">
          <input type="checkbox" v-model="state.prefs.zzOverlap"> Allow ZZ blocks to overlap each other
        </label>
        <label class="zz-check">
          <input type="checkbox" v-model="state.prefs.zzWithReg"> Allow ZZ blocks to overlap regular classes
        </label>
      </div>

      <div v-if="state.schedNotice" class="sched-notice">{{ state.schedNotice }}</div>
    </section>

    <section v-if="scheduleWarnings.length" class="sched-warnings">
      <h3>Warnings</h3>
      <ul>
        <li v-for="(w, i) in scheduleWarnings" :key="i" class="warn-item" :class="w.type">{{ WARN_TEXT[w.type](w) }}</li>
      </ul>
    </section>

    <section class="sched-left">
      <h3>Courses</h3>
      <label>Courses to Schedule</label>
      <div class="course-picks">
        <div v-if="!pendingCourses.length" class="sched-empty">
          No planned or current courses yet. Mark courses as &ldquo;Plan&rdquo; or &ldquo;Taking&rdquo; in the Program Planner tab to schedule them.
        </div>
        <div
          v-for="c in pendingCourses"
          :key="c.code"
          class="course-pick"
          :class="{ selected: scheduledCodes.includes(c.code) }"
        >
          <span class="course-code">{{ c.code }}</span>
          <span class="seg-pills">
            <button
              v-for="t in (courseOfferings[c.code] || [])"
              :key="(t.code || c.code) + t.value"
              type="button"
              class="seg-pill"
              :class="{ active: isScheduledIn(t.code || c.code, t.value), full: /Full|Year/.test(t.label), tba: t.tba, offcampus: isAwayFromHome(t) }"
              :disabled="t.tba"
              :title="offeringTitle(t)"
              @click="toggleScheduledTerm(t.code || c.code, t.value)"
            >{{ t.label }}{{ t.tba ? ' TBA' : '' }}</button>
            <span v-if="!(courseOfferings[c.code] || []).length" class="avail-none">{{ scopePublished ? 'Not offered in this range' : 'Timetable not published yet' }}</span>
          </span>
        </div>
      </div>

      <HardConstraints />

      <label class="friend-toggle">
        <input type="checkbox" :checked="state.friends.enabled" @change="toggleFriends($event.target.checked)">
        Schedule with friends
      </label>
      <template v-if="state.friends.enabled">
        <p class="friend-hint">
          Add each friend&rsquo;s full course list. Courses you both take are placed in the
          same lecture &amp; lab; their other courses just need to still fit around them.
        </p>
        <div v-for="f in state.friends.list" :key="f.id" class="friend-block">
          <div class="friend-head">
            <input
              class="friend-name"
              :value="f.name"
              @change="renameFriend(f.id, $event.target.value)"
            >
            <button type="button" class="friend-remove" title="Remove this friend" @click="removeFriend(f.id)">×</button>
          </div>
          <CoursePicker
            label=""
            placeholder="Search a course to add…"
            :items="f.courses"
            :add="(code) => addFriendCourse(f.id, code)"
            :remove="(code) => removeFriendCourse(f.id, code)"
          />
        </div>
        <button type="button" class="friend-add" @click="addFriend()">+ Add another friend</button>
      </template>
    </section>
  </aside>
</template>

<style scoped>
.seg-pills { display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.seg-pill {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--gray-300); background: #fff; color: var(--gray-600); white-space: nowrap; transition: .1s;
}
.seg-pill:hover { border-color: var(--teal); color: var(--teal); }
.seg-pill.active { background: var(--teal); border-color: var(--teal); color: #fff; }
.seg-pill.full.active { background: #92400e; border-color: #92400e; }
.seg-pill.offcampus { border-color: #c084fc; color: #7c3aed; border-style: dashed; }
.seg-pill.offcampus:hover { border-color: #7c3aed; color: #7c3aed; }
.seg-pill.offcampus.active { background: #7c3aed; border-color: #7c3aed; color: #fff; border-style: solid; }
.seg-pill.tba { background: #f3f4f6; border-color: var(--gray-200); color: #9ca3af; cursor: not-allowed; }
.seg-pill.tba:hover { border-color: var(--gray-200); color: #9ca3af; }
.avail-none { font-size: 10px; color: var(--gray-400); }
.pref-head {
  margin: 14px 0 4px; font-size: 12px; font-weight: 700; color: var(--gray-700);
  border-top: 1px solid var(--gray-200); padding-top: 10px;
}
.pref-head span { font-weight: 400; font-size: 11px; color: var(--gray-500); }
.day-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 6px; }
.day-btn {
  display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 0;
  border: 1px solid var(--gray-200); border-radius: 6px; background: #fff; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--gray-700); transition: .1s;
}
.day-btn .day-state { font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--gray-400); }
.day-btn.free { background: #fff5f5; border-color: #f5b5b5; color: #b91c1c; }
.day-btn.free .day-state { color: #b91c1c; }
.day-btn.busy { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.day-btn.busy .day-state { color: #15803d; }
.friend-toggle {
  display: flex !important; align-items: center; gap: 6px; flex-direction: row !important;
  text-transform: none !important; letter-spacing: 0 !important; font-size: 13px !important;
  color: var(--gray-800) !important; margin-top: 14px;
}
.friend-hint { font-size: 11px; color: var(--gray-600); line-height: 1.5; margin: 4px 0; }
.friend-block { border: 1px solid var(--gray-200); border-radius: 8px; padding: 8px; margin: 6px 0; }
.friend-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.friend-name {
  flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--gray-800);
  border: 1px solid transparent; border-radius: 5px; padding: 3px 6px; background: transparent;
}
.friend-name:hover, .friend-name:focus { border-color: var(--gray-300); background: #fff; outline: none; }
.friend-remove {
  width: 22px; height: 22px; line-height: 1; border: 1px solid var(--gray-300); border-radius: 5px;
  background: #fff; cursor: pointer; color: var(--gray-600); font-size: 14px;
}
.friend-remove:hover { border-color: var(--red); color: var(--red); }
.friend-add {
  margin-top: 4px; padding: 4px 10px; border: 1px dashed var(--gray-300); border-radius: 6px;
  background: #fff; cursor: pointer; font-size: 12px; color: var(--gray-600);
}
.friend-add:hover { border-color: var(--teal); color: var(--teal); }
.zz-opts { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.zz-check {
  display: flex !important; align-items: flex-start; gap: 6px; flex-direction: row !important;
  text-transform: none !important; letter-spacing: 0 !important; font-weight: 400 !important;
  font-size: 12px !important; color: var(--gray-700) !important; margin: 0 !important; line-height: 1.4;
}
.zz-check input { margin-top: 1px; cursor: pointer; }
.sched-warnings { padding: 14px; border-bottom: 1px solid var(--gray-200); background: #fffbeb; }
.sched-warnings h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #92400e; }
.sched-warnings ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.warn-item { font-size: 12px; line-height: 1.4; color: #92400e; padding-left: 16px; position: relative; }
.warn-item::before { content: '⚠'; position: absolute; left: 0; }
.warn-item.conflict { color: var(--red); }
</style>
