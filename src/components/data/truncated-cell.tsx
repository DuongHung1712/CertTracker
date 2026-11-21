/** A table cell for long text: two wrapped lines below md (a tooltip is out of reach on touch and keyboard), one line with an ellipsis and the full text as tooltip from md up. */
export function TruncatedCell({ text }: { text: string }) {
  return (
    <span className="block max-w-56 line-clamp-2 break-words md:truncate" title={text}>
      {text}
    </span>
  );
}
