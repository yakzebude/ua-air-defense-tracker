import { Trans, useTranslation } from "react-i18next";
import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

const Disclaimer = () => {
  const { t } = useTranslation();
  return (
    <DocPageLayout
      eyebrow={t("disclaimerPage.eyebrow")}
      title={t("disclaimerPage.title")}
      intro={t("disclaimerPage.intro")}
    >
      <DocCallout label={t("disclaimerPage.calloutLabel")} tone="warn">
        <Trans i18nKey="disclaimerPage.calloutBody" components={{ strong: <strong /> }} />
      </DocCallout>

      <DocSection num="01" title={t("disclaimerPage.s1Title")}>
        <p>{t("disclaimerPage.s1p1")}</p>
      </DocSection>

      <DocSection num="02" title={t("disclaimerPage.s2Title")}>
        <p>
          {t("disclaimerPage.s2p1Pre")}
          <a href="/methodology">{t("disclaimerPage.s2p1Link")}</a>
          {t("disclaimerPage.s2p1Post")}
        </p>
      </DocSection>

      <DocSection num="03" title={t("disclaimerPage.s3Title")}>
        <p>{t("disclaimerPage.s3p1")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("disclaimerPage.s3l1")}</li>
          <li>{t("disclaimerPage.s3l2")}</li>
          <li>{t("disclaimerPage.s3l3")}</li>
        </ul>
      </DocSection>

      <DocSection num="04" title={t("disclaimerPage.s4Title")}>
        <p>{t("disclaimerPage.s4p1")}</p>
      </DocSection>

      <DocSection num="05" title={t("disclaimerPage.s5Title")}>
        <ul className="list-disc space-y-2 pl-5">
          <li><Trans i18nKey="disclaimerPage.s5l1" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="disclaimerPage.s5l2" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="disclaimerPage.s5l3" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="disclaimerPage.s5l4" components={{ strong: <strong /> }} /></li>
        </ul>
      </DocSection>

      <DocSection num="06" title={t("disclaimerPage.s6Title")}>
        <p>{t("disclaimerPage.s6p1")}</p>
      </DocSection>
    </DocPageLayout>
  );
};

export default Disclaimer;
