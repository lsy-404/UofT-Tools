<script setup>
import { ref, reactive, onMounted } from 'vue'

const FALLBACK_BASE = 'https://uoft.leisiyu.dev/calendar/'

// Build webcal/https URLs from the current origin so the page works on any host
// (GitHub Pages, Cloudflare, custom domain, localhost, etc.).
function resolveBase() {
  try {
    const base = window.location.origin + '/calendar/'
    if (!/^https?:\/\//.test(base)) return FALLBACK_BASE
    return base
  } catch (e) {
    return FALLBACK_BASE
  }
}

const base = ref(FALLBACK_BASE)
onMounted(() => { base.value = resolveBase() })

const campuses = [
  {
    key: 'artsci',
    name: 'Faculty of Arts & Science (St. George)',
    tag: 'UTSG',
    file: 'artsci.ics',
    filteredFile: 'artsci-filtered.ics',
    downloadName: 'artsci_important_dates.ics',
    official: 'https://www.artsci.utoronto.ca/current/dates-deadlines/academic-dates',
  },
  {
    key: 'utm',
    name: 'University of Toronto Mississauga',
    tag: 'UTM',
    file: 'utm.ics',
    filteredFile: 'utm-filtered.ics',
    downloadName: 'utm_important_dates.ics',
    official: 'https://www.utm.utoronto.ca/registrar/dates',
  },
  {
    key: 'utsc',
    name: 'University of Toronto Scarborough',
    tag: 'UTSC',
    file: 'utsc.ics',
    filteredFile: 'utsc-filtered.ics',
    downloadName: 'utsc_important_dates.ics',
    official: 'https://www.utsc.utoronto.ca/registrar/academic-dates',
  },
]

const webcal = (file) => (base.value + file).replace(/^https?:\/\//, 'webcal://')
const gcal = (file) => 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal(file))

const toasts = reactive({})
let timer = null
function copyUrl(text, toastId) {
  const done = () => {
    toasts[toastId] = true
    clearTimeout(timer)
    timer = setTimeout(() => { toasts[toastId] = false }, 2000)
  }
  navigator.clipboard?.writeText(text).then(done).catch(done)
}
</script>

<template>
  <div class="container">
    <h1 class="page-title">U of T Important Dates</h1>
    <p class="page-sub">University of Toronto &mdash; Academic Calendar Feeds</p>

    <!-- Per-campus subscribe + download -->
    <div v-for="c in campuses" :key="c.key" class="campus-section">
      <div class="campus-header">
        <h2>{{ c.name }}</h2><span class="campus-tag">{{ c.tag }}</span>
      </div>
      <div class="cards-row">
        <div class="card">
          <h3>&#128225; Subscribe (auto-updates daily)</h3>
          <p>Webcal feed &mdash; updates automatically.</p>
          <div class="actions">
            <a class="btn btn-primary" :href="webcal(c.file)">Add to Calendar</a>
            <a class="btn btn-outline" :href="gcal(c.file)" target="_blank" rel="noopener noreferrer">+ Google Calendar</a>
          </div>
          <div class="url-row">
            <span class="url-box">{{ webcal(c.file) }}</span>
            <button class="btn btn-copy" @click="copyUrl(webcal(c.file), c.key)">Copy</button>
            <span class="toast" :style="{ display: toasts[c.key] ? 'inline' : 'none' }">Copied!</span>
          </div>
        </div>
        <div class="card">
          <h3>&#8659; Download Snapshot</h3>
          <p>Import once. Won&rsquo;t auto-update.</p>
          <div class="actions">
            <a class="btn btn-primary" :href="'/calendar/' + c.file" :download="c.downloadName">Download {{ c.file }}</a>
            <a class="btn btn-outline" :href="c.official" target="_blank" rel="noopener noreferrer">Official Page &#8599;</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Experimental: Program-Filtered Feeds -->
    <div class="exp-section">
      <div class="exp-header">
        <span class="exp-badge">Experimental</span>
        <h2 class="exp-title">Program-Filtered Feeds</h2>
      </div>
      <div class="exp-notice">
        <p>For students <strong>already enrolled in a declared program, major, specialist, or minor</strong>. Hides program-selection events such as limited-enrolment program application rounds, program selection periods, and invitation deadlines &mdash; dates that are no longer relevant once you are in your program.</p>
        <p><strong>&#9888; Keyword-based filtering &mdash; false positives are possible.</strong> Some legitimate events may be removed; some program-selection events may remain. Always verify important dates on your campus registrar website.</p>
      </div>

      <div v-for="c in campuses" :key="'f-' + c.key" class="exp-campus">
        <p class="exp-campus-label">{{ c.name }} <span class="campus-tag">{{ c.tag }}</span></p>
        <div class="url-row">
          <span class="url-box">{{ webcal(c.filteredFile) }}</span>
          <button class="btn btn-copy" @click="copyUrl(webcal(c.filteredFile), c.key + 'Filtered')">Copy</button>
          <span class="toast" :style="{ display: toasts[c.key + 'Filtered'] ? 'inline' : 'none' }">Copied!</span>
        </div>
        <div class="actions" style="margin-top:.6rem">
          <a class="btn btn-primary" :href="webcal(c.filteredFile)">Add to Calendar</a>
          <a class="btn btn-outline" :href="gcal(c.filteredFile)" target="_blank" rel="noopener noreferrer">+ Google Calendar</a>
        </div>
      </div>
    </div>

    <!-- How it works -->
    <div class="card" style="margin-top:.5rem">
      <h3>&#9432; How it works</h3>
      <ul>
        <li>A GitHub Actions job runs once per day.</li>
        <li><strong>UTM</strong> &mdash; headless browser renders the Elfsight widget on the UTM registrar page.</li>
        <li><strong>UTSC</strong> &mdash; static HTML tables on the UTSC registrar sub-pages are fetched directly.</li>
        <li><strong>ArtsCI</strong> &mdash; headless browser expands the accordion panels on the ArtsCI dates page.</li>
        <li>All events are converted to all-day ICS entries and committed to this repository.</li>
        <li>Calendar apps that support webcal/CalDAV poll the URL and pull in any changes.</li>
      </ul>
    </div>

    <p class="sources">
      Sources:
      <a href="https://www.utm.utoronto.ca/registrar/dates" target="_blank" rel="noopener noreferrer">UTM</a> &bull;
      <a href="https://www.utsc.utoronto.ca/registrar/academic-dates" target="_blank" rel="noopener noreferrer">UTSC</a> &bull;
      <a href="https://www.artsci.utoronto.ca/current/dates-deadlines/academic-dates" target="_blank" rel="noopener noreferrer">ArtsCI</a>
    </p>
  </div>
</template>

<style scoped>
.container { max-width: 780px; width: 100%; margin: 2.25rem auto; padding: 0 1.25rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--blue); }
.page-sub { font-size: .85rem; color: var(--muted); margin: .2rem 0 1.75rem; }

.campus-section { margin-bottom: 2.5rem; }
.campus-header {
  display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem;
  padding-bottom: .6rem; border-bottom: 2px solid var(--blue);
}
.campus-header h2 { font-size: 1.1rem; font-weight: 700; color: var(--blue); }
.campus-tag {
  font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  padding: .2em .6em; border-radius: 4px; background: var(--blue); color: #fff;
}
.card {
  background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.25rem 1.5rem; margin-bottom: 1rem;
}
.card h3 {
  font-size: .95rem; font-weight: 600; color: var(--blue); margin-bottom: .65rem;
  display: flex; align-items: center; gap: .5rem;
}
.card p, .card li { font-size: .88rem; color: var(--muted); line-height: 1.6; }
.card ul { padding-left: 1.2rem; margin-top: .4rem; }
.card ul li { margin-bottom: .25rem; }
.cards-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 580px) { .cards-row { grid-template-columns: 1fr; } }
.actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .75rem; }
.btn {
  display: inline-flex; align-items: center; gap: .4rem; padding: .5rem 1rem;
  border-radius: 6px; font-size: .85rem; font-weight: 600; text-decoration: none;
  cursor: pointer; transition: opacity .15s; border: none;
}
.btn:hover { opacity: .85; }
.btn-primary { background: var(--blue); color: #fff; }
.btn-outline { background: transparent; color: var(--blue); border: 1.5px solid var(--blue); }
.btn-copy { background: var(--grey); color: var(--blue); }
.url-row { display: flex; align-items: center; gap: .5rem; margin-top: .65rem; flex-wrap: wrap; }
.url-box {
  flex: 1; min-width: 0; font-family: "SF Mono", "Fira Code", Consolas, monospace;
  font-size: .78rem; background: var(--light); border: 1px solid var(--border);
  border-radius: 6px; padding: .4rem .65rem; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: all;
}
.toast { font-size: .8rem; color: green; font-weight: 600; }

.exp-section {
  border: 1.5px dashed #c99a00; border-radius: var(--radius);
  padding: 1.25rem 1.5rem; margin-top: 2rem; background: #fffdf0;
}
.exp-header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1rem; }
.exp-badge {
  font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  padding: .2em .65em; border-radius: 4px; background: #e8b400; color: #3d2e00;
  white-space: nowrap;
}
.exp-title { font-size: 1rem; font-weight: 700; color: var(--blue); margin: 0; }
.exp-notice {
  font-size: .83rem; color: #5a4500; line-height: 1.65;
  background: #fff8dc; border: 1px solid #e8c700;
  border-radius: var(--radius); padding: .75rem 1rem; margin-bottom: 1.25rem;
}
.exp-notice p + p { margin-top: .45rem; }
.exp-campus { padding: .9rem 0; border-top: 1px solid #f0d880; }
.exp-campus-label {
  font-size: .85rem; font-weight: 700; color: var(--blue);
  margin-bottom: .6rem; display: flex; align-items: center; gap: .5rem;
}
.sources { text-align: center; font-size: .78rem; color: var(--muted); margin-top: 1.5rem; }
.sources a { color: var(--blue); text-decoration: none; }
.sources a:hover { text-decoration: underline; }
</style>
