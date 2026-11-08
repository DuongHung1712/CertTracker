"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setMyCareerStart } from "@/features/career/actions";
import { CareerStartFields, NO_MONTH, toCareerStartInput, type CareerStartDraft } from "@/features/career/components/career-start-fields";
import { formatYoe } from "@/features/career/format";
import { dateToCareerStart } from "@/features/career/schema";

function toDraft(careerStart: string | null): CareerStartDraft {
  const { year, month } = dateToCareerStart(careerStart);
  return { year: year === null ? "" : String(year), month: month === null ? NO_MONTH : String(month) };
}

/** "My career" on /me: the role is read-only (the admin sets it); the member sets when they started working. */
export function CareerCard({
  roleName,
  careerStart,
  yoeYears,
}: {
  roleName: string | null;
  careerStart: string | null;
  yoeYears: number | null;
}) {
  const [draft, setDraft] = useState<CareerStartDraft>(() => toDraft(careerStart));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function save() {
    setError(undefined);
    setPending(true);
    const result = await setMyCareerStart(toCareerStartInput(draft));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Saved when you started working");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">My career</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-caption text-muted-foreground">Career role</dt>
            <dd data-testid="career-role">{roleName ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Years of experience</dt>
            <dd data-testid="career-yoe">{formatYoe(yoeYears)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium">Started working</p>
          <div className="flex flex-wrap items-start gap-3">
            <CareerStartFields idPrefix="career" value={draft} onChange={setDraft} error={error} disabled={pending} />
            <Button size="lg" className="mt-5" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
