/**
 * Reusable Seed / Flower-of-Life geometry, drawn as inline SVG (no external
 * assets, no innerHTML). Used as the shell background field and as the hero
 * mark on Pulse. Purely presentational.
 */

interface SeedOfLifeProps {
  className?: string
  breathe?: boolean
  /** Content rendered centered inside the geometry (e.g. a metric). */
  children?: React.ReactNode
  size?: number
}

/** The six-around-one circle arrangement at the heart of the Seed of Life. */
function seedCircles(cx: number, cy: number, r: number) {
  const circles = [{ cx, cy }]
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    circles.push({ cx: cx + r * Math.cos(angle), cy: cy + r * Math.sin(angle) })
  }
  return circles
}

export function GeometryMark({
  className,
  breathe = false,
  children,
  size = 148,
}: SeedOfLifeProps) {
  const r = 26
  const cx = 74
  const cy = 74
  const circles = seedCircles(cx, cy, r)
  return (
    <div className={`geo-mark-wrap${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <svg
        className={`geo-mark${breathe ? ' geo-breathe' : ''}`}
        viewBox="0 0 148 148"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx={cx} cy={cy} r={r * 2} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            opacity="0.85"
          />
        ))}
      </svg>
      {children != null && <div className="geo-mark-center">{children}</div>}
    </div>
  )
}

/** Fixed, full-shell background field. */
export function GeometryField() {
  const circles = seedCircles(0, 0, 60)
  return (
    <div className="geo-field" aria-hidden="true">
      <svg viewBox="-160 -160 320 320" width="720" height="720">
        <g stroke="currentColor" strokeWidth="0.8" fill="none">
          {[60, 120, 180].map((rr) => (
            <circle key={rr} cx="0" cy="0" r={rr} />
          ))}
          {circles.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={60} />
          ))}
          {seedCircles(0, 0, 120).map((c, i) => (
            <circle key={`o${i}`} cx={c.cx} cy={c.cy} r={60} />
          ))}
        </g>
      </svg>
    </div>
  )
}
