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


      <DocSection num="02" title={t("aboutPage.s2Title")}>
        <p>{t("aboutPage.missionP1")}</p>
        <p>{t("aboutPage.missionP2")}</p>
        <DocCallout label={t("aboutPage.notLabel")}>
          <Trans i18nKey="aboutPage.notBody" />
        </DocCallout>
      </DocSection>

      <DocSection num="03" title={t("aboutPage.s3Title")}>
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

      <DocSection num="04" title={t("aboutPage.s4Title")}>
        <p>{t("aboutPage.citationIntro")}</p>
        <div className="space-y-3">
          <div className="src-label">APA</div>
          <pre className="overflow-x-auto rounded-sm border border-border bg-secondary/60 p-3 font-mono text-[12px] leading-relaxed text-foreground">
{`Ivaniuk, P. (${new Date().getUTCFullYear()}). UA Defense Tracker — Ukraine air defense aggregated data [Dataset]. https://ua-airdefense-tracker.org/`}
          </pre>
          <div className="src-label">BibTeX</div>
          <pre className="overflow-x-auto rounded-sm border border-border bg-secondary/60 p-3 font-mono text-[12px] leading-relaxed text-foreground">
{`@dataset{ivaniuk_ua_airdefense_${new Date().getUTCFullYear()},
  author = {Ivaniuk, Petro},
  title  = {UA Defense Tracker — Ukraine air defense aggregated data},
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
