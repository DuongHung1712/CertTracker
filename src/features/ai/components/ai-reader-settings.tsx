"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveAiReaderSettings } from "@/features/ai/actions";
import type { AiReaderSettings as Settings } from "@/features/ai/queries";

const PROVIDER_NOTE: Record<Settings["provider"], string> = {
  deepseek: "Provider: DeepSeek. Certificate files are sent to it to be read.",
  fake: "Provider: sample answers only (development). Nothing is sent anywhere.",
  "not-configured": "The AI provider is not configured, so members will not see the upload option until it is.",
};

/** Admin: switch the certificate reader on or off and set how many reads each member gets per day. */
export function AiReaderSettings({ settings }: { settings: Settings }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [limit, setLimit] = useState(String(settings.dailyLimit));
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await saveAiReaderSettings({ enabled, dailyLimit: limit });
    setPending(false);
    if (result.ok) toast.success(enabled ? "AI certificate reader is on" : "AI certificate reader is off");
    else toast.error(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">AI certificate reader</CardTitle>
        <CardDescription>
          Members can upload a certificate file and AI fills in the form. They check everything before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex max-w-md flex-col gap-4">
        <Field orientation="horizontal">
          <FieldLabel htmlFor="ai-reader-enabled">Let members use AI to fill in the form</FieldLabel>
          <Switch id="ai-reader-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ai-reader-limit">Reads per member per day</FieldLabel>
          <Input
            id="ai-reader-limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            className="h-9 w-32"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
          <FieldDescription>Every file a member chooses uses one read, also when it fails.</FieldDescription>
        </Field>
        <p className="text-caption text-muted-foreground">Reads today: {settings.callsToday}</p>
        <p className="text-caption text-muted-foreground">{PROVIDER_NOTE[settings.provider]}</p>
        <Button type="button" className="h-9 w-fit font-medium" disabled={pending} onClick={() => void save()}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
