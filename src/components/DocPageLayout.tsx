import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface Props {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

export function DocPageLayout({ eyebrow, title, intro, children }: Props) {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="container flex items-center justify-between gap-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("doc.topBack")}
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline">{eyebrow}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="container-prose py-12 md:py-16">
          <div className="src-label mb-3">{eyebrow}</div>
          <h1 className="t-h2 md:t-h1">
            {title}
          </h1>
          {intro && (
            <p className="mt-4 t-body-lg text-muted-foreground">
              {intro}
            </p>
          )}
        </div>
      </section>

      <section className="container-prose py-12 md:py-16">
        <div className="prose-doc space-y-10">{children}</div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">{t("doc.back")}</Link>
          <div className="flex flex-wrap gap-4">
            <Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link>
            <Link to="/methodology" className="hover:text-foreground">{t("nav.methodology")}</Link>
            <Link to="/sources" className="hover:text-foreground">{t("nav.sources")}</Link>
            <Link to="/changelog" className="hover:text-foreground">{t("nav.changelog")}</Link>
            <Link to="/disclaimer" className="hover:text-foreground">{t("footer.disclaimer")}</Link>
            <Link to="/imprint" className="hover:text-foreground">{t("nav.imprint")}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function DocSection({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-10 first:border-0 first:pt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="src-label">{num}</span>
        <h2 className="t-h3 md:t-h2 text-foreground">{title}</h2>
      </div>
      <div className="space-y-4 t-body text-muted-foreground [&_strong]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </section>
  );
}

export function DocCallout({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-destructive/40 bg-destructive/5"
      : "border-border bg-secondary/50";
  return (
    <div className={`rounded-sm border ${cls} p-5`}>
      <div className="src-label mb-2">{label}</div>
      <div className="t-body-sm text-foreground">{children}</div>
    </div>
  );
}
