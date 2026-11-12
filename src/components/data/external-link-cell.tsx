import { ExternalLink } from "lucide-react";

/** Table cell for an optional URL: an icon link that opens in a new tab, or a dash. */
export function ExternalLinkCell({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex text-muted-foreground hover:text-foreground"
    >
      <ExternalLink aria-hidden className="size-4" />
    </a>
  );
}
