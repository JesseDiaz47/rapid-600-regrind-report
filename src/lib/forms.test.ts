import { describe, it, expect } from 'vitest'
import {
  MAX_AMPS,
  MAX_WEIGHT,
  MAX_YIELD,
  parseNumberInput,
  validateNumberField,
  validateThresholds,
} from './forms'

describe('parseNumberInput', () => {
  it('returns null for blank and invalid input', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('   ')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
    expect(parseNumberInput('-5')).toBeNull()
  })

  it('parses a non-negative number', () => {
    expect(parseNumberInput('420')).toBe(420)
    expect(parseNumberInput(' 12.5 ')).toBe(12.5)
  })
})

describe('validateNumberField', () => {
  it('treats a blank optional field as null', () => {
    const res = validateNumberField('', { label: 'Output', max: MAX_WEIGHT })
    expect(res).toEqual({ ok: true, value: null })
  })

  it('rejects a blank required field', () => {
    const res = validateNumberField('  ', { label: 'Input weight', required: true, max: MAX_WEIGHT })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/required/i)
  })

  it('rejects non-numeric text', () => {
    const res = validateNumberField('12kg', { label: 'Peak amps', max: MAX_AMPS })
    expect(res.ok).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(validateNumberField('Infinity', { label: 'x', max: MAX_AMPS }).ok).toBe(false)
    expect(validateNumberField('NaN', { label: 'x', max: MAX_AMPS }).ok).toBe(false)
  })

  it('rejects negative numbers', () => {
    const res = validateNumberField('-1', { label: 'Peak amps', max: MAX_AMPS })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/negative/i)
  })

  it('rejects zero when the field must be positive', () => {
    const res = validateNumberField('0', {
      label: 'Input weight',
      required: true,
      positive: true,
      max: MAX_WEIGHT,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/greater than 0/i)
  })

  it('allows zero when positive is not required', () => {
    expect(validateNumberField('0', { label: 'Output', max: MAX_WEIGHT })).toEqual({
      ok: true,
      value: 0,
    })
  })

  it('rejects values above the max', () => {
    const res = validateNumberField(String(MAX_WEIGHT + 1), { label: 'Input', max: MAX_WEIGHT })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/too large/i)
  })

  it('accepts a valid positive value', () => {
    expect(validateNumberField('500', { label: 'Input', required: true, positive: true, max: MAX_WEIGHT })).toEqual({
      ok: true,
      value: 500,
    })
  })

  it('caps target yield at 100', () => {
    expect(validateNumberField('120', { label: 'Target yield', max: MAX_YIELD }).ok).toBe(false)
    expect(validateNumberField('90', { label: 'Target yield', max: MAX_YIELD })).toEqual({
      ok: true,
      value: 90,
    })
  })
})

describe('validateThresholds', () => {
  it('accepts safe below trip', () => {
    const res = validateThresholds('130', '140')
    expect(res).toEqual({ ok: true, safeAmps: 130, tripAmps: 140 })
  })

  it('flags a blank field instead of coercing to zero', () => {
    const res = validateThresholds('', '140')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/required/i)
  })

  it('rejects a non-positive threshold', () => {
    expect(validateThresholds('0', '140').ok).toBe(false)
  })

  it('rejects safe greater than or equal to trip', () => {
    expect(validateThresholds('140', '140').ok).toBe(false)
    const res = validateThresholds('150', '140')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/higher than the safe/i)
  })
})
