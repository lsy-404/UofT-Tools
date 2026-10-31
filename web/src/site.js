// Plain data shared by the router, <head> management and the build-time sitemap.
export const SITE_URL = 'https://uoft.leisiyu.dev'
export const SITE_NAME = 'UofT Tools'

export const pages = {
  '/': {
    title: 'UofT Tools — Calendar Feeds and Course Planner for U of T',
    description: 'Free unofficial tools for University of Toronto students: academic calendar feeds for UTSG, UTM and UTSC, and a course planner with a schedule builder.',
    crumb: null,
  },
  '/calendar': {
    title: 'U of T Academic Calendar Feeds (ICS) — UTSG, UTM, UTSC',
    description: 'Subscribe to University of Toronto important academic dates for UTSG, UTM and UTSC as a webcal/ICS feed for Google, Apple or Outlook Calendar. Updated daily.',
    crumb: 'Calendar Feeds',
    app: { name: 'U of T Academic Calendar Feeds', category: 'EducationalApplication' },
  },
  '/planner': {
    title: 'U of T Course Planner and Schedule Builder — UTM, UTSC, UTSG',
    description: 'Plan University of Toronto courses and build timetables for UTM, UTSC and UTSG Arts & Science, with program requirements and degree progress checks.',
    crumb: 'Course Planner',
    app: { name: 'U of T Course Planner', category: 'EducationalApplication' },
  },
  '/faq': {
    title: 'FAQ — UofT Tools',
    description: 'Answers about UofT Tools: what the unofficial student project is, how to subscribe to the academic calendar feeds, update frequency, data sources and hosting.',
    crumb: 'FAQ',
  },
  '/statement': {
    title: 'User Agreement — UofT Tools',
    description: 'User agreement for UofT Tools: unofficial status, data use, acceptable use, disclaimer of warranty, governing law and the MIT license of the source code.',
    crumb: 'User Agreement',
  },
}

export const indexablePaths = Object.keys(pages)

export function absoluteUrl(path) {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}
