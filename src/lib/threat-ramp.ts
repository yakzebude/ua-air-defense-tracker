/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0.0  → light warm gray (low monthly volume)
 *   t = 0.5  → red             (medium volume)
 *   t = 1.0  → deep dark red   (record peak)
 *
 * Grayscale → red → dark red. Matches the site-wide red/grayscale palette.
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  const stops = [
    { h: 30, s: 10, l: 82 }, // 0.0 light warm gray
    { h: 0,  s: 65, l: 48 }, // 0.5 red
    { h: 0,  s: 72, l: 30 }, // 1.0 dark red
  ];
  const seg = tc < 0.5 ? 0 : 1;
  const localT = seg === 0 ? tc / 0.5 : (tc - 0.5) / 0.5;
  const a = stops[seg];
  const b = stops[seg + 1];
  const h = a.h + (b.h - a.h) * localT;
  const s = a.s + (b.s - a.s) * localT;
  const l = a.l + (b.l - a.l) * localT;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
