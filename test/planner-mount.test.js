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
})

describe('PlannerApp mounts and renders', () => {
  it('renders three top-level Planner sections and the program sidebar after init', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    expect(wrapper.text()).toContain('Campus & Programs')
    expect(wrapper.text()).toContain('Course Plan')
    expect(wrapper.text()).toContain('Schedule Builder')
    expect(wrapper.text()).toContain('Computer Science')
    expect(wrapper.text()).toContain('Program combination')
  })

  it('keeps course statuses and requirements in the Course Plan section', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    toggleProgram('p1')
    state.activeTab = 'courses'
    await flushPromises()
    expect(wrapper.text()).toContain('CSC108H5')
    expect(wrapper.text()).toContain('CSC148H5')

    state.viewMode = 'requirements'
    await flushPromises()
    expect(wrapper.text()).toContain('First Year:')
    expect(wrapper.text()).toContain('Completion Requirements')
  })

  it('renders the schedule builder when switching tabs', async () => {
    const wrapper = mount(PlannerApp)
    await init()
    await flushPromises()

    state.activeTab = 'schedule'
    await flushPromises()
    expect(wrapper.text()).toContain('Courses')
    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).toContain('Select courses to preview a schedule.')
  })
})
