import { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  term: string;
  description: string;
  children?: ReactNode;
  compact?: boolean;
}

/**
 * Inline weapon-system term with an explanatory tooltip on hover/focus.
 * Used to disambiguate model names (Shahed-136, Kh-101, Iskander-M) for non-specialists.
 */
export function WeaponTerm({ term, description, children, compact }: Props) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
        >
          <span className={compact ? "" : "font-semibold"}>{children ?? term}</span>
          <HelpCircle aria-hidden className="h-3 w-3 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-[12px] leading-snug">
        <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {term}
        </div>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
