import { useTranslation } from "react-i18next";
import { DocPageLayout, DocSection } from "@/components/DocPageLayout";

export default function Imprint() {
  const { t } = useTranslation();

  return (
    <DocPageLayout
      eyebrow={t("imprintPage.eyebrow")}
      title={t("imprintPage.title")}
    >
      <DocSection num="01" title={t("imprintPage.s1Title")}>
        <dl className="grid gap-y-3 gap-x-6 md:grid-cols-[minmax(180px,auto)_1fr] [&_dt]:font-mono [&_dt]:text-[11px] [&_dt]:uppercase [&_dt]:tracking-[0.16em] [&_dt]:text-muted-foreground [&_dd]:text-foreground">
          <dt>{t("imprintPage.operator")}</dt>
          <dd>Alexander Anton-Boicuk</dd>
        </dl>
      </DocSection>
    </DocPageLayout>
  );
}
