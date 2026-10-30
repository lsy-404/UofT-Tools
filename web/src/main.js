import { ViteSSG } from 'vite-ssg'
import './styles/theme.css'
import App from './App.vue'
import { routes } from './routes.js'

export const createApp = ViteSSG(App, {
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
