/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0  → pale yellow (lowest monthly volume)
 *   t = 1  → deep red    (peak monthly volume)
 *
 * Yellow and red tones only — no orange or brown mid-stops.
 * Hue is interpolated the short way around the wheel (60° → 0°).
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  const a = { h: 55,  s: 95, l: 78 };  // pale yellow
  const b = { h: 358, s: 72, l: 40 };  // deep red
  // Treat 358 as -2 so we sweep yellow → red the short way.
  const bh = b.h > 180 ? b.h - 360 : b.h;
  const h = a.h + (bh - a.h) * tc;
  const s = a.s + (b.s - a.s) * tc;
  const l = a.l + (b.l - a.l) * tc;
  const hh = (h + 360) % 360;
  return alpha >= 1
    ? `hsl(${hh.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${hh.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
