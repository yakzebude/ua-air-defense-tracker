import { ReactNode } from "react";

export type StatusLevel = "operational" | "delayed" | "unavailable";

const LEVEL_LABEL: Record<StatusLevel, string> = {
  operational: "Operational",
  delayed: "Delayed",
  unavailable: "Unavailable",
};

const LEVEL_DOT: Record<StatusLevel, string> = {
  operational: "bg-[hsl(var(--signal-ok))]",
  delayed:     "bg-[hsl(var(--signal-warn))]",
  unavailable: "bg-[hsl(var(--signal))]",
};

const LEVEL_RING: Record<StatusLevel, string> = {
  operational: "border-[hsl(var(--signal-ok)/0.35)] bg-[hsl(var(--signal-ok)/0.07)]",
  delayed:     "border-[hsl(var(--signal-warn)/0.4)] bg-[hsl(var(--signal-warn)/0.08)]",
  unavailable: "border-[hsl(var(--signal)/0.4)] bg-[hsl(var(--signal)/0.08)]",
};

/** Inline pill: small status dot + label. */
export function StatusBadge({ level, label }: { level: StatusLevel; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card/70 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-foreground">
      <span className="relative inline-flex h-1.5 w-1.5">
        {level === "operational" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${LEVEL_DOT[level]}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} />
      </span>
      <span>{label ?? LEVEL_LABEL[level]}</span>
    </span>
  );
}

/**
 * Full-width status banner used when a live source is delayed or unavailable.
 * Never shows raw error strings — explains, in plain language, what visitors
 * are seeing and points to the last-known-good data.
 */
export function StatusBanner({
  level,
  title,
  description,
  lastSuccess,
  meta,
}: {
  level: StatusLevel;
  title: string;
  description: ReactNode;
  lastSuccess?: string | null;
  meta?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`rounded-sm border px-4 py-3 ${LEVEL_RING[level]}`}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <StatusBadge level={level} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</div>
          {(lastSuccess || meta) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {lastSuccess && (
                <span>
                  Last successful update:{" "}
                  <span className="text-foreground">{lastSuccess}</span>
                </span>
              )}
              {meta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
