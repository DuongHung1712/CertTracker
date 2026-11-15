import { ChevronDown, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EXAM_ONLY_NOTE, GUIDE_COLUMNS } from "@/features/import/columns-guide";

/** Collapsible reference of every column the importer reads. A native disclosure: keyboard and screen-reader support for free. */
export function ColumnsGuide() {
  return (
    <details className="group max-w-3xl rounded-lg border bg-card" data-testid="columns-guide">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-body font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        Columns
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t px-3 py-3">
        <Alert>
          <Info aria-hidden />
          <AlertDescription className="text-foreground">{EXAM_ONLY_NOTE}</AlertDescription>
        </Alert>
        <p className="text-caption text-muted-foreground">
          Header spelling does not matter: case, accents and the other names listed here are read as the same column. Other columns are ignored.
        </p>
        <ul className="flex flex-col divide-y">
          {GUIDE_COLUMNS.map((column) => (
            <li key={column.field} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-body font-medium">{column.header}</span>
                <span className={column.required ? "text-caption font-medium text-primary" : "text-caption text-muted-foreground"}>
                  {column.required ? "Required" : "Optional"}
                </span>
              </div>
              <p className="text-body wrap-anywhere">{column.description}</p>
              <p className="text-caption text-muted-foreground wrap-anywhere">
                {`Example: ${column.example}`}
                {column.aliases.length > 0 && ` · Also accepted: ${column.aliases.join(", ")}`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
