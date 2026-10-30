// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from '../web/src/routes.js'

window.scrollTo = vi.fn()

const router = createRouter({ history: createMemoryHistory(), routes })

describe('router resolves without infinite redirect', () => {
  it('navigates to core routes', async () => {
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
    await router.push('/planner')
    expect(router.currentRoute.value.name).toBe('planner')
    expect(router.currentRoute.value.meta.title).toContain('Course Planner')
    await router.push('/faq')
    expect(router.currentRoute.value.name).toBe('faq')
  })

  it('matches trailing-slash calendar path', async () => {
    await router.push('/calendar/')
    expect(router.currentRoute.value.name).toBe('calendar')
  })

  it('renders unknown paths as a noindex not-found route', async () => {
    await router.push('/totally/unknown/path')
    expect(router.currentRoute.value.name).toBe('not-found')
    expect(router.currentRoute.value.meta.noindex).toBe(true)
  })
})
