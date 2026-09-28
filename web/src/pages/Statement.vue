<script setup>
// Formal user agreement (terms of use & privacy). Header/footer from app shell.
const sections = [
  ['about', '0. About the Site'],
  ['acceptance', '1. Acceptance of Terms'],
  ['ip', '2. Intellectual Property'],
  ['data', '3. Data on Your Device & Privacy'],
  ['ads', '4. Advertising'],
  ['use', '5. Acceptable Use'],
  ['disclaimer', '6. Disclaimer & No Warranty'],
  ['changes', '7. Changes to this Agreement'],
  ['law', '8. Governing Law'],
  ['misc', '9. Miscellaneous'],
]
</script>

<template>
  <div class="container">
    <h1 class="page-title">User Agreement</h1>
    <p class="updated">Last updated: June 9, 2026</p>
    <p class="intro">
      Welcome to UofT Tools (<a href="https://uoft.voidcarve.com">uoft.voidcarve.com</a>, the &ldquo;Site&rdquo;). This
      User Agreement (the &ldquo;Agreement&rdquo;) sets out the terms and conditions under which you (the &ldquo;user&rdquo;)
      may use the Site and its tools. Please read it carefully before using the Site.
    </p>

    <nav class="toc">
      <span class="toc-title">On this page</span>
      <a v-for="[id, label] in sections" :key="id" :href="'#' + id">{{ label }}</a>
    </nav>

    <section class="agreement">
      <h2 id="about">0. About the Site</h2>
      <p>UofT Tools is an independent, open-source project built and maintained by a student to make student life at the University of Toronto easier (for example, academic calendar feeds and a course planner). The source code is publicly available on <a href="https://github.com/lsy-404/UofT-Tools" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      <p>The Site is <strong>not</strong> affiliated with, endorsed by, or operated by the University of Toronto. The Site has no user accounts; all features are available without signing in.</p>

      <h2 id="acceptance">1. Acceptance of Terms</h2>
      <p>By using the Site you confirm that you have read, understood, and agreed to this Agreement and to the data practices described in it. If you do not agree to any part of this Agreement, please do not use the Site. You may not later raise any objection on the basis that you did not read or did not agree to this Agreement.</p>
      <p>If you are a minor under the applicable age of majority, you and your parent or legal guardian must read and accept this Agreement together. Your continued use of the Site constitutes acceptance of this Agreement as amended from time to time.</p>

      <h2 id="ip">2. Intellectual Property</h2>
      <p>The Site&rsquo;s original source code is open source and publicly available on GitHub under the MIT License; you may use it under the terms in the repository&rsquo;s <a href="https://github.com/lsy-404/UofT-Tools/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a>.</p>
      <p>Academic information presented by the tools &mdash; including course, program, timetable, and calendar data &mdash; originates from University of Toronto websites. It is provided for students&rsquo; convenience and reference only, may be incomplete or out of date, and is separate from the project source code license. This project does not claim ownership of, or grant rights to, that material.</p>
      <p>You may not present the Site or its content as an official University of Toronto product. The Site reserves all rights not expressly granted to you.</p>

      <h2 id="data">3. Data on Your Device &amp; Privacy</h2>
      <p>This Site uses cookie-like technologies (such as your browser&rsquo;s local storage) to keep a persistent cache on your device. This lets the tools remember your previous choices &mdash; selected programs, course statuses, schedule preferences, and similar settings &mdash; so they are available the next time you visit. This information stays in your browser on your device, and you can clear it at any time through your browser&rsquo;s settings.</p>
      <p>We do <strong>not</strong> collect any data about how you use the features of this Site. Your selections, clicks, and choices are not transmitted to us.</p>
      <p>We do record basic aggregate request metadata &mdash; the source (referrer) of requests and overall visit counts &mdash; solely to understand how much the tools are used and where visitors come from. None of this data is provided to any party outside the University of Toronto community.</p>

      <h2 id="ads">4. Advertising</h2>
      <p>To help cover development and maintenance costs, this Site may display advertising. We do <strong>not</strong> share any of your data with advertising providers. Blocking advertisements will not affect your ability to use this Site.</p>

      <h2 id="use">5. Acceptable Use</h2>
      <p>You must comply with all applicable laws and with this Agreement when using the Site. You agree not to:</p>
      <ul>
        <li>use the Site for any unlawful purpose, or in any way that infringes the rights of others;</li>
        <li>attack, probe, overload, disrupt, or attempt to gain unauthorized access to the Site or its systems (including via hacking, malware, scraping that harms the service, or similar means);</li>
        <li>interfere with, damage, or alter the operation of the Site or its content; or</li>
        <li>misrepresent the Site, or any output you obtain from it, as an official University of Toronto source.</li>
      </ul>
      <p>Academic information and planning suggestions provided by the tools are for personal reference and are not official University of Toronto advice or services. This describes their intended use only; it does not limit any rights to use, modify, or redistribute the original source code under the MIT License. The Site may suspend or terminate access for any user who violates this Agreement.</p>

      <h2 id="disclaimer">6. Disclaimer &amp; No Warranty</h2>
      <p>This service is provided <strong>AS IS</strong> with no warranty of any kind, express or implied, including accuracy, completeness, or timeliness. It is intended for supplementary reference only and should not be the sole basis for academic or financial planning.</p>
      <p><strong>The information shown is not guaranteed to be accurate or complete.</strong> You are solely responsible for regularly verifying all academic, payment, and refund details against your campus&rsquo;s official registrar and Academic Calendar. As the university makes clear, being unaware of a deadline is not typically a valid reason for an exception or extension.</p>
      <p>Use of this tool is strictly at your own risk; the maintainer assumes no liability for any errors, omissions, or consequences resulting from its use, and reserves the right to change or discontinue the service at any time without notice.</p>

      <h2 id="changes">7. Changes to this Agreement</h2>
      <p>The Site may revise this Agreement at any time. The revised version will be posted on this page. Your continued use of the Site after changes are posted means you accept the revised Agreement.</p>

      <h2 id="law">8. Governing Law</h2>
      <p>This Agreement is governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict-of-laws principles. Any dispute arising from or relating to this Agreement or the Site shall be subject to the exclusive jurisdiction of the courts of Ontario, and the parties will first attempt to resolve it amicably.</p>

      <h2 id="misc">9. Miscellaneous</h2>
      <p>The headings in this Agreement are for convenience only and do not affect its interpretation. If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions will continue in full force and effect. This Agreement constitutes the entire agreement between you and the Site regarding your use of the Site.</p>
    </section>
  </div>
</template>

<style scoped>
.container { max-width: 820px; margin: 2.25rem auto; padding: 0 1.25rem; width: 100%; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--blue); margin-bottom: .25rem; }
.updated { color: var(--muted); font-size: .85rem; margin-bottom: 1rem; }
.intro { font-size: 0.95rem; line-height: 1.6; color: var(--text); }
.toc {
  display: flex; flex-direction: column; gap: .25rem;
  margin: 1.25rem 0; padding: .9rem 1rem;
  background: #f8f9fb; border: 1px solid var(--border); border-radius: var(--radius);
}
.toc-title { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: .2rem; }
.toc a { color: var(--blue); text-decoration: none; font-size: .88rem; }
.toc a:hover { text-decoration: underline; }
.agreement h2 { font-size: 1.05rem; font-weight: 700; color: var(--blue); margin: 1.6rem 0 .5rem; scroll-margin-top: 70px; }
.agreement p { margin-top: .5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text); }
.agreement ul { margin: .5rem 0 .5rem 1.25rem; font-size: 0.95rem; line-height: 1.6; color: var(--text); }
.agreement li { margin-top: .3rem; }
.agreement a { color: var(--blue); }
</style>
