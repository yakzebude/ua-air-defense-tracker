/**
 * Threat color ramp — restrained two-tone version.
 *
 *   t = 0  → neutral mid-gray (low intensity)
 *   t = 1  → amber signal     (peak intensity)
 *
 * All charts/heatmaps share this so the surface stays calm and readable.
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  // Interpolate between mid-gray and amber in HSL space.
  const a = { h: 220, s: 8,  l: 70 };  // muted gray
  const b = { h: 38,  s: 92, l: 45 };  // amber
  const h = a.h + (b.h - a.h) * tc;
  const s = a.s + (b.s - a.s) * tc;
  const l = a.l + (b.l - a.l) * tc;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
