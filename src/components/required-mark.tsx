/** Red star after a required field's label; the control carries `aria-required` for screen readers. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}
