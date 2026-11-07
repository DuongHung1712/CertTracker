import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINK = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
  "min-h-[44px] sm:min-h-[36px] gap-1.5"
);

/** Plain anchors (not Base UI `render` on a non-button): the browser downloads the response itself. */
export function ExportLinks() {
  return (
    <>
      <a href="/api/export/records?format=csv" download className={LINK}>
        <Download aria-hidden className="size-4" />
        Export CSV
      </a>
      <a href="/api/export/records?format=xlsx" download className={LINK}>
        <Download aria-hidden className="size-4" />
        Export Excel
      </a>
    </>
  );
}
