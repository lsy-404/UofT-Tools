<script setup>
const tools = [
  {
    to: '/calendar',
    tag: 'Live',
    tagClass: 'tag-live',
    icon: '\u{1F4C5}',
    title: 'Academic Calendar Feeds',
    desc: 'Subscribe to UTM, UTSC, and ArtsCI important academic dates as a webcal feed. Auto-updated daily via GitHub Actions.',
    pills: ['UTSG', 'UTM', 'UTSC'],
  },
  {
    to: '/planner',
    tag: 'Live',
    tagClass: 'tag-live',
    icon: '\u{1F4CB}',
    title: 'UofT Course Planner',
    desc: 'Plan courses and schedules at UTM, UTSC and UTSG Arts & Science. Check supported programs, official requirements and campus-specific degree progress.',
    pills: ['UTM', 'UTSC', 'UTSG Arts & Science'],
  },
  {
    to: null,
    tag: 'Coming Soon',
    tagClass: 'tag-soon',
    icon: '\u{1F50E}',
    title: 'More Tools',
    desc: 'Additional tools for UofT students are in the works. Check back later.',
    pills: ['TBD'],
  },
]
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1>Student Tools for University of Toronto</h1>
      <p>Unofficial utilities built by a student to make campus life a little easier.</p>
    </section>

    <div class="container">
      <p class="section-label">Available Tools</p>
      <div class="tool-grid">
        <template v-for="tool in tools" :key="tool.title">
          <router-link v-if="tool.to" class="tool-card" :to="tool.to">
            <span class="card-tag" :class="tool.tagClass">{{ tool.tag }}</span>
            <div class="icon">{{ tool.icon }}</div>
            <h2>{{ tool.title }}</h2>
            <p>{{ tool.desc }}</p>
            <div class="card-meta">
              <span v-for="pill in tool.pills" :key="pill" class="pill">{{ pill }}</span>
            </div>
            <span class="arrow">&#8594;</span>
          </router-link>
          <div v-else class="tool-card coming-soon">
            <span class="card-tag" :class="tool.tagClass">{{ tool.tag }}</span>
            <div class="icon">{{ tool.icon }}</div>
            <h2>{{ tool.title }}</h2>
            <p>{{ tool.desc }}</p>
            <div class="card-meta">
              <span v-for="pill in tool.pills" :key="pill" class="pill">{{ pill }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home { display: flex; flex-direction: column; }
.hero {
  background: var(--blue);
  color: #fff;
  padding: 2.75rem 1.5rem 2.25rem;
  text-align: center;
}
.hero h1 {
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: .65rem;
}
.hero p {
  font-size: 1rem;
  opacity: .75;
  max-width: 540px;
  margin: 0 auto;
  line-height: 1.6;
}
.container {
  max-width: 900px;
  width: 100%;
  margin: 2.25rem auto;
  padding: 0 1.25rem;
}
.section-label {
  font-size: .7rem; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 1.25rem;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}
.tool-card {
  background: #fff; border: 1px solid var(--border); border-radius: 12px;
  padding: 1.5rem; text-decoration: none; color: inherit;
  display: flex; flex-direction: column; gap: .75rem;
  transition: box-shadow .15s, transform .15s; position: relative; overflow: hidden;
}
a.tool-card:hover { box-shadow: 0 4px 20px rgba(0, 42, 92, .1); transform: translateY(-2px); }
.tool-card.coming-soon { opacity: .6; cursor: default; pointer-events: none; }
.tool-card .icon { font-size: 2rem; line-height: 1; }
.tool-card .card-tag {
  position: absolute; top: 1rem; right: 1rem;
  font-size: .65rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  padding: .2em .55em; border-radius: 4px;
}
.tag-live { background: #d4edda; color: #1a5c30; }
.tag-soon { background: var(--grey); color: var(--muted); }
.tool-card h2 { font-size: 1rem; font-weight: 700; color: var(--blue); margin: 0; }
.tool-card p { font-size: .85rem; color: var(--muted); line-height: 1.55; margin: 0; }
.tool-card .card-meta {
  font-size: .75rem; color: var(--muted); display: flex; align-items: center; gap: .4rem;
  margin-top: auto; padding-top: .5rem; border-top: 1px solid var(--border);
}
.tool-card .card-meta .pill {
  background: var(--light); border: 1px solid var(--border);
  border-radius: 4px; padding: .15em .5em; font-size: .7rem;
}
.tool-card .arrow {
  position: absolute; bottom: 1.25rem; right: 1.25rem;
  font-size: .9rem; color: var(--blue); opacity: .5;
  transition: opacity .15s, transform .15s;
}
a.tool-card:hover .arrow { opacity: 1; transform: translateX(3px); }
</style>
