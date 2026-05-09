import { Trans, useTranslation } from "react-i18next";
import { DocPageLayout, DocSection, DocCallout } from "@/components/DocPageLayout";

type SourceRole = "Primary" | "Mirror" | "Secondary" | "Reference";

type Source = {
  key: string;
  name: string;
  role: SourceRole;
  href: string;
};

const SOURCES: Source[] = [
  { key: "afc", name: "Air Force Command of the Armed Forces of Ukraine", role: "Primary", href: "https://www.facebook.com/kpszsu" },
  { key: "kaggle", name: "Massive Missile Attacks on Ukraine — Kaggle dataset", role: "Mirror", href: "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine" },
  { key: "genstaff", name: "General Staff of the Armed Forces of Ukraine", role: "Reference", href: "https://www.facebook.com/GeneralStaff.ua" },
  { key: "oryx", name: "Oryx — Attack On Europe: Documenting Russian Equipment Losses", role: "Secondary", href: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html" },
  { key: "liveuamap", name: "Liveuamap", role: "Reference", href: "https://liveuamap.com/" },
  { key: "isw", name: "Institute for the Study of War (ISW)", role: "Reference", href: "https://www.understandingwar.org/backgrounder/ukraine-conflict-updates" },
];

const ROLE_TONE: Record<SourceRole, string> = {
  Primary: "border-ua-yellow/50 bg-ua-yellow/5 text-ua-yellow",
  Mirror: "border-cyber/50 bg-cyber/5 text-cyber",
  Secondary: "border-border bg-secondary text-foreground",
  Reference: "border-border bg-secondary/60 text-muted-foreground",
};

const Sources = () => {
  const { t } = useTranslation();
  return (
    <DocPageLayout
      eyebrow={t("sourcesPage.eyebrow")}
      title={t("sourcesPage.title")}
      intro={t("sourcesPage.intro")}
    >
      <DocCallout label={t("sourcesPage.calloutLabel")}>
        {t("sourcesPage.calloutBody")}
      </DocCallout>

      <DocSection num="01" title={t("sourcesPage.s1Title")}>
        <ul className="space-y-3">
          {SOURCES.map((s) => (
            <li
              key={s.key}
              className="rounded-md border border-border bg-card/60 p-4 backdrop-blur transition-colors hover:border-foreground/30"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${ROLE_TONE[s.role]}`}>
                  {t(`sourcesPage.roles.${s.role}`)}
                </span>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="font-display text-base text-foreground hover:text-cyber">
                  {s.name} ↗
                </a>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`sourcesPage.items.${s.key}`)}
              </p>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection num="02" title={t("sourcesPage.s2Title")}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            {t("sourcesPage.s2l1Pre")}
            <a href="/data/missile_attacks_daily.csv" download>{t("sourcesPage.s2l1Link")}</a>
            {t("sourcesPage.s2l1Post")}
          </li>
          <li>{t("sourcesPage.s2l2")}</li>
          <li>
            {t("sourcesPage.s2l3Pre")}
            <code className="rounded-sm bg-secondary px-1.5 font-mono text-[12px] text-foreground">{t("sourcesPage.s2l3Launched")}</code>
            {t("sourcesPage.s2l3And")}
            <code className="rounded-sm bg-secondary px-1.5 font-mono text-[12px] text-foreground">{t("sourcesPage.s2l3Destroyed")}</code>
            {t("sourcesPage.s2l3Post")}
          </li>
          <li>{t("sourcesPage.s2l4")}</li>
        </ol>
      </DocSection>

      <DocSection num="03" title={t("sourcesPage.s3Title")}>
        <ul className="list-disc space-y-2 pl-5">
          <li><Trans i18nKey="sourcesPage.s3l1" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="sourcesPage.s3l2" components={{ strong: <strong /> }} /></li>
          <li><Trans i18nKey="sourcesPage.s3l3" components={{ strong: <strong /> }} /></li>
        </ul>
      </DocSection>
    </DocPageLayout>
  );
};

export default Sources;
