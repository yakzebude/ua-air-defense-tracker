import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

type Source = {
  name: string;
  role: "Primary" | "Mirror" | "Secondary" | "Reference";
  href: string;
  desc: string;
};

const SOURCES: Source[] = [
  {
    name: "Air Force Command of the Armed Forces of Ukraine",
    role: "Primary",
    href: "https://www.facebook.com/kpszsu",
    desc: "Daily bulletins detailing weapons launched against Ukraine and air-defense interceptions, by model. The single upstream source of every figure on this dashboard.",
  },
  {
    name: "Massive Missile Attacks on Ukraine — Kaggle dataset",
    role: "Mirror",
    href: "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine",
    desc: "Open-source CSV mirror of the Air Force daily reports, normalized into a structured time series. We re-fetch this file on every page load.",
  },
  {
    name: "General Staff of the Armed Forces of Ukraine",
    role: "Reference",
    href: "https://www.facebook.com/GeneralStaff.ua",
    desc: "Daily totals on personnel and equipment losses on both sides. Useful context but not used as a numerical input here.",
  },
  {
    name: "Oryx — Attack On Europe: Documenting Russian Equipment Losses",
    role: "Secondary",
    href: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html",
    desc: "Photo-verified record of equipment losses on both sides. Independent visual confirmation; methodology differs from ours and figures are not directly comparable.",
  },
  {
    name: "Liveuamap",
    role: "Reference",
    href: "https://liveuamap.com/",
    desc: "Real-time geolocated incident map. Useful to contextualize where strikes occur; not used as a numerical input.",
  },
  {
    name: "Institute for the Study of War (ISW)",
    role: "Reference",
    href: "https://www.understandingwar.org/backgrounder/ukraine-conflict-updates",
    desc: "Daily analytical assessments of the war. Recommended for narrative context behind the numbers shown here.",
  },
];

const ROLE_TONE: Record<Source["role"], string> = {
  Primary: "border-ua-yellow/50 bg-ua-yellow/5 text-ua-yellow",
  Mirror: "border-cyber/50 bg-cyber/5 text-cyber",
  Secondary: "border-border bg-secondary text-foreground",
  Reference: "border-border bg-secondary/60 text-muted-foreground",
};

const Sources = () => {
  return (
    <DocPageLayout
      eyebrow="Sources & Verification"
      title="Where every number comes from."
      intro="Transparent sourcing is the single most important property of OSINT. This page lists every source feeding the dashboard, what role it plays, and how to independently verify it."
    >
      <DocCallout label="One primary source · many cross-references">
        Every numerical figure on UA Defense Tracker resolves to a single primary
        source — the Air Force Command of the Armed Forces of Ukraine. The other
        sources below provide independent context, not numerical input.
      </DocCallout>

      <DocSection num="01" title="Source registry">
        <ul className="space-y-3">
          {SOURCES.map((s) => (
            <li
              key={s.name}
              className="rounded-md border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-foreground/30"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${ROLE_TONE[s.role]}`}
                >
                  {s.role}
                </span>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-base text-foreground hover:text-cyber"
                >
                  {s.name} ↗
                </a>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection num="02" title="How to verify a number">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Download the <a href="/data/missile_attacks_daily.csv" download>raw CSV</a>{" "}
            served alongside this site (identical to the Kaggle mirror at fetch time).
          </li>
          <li>
            Filter the rows by date range and weapon model corresponding to the
            chart you want to verify.
          </li>
          <li>
            Sum the <code className="rounded-sm bg-secondary px-1.5 font-mono text-[12px] text-foreground">launched</code> and{" "}
            <code className="rounded-sm bg-secondary px-1.5 font-mono text-[12px] text-foreground">destroyed</code> columns.
          </li>
          <li>
            Cross-check the original Air Force bulletin for that day on the
            Primary source above.
          </li>
        </ol>
      </DocSection>

      <DocSection num="03" title="What we explicitly do not source">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Russian MoD claims.</strong> Excluded due to repeatedly
            documented inconsistencies.
          </li>
          <li>
            <strong>Social-media sightings without provenance.</strong> Not
            integrated; OSINT requires reproducible chains.
          </li>
          <li>
            <strong>Casualty figures.</strong> Out of scope for this dashboard.
          </li>
        </ul>
      </DocSection>
    </DocPageLayout>
  );
};

export default Sources;
