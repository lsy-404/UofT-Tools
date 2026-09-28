// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlannerApp from '../web/src/pages/planner/PlannerApp.vue'
import { state, init, toggleProgram } from '../web/src/pages/planner/store.js'

const PROGRAMS = {
  sections: [{
    slug: 'computer-science',
    name: 'Computer Science',
    programs: [{
      id: 'p1',
      name: 'Computer Science - Major',
      type: 'Major',
      code: 'ERMAJ1234',
      courses: ['CSC108H5', 'CSC148H5'],
      requirementGroups: {
        completion: { blocks: [
          { text: 'First Year: CSC108H5 and CSC148H5', codes: ['CSC108H5', 'CSC148H5'], heading: false, indent: false, lead: 'First Year:', note: false },
        ] },
      },
    }],
  }],
}
const SESSIONS = [{ value: '20269', label: 'Fall 2026' }]
const COURSES = {
  CSC108H5: { code: 'CSC108H5', name: 'Intro to CS', prereqs: [], exclusions: [] },
  CSC148H5: { code: 'CSC148H5', name: 'Intro to CS II', prereqs: ['CSC108H5'], prereqText: 'CSC108H5', exclusions: [] },
}

function mockFetch(url) {
  const body = url.includes('utm-programs') ? PROGRAMS
    : url.includes('utm-sessions') ? SESSIONS
      : url.includes('utm-courses') ? COURSES
        : {}
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn(mockFetch)
  // reset shared singleton state between tests
  state.programs = null
  state.courses = null
  state.selectedPrograms = []
  state.activeTab = 'programs'
  state.viewMode = 'list'
  state.courseStatus = {}
  state.scheduled = {}
  state.ttbWarningOpen = false
})

describe('PlannerApp mounts and renders', () => {
  it('switches the active panel by clicking each Planner section control', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    const controls = wrapper.findAll('.tab-btn')
    expect(controls).toHaveLength(3)
    expect(controls[0].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.tab-panel.active').attributes('aria-label')).toBe('Campus and program selection')
    expect(wrapper.find('.program-panel .campus-banner').exists()).toBe(true)
    expect(wrapper.find('.program-panel .program-workspace .sidebar').exists()).toBe(true)
    expect(wrapper.find('.program-panel .program-workspace .main').exists()).toBe(true)

    await controls[1].trigger('click')
    expect(controls[1].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.tab-panel.active').attributes('aria-label')).toBe('Course plan')
    expect(wrapper.find('.tab-panel.active').text()).toContain('Browse catalog / home faculty')

    await controls[2].trigger('click')
    expect(controls[2].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.tab-panel.active').attributes('aria-label')).toBe('Schedule builder')
    expect(wrapper.find('.tab-panel.active').text()).toContain('Course Plan page')

    await controls[0].trigger('click')
    expect(controls[0].attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.tab-panel.active').attributes('aria-label')).toBe('Campus and program selection')
  })

  it('keeps course statuses and requirements in the Course Plan section', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    toggleProgram('p1')
    await wrapper.findAll('.tab-btn')[1].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('CSC108H5')
    expect(wrapper.text()).toContain('CSC148H5')

    state.viewMode = 'requirements'
    await flushPromises()
    expect(wrapper.text()).toContain('First Year:')
    expect(wrapper.text()).toContain('Completion Requirements')
  })

  it('syncs planned courses and opens the TTB warning when Schedule Builder is clicked', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    state.courseStatus = { CSC108H5: 1 }
    state.scheduled = { CSC108H5: ['20269'], CSC148H5: ['20269'] }
    await wrapper.findAll('.tab-btn')[2].trigger('click')
    await flushPromises()
    expect(state.scheduled.CSC108H5).toEqual(['20269'])
    expect(state.scheduled.CSC148H5).toBeUndefined()
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Courses')
    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).toContain('Select courses to preview a schedule.')
  })
})
