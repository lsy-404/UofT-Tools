// Course level, recommended study year, eligibility and degree credit are
// different facts. Never infer eligibility/timing from the course code.
export function courseLevelLabel(code) {
  const letter = /^[A-Z]{3}([A-D])\d{2}[HY]3$/.exec(code || '')
  if (letter) return `${letter[1]}-level`
  const numeric = /^[A-Z]{2,4}([1-9])\d{2}[HY][0135]$/.exec(code || '')
  return numeric ? `${numeric[1]}00-level` : 'Not specified'
}

export function academicCredit(code, meta) {
  if (typeof meta?.academicCredit === 'number') return meta.academicCredit
  // https://utsc.calendar.utoronto.ca/co-operative-programs
  // Applies also while old saved plans are loading refreshed course metadata.
  if (/^COP[A-D]\d{2}[HY]3$/.test(code || '')) return 0
  return /Y[0135]$/.test(code || '') ? 1 : 0.5
}

export function prerequisiteText(meta) {
  return meta?.prereqText || (meta?.prereqs || []).join(', ')
}

export const ROLE_LABELS = {
  required: 'Required course', alternative: 'Alternative — choose an option',
  elective: 'Elective pool', recommended: 'Recommended — optional',
  admission: 'Program admission', note: 'Note / condition',
  reference: 'Reference — check requirement', added: 'Added independently',
  excluded: 'Not accepted for this requirement',
}

// Legacy snapshots lack source-structure annotations. Do not call every
// referenced course required while waiting for their importer to be refreshed.
export function requirementRole(block, kind) {
  if (kind === 'enrolment') return 'admission'
  if (block.role) return block.role
  const text = block.text || ''
  if (/recommend|encourag|\burged\b/i.test(text)) return 'recommended'
  if (/\b(?:choose|electives?|selected from|credits? from)\b/i.test(text)) return 'elective'
  if (/\bor\b|\//i.test(text) && block.codes?.length > 1) return 'alternative'
  return 'reference'
}
