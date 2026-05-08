import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

const Disclaimer = () => {
  return (
    <DocPageLayout
      eyebrow="Disclaimer"
      title="What this site is — and what it isn’t."
      intro="UA Defense Tracker is an independent, non-commercial OSINT visualization. Read this page before citing the figures."
    >
      <DocCallout label="Independence" tone="warn">
        This project is <strong>not affiliated with</strong> the Government of
        Ukraine, the Armed Forces of Ukraine, NATO, the European Union, or any
        intelligence service. It is an open visualization layer over a public
        dataset.
      </DocCallout>

      <DocSection num="01" title="Nature of the data">
        <p>
          All figures derive from official daily bulletins of the Air Force
          Command of the Armed Forces of Ukraine. As such, they reflect the
          reporting of one party to an active armed conflict. Numbers may be
          revised retroactively as bulletins are corrected. We always serve the
          latest version of the upstream dataset.
        </p>
      </DocSection>

      <DocSection num="02" title="Fog of war">
        <p>
          In any active conflict, real-time figures are imperfect. Observation,
          attribution, and outcome assessment are subject to operational
          uncertainty. Read the{" "}
          <a href="/methodology">Methodology</a> page for a full list of
          limitations before drawing conclusions.
        </p>
      </DocSection>

      <DocSection num="03" title="Use of the visualizations">
        <p>
          You are welcome to share, embed, screenshot, and cite the
          visualizations on this site for journalistic, analytical, educational,
          and research purposes, provided you:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Attribute the underlying data to the Air Force Command of the Armed Forces of Ukraine.</li>
          <li>Link back to this dashboard when feasible.</li>
          <li>Do not present derived numbers as if they were independently verified by us.</li>
        </ul>
      </DocSection>

      <DocSection num="04" title="No operational guidance">
        <p>
          Nothing on this site constitutes military advice, targeting
          information, threat assessment for civilian protection, or
          investment guidance. The dashboard is a retrospective and
          near-real-time analytical view, not an early-warning system.
        </p>
      </DocSection>

      <DocSection num="05" title="Privacy & security">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>No personal data is collected.</strong> The site has no
            login, no comments, and no user accounts.
          </li>
          <li>
            <strong>Static, read-only architecture.</strong> The dashboard is a
            fully client-side application: it reads one public CSV file and
            renders charts in your browser. There is no backend that stores
            queries or behaviour.
          </li>
          <li>
            <strong>Transport security.</strong> All assets, including the CSV,
            are served over HTTPS.
          </li>
          <li>
            <strong>No third-party trackers</strong> beyond what your hosting
            provider may add at the network level.
          </li>
        </ul>
      </DocSection>

      <DocSection num="06" title="Corrections">
        <p>
          If you spot an aggregation, mapping, or labeling error, please open an
          issue on the source repository or contact the maintainer. Errors are
          fixed in-place; major changes are noted in the changelog of the
          upstream dataset.
        </p>
      </DocSection>
    </DocPageLayout>
  );
};

export default Disclaimer;
