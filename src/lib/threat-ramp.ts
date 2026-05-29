/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0  → neutral slate gray (lowest monthly volume)
 *   t = 1  → deep crimson red   (peak monthly volume)
 *
 * Monochrome gray → red, matching the launched/destroyed palette.
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  const a = { h: 215, s: 14, l: 40 };  // neutral slate gray
  const b = { h: 0,   s: 70, l: 42 };  // deep crimson
  const h = a.h + (b.h - a.h) * tc;
  const s = a.s + (b.s - a.s) * tc;
  const l = a.l + (b.l - a.l) * tc;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}

