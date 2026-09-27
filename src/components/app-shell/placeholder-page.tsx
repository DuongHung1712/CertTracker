import { PageHeader } from "@/components/app-shell/page-header";

export function PlaceholderPage({ title, description, week }: { title: string; description: string; week: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <p className="rounded-lg border bg-card p-6 text-body text-muted-foreground">
        Màn hình này sẽ có ở tuần {week}.
      </p>
    </div>
  );
}
