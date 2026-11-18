"use client";

import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { proposeCertificate } from "@/features/certificates/actions";
import {
  proposeCertificateSchema,
  type CertificateKind,
  type ProposeCertificateFormInput,
  type ProposeCertificateInput,
} from "@/features/certificates/schema";
import type { CertificateChoice } from "@/features/records/certificate-course";

const OTHER_PROVIDER_VALUE = "__new_provider__";

export function ProposeCertificateDialog({
  open,
  onOpenChange,
  defaultKind = "exam",
  defaultName = "",
  providers = [],
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: CertificateKind;
  defaultName?: string;
  providers?: { id: string; name: string }[];
  onSuccess: (choice: CertificateChoice) => void;
}) {
  const defaultProviderId = providers.length > 0 ? providers[0].id : null;
  const form = useForm<ProposeCertificateFormInput, unknown, ProposeCertificateInput>({
    resolver: zodResolver(proposeCertificateSchema),
    defaultValues: {
      name: defaultName,
      kind: defaultKind,
      providerId: defaultProviderId,
      proposedProvider: defaultProviderId ? null : "",
      url: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultName,
        kind: defaultKind,
        providerId: defaultProviderId,
        proposedProvider: defaultProviderId ? null : "",
        url: "",
        reason: "",
      });
    }
  }, [open, defaultName, defaultKind, defaultProviderId, form]);

  const selectedProviderId = useWatch({ control: form.control, name: "providerId" });
  const providerChoice = selectedProviderId ?? OTHER_PROVIDER_VALUE;

  async function onSubmit(values: ProposeCertificateInput) {
    const result = await proposeCertificate(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }

    toast.success(`Proposed "${values.name}". You can now complete the item details.`);
    onSuccess(result.data);
    onOpenChange(false);
  }

  const kind = useWatch({ control: form.control, name: "kind" }) ?? "exam";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-section-title">
            {kind === "exam" ? "Propose a new certificate" : "Propose a new course completion"}
          </DialogTitle>
          <DialogDescription>
            Can&apos;t find yours in the catalogue? Propose it here so you can add your learning item immediately while waiting for admin review.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={(val) => field.onChange(val as CertificateKind)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="exam">Exam certificate</TabsTrigger>
                    <TabsTrigger value="completion">Course completion</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="propose-name">
              {kind === "exam" ? "Certificate name" : "Course completion name"}
            </FieldLabel>
            <Input
              id="propose-name"
              placeholder={kind === "exam" ? "e.g. Google Cloud Certified Associate Cloud Engineer" : "e.g. Machine Learning with Python"}
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="propose-provider-select">Provider</FieldLabel>
            <Select
              value={providerChoice}
              onValueChange={(val) => {
                if (!val) return;
                if (val === OTHER_PROVIDER_VALUE) {
                  form.setValue("providerId", null);
                  form.setValue("proposedProvider", "");
                } else {
                  form.setValue("providerId", val);
                  form.setValue("proposedProvider", null);
                }
              }}
            >
              <SelectTrigger id="propose-provider-select" className="w-full">
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_PROVIDER_VALUE}>+ Other / New provider</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {providerChoice === OTHER_PROVIDER_VALUE && (
            <Field>
              <FieldLabel htmlFor="propose-new-provider">Provider name</FieldLabel>
              <Input
                id="propose-new-provider"
                placeholder="e.g. Coursera, edX, Databricks"
                {...form.register("proposedProvider")}
                aria-invalid={!!form.formState.errors.proposedProvider}
              />
              <FieldError errors={[form.formState.errors.proposedProvider]} />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="propose-url">Course or exam URL</FieldLabel>
            <Input
              id="propose-url"
              placeholder="https://..."
              {...form.register("url")}
              aria-invalid={!!form.formState.errors.url}
            />
            <FieldDescription>Link to the official certificate or course page.</FieldDescription>
            <FieldError errors={[form.formState.errors.url]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="propose-reason">Reason / Notes</FieldLabel>
            <Textarea
              id="propose-reason"
              placeholder="Why should this be added? (e.g. Needed for Cloud Architect certification path)"
              rows={2}
              {...form.register("reason")}
              aria-invalid={!!form.formState.errors.reason}
            />
            <FieldError errors={[form.formState.errors.reason]} />
          </Field>

          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting…" : "Propose & select"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
