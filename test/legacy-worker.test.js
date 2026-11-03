import { describe, expect, it, vi } from 'vitest'

vi.mock('../web/src/storage-transfer.js', () => ({
  default: 'async function redirectWithTransfer() {}',
}))

import worker from '../legacy/worker.js'

describe('legacy worker', () => {
  it('serves the migration bridge without caching or a referrer', async () => {
    const response = await worker.fetch(new Request('https://uoft.leisiyu.dev/planner?export=1'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(await response.text()).toContain('await redirectWithTransfer(localStorage, window.location)')
  })

  it('redirects old paths while preserving their query strings', async () => {
    const response = await worker.fetch(new Request('https://uoft.leisiyu.dev/calendar/utm.ics?example=1'))
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://tiny.leisiyu.dev/p/uoft/calendar/utm.ics?example=1')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
})
