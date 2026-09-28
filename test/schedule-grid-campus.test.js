// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleGrid from '../web/src/pages/planner/components/ScheduleGrid.vue'

const hour = h => h * 3600000
const result = code => ({
  code,
  name: code,
  color: 'rgb(18, 52, 86)',
  sections: [{ name: 'LEC0101', times: [{ day: 1, startMs: hour(10), endMs: hour(11), room: 'IB 120' }] }],
})

describe('ScheduleGrid campus labels', () => {
  it('uses the current home campus and keeps H0 instruction visibly off-campus', () => {
    const homeStg = mount(ScheduleGrid, { props: { homeCampus: 'stg', results: [result('MAT135H1'), result('HIS100H0'), result('CSC108H5')] } })
    expect(homeStg.findAll('.cb-campus')).toHaveLength(2)
    expect(homeStg.text()).toContain('Off campus')
    expect(homeStg.text()).toContain('UTM')
    homeStg.unmount()

    const homeUtsc = mount(ScheduleGrid, { props: { homeCampus: 'utsc', results: [result('CSCA08H3'), result('CSC108H5')] } })
    expect(homeUtsc.findAll('.cb-campus')).toHaveLength(1)
    expect(homeUtsc.text()).toContain('UTM')
    homeUtsc.unmount()
  })
})
