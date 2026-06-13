import { ReactNode } from "react";
import { HelpCircle, ArrowUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  term: string;
  description: string;
  children?: ReactNode;
  compact?: boolean;
  /** Search token used to pre-filter the Arsenal section. Defaults to `term`. */
  arsenalQuery?: string;
}

/**
 * Inline weapon-system term with an explanatory tooltip on hover/focus.
 * Clicking deep-links to the Arsenal section, pre-filtering the catalog
 * search via the `arsenal` URL query parameter.
 */
export function WeaponTerm({ term, description, children, compact, arsenalQuery }: Props) {
  const q = arsenalQuery ?? term;
  const href = `?arsenal=${encodeURIComponent(q)}#arsenal`;

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("arsenal", q);
    url.hash = "arsenal";
    window.history.pushState({}, "", url.toString());
    // Notify subscribers (Arsenal section) that the URL changed.
    window.dispatchEvent(new PopStateEvent("popstate"));
    document.getElementById("arsenal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <a
          href={href}
          onClick={onClick}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary hover:border-foreground/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
          aria-label={`${term} — view in Arsenal`}
        >
          <span className={compact ? "" : "font-semibold"}>{children ?? term}</span>
          <ArrowUpRight aria-hidden className="h-3 w-3 text-muted-foreground" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-[12px] leading-snug">
        <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {term}
        </div>
        {description}
        <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <HelpCircle aria-hidden className="h-3 w-3" />
          Click to view in Arsenal
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
