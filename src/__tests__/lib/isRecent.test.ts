import { describe, expect, test } from 'vitest'

import { isRecent } from '@/lib/dates/isRecent'

const NOW = new Date('2026-05-18T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

describe('isRecent', () => {
  test('returns true for a date 1 hour ago', () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
    expect(isRecent(oneHourAgo, 7, NOW)).toBe(true)
  })

  test('returns true exactly at the 7-day boundary minus 1ms', () => {
    const justInside = new Date(NOW.getTime() - 7 * DAY + 1).toISOString()
    expect(isRecent(justInside, 7, NOW)).toBe(true)
  })

  test('returns false exactly at the 7-day boundary', () => {
    const onBoundary = new Date(NOW.getTime() - 7 * DAY).toISOString()
    expect(isRecent(onBoundary, 7, NOW)).toBe(false)
  })

  test('returns false for a date 8 days ago', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * DAY).toISOString()
    expect(isRecent(eightDaysAgo, 7, NOW)).toBe(false)
  })

  test('returns false for a future date (clock skew)', () => {
    const future = new Date(NOW.getTime() + 60 * 1000).toISOString()
    expect(isRecent(future, 7, NOW)).toBe(false)
  })

  test('returns false for null / undefined', () => {
    expect(isRecent(null, 7, NOW)).toBe(false)
    expect(isRecent(undefined, 7, NOW)).toBe(false)
  })

  test('returns false for an unparseable string', () => {
    expect(isRecent('not-a-date', 7, NOW)).toBe(false)
  })

  test('accepts Date objects in addition to strings', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * DAY)
    expect(isRecent(twoDaysAgo, 7, NOW)).toBe(true)
  })

  test('respects a custom withinDays', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * DAY).toISOString()
    expect(isRecent(threeDaysAgo, 2, NOW)).toBe(false)
    expect(isRecent(threeDaysAgo, 4, NOW)).toBe(true)
  })
})
