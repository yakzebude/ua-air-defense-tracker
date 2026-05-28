// Tracker changelog. Add an entry whenever:
// - the upstream dataset is refreshed past a notable point
// - a monthly figure is revised
// - a methodology or visualisation change ships
//
// Keep newest entries at the top. Dates in ISO format.

export type ChangelogEntryKind = "data" | "revision" | "release" | "methodology";

export interface ChangelogEntry {
  date: string;        // YYYY-MM-DD
  kind: ChangelogEntryKind;
  title: string;
  body: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-27",
    kind: "release",
    title: "Newsroom toolkit",
    body:
      "Per-panel CSV export, copy-citation, freshness indicator, deep-linkable filter ranges (?r1=, ?r2=, ?r3=), Dataset JSON-LD for Google Dataset Search, and a public changelog.",
  },
  {
    date: "2026-05-26",
    kind: "release",
    title: "Visual refinements",
    body:
      "Swipeable composition and interception panels on small screens; tightened bar sizing for shorter date ranges; spacing polish across KPI typography.",
  },
  {
    date: "2026-05-25",
    kind: "release",
    title: "Brand rename",
    body:
      "Project renamed to UA AirDefense Tracker. Yellow accent retired in favour of a single signal-red so charts read as analysis, not branding.",
  },
];
