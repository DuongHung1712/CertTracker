import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogueTabs } from "./catalogue-tabs";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const render = (props: { pendingCertificates?: number; pendingCourses?: number }) =>
  renderToStaticMarkup(<CatalogueTabs certificates={<p>c</p>} courses={<p>k</p>} {...props} />);

describe("CatalogueTabs pending counts", () => {
  it("shows how many proposals wait on each tab, with a spoken label", () => {
    const html = render({ pendingCertificates: 2, pendingCourses: 1 });
    expect(html).toContain("waiting for approval");
    expect(html.match(/waiting for approval/g)).toHaveLength(2);
    expect(html).toMatch(/Certificates[^]*?>2</);
    expect(html).toMatch(/Courses[^]*?>1</);
  });

  it("shows nothing at zero or when the viewer is not an admin", () => {
    expect(render({})).not.toContain("waiting for approval");
    expect(render({ pendingCertificates: 0, pendingCourses: 0 })).not.toContain("waiting for approval");
  });
});
