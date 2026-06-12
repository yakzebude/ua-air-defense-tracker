import { Link } from "react-router-dom";

interface Props {
  lastUpdatedLabel?: string | null;
  lastUpdatedDate?: Date | null;
}

function fmtLastUpdated(d: Date | null | undefined, fallback?: string | null): string {
  if (d) {
    const iso = d.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  }
  return fallback ?? "—";
}


const PIPELINE = [
  {
    code: "01",
    title: "Source reports",
    body: "Official daily briefings from the Ukrainian Air Force Command, oblast administrations and verified OSINT channels.",
  },
  {
    code: "02",
    title: "Data collection",
    body: "Reports are scraped, parsed and timestamped (UTC) by the upstream open-data pipeline maintained by Petro Ivaniuk.",
  },
  {
    code: "03",
    title: "Validation",
    body: "Cross-checked against multiple briefings; conflicting figures are flagged and conservative values are used.",
  },
  {
    code: "04",
    title: "Aggregation",
    body: "Daily counts are rolled up into monthly windows per weapon category and an interception rate is computed.",
  },
  {
    code: "05",
    title: "Dashboard",
    body: "Aggregated values are published here as CSV, JSON and the interactive panels below.",
  },
];

const CONFIDENCE = [
  {
    tag: "REPORTED",
    tone: "warn",
    title: "Reported",
    body: "Launch counts published in official daily briefings. Treated as the primary figure but subject to later revision.",
  },
  {
    tag: "CONFIRMED",
    tone: "ok",
    title: "Confirmed",
    body: "Intercepts and physical-debris finds independently corroborated by named sources or photographic evidence.",
  },
  {
    tag: "ESTIMATED",
    tone: "neutral",
    title: "Estimated",
    body: "Derived figures (e.g. leakers = launched − intercepted) and rolling-window comparisons. Clearly labelled as derived.",
  },
];

const LIMITATIONS = [
  {
    title: "Fog of war",
    body: "Active hostilities limit independent verification. Some launches and impacts are reported with delay or not at all.",
  },
  {
    title: "Reporting bias",
    body: "Official sources may emphasise interception successes. We do not adjust raw figures — we display them transparently.",
  },
  {
    title: "Delayed revisions",
    body: "Daily figures can be revised days later as wreckage is recovered. Historical months may shift slightly between snapshots.",
  },
  {
    title: "Incomplete information",
    body: "Weapons that were jammed, lost in flight, or not publicly disclosed are not included in the interception statistics.",
  },
];

export function DataConfidenceSection({ lastUpdatedLabel, lastUpdatedDate }: Props) {
  return (
    <section
      id="confidence"
      aria-labelledby="confidence-title"
      className="scroll-mt-32 border-t border-border bg-background"
    >
      <div className="container py-12 md:py-16">
        {/* Heading row */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="src-label mb-3">Data confidence · Methodology</div>
            <h2 id="confidence-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
              How this data is collected, validated and labelled
            </h2>
            <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
              We publish daily aggregates of Russian aerial weapons launched at Ukraine and Ukrainian air-defense interceptions.
              Every number on this dashboard travels through the pipeline below, and every figure is tagged with its confidence class.
            </p>
          </div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Last updated:{" "}
            <span className="text-foreground">{fmtLastUpdated(lastUpdatedDate, lastUpdatedLabel)}</span>
          </div>
        </div>


        {/* Pipeline */}
        <div className="mb-10">
          <div className="src-label mb-3">Data pipeline</div>
          <ol className="grid gap-2 md:grid-cols-5">
            {PIPELINE.map((step, i) => (
              <li
                key={step.code}
                className="relative rounded-sm border border-border bg-card p-4"
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {step.code}
                  </span>
                  {i < PIPELINE.length - 1 && (
                    <span aria-hidden className="hidden font-mono text-muted-foreground/60 md:inline">
                      →
                    </span>
                  )}
                </div>
                <div className="text-[13.5px] font-semibold text-foreground">{step.title}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Collapsible: confidence classification, included/excluded, limitations */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm border border-border bg-card px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="src-label">More on classification, scope &amp; known limitations</span>
            <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">
              <span className="group-open:hidden">Expand</span>
              <span className="hidden group-open:inline">Collapse</span>
              <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
            </span>
          </summary>

          <div className="mt-6">
            {/* Confidence classification + included/excluded */}
            <div className="mb-10 grid gap-6 md:grid-cols-2 md:items-stretch">
              <div className="flex flex-col">
                <div className="src-label mb-3">Confidence classification</div>
                <ul className="flex flex-1 flex-col gap-2.5">
                  {CONFIDENCE.map((c) => (
                    <li
                      key={c.tag}
                      className="flex-1 rounded-sm border border-border bg-card p-4"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            c.tone === "ok"
                              ? "text-[hsl(var(--signal-ok))]"
                              : c.tone === "warn"
                              ? "text-[hsl(var(--signal-warn))]"
                              : "text-muted-foreground"
                          }`}
                        >
                          {c.tag}
                        </span>
                        <span className="text-[13.5px] font-semibold text-foreground">{c.title}</span>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col">
                <div className="src-label mb-3">What interception statistics include — and exclude</div>
                <div className="flex flex-1 flex-col gap-2.5">
                  <div className="flex-1 rounded-sm border border-border bg-card p-4">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[hsl(var(--signal-ok))]">
                      Included
                    </div>
                    <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-foreground">
                      <li>Cruise missiles, ballistic missiles and one-way attack UAVs (e.g. Shahed/Geran) launched at Ukrainian territory.</li>
                      <li>Confirmed kinetic interceptions reported by the Ukrainian Air Force Command.</li>
                      <li>Confirmed losses to electronic-warfare suppression that are publicly disclosed.</li>
                    </ul>
                  </div>
                  <div className="flex-1 rounded-sm border border-border bg-card p-4">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[hsl(var(--signal))]">
                      Excluded
                    </div>
                    <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-foreground">
                      <li>Reconnaissance drones, tactical FPVs and front-line loitering munitions (separate dataset).</li>
                      <li>Air-launched glide bombs (KAB / UMPK) — counted separately in the live alert feed only.</li>
                      <li>Weapons jammed but not destroyed, and weapons whose fate is not publicly disclosed.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Known limitations */}
            <div>
              <div className="src-label mb-3">Known limitations</div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {LIMITATIONS.map((l) => (
                  <div key={l.title} className="rounded-sm border border-border bg-card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span aria-hidden className="text-[hsl(var(--signal-warn))]">⚠</span>
                      <span className="text-[13.5px] font-semibold text-foreground">{l.title}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">{l.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                For the full methodology see{" "}
                <Link to="/methodology" className="underline underline-offset-4 hover:text-foreground">
                  /methodology
                </Link>
                ; for the source list see{" "}
                <Link to="/sources" className="underline underline-offset-4 hover:text-foreground">
                  /sources
                </Link>
                .
              </p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
