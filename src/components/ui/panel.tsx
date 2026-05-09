import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  source?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
}

/**
 * Uniform card primitive used across the platform.
 * One border, one shadow, one radius — no gradients, no glow.
 */
export function Panel({
  title,
  subtitle,
  source,
  note,
  children,
  className,
  bodyClassName,
  action,
}: PanelProps) {
  const hasHeader = title || subtitle || action;
  return (
    <section className={cn("panel", className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 md:px-6">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[15px] font-semibold leading-tight text-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5 md:p-6", bodyClassName)}>{children}</div>
      {(source || note) && (
        <footer className="space-y-1 border-t border-border px-5 py-3 md:px-6">
          {source && <div className="src-label">{source}</div>}
          {note && (
            <div className="text-[11px] leading-snug text-muted-foreground">
              {note}
            </div>
          )}
        </footer>
      )}
    </section>
  );
}

/** Inline source label — small, muted, uppercase. */
export function SourceLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("src-label", className)}>{children}</div>;
}
