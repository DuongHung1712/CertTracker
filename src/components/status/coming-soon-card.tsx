import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComingSoonCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Shared placeholder card for upcoming features:
 * - Dashed 1px border `border-border`
 * - Small outlined chip with Clock icon and "Coming soon" in neutral tokens
 * - Title and one-line description
 * - High contrast text with disabled/aria-disabled controls
 */
export function ComingSoonCard({
  title,
  description,
  icon,
  children,
  className,
}: ComingSoonCardProps) {
  return (
    <section
      aria-label={`${title} (Coming soon)`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <span aria-hidden className="text-muted-foreground">{icon}</span>}
          <h3 className="text-body font-semibold text-foreground">{title}</h3>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-caption font-medium text-muted-foreground"
        >
          <Clock className="size-3 text-muted-foreground" aria-hidden />
          <span>Coming soon</span>
        </span>
      </div>
      <p className="text-caption text-muted-foreground">{description}</p>
      {children && <div className="mt-1 flex flex-col gap-2">{children}</div>}
    </section>
  );
}
