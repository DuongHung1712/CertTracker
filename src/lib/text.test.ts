import { describe, expect, it } from "vitest";
import { foldText } from "@/lib/text";

describe("foldText", () => {
  it("strips Vietnamese diacritics and lowercases", () => {
    expect(foldText("Nguyễn Văn An")).toBe("nguyen van an");
    expect(foldText("ĐẶNG Thị Đào")).toBe("dang thi dao");
  });

  it("treats precomposed and decomposed input the same", () => {
    expect(foldText("Trần".normalize("NFD"))).toBe(foldText("Trần".normalize("NFC")));
  });

  it("trims and collapses whitespace", () => {
    expect(foldText("  AWS   SAA ")).toBe("aws saa");
  });
});
