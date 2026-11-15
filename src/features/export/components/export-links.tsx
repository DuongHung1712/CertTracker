import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINK = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
  "gap-1.5"
);

/** Plain anchors (not Base UI `render` on a non-button): the browser downloads the response itself. */
export function ExportLinks({
  label,
  format = "csv",
  endpoint = "/api/export/records",
}: {
  label?: string;
  format?: "csv" | "xlsx";
  endpoint?: string;
} = {}) {
  if (label) {
    return (
      <a href={`${endpoint}?format=${format}`} download className={LINK}>
        <Download aria-hidden className="size-4" />
        {label}
      </a>
    );
  }
  return (
    <>
      <a href={`${endpoint}?format=csv`} download className={LINK}>
        <Download aria-hidden className="size-4" />
        Export CSV
      </a>
      <a href={`${endpoint}?format=xlsx`} download className={LINK}>
        <Download aria-hidden className="size-4" />
        Export Excel
      </a>
    </>
  );
}
