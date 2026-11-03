import { ViteSSG } from 'vite-ssg'
import './styles/theme.css'
import App from './App.vue'
import { routes } from './routes.js'
import { receiveTransfer } from './storage-transfer.js'

const transfer = import.meta.env.SSR
  ? Promise.resolve()
  : receiveTransfer(() => window.localStorage, window.location, window.history)
    .catch(() => window.alert('Could not transfer your planner data. Please try again from the previous site.'))

export const createApp = ViteSSG(App, {
  routes,
  base: import.meta.env.BASE_URL,
  scrollBehavior() {
    return { top: 0 }
  },
}, async () => {
  await transfer
})
