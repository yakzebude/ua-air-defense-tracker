/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0    → pale yellow (lowest monthly volume)
 *   t = 0.5  → orange       (mid-range)
 *   t = 1    → deep red     (peak monthly volume)
 *
 * Piecewise interpolation through three anchor stops in HSL space so the
 * mid-tones read as warm orange rather than muddy brown.
 */
const STOPS: Array<{ t: number; h: number; s: number; l: number }> = [
  { t: 0,    h: 52,  s: 95, l: 80 },  // pale yellow
  { t: 0.5,  h: 28,  s: 88, l: 58 },  // warm orange
  { t: 1,    h: 358, s: 70, l: 42 },  // deep red
];

export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  // Find surrounding stops
  let i = 0;
  while (i < STOPS.length - 2 && tc > STOPS[i + 1].t) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const k = (tc - a.t) / (b.t - a.t);
  const h = a.h + (b.h - a.h) * k;
  const s = a.s + (b.s - a.s) * k;
  const l = a.l + (b.l - a.l) * k;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
