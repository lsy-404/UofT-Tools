// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import router from '../web/src/router.js'

window.scrollTo = vi.fn()

describe('router resolves without infinite redirect', () => {
  it('navigates to core routes', async () => {
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
    await router.push('/planner')
    expect(router.currentRoute.value.name).toBe('planner')
    expect(router.currentRoute.value.meta.title).toBe('UofT Course Planner — UofT Tools')
    await router.push('/faq')
    expect(router.currentRoute.value.name).toBe('faq')
  })

  it('follows backward-compatible redirects', async () => {
    // Note: Vue router matches non-strictly, so /calendar/ resolves to /calendar route
    // but keeps the trailing slash in the path unless strictly redirected.
    await router.push('/calendar/')
    expect(router.currentRoute.value.name).toBe('calendar')

    await router.push('/faq.html')
    expect(router.currentRoute.value.path).toBe('/faq')
  })

  it('sends unknown paths to home', async () => {
    await router.push('/totally/unknown/path')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
