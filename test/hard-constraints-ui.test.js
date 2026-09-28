// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import HardConstraints from '../web/src/pages/planner/components/HardConstraints.vue'
import { state, defaultConstraints } from '../web/src/pages/planner/store.js'

const section = (name, type) => ({ name, type, cancelled: false, times: [{ day: 1, startMs: 36000000, endMs: 39600000 }], instructors: [] })
beforeEach(() => {
  state.prefs.constraints = defaultConstraints()
  state.sessions = [
    { value: '20269', label: 'Fall 2026' }, { value: '20271', label: 'Winter 2027' },
    { value: '20269-20271', label: 'Fall-Winter 2026-2027' },
  ]
  state.scopeId = '20269-20271'
  state.scheduled = { CSC108H5: ['20269'], MAT137Y1: ['20269-20271'] }
  state.timetables = {
    '20269': { courses: [{ code: 'CSC108H5', sections: [section('LEC0101', 'LEC'), section('LEC0201', 'LEC'), section('TUT0101', 'TUT')] }] },
    '20269-20271': { courses: [{ code: 'MAT137Y1', sections: [section('LEC0101', 'LEC')] }] },
  }
})

describe('hard constraint controls', () => {
  it('stores exact section locks and exclusions by selected term, including full-year keys', async () => {
    const wrapper = mount(HardConstraints)
    const course = wrapper.findAll('.course-rules').find(w => w.text().includes('CSC108H5'))
    await course.find('summary').trigger('click')
    await course.findAll('.section-row')[0].findAll('button')[0].trigger('click')
    await course.findAll('.section-row')[1].findAll('button')[1].trigger('click')
    expect(state.prefs.constraints.sections['20269'].CSC108H5).toEqual({ locked: { LEC: 'LEC0101' }, excluded: ['LEC0201'] })
    const full = wrapper.findAll('.course-rules').find(w => w.text().includes('MAT137Y1'))
    await full.find('summary').trigger('click')
    await full.find('.section-row button').trigger('click')
    expect(state.prefs.constraints.sections['20269-20271'].MAT137Y1.locked.LEC).toBe('LEC0101')
    await wrapper.find('.clear-sections').trigger('click')
    expect(state.prefs.constraints.sections).toEqual({})
    wrapper.unmount()
  })

  it('validates blocked intervals and stores global rules', async () => {
    const wrapper = mount(HardConstraints)
    const end = wrapper.find('[aria-label="Unavailable until"]')
    await end.setValue('08:00')
    await wrapper.find('.entry-row button').trigger('click')
    expect(wrapper.text()).toContain('End must be after start')
    expect(state.prefs.constraints.unavailable).toEqual([])
    await end.setValue('10:00')
    await wrapper.find('.entry-row button').trigger('click')
    expect(state.prefs.constraints.unavailable).toEqual([{ day: 1, start: '09:00', end: '10:00' }])
    await wrapper.find('[aria-label="Instructor name"]').setValue('Jane Doe')
    await wrapper.find('[aria-label="Instructor name"]').trigger('keydown.enter')
    expect(state.prefs.constraints.excludedInstructors).toEqual(['Jane Doe'])
    await wrapper.find('#online-rule').setValue('forbid')
    expect(state.prefs.constraints.online).toBe('forbid')
    await nextTick()
    wrapper.unmount()
  })
})
