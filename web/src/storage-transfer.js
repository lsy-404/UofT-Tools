const profileKeys = ['utm_course_status', 'utm_selected_programs', 'utm_completed', 'utm_extra_courses', 'utm_schedule']
export const TRANSFER_KEYS = ['uoft_home_campus', 'utm_ttb_warning_seen', ...['', 'stg_', 'utsc_'].flatMap(prefix => profileKeys.map(key => prefix + key))]

const defaultPrefs = {
  density: 'any', time: 'any', freeDays: [], busyDays: [], zzOverlap: true, zzWithReg: false,
  commute: { enabled: true, hours: 1 },
  constraints: { sections: {}, unavailable: [], earliest: '', latest: '', excludedInstructors: [], lunch: { enabled: false, start: '11:00', end: '14:00', minutes: 60 }, online: 'any' },
}

function differs(value, defaults) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => differs(item, defaults?.[key]))
  return defaults === undefined ? value !== '' && value !== null && value !== false : value !== defaults
}

function isRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value) }

function validEntries(entries) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return false
  return Object.entries(entries).every(([key, value]) => {
    if (!TRANSFER_KEYS.includes(key) || typeof value !== 'string') return false
    if (key === 'uoft_home_campus') return ['utm', 'stg', 'utsc'].includes(value)
    if (key === 'utm_ttb_warning_seen') return value === '1'
    try {
      const data = JSON.parse(value)
      if (key.endsWith('utm_schedule')) return isRecord(data) && (data.scheduled === undefined || isRecord(data.scheduled)) && (data.prefs === undefined || isRecord(data.prefs)) && (data.scopeId === undefined || typeof data.scopeId === 'string')
      if (key.endsWith('utm_course_status')) return isRecord(data)
      return Array.isArray(data)
    } catch { return false }
  })
}

function hasUserData(storage) {
  for (const key of TRANSFER_KEYS.slice(2)) {
    const raw = storage.getItem(key)
    if (raw === null) continue
    let data
    try { data = JSON.parse(raw) } catch { return true }
    if (key.endsWith('utm_schedule')) {
      if (!isRecord(data) || (data.scheduled !== undefined && !isRecord(data.scheduled)) || (data.prefs !== undefined && !isRecord(data.prefs))) return true
      if (differs(data.scheduled || {}, {}) || differs(data.prefs || {}, defaultPrefs)) return true
      if (Object.entries(data).some(([name, value]) => !['scopeId', 'scheduled', 'prefs'].includes(name) && differs(value, undefined))) return true
    } else if (differs(data, Array.isArray(data) ? [] : {})) return true
  }
  return false
}

async function transform(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(format === 'compress' ? new CompressionStream('gzip') : new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeTransfer(storage) {
  const entries = Object.fromEntries(TRANSFER_KEYS.flatMap(key => {
    const value = storage.getItem(key)
    return value === null ? [] : [[key, value]]
  }))
  if (!validEntries(entries)) throw new Error('Invalid planner data')
  const bytes = await transform(new TextEncoder().encode(JSON.stringify(entries)), 'compress')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export async function decodeTransfer(encoded) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid transfer')
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const entries = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await transform(bytes, 'decompress')))
  if (!validEntries(entries)) throw new Error('Invalid planner data')
  return entries
}

export async function redirectWithTransfer(storage, location) {
  const url = new URL('https://tiny.leisiyu.dev/p/uoft/')
  url.searchParams.set('data', await encodeTransfer(storage))
  location.replace(url.href)
}

export async function importTransfer(storage, encoded) {
  const entries = await decodeTransfer(encoded)
  if (hasUserData(storage)) return false
  const previous = new Map(Object.keys(entries).map(key => [key, storage.getItem(key)]))
  try {
    for (const [key, value] of Object.entries(entries)) storage.setItem(key, value)
  } catch (error) {
    for (const [key, value] of previous) {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    }
    throw error
  }
  return true
}

export async function receiveTransfer(storage, location, history) {
  const url = new URL(location.href)
  const encoded = url.searchParams.get('data')
  if (encoded === null) return false
  url.searchParams.delete('data')
  history.replaceState(history.state, '', url.href)
  try { return await importTransfer(storage, encoded) } catch { return false }
}
