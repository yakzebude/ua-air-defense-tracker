import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

const Methodology = () => {
  return (
    <DocPageLayout
      eyebrow="Methodology"
      title="How we turn daily reports into intelligence."
      intro="Every figure on UA Defense Tracker is derived from a single, fully open primary source: the daily air-defense bulletins issued by the Air Force Command of the Armed Forces of Ukraine. This page documents the exact pipeline, definitions, and limitations behind the dashboard."
    >
      <DocSection num="01" title="Primary source">
        <p>
          We aggregate the daily reports published on the official channels of the
          <strong> Air Force Command of the Armed Forces of Ukraine </strong>(Повітряні
          сили ЗСУ). The structured CSV mirror is maintained by the open-source
          dataset <a href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine" target="_blank" rel="noopener noreferrer">“Massive Missile Attacks on Ukraine”</a> on
          Kaggle, which converts the daily Telegram/Facebook posts into a normalized
          time series.
        </p>
        <p>
          Coverage starts <strong>October 2022</strong>, the first month with
          consistent daily disclosure of both launched and destroyed counts per
          weapon model, and runs to the latest published bulletin.
        </p>
      </DocSection>

      <DocSection num="02" title="Update cadence">
        <p>
          The upstream dataset is refreshed when new daily bulletins are issued —
          typically within hours of the morning Air Force briefing. Our dashboard
          re-reads the CSV on every page load, so the “Last update” chip in the
          status bar reflects the most recent <strong>data point</strong> in the
          file, not the time of your visit.
        </p>
        <DocCallout label="Live data atmosphere — what this means">
          We do not poll a streaming feed. The interface is built around a
          near-real-time daily cadence. Treat hour-level changes as noise; trust
          day- and month-level movement.
        </DocCallout>
      </DocSection>

      <DocSection num="03" title="Definitions">
        <p>
          <strong>Launched.</strong> The number of weapons of a given model that
          Ukrainian air defense observed entering Ukrainian airspace or being fired
          at Ukrainian territory in the reporting window.
        </p>
        <p>
          <strong>Destroyed.</strong> The number of those weapons that Ukrainian
          air defense reports as intercepted, suppressed, or otherwise neutralized
          before reaching their target.
        </p>
        <p>
          <strong>Through-rate.</strong> Calculated as
          <code className="mx-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground">launched − destroyed</code>
          — the count of weapons that were not confirmed intercepted. It is an
          upper bound on impacts, since some weapons fail in flight, are jammed,
          or land in unpopulated areas.
        </p>
        <p>
          <strong>Interception rate.</strong>
          <code className="mx-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground">destroyed ÷ launched</code>,
          expressed as a percentage. Computed per category and per month.
        </p>
      </DocSection>

      <DocSection num="04" title="Category mapping">
        <p>
          Each row in the source CSV lists one or more weapon models. We assign
          rows to three weapon families:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>UAVs (Shahed, etc.).</strong> Loitering munitions identified
            as <em>Shahed-136/131</em>.
          </li>
          <li>
            <strong>Cruise / air-to-surface missiles.</strong> Kalibr,
            X-101 / X-555, X-22, X-59 / X-69, Iskander-K, P-800 Oniks, and other
            cruise systems.
          </li>
          <li>
            <strong>Ballistic.</strong> Iskander-M / KN-23, Kinzhal, 3M22 Zircon,
            S-300/S-400 fired in surface-to-surface mode, and ICBM-class systems.
          </li>
        </ul>
        <p>
          Mixed-model rows (e.g. “Kalibr + Iskander-M”) contribute to{" "}
          <strong>every category they list</strong>. This is conservative for
          totals across categories but matches how the Air Force itself reports
          combined salvos.
        </p>
      </DocSection>

      <DocSection num="05" title="Aggregation">
        <p>
          Daily entries are bucketed by the <strong>start date</strong> of the
          reporting window into calendar months (UTC). Charts render the
          continuous month axis from October 2022 onward, including months with
          zero activity, so escalation patterns are not visually compressed.
        </p>
      </DocSection>

      <DocSection num="06" title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Single-source bias.</strong> All figures originate from one
            party to the conflict. We do not cross-reference Russian MoD claims,
            which are systematically inconsistent.
          </li>
          <li>
            <strong>Detection floor.</strong> Very small or stealthy systems may
            be undercounted in “launched.”
          </li>
          <li>
            <strong>Attribution of destruction.</strong> Some weapons crash,
            are jammed, or are downed by EW rather than kinetic interception. The
            Air Force counts these as “destroyed”; we follow that convention.
          </li>
          <li>
            <strong>Mid-month corrections.</strong> Occasionally totals are
            revised in later bulletins; we always reflect the latest CSV.
          </li>
        </ul>
      </DocSection>

      <DocSection num="07" title="Verification you can do yourself">
        <p>
          Every number on this site is reproducible from the public CSV. You can
          download the raw file and replicate any chart in a spreadsheet:
        </p>
        <p>
          <a href="/data/missile_attacks_daily.csv" download>↓ Download raw CSV</a>
          {"  ·  "}
          <a href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine" target="_blank" rel="noopener noreferrer">View upstream dataset</a>
        </p>
      </DocSection>
    </DocPageLayout>
  );
};

export default Methodology;
