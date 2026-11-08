import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    // aria-label gives the <section> the "region" role with a name (the e2e tests locate sections by it).
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section-title font-semibold text-foreground">{title}</h2>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SectionError({ title }: { title: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{`Could not load "${title}"`}</AlertTitle>
      <AlertDescription>Reload the page to try again. If it keeps failing, ask your admin.</AlertDescription>
    </Alert>
  );
}
