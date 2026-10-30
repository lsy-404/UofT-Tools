import { pages } from './site.js'

// Lazy-load each route so the heavy planner stays in its own chunk.
export const routes = [
  { path: '/', name: 'home', component: () => import('./pages/Home.vue'), meta: pages['/'] },
  { path: '/calendar', name: 'calendar', component: () => import('./pages/Calendar.vue'), meta: pages['/calendar'] },
  { path: '/planner', name: 'planner', component: () => import('./pages/planner/PlannerApp.vue'), meta: { ...pages['/planner'], wide: true } },
  { path: '/faq', name: 'faq', component: () => import('./pages/Faq.vue'), meta: pages['/faq'] },
  { path: '/statement', name: 'statement', component: () => import('./pages/Statement.vue'), meta: pages['/statement'] },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./pages/NotFound.vue'),
    meta: { title: 'Page not found — UofT Tools', description: 'This page does not exist.', noindex: true },
  },
]
