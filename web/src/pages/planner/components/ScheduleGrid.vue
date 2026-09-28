<script setup>
import { computed, ref } from 'vue'
import { buildGrid, DAY_LABELS, HOUR_PX, msToLabel } from '../lib/scheduling.js'

const props = defineProps({
  results: { type: Array, default: () => [] },
})

const DAYS = [1, 2, 3, 4, 5, 6]
const grid = computed(() => buildGrid(props.results))

const hasTimes = (r) => (r.sections || []).some(s => (s.times || []).some(t => t.day >= 1 && t.day <= 6 && t.endMs > t.startMs))
const tbaItems = computed(() => props.results.filter(r => !r.missing && !hasTimes(r)))

// Custom hover card (native title tooltips are slow and clipped by the
// blocks' overflow:hidden, so equivalents were effectively unreachable).
const wrapEl = ref(null)
const tip = ref(null)
const showTip = (b, e) => {
  const wr = wrapEl.value.getBoundingClientRect()
  const br = e.currentTarget.getBoundingClientRect()
  const below = br.top - wr.top < 90
  tip.value = {
    b,
    x: br.left - wr.left + br.width / 2,
    y: below ? br.bottom - wr.top + 6 : br.top - wr.top - 6,
    below,
  }
}
const hideTip = () => { tip.value = null }
const instNames = (b) => (b.instructors || []).map(i => `${i.firstName} ${i.lastName}`.trim()).join(', ')
const recurrenceLabel = (b) => b.repetition === 'BI_WEEKLY' ? 'Every other week' : ''
</script>

<template>
  <div class="grid-wrap" ref="wrapEl">
    <div v-if="!results.length" class="no-data">No courses scheduled for this term.</div>

    <template v-else>
      <div class="grid-header">
        <div></div>
        <div v-for="d in DAYS" :key="d" class="grid-day-label">{{ DAY_LABELS[d] }}</div>
      </div>
      <div class="grid-body">
        <div class="time-col" :style="{ height: grid.colHeight + 'px' }">
          <div v-for="h in grid.hours" :key="h" class="time-slot" :style="{ height: HOUR_PX + 'px' }">{{ msToLabel(h) }}</div>
        </div>
        <div v-for="d in DAYS" :key="d" class="day-col" :style="{ height: grid.colHeight + 'px' }">
          <div class="day-col-bg">
            <div v-for="(h, i) in grid.hours" :key="i" class="hour-block"><div class="half-block"></div></div>
          </div>
          <div
            v-for="(b, i) in grid.dayBlocks[d]"
            :key="i"
            class="course-block"
            :class="{ conflict: b.conflict, shared: b.shared }"
            :style="{ top: b.top + 'px', height: b.height + 'px', left: 'calc(' + (b.left || 0) + '% + 2px)', width: 'calc(' + (b.widthPct || 100) + '% - 4px)', background: b.color, color: '#fff' }"
            @mouseenter="showTip(b, $event)"
            @mouseleave="hideTip"
          >
            <div class="cb-code">{{ b.code }}<span v-if="b.shared" class="cb-shared">★</span><span v-if="b.full" class="cb-full" title="Full-session course — runs in both terms">Y</span><span v-if="b.campus && b.campus !== '5'" class="cb-campus" :title="b.campus === '0' ? 'Off-campus location; check travel time' : b.campusName + ' campus'">{{ b.campusName }}</span></div>
            <div class="cb-room">{{ b.sec }}<span v-if="b.equivalents?.length"> (+{{ b.equivalents.length }})</span> {{ b.room }}<span v-if="recurrenceLabel(b)"> · {{ recurrenceLabel(b) }}</span><span v-if="b.instructors?.length"> — {{ b.instructors.map(i => i.lastName).join(', ') }}</span></div>
          </div>
        </div>
      </div>
    </template>

    <div
      v-if="tip"
      class="grid-tip"
      :class="{ below: tip.below }"
      :style="{ left: tip.x + 'px', top: tip.y + 'px' }"
    >
      <div class="gt-head">{{ tip.b.code }} {{ tip.b.sec }}<span v-if="tip.b.equivalents?.length" class="gt-eqn"> +{{ tip.b.equivalents.length }}</span></div>
      <div class="gt-line">{{ tip.b.startLabel }}–{{ tip.b.endLabel }}<template v-if="tip.b.room"> · {{ tip.b.room }}</template></div>
      <div v-if="recurrenceLabel(tip.b)" class="gt-line">Every other week · confirm the starting week in timetable notes</div>
      <div v-if="instNames(tip.b)" class="gt-line">{{ instNames(tip.b) }}</div>
      <div v-if="tip.b.shared" class="gt-line">★ Shared with {{ (tip.b.sharedWith || []).join(', ') || 'friend' }}</div>
      <div v-if="tip.b.full" class="gt-line">Full-session — runs both terms</div>
      <div v-if="tip.b.campus === '0'" class="gt-line">Off-campus location — confirm the actual location and travel time</div>
      <div v-else-if="tip.b.campus && tip.b.campus !== '5'" class="gt-line">{{ tip.b.campusName }} campus — commute buffer applies</div>
      <div v-if="tip.b.equivalents?.length" class="gt-eq">Same time: {{ tip.b.equivalents.join(', ') }}</div>
    </div>

    <div v-if="tbaItems.length" class="tba-section">
      <div class="tba-head">TBA — no meeting times posted</div>
      <div v-for="item in tbaItems" :key="item.code" class="tba-row">
        <span class="tba-code">{{ item.code }}</span>
        <span v-for="(sec, si) in item.sections" :key="si" class="tba-sec">{{ sec.name || sec.type }} {{ sec.room }}<span v-if="sec.instructors?.length"> — {{ sec.instructors.map(i => i.lastName).join(', ') }}</span></span>
      </div>
    </div>
  </div>
</template>
