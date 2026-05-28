import { useTranslation } from "react-i18next";
import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

export default function Imprint() {
  const { t } = useTranslation();

  return (
    <DocPageLayout
      eyebrow={t("imprintPage.eyebrow")}
      title={t("imprintPage.title")}
      intro={t("imprintPage.intro")}
    >
      <DocCallout label={t("imprintPage.todoLabel")} tone="warn">
        {t("imprintPage.todoBody")}
      </DocCallout>

      <DocSection num="01" title={t("imprintPage.s1Title")}>
        <dl className="grid gap-y-3 gap-x-6 md:grid-cols-[minmax(180px,auto)_1fr] [&_dt]:font-mono [&_dt]:text-[11px] [&_dt]:uppercase [&_dt]:tracking-[0.16em] [&_dt]:text-muted-foreground [&_dd]:text-foreground">
          <dt>{t("imprintPage.operator")}</dt>
      <DocSection num="01" title={t("imprintPage.s1Title")}>
        <dl className="grid gap-y-3 gap-x-6 md:grid-cols-[minmax(180px,auto)_1fr] [&_dt]:font-mono [&_dt]:text-[11px] [&_dt]:uppercase [&_dt]:tracking-[0.16em] [&_dt]:text-muted-foreground [&_dd]:text-foreground">
          <dt>{t("imprintPage.operator")}</dt>
          <dd>Alexander Anton-Boicuk</dd>
          <dt>{t("imprintPage.address")}</dt>
          <dd>[ TODO — Straße, PLZ, Ort, Land ]</dd>
          <dt>{t("imprintPage.email")}</dt>
          <dd>
            <a href="mailto:[TODO]@example.org" className="underline underline-offset-4">
              [TODO]@example.org
            </a>
          </dd>
          <dt>{t("imprintPage.responsible")}</dt>
          <dd>Alexander Anton-Boicuk</dd>
        </dl>
      </DocSection>

        <p>{t("imprintPage.liabilityLinks")}</p>
      </DocSection>

      <DocSection num="03" title={t("imprintPage.s3Title")}>
        <p>{t("imprintPage.copyright")}</p>
        <p>
          {t("imprintPage.dataLicensePre")}{" "}
          <a
            href="https://opendatacommons.org/licenses/by/1-0/"
            target="_blank"
            rel="noopener noreferrer external"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Open Data Commons Attribution License (ODC-BY 1.0)
          </a>
          {t("imprintPage.dataLicensePost")}
        </p>
      </DocSection>
    </DocPageLayout>
  );
}
