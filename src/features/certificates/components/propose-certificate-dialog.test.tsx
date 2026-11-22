// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposeCertificateDialog } from "@/features/certificates/components/propose-certificate-dialog";
import { proposeCertificate } from "@/features/certificates/actions";

vi.mock("@/features/certificates/actions", () => ({
  proposeCertificate: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PROVIDERS = [
  { id: "00000000-0000-0000-0000-0000000000a1", name: "Amazon Web Services" },
  { id: "00000000-0000-0000-0000-0000000000a2", name: "Google Cloud" },
];

describe("ProposeCertificateDialog", () => {
  it("renders with default values and prefilled defaultName", () => {
    render(
      <ProposeCertificateDialog
        open
        onOpenChange={() => {}}
        defaultKind="exam"
        defaultName="Prefilled Exam Name"
        providers={PROVIDERS}
        onSuccess={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Propose a new certificate" })).toBeTruthy();
    expect((screen.getByLabelText(/^Certificate name/) as HTMLInputElement).value).toBe("Prefilled Exam Name");
  });

  it("submits the form successfully and triggers onSuccess", async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(proposeCertificate).mockResolvedValueOnce({
      ok: true,
      data: {
        id: "c-new",
        label: "New Kubernetes Cert",
        kind: "exam",
        grantingCourse: null,
        catalogueStatus: "pending",
      },
    });

    render(
      <ProposeCertificateDialog
        open
        onOpenChange={onOpenChange}
        defaultKind="exam"
        defaultName="New Kubernetes Cert"
        providers={PROVIDERS}
        onSuccess={onSuccess}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Propose & select" });
    await userEvent.click(submitBtn);

    await vi.waitFor(() => {
      expect(proposeCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Kubernetes Cert",
          kind: "exam",
          providerId: "00000000-0000-0000-0000-0000000000a1",
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "c-new",
          label: "New Kubernetes Cert",
          catalogueStatus: "pending",
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays server error message when proposal fails", async () => {
    vi.mocked(proposeCertificate).mockResolvedValueOnce({
      ok: false,
      error: "This certificate is already in the Catalogue.",
    });

    render(
      <ProposeCertificateDialog
        open
        onOpenChange={() => {}}
        defaultKind="exam"
        defaultName="Existing Cert"
        providers={PROVIDERS}
        onSuccess={() => {}}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Propose & select" });
    await userEvent.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This certificate is already in the Catalogue.");
  });

  it("renders course completion wording when kind is completion", () => {
    render(
      <ProposeCertificateDialog
        open
        onOpenChange={() => {}}
        defaultKind="completion"
        defaultName="ML Specialization"
        providers={PROVIDERS}
        onSuccess={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Propose a new course certificate" })).toBeTruthy();
    expect((screen.getByLabelText(/^Course certificate name/) as HTMLInputElement).value).toBe("ML Specialization");
  });
  it("preselects the provider given by id", () => {
    render(
      <ProposeCertificateDialog open onOpenChange={() => {}} defaultProviderId={PROVIDERS[1].id} providers={PROVIDERS} onSuccess={() => {}} />,
    );
    expect(document.getElementById("propose-provider-select")?.textContent).toContain("Google Cloud");
  });

  it("opens the new-provider field with a proposed provider name", () => {
    render(
      <ProposeCertificateDialog open onOpenChange={() => {}} defaultProviderId={null} defaultProposedProvider="Anthropic" providers={PROVIDERS} onSuccess={() => {}} />,
    );
    expect((screen.getByLabelText(/^Provider name/) as HTMLInputElement).value).toBe("Anthropic");
  });
});
