// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Calendar from '../web/src/pages/Calendar.vue'
import TheHeader from '../web/src/components/TheHeader.vue'

describe('hosted subpath', () => {
  it('uses the hosted path for calendar feeds and downloads', async () => {
    const wrapper = mount(Calendar)
    await nextTick()
    const origin = window.location.origin
    const feed = origin.replace(/^https?:/, 'webcal:') + '/p/uoft/calendar/artsci.ics'
    const links = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(links).toContain(feed)
    expect(links).toContain(origin + '/p/uoft/calendar/artsci.ics')
    const google = links.find(href => href?.startsWith('https://calendar.google.com/'))
    expect(new URL(google).searchParams.get('cid')).toBe(feed)
    expect(links).toContain(origin.replace(/^https?:/, 'webcal:') + '/p/uoft/calendar/utsc-filtered.ics')
  })

  it('shows the host return link when supplied', async () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="home-url" content="https://example.com/">')
    const wrapper = mount(TheHeader, { global: { stubs: { RouterLink: true }, mocks: { $route: { path: '/' } } } })
    await nextTick()
    expect(wrapper.find('a[href="https://example.com/"]').text()).toBe('Tiny Projects')
    document.querySelector('meta[name="home-url"]').remove()
  })
})
