"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveAiReaderSettings } from "@/features/ai/actions";
import type { AiReaderSettings as Settings } from "@/features/ai/queries";
import { aiReaderSettingsSchema } from "@/features/ai/schema";

const PROVIDER_NOTE: Record<Settings["provider"], string> = {
  deepseek: "Provider: DeepSeek. Certificate files are sent to it to be read.",
  fake: "Provider: sample answers only (development). Nothing is sent anywhere.",
  "not-configured": "The AI provider is not configured, so members will not see the upload option until it is.",
};

/** Admin: switch the certificate reader on or off and set how many reads each member gets per day. */
export function AiReaderSettings({ settings }: { settings: Settings }) {
  const [saved, setSaved] = useState({ enabled: settings.enabled, dailyLimit: String(settings.dailyLimit) });
  const [enabled, setEnabled] = useState(settings.enabled);
  const [limit, setLimit] = useState(String(settings.dailyLimit));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const dirty = enabled !== saved.enabled || limit.trim() !== saved.dailyLimit;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const parsed = aiReaderSettingsSchema.safeParse({ enabled, dailyLimit: limit });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid value");
      return;
    }
    setPending(true);
    const result = await saveAiReaderSettings({ enabled, dailyLimit: limit });
    setPending(false);
    if (result.ok) {
      setSaved({ enabled, dailyLimit: String(parsed.data.dailyLimit) });
      setLimit(String(parsed.data.dailyLimit));
      toast.success(enabled ? "AI certificate reader is on" : "AI certificate reader is off");
    } else {
      setError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">AI certificate reader</CardTitle>
        <CardDescription>
          Members can upload a certificate file and AI fills in the form. They check everything before saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-4">
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
              aria-invalid={!!error}
              onChange={(event) => {
                setLimit(event.target.value);
                if (error) setError(undefined);
              }}
            />
            <FieldDescription>Every file a member chooses uses one read, also when it fails.</FieldDescription>
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <p className="text-caption text-muted-foreground">Reads today: {settings.callsToday}</p>
          <p className="text-caption text-muted-foreground">{PROVIDER_NOTE[settings.provider]}</p>
          <Button type="submit" className="h-9 w-fit font-medium" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
