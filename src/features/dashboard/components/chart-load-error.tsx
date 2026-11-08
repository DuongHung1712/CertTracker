export function ChartLoadError() {
  return (
    <div
      role="alert"
      className="flex h-24 flex-col items-center justify-center gap-1 rounded border border-destructive/20 bg-destructive/5 px-2 text-center text-caption text-destructive"
    >
      <p className="font-medium">Could not load chart.</p>
    </div>
  );
}
