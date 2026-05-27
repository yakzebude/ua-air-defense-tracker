import { useTranslation } from "react-i18next";
import { DocPageLayout } from "@/components/DocPageLayout";
import { CHANGELOG, type ChangelogEntryKind } from "@/data/changelog";

const KIND_TONE: Record<ChangelogEntryKind, string> = {
  data: "border-foreground/30 text-foreground",
  revision: "border-[hsl(var(--signal))]/50 text-[hsl(var(--signal))]",
  release: "border-[hsl(var(--signal-ok))]/50 text-[hsl(var(--signal-ok))]",
  methodology: "border-[hsl(var(--signal-warn))]/60 text-[hsl(var(--signal-warn))]",
};

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export default function Changelog() {
  const { t } = useTranslation();

  return (
    <DocPageLayout
      eyebrow={t("changelog.eyebrow")}
      title={t("changelog.title")}
      intro={t("changelog.intro")}
    >
      <ol className="space-y-6">
        {CHANGELOG.map((entry, i) => (
          <li
            key={`${entry.date}-${i}`}
            className="grid gap-3 border-t border-border pt-6 first:border-0 first:pt-0 md:grid-cols-[160px_1fr]"
          >
            <div className="flex flex-col gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="num text-foreground">{formatDate(entry.date)}</span>
              <span
                className={`inline-flex w-fit rounded-sm border px-1.5 py-0.5 ${KIND_TONE[entry.kind]}`}
              >
                {t(`changelog.kinds.${entry.kind}`)}
              </span>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                {entry.title}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {entry.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </DocPageLayout>
  );
}
