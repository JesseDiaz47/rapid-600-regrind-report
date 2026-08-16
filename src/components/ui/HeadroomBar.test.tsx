import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeadroomBar } from './HeadroomBar'
import type { MachineSettings } from '../../types/domain'

const SETTINGS: MachineSettings = { safeAmps: 130, tripAmps: 140, screenSize: '' }

describe('HeadroomBar threshold labels', () => {
  /**
   * Regression: the safe and trip numbers used to be absolutely positioned
   * under their marks on the track. Default thresholds (130 / 140) land a few
   * percent apart, so on a phone-width track the two labels rendered on top of
   * each other as unreadable overlapping text. jsdom does no layout and cannot
   * measure the overlap, so the guard is structural — the numbers must live
   * outside the track, where their position can't depend on the amp values.
   */
  it('keeps threshold numbers out of the positioned track', () => {
    const { container } = render(
      <HeadroomBar peakAmps={137} status="near" settings={SETTINGS} />,
    )
    const track = container.querySelector('.headroom__track')
    expect(track).not.toBeNull()
    expect(track).not.toHaveTextContent(/130|140/)

    const safe = screen.getByText(/safe 130/i)
    const trip = screen.getByText(/trip 140/i)
    expect(track).not.toContainElement(safe)
    expect(track).not.toContainElement(trip)
  })

  it('renders each threshold exactly once, at any spacing', () => {
    // Thresholds one amp apart would have been the worst-case overlap.
    render(
      <HeadroomBar
        peakAmps={100}
        status="safe"
        settings={{ safeAmps: 139, tripAmps: 140, screenSize: '' }}
      />,
    )
    expect(screen.getByText(/safe 139/i)).toBeInTheDocument()
    expect(screen.getByText(/trip 140/i)).toBeInTheDocument()
  })

  it('still marks both thresholds on the track', () => {
    const { container } = render(
      <HeadroomBar peakAmps={137} status="near" settings={SETTINGS} />,
    )
    expect(container.querySelector('.headroom__mark--safe')).not.toBeNull()
    expect(container.querySelector('.headroom__mark--trip')).not.toBeNull()
  })
})
