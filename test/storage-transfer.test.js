import { describe, expect, it } from 'vitest'
import { TRANSFER_KEYS, encodeTransfer, decodeTransfer, importTransfer, receiveTransfer, redirectWithTransfer } from '../web/src/storage-transfer.js'

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    values,
  }
}
const defaults = JSON.stringify({ scopeId: '20269', scheduled: {}, prefs: {
  density: 'any', time: 'any', freeDays: [], busyDays: [], zzOverlap: true, zzWithReg: false,
  commute: { enabled: true, hours: 1 }, constraints: { sections: {}, unavailable: [], earliest: '', latest: '', excludedInstructors: [], lunch: { enabled: false, start: '11:00', end: '14:00', minutes: 60 }, online: 'any' },
} })

describe('planner transfer', () => {
  it('round trips the complete allowlist with Unicode and excludes other keys', async () => {
    const original = Object.fromEntries(TRANSFER_KEYS.map(key => [key, key === 'uoft_home_campus' ? 'stg' : key === 'utm_ttb_warning_seen' ? '1' : key.endsWith('utm_schedule') || key.endsWith('utm_course_status') ? JSON.stringify({ name: '多伦多 🐈' }) : JSON.stringify(['多伦多 🐈'])]))
    const source = storage({ ...original, unrelated: 'private' })
    const encoded = await encodeTransfer(source)
    expect(await decodeTransfer(encoded)).toEqual(original)
    const target = storage({ utm_schedule: defaults, utm_course_status: '{}', stg_utm_extra_courses: '[]', uoft_home_campus: 'utm', utm_ttb_warning_seen: '1' })
    expect(await importTransfer(target, encoded)).toBe(true)
    for (const [key, value] of Object.entries(original)) expect(target.getItem(key)).toBe(value)
    expect(target.getItem('unrelated')).toBeNull()
  })

  it.each([
    ['stg_utm_course_status', '{"CSC108H1":2}'],
    ['utsc_utm_selected_programs', '[{"id":"abc"}]'],
    ['utm_schedule', JSON.stringify({ scheduled: {}, prefs: { commute: { enabled: false, hours: 1 } } })],
    ['stg_utm_schedule', JSON.stringify({ scheduled: { CSC108H1: ['F'] }, prefs: {} })],
  ])('protects existing data in %s', async (key, value) => {
    const target = storage({ [key]: value, uoft_home_campus: 'utm' })
    const before = [...target.values]
    expect(await importTransfer(target, await encodeTransfer(storage({ utm_extra_courses: '["CSC108H1"]' })))).toBe(false)
    expect([...target.values]).toEqual(before)
  })

  it('restores earlier values after a write fails', async () => {
    const target = storage({ utm_course_status: '{}', utm_extra_courses: '[]' })
    const set = target.setItem
    let fail = true
    target.setItem = (key, value) => { if (key === 'utm_extra_courses' && fail) { fail = false; throw Error('quota') } set(key, value) }
    const encoded = await encodeTransfer(storage({ utm_course_status: '{"CSC108H1":2}', utm_extra_courses: '["CSC108H1"]' }))
    await expect(importTransfer(target, encoded)).rejects.toThrow('quota')
    expect([...target.values]).toEqual([['utm_course_status', '{}'], ['utm_extra_courses', '[]']])
  })

  it('removes the data parameter even when invalid, preserving other URL parts', async () => {
    let clean
    const history = { state: { a: 1 }, replaceState: (state, title, url) => { clean = url } }
    expect(await receiveTransfer(storage(), { href: 'https://example.com/p/uoft/?data=invalid&x=1#section' }, history)).toBe(false)
    expect(clean).toBe('https://example.com/p/uoft/?x=1#section')
  })

  it('rejects payloads containing keys outside the allowlist', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ unrelated: 'value' }))
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
    const zipped = new Uint8Array(await new Response(stream).arrayBuffer())
    const encoded = btoa(Array.from(zipped, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    const target = storage()
    await expect(importTransfer(target, encoded)).rejects.toThrow()
    expect(target.values.size).toBe(0)
  })

  it('rejects invalid source values and redirects using the data parameter', async () => {
    await expect(encodeTransfer(storage({ utm_schedule: 'not json' }))).rejects.toThrow()
    let url
    await redirectWithTransfer(storage({ utm_extra_courses: '[]' }), { replace: value => { url = new URL(value) } })
    expect(url.pathname).toBe('/p/uoft/')
    expect(await decodeTransfer(url.searchParams.get('data'))).toEqual({ utm_extra_courses: '[]' })
  })
})
