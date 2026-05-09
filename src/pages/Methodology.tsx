import { Trans, useTranslation } from "react-i18next";
import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

const Methodology = () => {
  const { t } = useTranslation();
  return (
    <DocPageLayout
      eyebrow={t("methodologyPage.eyebrow")}
      title={t("methodologyPage.title")}
      intro={t("methodologyPage.intro")}
    >
      <DocSection num="01" title={t("methodologyPage.s1Title")}>
        <p>
          <Trans
            i18nKey="methodologyPage.s1p1"
            components={{
              strong: <strong />,
              a: (
                <a
                  href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
            }}
          />
        </p>
        <p>
          <Trans i18nKey="methodologyPage.s1p2" components={{ strong: <strong /> }} />
        </p>
      </DocSection>

      <DocSection num="02" title={t("methodologyPage.s2Title")}>
        <p>
          <Trans i18nKey="methodologyPage.s2p1" components={{ strong: <strong /> }} />
        </p>
        <DocCallout label={t("methodologyPage.s2callLabel")}>
          {t("methodologyPage.s2callBody")}
        </DocCallout>
      </DocSection>

      <DocSection num="03" title={t("methodologyPage.s3Title")}>
        <p><Trans i18nKey="methodologyPage.s3p1" components={{ strong: <strong /> }} /></p>
        <p><Trans i18nKey="methodologyPage.s3p2" components={{ strong: <strong /> }} /></p>
        <p>
          <Trans
            i18nKey="methodologyPage.s3p3"
            components={{
              strong: <strong />,
              code: <code className="mx-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground" />,
            }}
          />
        </p>
        <p>
          <Trans
            i18nKey="methodologyPage.s3p4"
            components={{
              strong: <strong />,
              code: <code className="mx-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground" />,
            }}
          />
        </p>
      </DocSection>

      <DocSection num="04" title={t("methodologyPage.s4Title")}>
        <p>{t("methodologyPage.s4p1")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><Trans i18nKey="methodologyPage.s4l1" components={{ strong: <strong />, em: <em /> }} /></li>
          <li><Trans i18nKey="methodologyPage.s4l2" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="methodologyPage.s4l3" components={{ strong: <strong /> }} /></li>
        </ul>
        <p><Trans i18nKey="methodologyPage.s4p2" components={{ strong: <strong /> }} /></p>
      </DocSection>

      <DocSection num="05" title={t("methodologyPage.s5Title")}>
        <p><Trans i18nKey="methodologyPage.s5p1" components={{ strong: <strong /> }} /></p>
      </DocSection>

      <DocSection num="06" title={t("methodologyPage.s6Title")}>
        <ul className="list-disc space-y-2 pl-5">
          <li><Trans i18nKey="methodologyPage.s6l1" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="methodologyPage.s6l2" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="methodologyPage.s6l3" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="methodologyPage.s6l4" components={{ strong: <strong /> }} /></li>
        </ul>
      </DocSection>

      <DocSection num="07" title={t("methodologyPage.s7Title")}>
        <p>{t("methodologyPage.s7p1")}</p>
        <p>
          <a href="/data/missile_attacks_daily.csv" download>{t("methodologyPage.s7Download")}</a>
          {"  ·  "}
          <a href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine" target="_blank" rel="noopener noreferrer">
            {t("methodologyPage.s7Upstream")}
          </a>
        </p>
      </DocSection>
    </DocPageLayout>
  );
};

export default Methodology;
