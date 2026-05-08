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
      {/* Top bar */}
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between py-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <Link
            to="/"
            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            UA Defense Tracker
          </Link>
          <span className="hidden md:inline">{eyebrow}</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-tactical-grid">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--cyber)/0.08),transparent_70%)]" />
        <div className="container relative py-14 md:py-20">
          <div className="mb-3 inline-flex items-center gap-2 rounded-sm border border-cyber/40 bg-cyber/5 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyber">
            <span className="h-1.5 w-1.5 rounded-full bg-cyber pulse-soft" />
            {eyebrow}
          </div>
          <h1 className="font-display text-3xl leading-tight tracking-tight md:text-5xl">
            {title}
          </h1>
          {intro && (
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {intro}
            </p>
          )}
        </div>
      </section>

      {/* Body */}
      <section className="container py-12 md:py-16">
        <div className="prose-doc mx-auto max-w-3xl space-y-10">{children}</div>
      </section>

      {/* Footer cross-links */}
      <footer className="border-t border-border">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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

/* ------------------------- Shared section building blocks ----------------- */

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
    <section className="border-t border-border pt-8 first:border-0 first:pt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {num}
        </span>
        <h2 className="font-display text-xl text-foreground md:text-2xl">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_a]:text-cyber [&_a]:underline-offset-4 hover:[&_a]:underline">
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
      : "border-border bg-card/60";
  return (
    <div className={`rounded-md border ${cls} p-4 backdrop-blur`}>
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}
