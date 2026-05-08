/**
 * Shared "threat" color ramp used across analytics charts.
 *
 *   t = 0   → yellow      (low threat / high interception)
 *   t = 0.4 → orange
 *   t = 0.7 → red
 *   t = 1   → deep purple (high threat / many leakers)
 *
 * Hue interpolation between red (0°) and purple (280°) takes the short
 * path through magenta (360 → 280) so the gradient stays in the warm
 * half of the wheel and never crosses through green.
 */
export function rampColor(t: number, alpha = 1): string {
  const stops = [
    { t: 0,   h: 47,  s: 95, l: 58 }, // yellow
    { t: 0.4, h: 25,  s: 92, l: 55 }, // orange
    { t: 0.7, h: 0,   s: 78, l: 52 }, // red
    { t: 1,   h: 280, s: 62, l: 42 }, // deep purple
  ];
  const tc = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 1 && tc > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[i + 1] ?? stops[i];
  const local = b.t === a.t ? 0 : (tc - a.t) / (b.t - a.t);
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (a.h + dh * local + 360) % 360;
  const s = a.s + (b.s - a.s) * local;
  const l = a.l + (b.l - a.l) * local;
  return alpha >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alpha})`;
}
