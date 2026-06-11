/**
 * Threat color ramp for the escalation calendar.
 *
 *   t = 0.0  → light yellow   (low monthly volume)
 *   t = 0.5  → orange         (medium volume)
 *   t = 1.0  → deep crimson   (record peak)
 *
 * Piecewise ramp pale-yellow → orange → dark red, matching the threat-
 * intensity convention used on most operational dashboards.
 */
export function rampColor(t: number, alpha = 1): string {
  const tc = Math.max(0, Math.min(1, t));
  // Stops: light yellow → orange → dark red
  const stops = [
    { h: 48, s: 95, l: 78 }, // 0.0 light yellow
    { h: 28, s: 92, l: 55 }, // 0.5 orange
    { h: 0,  s: 78, l: 38 }, // 1.0 deep red
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
