<script setup>
// Each answer is trusted, author-authored HTML rendered with v-html.
const sections = [
  {
    title: 'About the Project',
    items: [
      {
        q: 'What is UofT Tools?',
        a: `<p>UofT Tools is an unofficial, open-source suite of utilities built by a student to make everyday campus life at the University of Toronto a little easier. The first tool is an automatically-updated academic calendar feed for all three UofT campuses (UTSG, UTM, UTSC). More tools are planned.</p>`,
      },
      {
        q: 'Is this an official University of Toronto product?',
        a: `<p>No. This project is <strong>not affiliated with, endorsed by, or supported by the University of Toronto</strong> in any way. It is an independent student side-project. Always verify important dates and deadlines on your campus&rsquo;s official registrar website.</p>`,
      },
      {
        q: 'Who built this and why?',
        a: `<p>Built by a UofT student. The original motivation was accessibility: important academic dates are buried across multiple registrar pages with no machine-readable export, making them hard to track — especially for students who rely on calendar reminders for time management and planning. The source code is fully open on <a href="https://github.com/lsy-404/UofT-Tools" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>`,
      },
      {
        q: 'Is this an accessibility tool?',
        a: `<p>Yes, by design. Delivering academic dates as a standard calendar feed means students can receive system notifications, use screen readers, integrate with assistive scheduling software, and generally manage their time in whatever way works best for them — without having to manually visit and parse university web pages. Accessibility is a core design goal, not an afterthought.</p>`,
      },
    ],
  },
  {
    title: 'Using the Tools',
    items: [
      {
        q: 'How do I subscribe to the academic calendar feeds?',
        a: `<p>Go to the <a href="/calendar">Calendar Feeds</a> page, pick your campus, and click <strong>Add to Calendar</strong>. The webcal link works with Google Calendar, Apple Calendar, Outlook, and most other apps. Your calendar will auto-update daily without any action on your part.</p>`,
      },
      {
        q: 'How often are the calendars updated?',
        a: `<p>Once every 24 hours via a scheduled GitHub Actions job. The scraper fetches the latest data from each campus registrar page, regenerates the ICS files, and commits them to the repository. Cloudflare serves the updated files immediately after.</p>`,
      },
      {
        q: 'What if a date in the calendar is wrong?',
        a: `<p>The dates are scraped directly from official registrar pages — if the registrar page is correct, the calendar should be too. If you spot a discrepancy, please <a href="https://github.com/lsy-404/UofT-Tools/issues" target="_blank" rel="noopener noreferrer">open an issue on GitHub</a> with a link to the official source. In the meantime, always trust the official page over this tool.</p>`,
      },
    ],
  },
  {
    title: 'Domain & Hosting',
    items: [
      {
        q: 'Why is the site on a personal domain?',
        a: `<p>The project is currently hosted under my personal domain (<code>uoft.voidcarve.com</code>) because I haven&rsquo;t yet found a more appropriate home for it. Ideally, a project like this would live under a student-organisation or community domain that better reflects its purpose.</p>
        <div class="callout">
          <strong>&#128233; Looking for a collaboration.</strong> If you represent a UofT student organisation, CS club, or student society that has a suitable domain and would be open to hosting or co-maintaining this project, I&rsquo;d love to hear from you. Please reach out via <a href="https://github.com/lsy-404/UofT-Tools/issues" target="_blank" rel="noopener noreferrer">GitHub</a> or email at <a href="mailto:sy.lei@mail.utoronto.ca">sy.lei@mail.utoronto.ca</a>.
        </div>`,
      },
      {
        q: 'Is the project free to use?',
        a: `<p>There are no accounts or fees to use this hosted site. The project&rsquo;s original source code is licensed under the <a href="https://github.com/lsy-404/UofT-Tools/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>, which permits commercial use under its terms. University academic information and planning suggestions are provided for personal reference and are separate from the project source code license.</p>`,
      },
    ],
  },
  {
    title: 'Contributing & Feedback',
    items: [
      {
        q: 'How do I report a bug or request a feature?',
        a: `<p>Open an issue on the <a href="https://github.com/lsy-404/UofT-Tools/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a> page. Please include as much detail as possible — what you expected to happen, what actually happened, and a link to any relevant official source if the issue is about incorrect dates.</p>`,
      },
      {
        q: 'Can I contribute code?',
        a: `<p>Absolutely. Pull requests are welcome. The repository is at <a href="https://github.com/lsy-404/UofT-Tools" target="_blank" rel="noopener noreferrer">github.com/lsy-404/UofT-Tools</a>. Whether it&rsquo;s fixing a scraper, improving the UI, or adding a brand-new tool — contributions of all sizes are appreciated.</p>`,
      },
    ],
  },
]
</script>

<template>
  <div class="container">
    <h1 class="page-title">Frequently Asked Questions</h1>
    <div v-for="section in sections" :key="section.title" class="section">
      <p class="section-title">{{ section.title }}</p>
      <div v-for="item in section.items" :key="item.q" class="qa">
        <p class="qa-q">{{ item.q }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="qa-a" v-html="item.a"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { max-width: 780px; width: 100%; margin: 2.25rem auto; padding: 0 1.25rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--blue); margin-bottom: 1.5rem; }
.section { margin-bottom: 2.5rem; }
.section-title {
  font-size: .7rem; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted);
  margin-bottom: 1rem; padding-bottom: .5rem; border-bottom: 2px solid var(--blue);
}
.qa + .qa { margin-top: 1.25rem; }
.qa-q {
  font-size: .95rem; font-weight: 700; color: var(--blue);
  margin-bottom: .4rem; display: flex; gap: .5rem; align-items: baseline;
}
.qa-q::before { content: "Q."; color: var(--gold); font-weight: 800; flex-shrink: 0; }
.qa-a { font-size: .88rem; color: var(--text); line-height: 1.7; padding-left: 1.6rem; }
:deep(.qa-a p + p) { margin-top: .6rem; }
:deep(.qa-a a) { color: var(--blue); }
:deep(.qa-a a:hover) { text-decoration: underline; }
:deep(.callout) {
  border-left: 4px solid var(--gold); background: #fffbea;
  padding: .85rem 1rem; border-radius: 0 var(--radius) var(--radius) 0;
  font-size: .88rem; line-height: 1.65; margin-top: .6rem;
}
:deep(.callout strong) { color: #5a3e00; }
</style>
