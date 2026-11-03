import { ViteSSG } from 'vite-ssg'
import './styles/theme.css'
import App from './App.vue'
import { routes } from './routes.js'

export const createApp = ViteSSG(App, {
  routes,
  base: import.meta.env.BASE_URL,
  scrollBehavior() {
    return { top: 0 }
  },
})
