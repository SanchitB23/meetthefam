import { describe, expect, it } from 'vitest'

import {
  SOFT_OCTAGON_CLIP_PATH,
  shapeCssForGender,
} from '@/components/ui/avatar'

describe('shapeCssForGender', () => {
  it('m → rounded-square radius at ~18% of px', () => {
    expect(shapeCssForGender('m', 48)).toEqual({
      kind: 'radius',
      borderRadius: '9px', // Math.round(48 * 0.18) = 9
    })
    expect(shapeCssForGender('m', 80)).toEqual({
      kind: 'radius',
      borderRadius: '14px', // Math.round(80 * 0.18) = 14
    })
  })

  it('unknown → squircle radius at ~34% of px (geometric midpoint of m and f)', () => {
    expect(shapeCssForGender('unknown', 48)).toEqual({
      kind: 'radius',
      borderRadius: '16px', // Math.round(48 * 0.34) = 16
    })
    expect(shapeCssForGender('unknown', 80)).toEqual({
      kind: 'radius',
      borderRadius: '27px', // Math.round(80 * 0.34) = 27
    })
  })

  it('f → circle (50%)', () => {
    expect(shapeCssForGender('f', 48)).toEqual({
      kind: 'radius',
      borderRadius: '50%',
    })
  })

  it('other → soft octagon clip-path (distinctive shape)', () => {
    const result = shapeCssForGender('other', 48)
    expect(result.kind).toBe('clip-path')
    if (result.kind === 'clip-path') {
      expect(result.clipPath).toBe(SOFT_OCTAGON_CLIP_PATH)
      expect(result.clipPath.startsWith('polygon(')).toBe(true)
    }
  })

  it('undefined → circle (50%) backstop', () => {
    expect(shapeCssForGender(undefined, 48)).toEqual({
      kind: 'radius',
      borderRadius: '50%',
    })
  })

  it('SOFT_OCTAGON_CLIP_PATH is a polygon with exactly 40 vertices', () => {
    const matches = SOFT_OCTAGON_CLIP_PATH.match(/\d+(\.\d+)?%\s+\d+(\.\d+)?%/g)
    expect(matches?.length).toBe(40)
  })
})
