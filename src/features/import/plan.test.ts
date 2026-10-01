import { describe, expect, it } from "vitest";
import type { ImportTable, Cell } from "@/features/import/clean";
import { buildImportPlan, reconcileRecord, type ImportLookups } from "@/features/import/plan";
import { buildLegacyWorkbook, LEGACY_EXPECTED } from "@/features/import/__fixtures__/legacy-workbook";
import { readImportTable } from "@/features/import/workbook";

const TODAY = "2026-09-30";
const HEADERS = ["Họ tên", "Email", "Team", "Khóa học", "Nhà cung cấp", "Loại", "Thời hạn", "Trạng thái", "Tiến độ", "Ngày thi", "Ngày cấp", "Ghi chú"];

function table(rows: Cell[][], headers = HEADERS): ImportTable {
  const map = Object.fromEntries(
    headers.map((h, i) => [({ "Họ tên": "memberName", Email: "email", Team: "team", "Khóa học": "courseName", "Nhà cung cấp": "provider", Loại: "certType", "Thời hạn": "validityMonths", "Trạng thái": "status", "Tiến độ": "progress", "Ngày thi": "plannedExamDate", "Ngày cấp": "issuedDate", "Ghi chú": "notes" } as Record<string, string>)[h], i]),
  );
  return { sheetName: "S", headerRowNumber: 1, headers, map, unknownColumns: [], rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })), date1904: false };
}

const LOOKUPS: ImportLookups = {
  members: [
    { id: "m-an", email: "an@x.vn", fullName: "Nguyễn Văn An", teamId: "t-cloud", isActive: true },
    { id: "m-old", email: "old@x.vn", fullName: "Cũ", teamId: null, isActive: false },
  ],
  teams: [{ id: "t-cloud", name: "Team Cloud" }, { id: "t-ai", name: "Team AI" }, { id: "t-dup1", name: "Team X" }, { id: "t-dup2", name: "Team X" }],
  providers: [{ id: "p-aws", name: "AWS" }],
  certTypes: [{ id: "ct-cloud", name: "Cloud" }],
  courses: [
    { id: "c-saa", name: "AWS SAA", providerId: "p-aws", certTypeId: "ct-cloud", validityMonths: 36 },
    { id: "c-a", name: "Shared Name", providerId: "p-aws", certTypeId: null, validityMonths: null },
    { id: "c-b", name: "Shared Name", providerId: "p-other", certTypeId: null, validityMonths: null },
  ],
  records: [
    { id: "r-1", memberId: "m-an", courseId: "c-saa", status: "in_progress", progress: 40, plannedExamDate: "2026-12-01", issuedDate: null, certificateUrl: null, viaCompany: false, refundStatus: "n_a", notes: "cũ" },
  ],
};

const row = (overrides: Partial<Record<string, Cell>>): Cell[] => {
  const base: Record<string, Cell> = { "Họ tên": "Nguyễn Văn An", Email: "an@x.vn", Team: "Team Cloud", "Khóa học": "AWS SAA", "Nhà cung cấp": "AWS", Loại: null, "Thời hạn": null, "Trạng thái": "Đang học", "Tiến độ": 50, "Ngày thi": null, "Ngày cấp": null, "Ghi chú": null, ...overrides };
  return HEADERS.map((h) => base[h] ?? null);
};

describe("buildImportPlan", () => {
  it("updates an existing record and keeps blanks as 'not provided'", () => {
    const [planned] = buildImportPlan(table([row({})]), LOOKUPS, TODAY).rows;
    expect(planned!.action).toBe("update");
    expect(planned!.normalized!.member).toEqual({ id: "m-an" });
    expect(planned!.normalized!.course).toEqual({ id: "c-saa" });
    expect(planned!.normalized!.record).toMatchObject({ status: "in_progress", progress: 50, plannedExamDate: null, notes: null });
  });

  it("marks a row identical to the database as unchanged (skip without errors)", () => {
    const [planned] = buildImportPlan(table([row({ "Tiến độ": 40 })]), LOOKUPS, TODAY).rows;
    expect(planned).toMatchObject({ action: "skip", errors: [] });
  });

  it("creates a new member, provider, cert type and course, deduplicated by folded name", () => {
    const plan = buildImportPlan(
      table([
        row({ "Họ tên": "Hà", Email: "ha@x.vn", Team: "team ai", "Khóa học": "Azure  Fundamentals", "Nhà cung cấp": "Microsoft", Loại: "Security", "Thời hạn": "24 tháng" }),
        row({ "Họ tên": "Hà", Email: "HA@X.VN", "Khóa học": "azure fundamentals ", "Nhà cung cấp": "microsoft", Loại: "security", "Trạng thái": "xong", "Tiến độ": 100, "Ngày cấp": "01/08/2025", Team: "Team AI" }),
      ]),
      LOOKUPS,
      TODAY,
    );
    expect(plan.rows.map((r) => r.action)).toEqual(["create", "skip"]);
    expect(plan.rows[1]!.errors[0]).toMatch(/Trùng với dòng 2/);
    expect(plan.rows[0]!.normalized!.member).toEqual({ email: "ha@x.vn", fullName: "Hà", teamId: "t-ai" });
    expect(plan.rows[0]!.normalized!.course).toEqual({ name: "Azure Fundamentals", provider: { name: "Microsoft" }, certType: { name: "Security" }, validityMonths: 24 });
    expect(plan.newEntities).toEqual({ members: ["Hà"], providers: ["Microsoft"], certTypes: ["Security"], courses: ["Azure Fundamentals"] });
  });

  it("reuses a new member's first-row name and team, with a warning when later rows disagree", () => {
    const plan = buildImportPlan(
      table([
        row({ "Họ tên": "Hà", Email: "ha@x.vn", Team: "Team AI", "Khóa học": "AWS SAA" }),
        row({ "Họ tên": "Thu Hà", Email: "ha@x.vn", Team: "Team AI", "Khóa học": "New Course", "Nhà cung cấp": "AWS" }),
      ]),
      LOOKUPS,
      TODAY,
    );
    expect(plan.rows[1]!.normalized!.member).toEqual({ email: "ha@x.vn", fullName: "Hà", teamId: "t-ai" });
    expect(plan.rows[1]!.warnings.join()).toMatch(/dòng 2/);
  });

  it("errors on unknown or ambiguous teams for new members, and on missing names", () => {
    const rows = buildImportPlan(
      table([
        row({ Email: "a@x.vn", Team: "Team Ghost" }),
        row({ Email: "b@x.vn", Team: "Team X" }),
        row({ Email: "c@x.vn", "Họ tên": null }),
      ]),
      LOOKUPS,
      TODAY,
    ).rows;
    expect(rows[0]!.errors.join()).toMatch(/Không tìm thấy team "Team Ghost"/);
    expect(rows[1]!.errors.join()).toMatch(/Có nhiều team tên "Team X"/);
    expect(rows[2]!.errors.join()).toMatch(/Thiếu họ tên/);
  });

  it("never moves or renames an existing member, but warns", () => {
    const [planned] = buildImportPlan(table([row({ "Họ tên": "An Nguyễn", Team: "Team AI" })]), LOOKUPS, TODAY).rows;
    expect(planned!.normalized!.member).toEqual({ id: "m-an" });
    expect(planned!.warnings.join()).toMatch(/giữ tên hiện có/);
    expect(planned!.warnings.join()).toMatch(/không chuyển team/);
  });

  it("warns for an inactive member but still imports", () => {
    const [planned] = buildImportPlan(table([row({ Email: "old@x.vn", "Họ tên": "Cũ" })]), LOOKUPS, TODAY).rows;
    expect(planned!.action).toBe("create");
    expect(planned!.warnings.join()).toMatch(/ngừng hoạt động/);
  });

  it("needs a provider to disambiguate or to create a course", () => {
    const rows = buildImportPlan(
      table([row({ "Khóa học": "Shared Name", "Nhà cung cấp": null }), row({ "Khóa học": "Brand New", "Nhà cung cấp": null }), row({ "Khóa học": "aws saa", "Nhà cung cấp": null })]),
      LOOKUPS,
      TODAY,
    ).rows;
    expect(rows[0]!.errors.join()).toMatch(/Có nhiều khóa học tên/);
    expect(rows[1]!.errors.join()).toMatch(/cần Nhà cung cấp/);
    expect(rows[2]!.normalized!.course).toEqual({ id: "c-saa" });
  });

  it("collects every cell error of a row, not just the first", () => {
    const [planned] = buildImportPlan(table([row({ "Trạng thái": "Failed", "Ngày thi": "31/02/2026", "Tiến độ": 150 })]), LOOKUPS, TODAY).rows;
    expect(planned!.action).toBe("skip");
    expect(planned!.errors).toHaveLength(3);
  });

  it("uses fraction mode for the whole column and says so in the notes", () => {
    const plan = buildImportPlan(table([row({ "Tiến độ": 0.5 }), row({ Email: "x@x.vn", "Họ tên": "X", "Tiến độ": 1, "Trạng thái": "Đang học" })]), LOOKUPS, TODAY);
    expect(plan.rows[0]!.normalized!.record.progress).toBe(50);
    expect(plan.notes.join()).toMatch(/0–1/);
  });

  it("keeps raw cells and display fields for the preview, even on error rows", () => {
    const [planned] = buildImportPlan(table([row({ "Trạng thái": "Failed" })]), LOOKUPS, TODAY).rows;
    expect(planned!.raw.email).toBe("an@x.vn");
    expect(planned!.raw.course).toBe("AWS SAA");
    expect(planned!.raw.cells["Trạng thái"]).toBe("Failed");
  });
});

describe("buildImportPlan edge cases", () => {
  it("creates a new course under the given provider when the name only exists under another provider", () => {
    const lookups: ImportLookups = { ...LOOKUPS, providers: [...LOOKUPS.providers, { id: "p-ms", name: "Microsoft" }] };
    const [planned] = buildImportPlan(table([row({ "Khóa học": "aws saa", "Nhà cung cấp": "Microsoft" })]), lookups, TODAY).rows;
    expect(planned!.errors).toEqual([]);
    expect(planned!.action).toBe("create");
    expect(planned!.normalized!.course).toEqual({ name: "aws saa", provider: { id: "p-ms" }, certType: null, validityMonths: null });
  });

  it("warns, but does not move, when an existing member without a team has a team in the file", () => {
    const [planned] = buildImportPlan(table([row({ Email: "old@x.vn", "Họ tên": "Cũ", Team: "Team Cloud" })]), LOOKUPS, TODAY).rows;
    expect(planned!.normalized!.member).toEqual({ id: "m-old" });
    expect(planned!.warnings.join()).toMatch(/không chuyển team/);
  });

  it("does not warn about the team when it matches the member's current team", () => {
    const [planned] = buildImportPlan(table([row({})]), LOOKUPS, TODAY).rows;
    expect(planned!.warnings.join()).not.toMatch(/team/i);
  });

  it("reads Excel-serial dates with the workbook's date system", () => {
    const serialRow = row({ "Ngày thi": 45000 });
    const [plan1900] = buildImportPlan(table([serialRow]), LOOKUPS, TODAY).rows;
    expect(plan1900!.normalized!.record.plannedExamDate).toBe("2023-03-15");
    const [plan1904] = buildImportPlan({ ...table([serialRow]), date1904: true }, LOOKUPS, TODAY).rows;
    expect(plan1904!.normalized!.record.plannedExamDate).toBe("2027-03-16");
    const [issued] = buildImportPlan(table([row({ "Trạng thái": "xong", "Tiến độ": 100, "Ngày cấp": 45000 })]), LOOKUPS, TODAY).rows;
    expect(issued!.normalized!.record).toMatchObject({ status: "done", progress: 100, issuedDate: "2023-03-15" });
  });

  it("warns when the same new course is defined twice with different validity, and keeps the first definition", () => {
    const rows = buildImportPlan(
      table([
        row({ "Khóa học": "Brand New", "Thời hạn": 12 }),
        row({ Email: "old@x.vn", "Họ tên": "Cũ", "Khóa học": "brand  new", "Thời hạn": 24 }),
      ]),
      LOOKUPS,
      TODAY,
    ).rows;
    expect(rows[0]!.normalized!.course).toEqual({ name: "Brand New", provider: { id: "p-aws" }, certType: null, validityMonths: 12 });
    expect(rows[1]!.normalized!.course).toEqual(rows[0]!.normalized!.course);
    expect(rows[1]!.warnings.join()).toMatch(/Thời hạn/);
  });

  it("warns when a non-blank cert type or validity differs from an existing course, and keeps the catalog", () => {
    const [planned] = buildImportPlan(table([row({ Loại: "AI", "Thời hạn": 12 })]), LOOKUPS, TODAY).rows;
    expect(planned!.normalized!.course).toEqual({ id: "c-saa" });
    expect(planned!.warnings.join()).toMatch(/Loại chứng chỉ trong file khác danh mục/);
    expect(planned!.warnings.join()).toMatch(/Thời hạn trong file khác danh mục/);
    const [same] = buildImportPlan(table([row({ Loại: "cloud", "Thời hạn": 36 })]), LOOKUPS, TODAY).rows;
    expect(same!.warnings.join()).not.toMatch(/khác danh mục/);
  });

  it("refers to Excel row numbers, never array indexes", () => {
    const t = table([
      row({ "Họ tên": "Hà", Email: "ha@x.vn", Team: "Team AI" }),
      row({ "Họ tên": "Hà", Email: "ha@x.vn", Team: "Team AI" }),
      row({ Email: "zzz", "Họ tên": "Z" }),
    ]);
    t.rows[0]!.rowNumber = 10;
    t.rows[1]!.rowNumber = 14;
    t.rows[2]!.rowNumber = 20;
    const plan = buildImportPlan(t, LOOKUPS, TODAY);
    expect(plan.rows.map((r) => r.rowNumber)).toEqual([10, 14, 20]);
    expect(plan.rows[1]!.errors[0]).toMatch(/Trùng với dòng 10 /);
  });

  it("reports the sheet and unused columns in the notes", () => {
    const t = { ...table([row({})]), unknownColumns: ["STT", "Ảnh"] };
    const notes = buildImportPlan(t, LOOKUPS, TODAY).notes;
    expect(notes[0]).toBe('Sheet "S", tiêu đề ở dòng 1.');
    expect(notes.join()).toMatch(/Bỏ qua các cột không dùng: STT, Ảnh\./);
  });

  it("applies decision #22 inside a plan: 100% without an issue date is capped at 99% with a warning", () => {
    const [planned] = buildImportPlan(table([row({ "Tiến độ": 100, "Trạng thái": "Đang học" })]), LOOKUPS, TODAY).rows;
    expect(planned!.normalized!.record).toMatchObject({ status: "in_progress", progress: 99 });
    expect(planned!.warnings.length).toBeGreaterThan(0);
  });
});

describe("commit_import safety of emitted records", () => {
  const doneInDb: ImportLookups["records"][number] = {
    id: "r-done", memberId: "m-an", courseId: "c-saa", status: "done", progress: 100, plannedExamDate: null,
    issuedDate: "2023-10-26", certificateUrl: null, viaCompany: false, refundStatus: "n_a", notes: "cũ",
  };
  const withRecord = (record: ImportLookups["records"][number] | null): ImportLookups => ({ ...LOOKUPS, records: record ? [record] : [] });

  it("emits the database issue date for a done update whose file has no issue date (CHECK runs before ON CONFLICT)", () => {
    const [planned] = buildImportPlan(table([row({ "Trạng thái": "Hoàn thành", "Tiến độ": 100, "Ngày cấp": null, "Ghi chú": "mới" })]), withRecord(doneInDb), TODAY).rows;
    expect(planned!.errors).toEqual([]);
    expect(planned!.action).toBe("update");
    expect(planned!.normalized!.record).toMatchObject({ status: "done", progress: 100, issuedDate: "2023-10-26", notes: "mới" });
  });

  it("does the same when status and progress are both blank and the existing record is done", () => {
    const [planned] = buildImportPlan(table([row({ "Trạng thái": null, "Tiến độ": null, "Ngày cấp": null, "Ghi chú": "mới" })]), withRecord(doneInDb), TODAY).rows;
    expect(planned!.errors).toEqual([]);
    expect(planned!.action).toBe("update");
    expect(planned!.normalized!.record).toMatchObject({ status: "done", progress: 100, issuedDate: "2023-10-26" });
  });

  it("still treats such a row as unchanged when nothing else differs", () => {
    const [planned] = buildImportPlan(table([row({ "Trạng thái": "Hoàn thành", "Tiến độ": 100, "Ghi chú": "cũ" })]), withRecord(doneInDb), TODAY).rows;
    expect(planned).toMatchObject({ action: "skip", errors: [] });
  });

  it("never emits a record that violates the done / not_started / in_progress CHECK constraints", () => {
    const statuses: Cell[] = [null, "Hoàn thành", "Đang học", "Chưa bắt đầu"];
    const progresses: Cell[] = [null, 0, 50, 99, 100];
    const issued: Cell[] = [null, "01/01/2025"];
    const existings = [
      null,
      doneInDb,
      { ...doneInDb, id: "r-ip", status: "in_progress" as const, progress: 40, issuedDate: null },
      { ...doneInDb, id: "r-ns", status: "not_started" as const, progress: 0, issuedDate: null },
    ];
    let checked = 0;
    for (const existing of existings) {
      for (const status of statuses) {
        for (const progress of progresses) {
          for (const date of issued) {
            const [planned] = buildImportPlan(table([row({ "Trạng thái": status, "Tiến độ": progress, "Ngày cấp": date, "Ghi chú": "mới" })]), withRecord(existing), TODAY).rows;
            if (planned!.errors.length > 0) continue;
            const { status: s, progress: p, issuedDate } = planned!.normalized!.record;
            const label = JSON.stringify({ existing: existing?.id, status, progress, date });
            expect(s !== "done" || (p === 100 && issuedDate !== null), label).toBe(true);
            expect(s !== "not_started" || p === 0, label).toBe(true);
            expect(s !== "in_progress" || p <= 99, label).toBe(true);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe("notes keep their line breaks", () => {
  it("treats a multi-line note identical to the database as unchanged", () => {
    const lookups: ImportLookups = { ...LOOKUPS, records: [{ ...LOOKUPS.records[0]!, notes: "dòng 1\ndòng 2" }] };
    const [planned] = buildImportPlan(table([row({ "Tiến độ": 40, "Ghi chú": "dòng 1\r\ndòng 2" })]), lookups, TODAY).rows;
    expect(planned).toMatchObject({ action: "skip", errors: [] });
  });
});

describe("reconcileRecord (decision #22)", () => {
  const none = null;
  it("derives status from progress and progress from status", () => {
    expect(reconcileRecord({ status: null, progress: 0, issuedDate: null }, none, TODAY)).toMatchObject({ status: "not_started", progress: 0, errors: [] });
    expect(reconcileRecord({ status: null, progress: 30, issuedDate: null }, none, TODAY)).toMatchObject({ status: "in_progress", progress: 30 });
    expect(reconcileRecord({ status: "done", progress: null, issuedDate: "2025-01-01" }, none, TODAY)).toMatchObject({ status: "done", progress: 100, errors: [] });
    expect(reconcileRecord({ status: "not_started", progress: null, issuedDate: null }, none, TODAY)).toMatchObject({ progress: 0 });
  });
  it("lets status win, with a warning", () => {
    const done = reconcileRecord({ status: "done", progress: 80, issuedDate: "2025-01-01" }, none, TODAY);
    expect(done).toMatchObject({ status: "done", progress: 100 });
    expect(done.warnings).toHaveLength(1);
    expect(reconcileRecord({ status: "not_started", progress: 30, issuedDate: null }, none, TODAY)).toMatchObject({ status: "in_progress", progress: 30 });
  });
  it("handles 100% without done", () => {
    expect(reconcileRecord({ status: "in_progress", progress: 100, issuedDate: "2025-01-01" }, none, TODAY)).toMatchObject({ status: "done", progress: 100 });
    expect(reconcileRecord({ status: "in_progress", progress: 100, issuedDate: null }, none, TODAY)).toMatchObject({ status: "in_progress", progress: 99 });
  });
  it("counts the existing issue date when 100% arrives with in_progress", () => {
    const existing = { id: "r", memberId: "m", courseId: "c", status: "done" as const, progress: 100, plannedExamDate: null, issuedDate: "2024-05-01", certificateUrl: null, viaCompany: false, refundStatus: "n_a" as const, notes: null };
    const result = reconcileRecord({ status: "in_progress", progress: 100, issuedDate: null }, existing, TODAY);
    expect(result).toMatchObject({ status: "done", progress: 100, errors: [] });
    expect(result.warnings).toHaveLength(1);
  });
  it("keeps an existing in-progress value when the file has no progress", () => {
    const existing = { id: "r", memberId: "m", courseId: "c", status: "in_progress" as const, progress: 40, plannedExamDate: null, issuedDate: null, certificateUrl: null, viaCompany: false, refundStatus: "n_a" as const, notes: null };
    expect(reconcileRecord({ status: "in_progress", progress: null, issuedDate: null }, existing, TODAY)).toMatchObject({ progress: 40 });
    expect(reconcileRecord({ status: null, progress: null, issuedDate: null }, existing, TODAY)).toMatchObject({ status: "in_progress", progress: 40, errors: [] });
  });
  it("errors when nothing can be derived, when done lacks an issue date, or when it is in the future", () => {
    expect(reconcileRecord({ status: null, progress: null, issuedDate: null }, none, TODAY).errors).toEqual(["Thiếu trạng thái và tiến độ"]);
    expect(reconcileRecord({ status: "done", progress: 100, issuedDate: null }, none, TODAY).errors).toEqual(["Hoàn thành thì cần ngày cấp"]);
    expect(reconcileRecord({ status: "done", progress: 100, issuedDate: "2027-01-01" }, none, TODAY).errors).toEqual(["Ngày cấp không được ở tương lai"]);
  });
  it("accepts a done record whose issue date already exists in the database", () => {
    const existing = { id: "r", memberId: "m", courseId: "c", status: "done" as const, progress: 100, plannedExamDate: null, issuedDate: "2024-05-01", certificateUrl: null, viaCompany: false, refundStatus: "n_a" as const, notes: null };
    expect(reconcileRecord({ status: "done", progress: 100, issuedDate: null }, existing, TODAY).errors).toEqual([]);
  });
});

it("produces the documented plan for the legacy fixture against seed-like lookups", () => {
  const seed: ImportLookups = {
    members: [
      { id: "an", email: "an@certtracker.test", fullName: "Nguyễn Văn An", teamId: "cloud", isActive: true },
      { id: "binh", email: "binh@certtracker.test", fullName: "Trần Thị Bình", teamId: "ai", isActive: true },
      { id: "chau", email: "member@certtracker.test", fullName: "Lê Minh Châu", teamId: "cloud", isActive: true },
    ],
    teams: [{ id: "cloud", name: "Team Cloud" }, { id: "ai", name: "Team AI" }],
    providers: [{ id: "aws", name: "AWS" }, { id: "nvidia", name: "NVIDIA" }],
    certTypes: [{ id: "tc", name: "Cloud" }, { id: "tai", name: "AI" }],
    courses: [
      { id: "saa", name: "AWS Solutions Architect Associate", providerId: "aws", certTypeId: "tc", validityMonths: 36 },
      { id: "nv", name: "NVIDIA Generative AI LLMs", providerId: "nvidia", certTypeId: "tai", validityMonths: 24 },
    ],
    records: [
      { id: "r1", memberId: "an", courseId: "saa", status: "done", progress: 100, plannedExamDate: null, issuedDate: "2023-10-26", certificateUrl: null, viaCompany: false, refundStatus: "n_a", notes: null },
      { id: "r2", memberId: "binh", courseId: "nv", status: "in_progress", progress: 40, plannedExamDate: "2026-10-20", issuedDate: null, certificateUrl: null, viaCompany: false, refundStatus: "n_a", notes: null },
      { id: "r3", memberId: "chau", courseId: "saa", status: "not_started", progress: 0, plannedExamDate: null, issuedDate: null, certificateUrl: null, viaCompany: false, refundStatus: "n_a", notes: null },
    ],
  };
  const read = readImportTable(buildLegacyWorkbook());
  if (!read.ok) throw new Error(read.error);
  const plan = buildImportPlan(read.value, seed, TODAY);
  const rowsWith = (predicate: (r: (typeof plan.rows)[number]) => boolean) => plan.rows.filter(predicate).map((r) => r.rowNumber);
  expect(rowsWith((r) => r.action === "create")).toEqual(LEGACY_EXPECTED.create);
  expect(rowsWith((r) => r.action === "update")).toEqual(LEGACY_EXPECTED.update);
  expect(rowsWith((r) => r.errors.length > 0)).toEqual(LEGACY_EXPECTED.error);
  expect(plan.newEntities).toEqual({
    members: LEGACY_EXPECTED.newMembers,
    providers: LEGACY_EXPECTED.newProviders,
    certTypes: LEGACY_EXPECTED.newCertTypes,
    courses: LEGACY_EXPECTED.newCourses,
  });
});
