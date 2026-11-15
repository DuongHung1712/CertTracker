import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileDropzone } from "@/components/file-dropzone";

const props = { id: "f", file: null, onChange: () => {}, accept: ".xlsx", maxBytes: 10, onReject: () => {} };

describe("FileDropzone", () => {
  it("points the file input at the description element when given one", () => {
    expect(renderToStaticMarkup(<FileDropzone {...props} describedBy="f-hint" />)).toMatch(/<input[^>]*aria-describedby="f-hint"/);
  });

  it("adds no aria-describedby by default", () => {
    expect(renderToStaticMarkup(<FileDropzone {...props} />)).not.toContain("aria-describedby");
  });
});
