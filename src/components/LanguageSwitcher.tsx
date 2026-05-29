import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, type Lang } from "@/lib/i18n";

const LABELS: Record<Lang, string> = {
  en: "EN",
  de: "DE",
  fr: "FR",
  uk: "UA",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2) as Lang;
  return (
    <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
      {SUPPORTED_LANGS.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            onClick={() => i18n.changeLanguage(l)}
            aria-current={active ? "true" : undefined}
            className={`rounded-sm px-2 py-0.5 transition-colors ${
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
