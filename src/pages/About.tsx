import { Trans, useTranslation } from "react-i18next";
import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

export default function About() {
  const { t } = useTranslation();

  return (
    <DocPageLayout
      eyebrow={t("aboutPage.eyebrow")}
      title={t("aboutPage.title")}
      intro={t("aboutPage.intro")}
    >
      <DocSection num="01" title={t("aboutPage.s1Title")}>
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary font-mono text-lg font-semibold tracking-[0.18em] text-foreground"
          >
            PI
          </div>
          <div className="space-y-3">
            <p>
              <strong>Petro Ivaniuk</strong> — {t("aboutPage.role")}
            </p>
            <p>{t("aboutPage.bio")}</p>
            <ul className="flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.16em]">
              <li>
                <a
                  href="https://www.kaggle.com/piterfm"
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="rounded-sm border border-border px-2.5 py-1 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Kaggle ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/PetroIvaniuk"
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="rounded-sm border border-border px-2.5 py-1 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  GitHub ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 border-t border-border pt-6 md:flex-row md:items-start">
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary font-mono text-lg font-semibold tracking-[0.18em] text-foreground"
          >
            AA
          </div>
          <div className="space-y-3">
            <p>
              <strong>Alexander Anton-Boicuk</strong> — {t("aboutPage.maintainerRole")}
            </p>
            <p>{t("aboutPage.maintainerBio")}</p>
          </div>
        </div>
      </DocSection>

      <DocSection num="02" title="Project purpose">
        <p>
          UA Air Defense Tracker is a public-interest OSINT dashboard that aggregates and republishes
          Ukrainian air-defense data in a verifiable, machine-readable form. It exists so that
          journalists, researchers, policymakers and the general public can read the same numbers
          the same way — without paywalls, without spin, and without losing the methodology.
        </p>
      </DocSection>

      <DocSection num="03" title="Methodology summary">
        <p>
          Every figure on the dashboard travels through a documented five-step pipeline:
          <strong> source reports → collection → validation → aggregation → publication</strong>.
          Inputs are official Ukrainian Air Force Command briefings, oblast administrations, and
          named OSINT channels. Conflicting numbers are flagged; we use the most conservative
          figure and tag every value with its confidence class (<em>Reported</em>,
          <em> Confirmed</em>, <em>Estimated</em>).
        </p>
        <p>
          The full methodology — including how interception rate, leakers and rolling 30-day
          windows are computed — lives at <a href="/methodology">/methodology</a>.
        </p>
      </DocSection>

      <DocSection num="04" title="Data sources">
        <p>
          We do not generate primary intelligence. We aggregate it. The complete, versioned source
          list — with URLs, update cadences and known reliability notes — is published at{" "}
          <a href="/sources">/sources</a>. Live air-alert data is sourced from{" "}
          <a href="https://www.ukrainealarm.com" target="_blank" rel="noopener noreferrer external">ukrainealarm.com</a>{" "}
          and refreshed every 60 seconds; aggregated launch / interception figures originate from
          the daily reports of the Ukrainian Air Force Command.
        </p>
      </DocSection>

      <DocSection num="05" title="Transparency statement">
        <p>
          We publish the underlying CSVs alongside the dashboard. Any chart you see here can be
          reproduced from those files. Revisions are kept in the upstream dataset history. If
          you can replicate our figures, you can also challenge them — and we welcome that.
          Corrections are filed publicly, not silently.
        </p>
        <DocCallout label="No advocacy, no fundraising for this project">
          UA Air Defense Tracker does not solicit donations for itself, does not sell ads, and is
          not affiliated with any government or political party. Where the dashboard recommends
          humanitarian or defense organisations, they are clearly labelled as third-party links.
        </DocCallout>
      </DocSection>

      <DocSection num="06" title="Open-data commitment">
        <p>
          The aggregated dataset is released under{" "}
          <a href="https://opendatacommons.org/licenses/by/1-0/" target="_blank" rel="noopener noreferrer external">
            ODC-BY 1.0
          </a>{" "}
          — free to use, modify and redistribute for any purpose, including commercial use, with
          attribution. Bulk downloads (CSV, JSON, Frictionless Data Package) are linked from the
          footer of every page.
        </p>
      </DocSection>

      <DocSection num="07" title={t("aboutPage.s2Title")}>
        <p>{t("aboutPage.missionP1")}</p>
        <p>{t("aboutPage.missionP2")}</p>
        <DocCallout label={t("aboutPage.notLabel")}>
          <Trans i18nKey="aboutPage.notBody" />
        </DocCallout>
      </DocSection>


      <DocSection num="08" title={t("aboutPage.s3Title")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{t("aboutPage.principle1Label")}</strong> {t("aboutPage.principle1")}
          </li>
          <li>
            <strong>{t("aboutPage.principle2Label")}</strong> {t("aboutPage.principle2")}
          </li>
          <li>
            <strong>{t("aboutPage.principle3Label")}</strong> {t("aboutPage.principle3")}
          </li>
          <li>
            <strong>{t("aboutPage.principle4Label")}</strong>{" "}
            <a
              href="https://opendatacommons.org/licenses/by/1-0/"
              target="_blank"
              rel="noopener noreferrer external"
              className="underline underline-offset-4 hover:text-foreground"
            >
              ODC-BY 1.0
            </a>{" "}
            — {t("aboutPage.principle4")}
          </li>
        </ul>
      </DocSection>

      <DocSection num="09" title={t("aboutPage.s4Title")}>
        <p>{t("aboutPage.citationIntro")}</p>
        <div className="space-y-3">
          <div className="src-label">APA</div>
          <pre className="overflow-x-auto rounded-sm border border-border bg-secondary/60 p-3 font-mono text-[12px] leading-relaxed text-foreground">
{`Ivaniuk, P. (${new Date().getUTCFullYear()}). UA Air Defense Tracker — Ukraine air defense aggregated data [Dataset]. https://ua-airdefense-tracker.org/`}
          </pre>
          <div className="src-label">BibTeX</div>
          <pre className="overflow-x-auto rounded-sm border border-border bg-secondary/60 p-3 font-mono text-[12px] leading-relaxed text-foreground">
{`@dataset{ivaniuk_ua_airdefense_${new Date().getUTCFullYear()},
  author = {Ivaniuk, Petro},
  title  = {UA Air Defense Tracker — Ukraine air defense aggregated data},
  year   = {${new Date().getUTCFullYear()}},
  url    = {https://ua-airdefense-tracker.org/},
  note   = {Aggregated from Ukrainian Air Force Command daily reports}
}`}
          </pre>
        </div>
      </DocSection>
    </DocPageLayout>
  );
}
