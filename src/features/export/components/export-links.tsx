import { buttonVariants } from "@/components/ui/button";

const LINK = buttonVariants({ variant: "outline", size: "sm" });

/** Plain anchors (not Base UI `render` on a non-button): the browser downloads the response itself. */
export function ExportLinks() {
  return (
    <>
      <a href="/api/export/records?format=csv" download className={LINK}>
        Xuất CSV
      </a>
      <a href="/api/export/records?format=xlsx" download className={LINK}>
        Xuất Excel
      </a>
    </>
  );
}
