import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface Props {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

export function DocPageLayout({ eyebrow, title, intro, children }: Props) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="container flex items-center justify-between py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            UA Intel
          </Link>
          <span className="hidden md:inline">{eyebrow}</span>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="container py-10 md:py-14">
          <div className="src-label mb-2">{eyebrow}</div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-[2.25rem]">
            {title}
          </h1>
          {intro && (
            <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted-foreground md:text-[15px]">
              {intro}
            </p>
          )}
        </div>
      </section>

      <section className="container py-10 md:py-14">
        <div className="prose-doc mx-auto max-w-3xl space-y-8">{children}</div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to dashboard</Link>
          <div className="flex flex-wrap gap-4">
            <Link to="/methodology" className="hover:text-foreground">Methodology</Link>
            <Link to="/sources" className="hover:text-foreground">Sources</Link>
            <Link to="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
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
    <section className="border-t border-border pt-7 first:border-0 first:pt-0">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="src-label">{num}</span>
        <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{title}</h2>
      </div>
      <div className="space-y-3 text-[14px] leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
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
    <div className={`rounded-sm border ${cls} p-4`}>
      <div className="src-label mb-1.5">{label}</div>
      <div className="text-[13.5px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}
