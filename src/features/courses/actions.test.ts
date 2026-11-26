import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCourseWithCompletion } from "@/features/courses/actions";

type Reply = { data?: unknown; error: { code?: string; message: string } | null };
const replies: Record<string, Reply[]> = {};
const inserted: { table: string; values: unknown }[] = [];
const deletes: string[] = [];
const eqCalls: unknown[][] = [];

function chain(table: string) {
  const self: Record<string, unknown> = {};
  const next = () => Promise.resolve(replies[table]?.shift() ?? { data: null, error: null });
  self.insert = (values: unknown) => {
    inserted.push({ table, values });
    return self;
  };
  self.delete = () => {
    deletes.push(table);
    return self;
  };
  self.select = () => self;
  self.eq = (...args: unknown[]) => {
    eqCalls.push(args);
    return self;
  };
  self.single = next;
  self.then = (resolve: (reply: Reply) => unknown) => next().then(resolve);
  return self;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: chain }) }));

const ID = "00000000-0000-0000-0000-000000000001";
const input = {
  name: "Intro", providerId: ID, preparesForId: null, refundable: false, cost: null, costCurrency: null, estHours: null,
  url: "https://course.test", refundConditions: null, grantsCompletion: true, completionCertTypeId: ID, completionUrl: null, completionName: null,
};
const unique = { code: "23505", message: "dup" };

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key];
  inserted.length = 0;
  deletes.length = 0;
  eqCalls.length = 0;
});

describe("createCourseWithCompletion", () => {
  it("creates the course, then the completion named after it with the course link", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }];
    expect(await createCourseWithCompletion(input)).toEqual({ ok: true, data: null });
    expect(inserted[1]).toMatchObject({
      table: "certificates",
      values: { kind: "completion", name: "Intro", course_id: "course-1", validity_months: null, url: "https://course.test", cert_type_id: ID },
    });
  });

  it("deletes the new course when the completion fails and reports the duplicate message", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }, { error: null }];
    replies.certificates = [{ error: unique }];
    expect(await createCourseWithCompletion(input)).toEqual({
      ok: false,
      error: 'A course certificate named "Intro" already exists for this provider. Rename the course or give the course certificate a different name.',
    });
    expect(deletes).toEqual(["courses"]);
    expect(eqCalls).toEqual([["id", "course-1"]]);
  });

  it("names the clashing custom completion name, not the course name", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }, { error: null }];
    replies.certificates = [{ error: unique }];
    const result = await createCourseWithCompletion({ ...input, completionName: " AWS Exam " });
    expect(!result.ok && result.error).toContain('named "AWS Exam" already exists');
    expect(deletes).toEqual(["courses"]);
    expect(eqCalls).toEqual([["id", "course-1"]]);
  });

  it("uses the custom completion name when given", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }];
    expect(await createCourseWithCompletion({ ...input, completionName: "Intro badge" })).toEqual({ ok: true, data: null });
    expect(inserted[1]).toMatchObject({ table: "certificates", values: { name: "Intro badge" } });
  });

  it("words a stale type id instead of the delete message", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }, { error: null }];
    replies.certificates = [{ error: { code: "23503", message: "fk" } }];
    const result = await createCourseWithCompletion(input);
    expect(!result.ok && result.error).toContain("no longer exists");
  });

  it("names the orphan course when the cleanup fails too", async () => {
    replies.courses = [{ data: { id: "course-1" }, error: null }, { error: { message: "boom" } }];
    replies.certificates = [{ error: { message: "x" } }];
    const result = await createCourseWithCompletion(input);
    expect(!result.ok && result.error).toContain('The course "Intro" was added');
  });

  it("words a duplicate course and creates nothing else", async () => {
    replies.courses = [{ data: null, error: unique }];
    expect(await createCourseWithCompletion(input)).toEqual({ ok: false, error: 'A course named "Intro" already exists for this provider.' });
    expect(inserted).toHaveLength(1);
  });

  it("refuses a missing type before any query", async () => {
    expect(await createCourseWithCompletion({ ...input, completionCertTypeId: "" })).toEqual({ ok: false, error: "Type is required" });
    expect(inserted).toHaveLength(0);
  });
});
