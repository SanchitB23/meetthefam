/**
 * @vitest-environment jsdom
 *
 * Unit tests for the pure crop-rect clamping helper that guards
 * cropAndResizeToJpeg against fractional / out-of-bounds rects coming
 * from react-easy-crop's croppedAreaPixels.
 */
import { describe, it, expect } from 'vitest'
import { clampCropRect } from '@/lib/image/resize'

describe('clampCropRect', () => {
  it('passes through an in-bounds integer rect unchanged', () => {
    expect(clampCropRect({ x: 10, y: 20, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 10, y: 20, width: 100, height: 100 })
  })

  it('rounds fractional values to integers', () => {
    expect(clampCropRect({ x: 9.6, y: 19.4, width: 100.5, height: 99.5 }, 200, 200))
      .toEqual({ x: 10, y: 19, width: 101, height: 100 })
  })

  it('clamps negative origin to 0', () => {
    expect(clampCropRect({ x: -3, y: -1, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('shrinks width/height that overshoot the source bounds', () => {
    expect(clampCropRect({ x: 150, y: 150, width: 100, height: 100 }, 200, 200))
      .toEqual({ x: 150, y: 150, width: 50, height: 50 })
  })

  it('never returns a rect smaller than 1x1', () => {
    expect(clampCropRect({ x: 199.9, y: 199.9, width: 0.05, height: 0.05 }, 200, 200))
      .toEqual({ x: 199, y: 199, width: 1, height: 1 })
  })
})
