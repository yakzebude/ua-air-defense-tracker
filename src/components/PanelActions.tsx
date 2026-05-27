import { useState } from "react";
import { Download, Quote, ExternalLink, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { downloadCSV, toCSV, buildCitation, copyToClipboard } from "@/lib/csv";

const PRIMARY_SOURCE_URL =
  "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine";

interface Props {
  filename: string;
  rows: Array<Record<string, unknown>>;
  headers?: string[];
  panelTitle?: string;
  /** Override the verify-source URL (defaults to the Kaggle primary mirror). */
  sourceUrl?: string;
}

function ActionButton({
  onClick,
  href,
  title,
  children,
}: {
  onClick?: () => void;
  href?: string;
  title: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer external" title={title} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} className={className}>
      {children}
    </button>
  );
}

export function PanelActions({ filename, rows, headers, panelTitle, sourceUrl = PRIMARY_SOURCE_URL }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    if (!rows.length) return;
    downloadCSV(filename, toCSV(rows, headers));
  };

  const handleCite = async () => {
    const ok = await copyToClipboard(buildCitation(panelTitle));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <ActionButton onClick={handleExport} title={t("panel.exportCsv")}>
        <Download className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">{t("panel.exportCsvShort")}</span>
      </ActionButton>
      <ActionButton onClick={handleCite} title={t("panel.copyCitation")}>
        {copied ? <Check className="h-3 w-3" aria-hidden /> : <Quote className="h-3 w-3" aria-hidden />}
        <span className="hidden sm:inline">{copied ? t("panel.citationCopied") : t("panel.copyCitationShort")}</span>
      </ActionButton>
      <ActionButton href={sourceUrl} title={t("panel.verifySource")}>
        <ExternalLink className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">{t("panel.verify")}</span>
      </ActionButton>
    </div>
  );
}
