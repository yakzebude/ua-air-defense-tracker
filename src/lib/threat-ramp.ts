/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0  → pastel yellow (lowest monthly volume)
 *   t = 1  → pastel deep red (peak monthly volume)
 *
 * Tuned for legibility against both light and dark surfaces.
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  // Pastel yellow → pastel deep red, interpolated through warm orange.
  const a = { h: 50, s: 90, l: 78 };  // pastel yellow
  const b = { h: 358, s: 65, l: 48 }; // pastel deep red
  const h = a.h + (b.h - a.h) * tc;
  const s = a.s + (b.s - a.s) * tc;
  const l = a.l + (b.l - a.l) * tc;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
