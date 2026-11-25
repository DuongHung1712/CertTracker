import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogueTabs } from "./catalogue-tabs";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const render = (props: {
  pendingCertificates?: number;
  pendingCourses?: number;
  certTypes?: React.ReactNode;
  providers?: React.ReactNode;
}) => renderToStaticMarkup(<CatalogueTabs certificates={<p>c</p>} courses={<p>k</p>} {...props} />);

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

  it("shows Certificate types and Providers tabs only when provided (Admin)", () => {
    const nonAdmin = render({});
    expect(nonAdmin).not.toContain("Certificate types");
    expect(nonAdmin).not.toContain("Providers");

    const admin = render({ certTypes: <p>t</p>, providers: <p>p</p> });
    expect(admin).toContain("Certificate types");
    expect(admin).toContain("Providers");
  });
});
