// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { toast } from "sonner";
import { deleteRecords, reviewRecord } from "@/features/records/actions";
import { RecordsTable } from "@/features/records/components/records-table";

// The sheet and the delete action pull in server actions; neither is part of what these tests look at.
vi.mock("@/features/records/components/record-sheet", () => ({ RecordSheet: () => null }));
vi.mock("@/features/records/actions", () => ({ deleteRecord: vi.fn(), deleteRecords: vi.fn(), reviewRecord: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const RECORDS = [
  makeRecord({ id: "e1", certificateName: "AWS Solutions Architect", certificateKind: "exam" }),
  makeRecord({ id: "c1", certificateName: "Intro to Terraform", certificateKind: "completion" }),
  makeRecord({ id: "c2", certificateName: "Kubernetes Basics", certificateKind: "completion" }),
];

const table = (mode: "self" | "team", records = RECORDS) => (
  <RecordsTable
    records={records}
    memberOptions={[{ id: "m1", label: "Le Minh Chau" }]}
    certificateOptions={[{ id: "c", label: "AWS", kind: "exam", grantingCourse: null }]}
    studyCourses={[]}
    mode={mode}
    canDelete={false}
    showCompanyFields={false}
  />
);

const rowNames = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");

afterEach(cleanup);

describe("RecordsTable kind filter", () => {
  it("self mode: tabs with counts narrow the list to one kind", async () => {
    render(table("self"));
    expect(screen.getByRole("tab", { name: "All (3)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Exam certificates (1)" })).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Course certificates (2)" }));
    expect(rowNames().join("|")).toContain("Intro to Terraform");
    expect(rowNames().join("|")).not.toContain("AWS Solutions Architect");

    await userEvent.click(screen.getByRole("tab", { name: "Exam certificates (1)" }));
    expect(rowNames()).toHaveLength(1);
  });

  it("self mode: names the planned date by the chosen kind and offers the add action for both kinds", async () => {
    render(table("self"));
    expect(screen.getByRole("columnheader", { name: "Planned date" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Course certificates (2)" }));
    expect(screen.getByRole("columnheader", { name: "Planned finish date" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add certificate" })).toBeTruthy();
    expect(screen.getByText("Passed an exam or finished a course? Add the certificate with its proof.")).toBeTruthy();
  });

  it("team mode: a Kind select, not tabs", async () => {
    render(table("team"));
    expect(screen.queryByRole("tab")).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: "Kind" }));
    await userEvent.click(await screen.findByRole("option", { name: "Course certificates" }));
    expect(rowNames().join("|")).not.toContain("AWS Solutions Architect");
    expect(rowNames()).toHaveLength(2);
  });

  it("Clear filters resets the kind", async () => {
    render(table("self"));
    await userEvent.click(screen.getByRole("tab", { name: "Course certificates (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "All (3)" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("RecordsTable bulk delete", () => {
  const bulk = (count: number) => {
    vi.mocked(deleteRecords).mockResolvedValue({ ok: true, data: { count } });
    render(<RecordsTable records={RECORDS} memberOptions={[]} certificateOptions={[]} studyCourses={[]} mode="self" canDelete showCompanyFields={false} />);
  };
  const deleteSelected = async (confirmLabel: string) => {
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    await userEvent.click(within(screen.getByRole("region", { name: "Bulk actions" })).getByRole("button", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: confirmLabel }));
  };

  it("warns when fewer rows went than were selected, and clears the selection", async () => {
    vi.clearAllMocks();
    bulk(2);
    await deleteSelected("Delete 3 items");
    expect(toast.warning).toHaveBeenCalledWith("Deleted 2 of 3 items. The rest were already gone or you can't delete them.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Bulk actions" })).toBeNull();
  });

  it("reports plain success when every selected row went", async () => {
    vi.clearAllMocks();
    bulk(3);
    await deleteSelected("Delete 3 items");
    expect(toast.success).toHaveBeenCalledWith("Deleted 3 items");
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("RecordsTable approval", () => {
  const W1 = "5eed0000-0000-0000-0000-00000000c001";
  const WAITING = makeRecord({ id: W1, memberId: "m-other", memberName: "Other Member", approval: "waiting", certificateName: "Waiting Exam" });
  const OWN = makeRecord({ id: "w2", memberId: "m-boss", memberName: "The Boss", approval: "waiting", certificateName: "Own Exam" });
  const RETURNED = makeRecord({ id: "w3", memberId: "m-other", memberName: "Other Member", approval: "returned", approvalNote: "x", certificateName: "Returned Exam" });
  const APPROVED = makeRecord({ id: "w4", memberId: "m-other", memberName: "Other Member", certificateName: "Approved Exam" });
  const ALL = [WAITING, OWN, RETURNED, APPROVED];

  const view = (props: { canReview?: boolean; initialApproval?: boolean; reviewerMemberId?: string | null } = {}) =>
    render(
      <RecordsTable records={ALL} memberOptions={[]} certificateOptions={[]} studyCourses={[]} mode="team" canDelete={false} showCompanyFields reviewerMemberId="m-boss" {...props} />,
    );
  const menuOf = async (name: RegExp) => {
    await userEvent.click(screen.getByRole("button", { name }));
    return (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
  };

  it("filters to waiting items with a count, opens from the URL flag, and Clear filters resets it", async () => {
    view({ canReview: true });
    const button = screen.getByRole("button", { name: "Waiting for approval (1)" });
    expect(rowNames()).toHaveLength(4);
    await userEvent.click(button);
    expect(rowNames()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(4);
    cleanup();
    view({ canReview: true, initialApproval: true });
    expect(rowNames()).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("Waiting for approval");
  });

  it("keeps the Status dropdown and Waiting for approval button in sync without contradicting each other", async () => {
    view({ canReview: true, initialApproval: true });
    expect(rowNames()).toHaveLength(1);

    // Changing the Status dropdown to Approved clears waitingOnly instead of returning 0 rows.
    await userEvent.click(screen.getByRole("combobox", { name: "Status" }));
    await userEvent.click(await screen.findByRole("option", { name: "Approved" }));
    expect(rowNames()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Waiting for approval (1)" }).getAttribute("aria-pressed")).toBe("false");

    // Clicking Waiting for approval while Status is Approved overrides Status instead of returning 0 rows.
    await userEvent.click(screen.getByRole("button", { name: "Waiting for approval (1)" }));
    expect(rowNames()).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("Waiting for approval");

    // Turning it off resets Status to All statuses.
    await userEvent.click(screen.getByRole("button", { name: "Waiting for approval (1)" }));
    expect(rowNames()).toHaveLength(4);
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("All statuses");
  });

  it("pre-selects the Team dropdown from initialTeam and searches by certTypeName", () => {
    const teamRecords = [
      makeRecord({ id: "t1", memberName: "An", teamId: "cloud", teamName: "Team Cloud", certTypeName: "Cloud", certificateName: "AWS" }),
      makeRecord({ id: "t2", memberName: "Binh", teamId: "data", teamName: "Team Data", certTypeName: "Data", certificateName: "Snowflake" }),
      makeRecord({ id: "t3", memberName: "Chau", teamId: null, teamName: null, certTypeName: "Security", certificateName: "CISSP" }),
    ];
    render(
      <RecordsTable
        records={teamRecords}
        memberOptions={[]}
        certificateOptions={[]}
        studyCourses={[]}
        mode="team"
        canDelete={false}
        showCompanyFields
        initialTeam="Team Cloud"
      />,
    );
    expect(rowNames()).toEqual([expect.stringContaining("An")]);
    expect(screen.getByRole("combobox", { name: "Team" }).textContent).toContain("Team Cloud");

    cleanup();
    render(
      <RecordsTable
        records={teamRecords}
        memberOptions={[]}
        certificateOptions={[]}
        studyCourses={[]}
        mode="team"
        canDelete={false}
        showCompanyFields
        initialTeam="No team"
      />,
    );
    expect(rowNames()).toEqual([expect.stringContaining("Chau")]);

    cleanup();
    render(
      <RecordsTable
        records={teamRecords}
        memberOptions={[]}
        certificateOptions={[]}
        studyCourses={[]}
        mode="team"
        canDelete={false}
        showCompanyFields
        initialSearch="Security"
      />,
    );
    expect(rowNames()).toEqual([expect.stringContaining("Chau")]);
  });

  it("offers Approve and Return on another member's waiting item, Approve only on a returned one, nothing on approved", async () => {
    view({ canReview: true });
    expect(await menuOf(/Actions for Other Member · Waiting Exam/)).toEqual(expect.arrayContaining(["Approve No proof", "Return"]));
    await userEvent.keyboard("{Escape}");
    const returned = await menuOf(/Actions for Other Member · Returned Exam/);
    expect(returned.join("|")).toContain("Approve");
    expect(returned).not.toContain("Return");
    await userEvent.keyboard("{Escape}");
    expect((await menuOf(/Actions for Other Member · Approved Exam/)).join("|")).not.toContain("Approve");
  });

  it("a manager never reviews their own item", async () => {
    view({ canReview: true });
    const items = await menuOf(/Actions for The Boss · Own Exam/);
    expect(items.join("|")).not.toContain("Approve");
    expect(items).not.toContain("Return");
  });

  it("without canReview (a member) there is no filter and no review action", async () => {
    view({ canReview: false });
    expect(screen.queryByRole("button", { name: /Waiting for approval/ })).toBeNull();
    const items = await menuOf(/Actions for Other Member · Waiting Exam/);
    expect(items.join("|")).not.toContain("Approve");
    expect(items).not.toContain("Return");
  });

  it("Approve is one click with a toast", async () => {
    vi.mocked(reviewRecord).mockResolvedValue({ ok: true, data: null });
    view({ canReview: true });
    await menuOf(/Actions for Other Member · Waiting Exam/);
    await userEvent.click(screen.getByRole("menuitem", { name: /^Approve/ }));
    expect(reviewRecord).toHaveBeenCalledWith({ id: W1, decision: "approve" });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("Return needs a note: empty is refused with a message, a note is sent", async () => {
    vi.mocked(reviewRecord).mockClear();
    vi.mocked(reviewRecord).mockResolvedValue({ ok: true, data: null });
    view({ canReview: true });
    await menuOf(/Actions for Other Member · Waiting Exam/);
    await userEvent.click(screen.getByRole("menuitem", { name: "Return" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Return" }));
    expect(within(dialog).getByText("Write what the member should fix.")).toBeTruthy();
    expect(reviewRecord).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "What should the member fix?" }), "  Wrong date ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Return" }));
    expect(reviewRecord).toHaveBeenCalledWith({ id: W1, decision: "return", note: "Wrong date" });
  });
});

describe("RecordsTable member draft delete", () => {
  const DRAFT = makeRecord({ id: "d1", memberName: "Me", certificateName: "Draft Exam", status: "in_progress" });
  const RETURNED = makeRecord({ id: "d2", memberName: "Me", certificateName: "Returned Exam", status: "done", approval: "returned", approvalNote: "fix it" });
  const APPROVED = makeRecord({ id: "d3", memberName: "Me", certificateName: "Approved Exam", status: "done", approval: "approved" });

  const getMenu = async (name: RegExp) => {
    await userEvent.click(screen.getByRole("button", { name }));
    return (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
  };

  it("offers Delete in row menu for draft and returned records, but not for approved completed records, and no bulk checkboxes for members", async () => {
    render(
      <RecordsTable
        records={[DRAFT, RETURNED, APPROVED]}
        memberOptions={[]}
        certificateOptions={[]}
        studyCourses={[]}
        mode="self"
        canDelete={false}
        showCompanyFields={false}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: "Select all on this page" })).toBeNull();

    const draftMenu = await getMenu(/Actions for Me · Draft Exam/);
    expect(draftMenu).toContain("Delete");
    await userEvent.keyboard("{Escape}");

    const returnedMenu = await getMenu(/Actions for Me · Returned Exam/);
    expect(returnedMenu).toContain("Delete");
    await userEvent.keyboard("{Escape}");

    const approvedMenu = await getMenu(/Actions for Me · Approved Exam/);
    expect(approvedMenu).not.toContain("Delete");
  });

  it("asks a member to confirm before deleting their draft", async () => {
    render(<RecordsTable records={[DRAFT]} memberOptions={[]} certificateOptions={[]} studyCourses={[]} mode="self" canDelete={false} showCompanyFields={false} />);
    await getMenu(/Actions for Me · Draft Exam/);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByRole("alertdialog", { name: /Delete the Draft Exam/ })).toBeTruthy();
  });
});

describe("RecordsTable status of a certificate (decision #72)", () => {
  it("shows the approval state, not Completed or a progress", () => {
    render(table("self", [makeRecord({ id: "w1", certificateName: "Waiting Cert", approval: "waiting" })]));
    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell").map((cell) => cell.textContent ?? "");
    expect(cells.join("|")).toContain("Waiting for approval");
    expect(cells.join("|")).not.toContain("Completed");
  });

  it("filters by approval state", async () => {
    render(table("self", [
      makeRecord({ id: "a1", certificateName: "Approved Cert", approval: "approved" }),
      makeRecord({ id: "w1", certificateName: "Waiting Cert", approval: "waiting" }),
    ]));
    await userEvent.click(screen.getByRole("combobox", { name: "Status" }));
    await userEvent.click(await screen.findByRole("option", { name: "Waiting for approval" }));
    expect(rowNames()).toEqual([expect.stringContaining("Waiting Cert")]);
  });

  it("syncs initialView=waiting with Status dropdown and clears view when Status changes", async () => {
    render(
      <RecordsTable
        records={[
          makeRecord({ id: "a1", memberName: "Hidden Name", certificateName: "Approved Cert", approval: "approved" }),
          makeRecord({ id: "w1", memberName: "Hidden Name", certificateName: "Waiting Cert", approval: "waiting" }),
        ]}
        memberOptions={[]}
        certificateOptions={[]}
        studyCourses={[]}
        mode="self"
        canDelete={false}
        showCompanyFields={false}
        initialView="waiting"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("Waiting for approval");
    expect(rowNames()).toEqual([expect.stringContaining("Waiting Cert")]);

    await userEvent.click(screen.getByRole("combobox", { name: "Status" }));
    await userEvent.click(await screen.findByRole("option", { name: "Approved" }));
    expect(rowNames()).toEqual([expect.stringContaining("Approved Cert")]);
  });

  it("self mode search ignores hidden memberName", async () => {
    render(table("self", [makeRecord({ id: "a1", memberName: "Lê Minh Châu", certificateName: "AWS SAA" })]));
    await userEvent.type(screen.getByRole("searchbox"), "Chau");
    expect(screen.getByText("Nothing found")).toBeTruthy();
  });
});
