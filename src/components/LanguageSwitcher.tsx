import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
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
    <div className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.16em]">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {SUPPORTED_LANGS.map((l) => {
        const active = l === current;
        return (
          <button
            key={l}
            onClick={() => i18n.changeLanguage(l)}
            aria-current={active ? "true" : undefined}
            className={`rounded-sm px-1.5 py-0.5 transition-colors ${
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
